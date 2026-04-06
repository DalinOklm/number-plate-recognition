from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path
from typing import List

import cv2
from ultralytics import YOLO


LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class PlateDetection:
    """One detected license plate region."""

    bbox: tuple[int, int, int, int]
    confidence: float
    crop: cv2.typing.MatLike


@dataclass(slots=True)
class NamedPlateDetection:
    model_name: str
    detection: PlateDetection


class LicensePlateDetector:
    """Wrapper around a YOLO detector trained specifically for license plates."""

    def __init__(self, model_path: Path, confidence_threshold: float) -> None:
        if not model_path.exists():
            raise FileNotFoundError(
                "License plate detector weights were not found at "
                f"'{model_path}'. Train or download a YOLO model that detects "
                "license plates and place it at this path."
            )

        self.model = YOLO(str(model_path))
        self.confidence_threshold = confidence_threshold
        LOGGER.info("Loaded license plate YOLO model from %s", model_path)

    def detect(self, image: cv2.typing.MatLike) -> List[PlateDetection]:
        """Return cropped license plate detections for one image."""
        predictions = self.model.predict(
            source=image,
            conf=self.confidence_threshold,
            verbose=False,
        )

        detections: List[PlateDetection] = []
        image_height, image_width = image.shape[:2]

        for prediction in predictions:
            boxes = prediction.boxes
            if boxes is None:
                continue

            xyxy_values = boxes.xyxy.cpu().tolist()
            confidence_values = boxes.conf.cpu().tolist()

            for xyxy, confidence in zip(xyxy_values, confidence_values):
                x1, y1, x2, y2 = [int(value) for value in xyxy]
                x1 = max(0, min(x1, image_width - 1))
                y1 = max(0, min(y1, image_height - 1))
                x2 = max(0, min(x2, image_width))
                y2 = max(0, min(y2, image_height))

                if x2 <= x1 or y2 <= y1:
                    continue

                crop = image[y1:y2, x1:x2].copy()
                if crop.size == 0:
                    continue

                detections.append(
                    PlateDetection(
                        bbox=(x1, y1, x2, y2),
                        confidence=float(confidence),
                        crop=crop,
                    )
                )

        LOGGER.debug("YOLO returned %d plate detections", len(detections))
        return detections


class MultiModelLicensePlateDetector:
    """Run multiple YOLO plate detectors for side-by-side comparison."""

    def __init__(self, model_configs: list[tuple[str, Path]], confidence_threshold: float) -> None:
        self.detectors = {
            model_name: LicensePlateDetector(model_path, confidence_threshold)
            for model_name, model_path in model_configs
        }

    def detect(self, image: cv2.typing.MatLike) -> list[NamedPlateDetection]:
        """Return the top detection for each loaded model."""
        model_detections: list[NamedPlateDetection] = []
        for model_name, detector in self.detectors.items():
            detections = detector.detect(image)
            if not detections:
                LOGGER.info("Model %s found no license plates", model_name)
                continue

            best_detection = max(detections, key=lambda item: item.confidence)
            model_detections.append(
                NamedPlateDetection(model_name=model_name, detection=best_detection)
            )
            LOGGER.info(
                "Model %s selected bbox=%s confidence=%.4f",
                model_name,
                best_detection.bbox,
                best_detection.confidence,
            )

        return model_detections
