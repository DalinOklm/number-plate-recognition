from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path
from typing import List

import cv2
import numpy as np

from .config import ANPRConfig
from .detection import MultiModelLicensePlateDetector, NamedPlateDetection
from .ocr import OCRPassResult, OCRResult, PlateOCR
from .preprocessing import PreprocessedPlate, preprocess_plate_image


SUPPORTED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class PlateDetectionResult:
    model_name: str
    raw_bbox: tuple[int, int, int, int]
    bbox: tuple[int, int, int, int]
    yolo_confidence: float
    text: str
    ocr_confidence: float | None
    quality_score: int
    is_low_confidence: bool
    comparison_score: float
    processed_plate_path: str
    preprocess_variant_paths: dict[str, str]
    ocr_pass_results: List[OCRPassResult]


@dataclass(slots=True)
class ImageResult:
    image_path: Path
    detections: List[PlateDetectionResult]
    best_model_name: str | None


class ANPRPipeline:
    """End-to-end detector + preprocessor + OCR pipeline."""

    def __init__(self, config: ANPRConfig) -> None:
        self.config = config
        self.detector = MultiModelLicensePlateDetector(
            model_configs=[
                ("Model1", config.detector_model_v1_path),
                ("Model2", config.detector_model_v2_path),
            ],
            confidence_threshold=config.detection_confidence,
        )
        self.ocr = PlateOCR(config.ocr_languages)

    def process_directory(self, input_dir: Path | None = None) -> List[ImageResult]:
        """Process all supported images in a directory."""
        directory = input_dir or self.config.input_dir
        LOGGER.info("Reading test images from %s", directory)
        image_paths = sorted(
            path
            for path in directory.iterdir()
            if path.is_file() and path.suffix.lower() in SUPPORTED_IMAGE_SUFFIXES
        )
        if self.config.focus_image_name:
            image_paths = [
                path for path in image_paths if path.name == self.config.focus_image_name
            ]
        LOGGER.info("Found %d supported images for ANPR", len(image_paths))
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        annotated_dir = self.config.output_dir / "annotated"
        processed_dir = self.config.output_dir / "processed_plates"
        annotated_dir.mkdir(parents=True, exist_ok=True)
        processed_dir.mkdir(parents=True, exist_ok=True)

        image_results: List[ImageResult] = []
        for image_path in image_paths:
            image_result = self.process_image(image_path)
            image_results.append(image_result)
            if self.config.enable_process_trace:
                trace_path = self.save_process_trace(
                    image_result=image_result,
                    trace_dir=self.config.output_dir,
                )
                if trace_path is not None and self.config.enable_visualization:
                    if not self.show_trace_image(trace_path, image_path.name):
                        LOGGER.info("Trace visualization interrupted by user request")
                        break
            if self.config.enable_visualization:
                if not self.visualize_result(
                    image_result=image_result,
                    annotated_dir=annotated_dir,
                ):
                    LOGGER.info("Visualization interrupted by user request")
                    break
            else:
                self.save_annotated_image(
                    image_result=image_result,
                    annotated_dir=annotated_dir,
                )

        if self.config.enable_visualization:
            cv2.destroyAllWindows()
        return image_results

    def process_image(self, image_path: Path) -> ImageResult:
        """Process one image and return all recognized license plates."""
        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError(f"Unable to read image: {image_path}")
        LOGGER.info("Loaded image successfully: %s shape=%s", image_path, image.shape)

        raw_detections = self.detector.detect(image)
        LOGGER.info(
            "Detected %d model outputs in %s",
            len(raw_detections),
            image_path.name,
        )
        plate_results: List[PlateDetectionResult] = []
        processed_dir = self.config.output_dir / "processed_plates"
        processed_dir.mkdir(parents=True, exist_ok=True)
        for index, named_detection in enumerate(raw_detections, start=1):
            detection = named_detection.detection
            crop_bbox = self._shrink_bbox(detection.bbox, image.shape)
            LOGGER.debug(
                "Detection %d model=%s bbox=%s shrunk_bbox=%s confidence=%.4f",
                index,
                named_detection.model_name,
                detection.bbox,
                crop_bbox,
                detection.confidence,
            )
            x1, y1, x2, y2 = crop_bbox
            cropped_plate = image[y1:y2, x1:x2].copy()
            if cropped_plate.size == 0:
                LOGGER.debug("Skipping detection %d because shrunk crop is empty", index)
                continue
            processed_plate: PreprocessedPlate = preprocess_plate_image(
                cropped_plate,
                block_size=self.config.threshold_block_size,
                threshold_c=self.config.threshold_c,
                bilateral_filter_diameter=self.config.bilateral_filter_diameter,
                bilateral_sigma_color=self.config.bilateral_sigma_color,
                bilateral_sigma_space=self.config.bilateral_sigma_space,
                deskew=self.config.enable_deskew,
            )
            LOGGER.debug(
                "Cropped plate %d for %s passed to OCR from bbox=%s",
                index,
                named_detection.model_name,
                detection.bbox,
            )
            base_name = f"{image_path.stem}_{named_detection.model_name.lower()}_plate_{index}"
            preprocess_variant_paths = self._save_preprocess_variants(
                processed_dir=processed_dir,
                base_name=base_name,
                processed_plate=processed_plate,
            )
            processed_path = Path(preprocess_variant_paths["thresholded"])
            LOGGER.debug("Saved processed plate %d debug image to %s", index, processed_path)
            ocr_result: OCRResult = self.ocr.extract_text(processed_plate)

            final_text = ocr_result.text or "UNREADABLE"
            comparison_score = self._compute_comparison_score(
                yolo_confidence=detection.confidence,
                ocr_confidence=ocr_result.confidence,
            )

            plate_results.append(
                PlateDetectionResult(
                    model_name=named_detection.model_name,
                    raw_bbox=detection.bbox,
                    bbox=crop_bbox,
                    yolo_confidence=detection.confidence,
                    text=final_text,
                    ocr_confidence=ocr_result.confidence,
                    quality_score=ocr_result.quality_score,
                    is_low_confidence=ocr_result.is_low_confidence,
                    comparison_score=comparison_score,
                    processed_plate_path=str(processed_path),
                    preprocess_variant_paths=preprocess_variant_paths,
                    ocr_pass_results=ocr_result.pass_results,
                )
            )
            LOGGER.info(
                "Accepted %s detection %d text=%s bbox=%s yolo_confidence=%.4f ocr_confidence=%s quality_score=%d low_confidence=%s comparison_score=%.4f",
                named_detection.model_name,
                index,
                final_text,
                detection.bbox,
                detection.confidence,
                f"{ocr_result.confidence:.4f}" if ocr_result.confidence is not None else "n/a",
                ocr_result.quality_score,
                ocr_result.is_low_confidence,
                comparison_score,
            )

        best_model_name = None
        if plate_results:
            best_model_name = max(
                plate_results,
                key=lambda result: result.comparison_score,
            ).model_name

        return ImageResult(
            image_path=image_path,
            detections=plate_results,
            best_model_name=best_model_name,
        )

    def save_annotated_image(self, image_result: ImageResult, annotated_dir: Path) -> Path | None:
        """Save one annotated image for debugging."""
        image = cv2.imread(str(image_result.image_path))
        if image is None:
            LOGGER.warning(
                "Skipping visualization because image could not be reloaded: %s",
                image_result.image_path,
            )
            return None

        for detection in image_result.detections:
            x1, y1, x2, y2 = detection.bbox
            image_height, image_width = image.shape[:2]
            font_scale = max(1.2, image_width / 800.0)
            font_thickness = 4 if image_width > 1200 else 3
            color = self._overlay_color(
                model_name=detection.model_name,
                best_model_name=image_result.best_model_name,
            )
            cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
            overlay_parts = [
                f"{self._model_display_name(detection.model_name)} ({self._ocr_engine_label()}): {detection.text}",
                f"YOLO {detection.yolo_confidence:.2f}",
            ]
            if detection.ocr_confidence is not None:
                overlay_parts.append(f"OCR {detection.ocr_confidence:.2f}")
            if detection.is_low_confidence:
                overlay_parts.append("LOW CONF")
            overlay_text = " | ".join(overlay_parts)
            (text_width, text_height), baseline = cv2.getTextSize(
                overlay_text,
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                font_thickness,
            )
            if detection.model_name == "Model1":
                text_x = x1
                text_y = max(text_height + 20, y1 - 12)
            else:
                text_x = x1
                text_y = min(image_height - 10, y2 + text_height + 20)
            rect_top = max(0, text_y - text_height - 14)
            rect_bottom = min(image_height, text_y + baseline + 4)
            rect_right = min(image_width, text_x + text_width + 12)
            cv2.rectangle(
                image,
                (text_x - 6, rect_top),
                (rect_right, rect_bottom),
                (0, 0, 0),
                -1,
            )
            cv2.putText(
                image,
                overlay_text,
                (text_x, text_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                color,
                font_thickness,
                cv2.LINE_AA,
            )

        annotated_path = annotated_dir / f"{image_result.image_path.stem}_annotated.jpg"
        cv2.imwrite(str(annotated_path), image)
        LOGGER.debug("Saved annotated debug image to %s", annotated_path)
        return annotated_path

    def visualize_result(self, image_result: ImageResult, annotated_dir: Path) -> bool:
        """Display one annotated image and optionally continue to the next."""
        annotated_path = self.save_annotated_image(image_result, annotated_dir)
        if annotated_path is None:
            return True

        image = cv2.imread(str(annotated_path))
        if image is None:
            LOGGER.warning("Skipping display because annotated image could not be loaded: %s", annotated_path)
            return True

        display_image = cv2.resize(
            image,
            None,
            fx=0.5,
            fy=0.5,
            interpolation=cv2.INTER_AREA,
        )
        cv2.imshow("ANPR Debug View", display_image)
        key = cv2.waitKey(0) & 0xFF
        if key == ord("q"):
            return False
        return True

    def save_process_trace(self, image_result: ImageResult, trace_dir: Path) -> Path | None:
        """Save a step-by-step process board for one image."""
        source_image = cv2.imread(str(image_result.image_path))
        if source_image is None:
            LOGGER.warning("Skipping process trace because image could not be loaded: %s", image_result.image_path)
            return None

        panels: List[np.ndarray] = []
        header_lines = [
            "ANPR System Pipeline",
            "Detection: YOLOv8 (Ultralytics)",
            "OCR: PaddleOCR 2.6.1.3",
            "Backend: PaddlePaddle 2.5.0",
            "Image Processing: OpenCV",
        ]
        panels.append(
            self._make_text_panel(
                header_lines,
                "Global Header",
                height=220,
                theme="header",
            )
        )

        overview = source_image.copy()
        cv2.putText(
            overview,
            "Detection: YOLOv8 (Ultralytics)",
            (16, 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 0),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            overview,
            "Framework: PyTorch",
            (16, 64),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 0),
            2,
            cv2.LINE_AA,
        )
        for detection in image_result.detections:
            color = self._overlay_color(detection.model_name, image_result.best_model_name)
            x1, y1, x2, y2 = detection.bbox
            cv2.rectangle(overview, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                overview,
                f"{detection.model_name} ({self._model_display_name(detection.model_name)}) | Conf: {detection.yolo_confidence:.2f}",
                (x1, max(25, y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
                cv2.LINE_AA,
            )
        panels.append(self._make_labeled_panel(overview, "Step 1: Original + Detections"))

        for detection in image_result.detections:
            model_display_name = self._model_display_name(detection.model_name)
            panels.append(
                self._make_text_panel(
                    [
                        f"Technology: {detection.model_name} -> {model_display_name}",
                        f"Detection Model: {model_display_name}",
                        "Cropping: Bounding box extraction from YOLO detection",
                        "Preprocessing: OpenCV (cv2)",
                        "Techniques: grayscale / threshold / sharpening",
                        f"OCR Engine: {self._ocr_engine_label()}",
                        f"Deep Learning Backend: {self._backend_label()}",
                        "PaddleOCR uses deep learning models executed by PaddlePaddle to recognize characters from images.",
                    ],
                    f"{model_display_name} Pipeline",
                    theme="section",
                )
            )
            x1, y1, x2, y2 = detection.bbox
            cropped_plate = source_image[y1:y2, x1:x2].copy()
            panels.append(
                self._make_labeled_panel(
                    cropped_plate,
                    f"{model_display_name} Step 2: Cropped Plate",
                    subtitle="Cropping: Bounding box extraction from YOLO detection",
                    accent=detection.model_name,
                    best_model_name=image_result.best_model_name,
                )
            )

            preprocess_labels = {
                "original": "Preprocess: original",
                "grayscale": "Preprocess: grayscale",
                "sharpened": "Preprocess: sharpened",
                "thresholded": "Preprocess: threshold",
            }
            for variant_name, variant_label in preprocess_labels.items():
                variant_path = detection.preprocess_variant_paths.get(variant_name)
                if not variant_path:
                    continue
                read_mode = cv2.IMREAD_GRAYSCALE if variant_name != "original" else cv2.IMREAD_COLOR
                processed_plate = cv2.imread(variant_path, read_mode)
                if processed_plate is None:
                    continue
                panels.append(
                    self._make_labeled_panel(
                        processed_plate,
                        f"{model_display_name} Step 3: {variant_label}",
                        subtitle="Preprocessing: OpenCV (cv2) | Techniques: grayscale / threshold / sharpening",
                        accent=detection.model_name,
                        best_model_name=image_result.best_model_name,
                    )
                )

            ocr_lines = [
                f"Detection Model: {model_display_name}",
            ]
            for pass_result in detection.ocr_pass_results:
                confidence_text = (
                    f"{pass_result.confidence:.2f}" if pass_result.confidence is not None else "n/a"
                )
                status = "REJECTED" if pass_result.is_low_confidence or not pass_result.text else "CANDIDATE"
                ocr_lines.append(f"Candidate ({pass_result.pass_name}) [{status}]")
                ocr_lines.append(f"Text: {pass_result.text or 'EMPTY'}")
                ocr_lines.append(f"Confidence: {confidence_text}")
                ocr_lines.append(f"OCR Engine: {self._ocr_engine_label()}")
                ocr_lines.append(f"Deep Learning Backend: {self._backend_label()}")

            panels.append(
                self._make_text_panel(
                    ocr_lines,
                    f"{model_display_name} Step 4: OCR Outputs",
                    theme="ocr",
                    accent=detection.model_name,
                    best_model_name=image_result.best_model_name,
                    height=max(320, 92 + (len(ocr_lines) * 28)),
                )
            )

            decision_lines = [
                f"Final Plate: {detection.text}",
                f"YOLO Confidence: {detection.yolo_confidence:.2f}",
                f"OCR Confidence: {detection.ocr_confidence:.2f}" if detection.ocr_confidence is not None else "OCR Confidence: n/a",
                f"Combined Score: {detection.comparison_score:.2f}",
                "Score = YOLO confidence + OCR confidence",
                "Fusion logic: custom scoring pipeline",
            ]
            if detection.comparison_score < 0.80:
                decision_lines.append("LOW CONFIDENCE DETECTION")
                decision_lines.append("Prediction may be unreliable")
            panels.append(
                self._make_text_panel(
                    decision_lines,
                    f"{model_display_name} Step 5: Final Decision",
                    theme="decision",
                    accent=detection.model_name,
                    best_model_name=image_result.best_model_name,
                    confidence_score=detection.comparison_score,
                )
            )

        if not panels:
            return None

        comparison_lines = [
            "Final decision based on:",
            "- Detection confidence (YOLO)",
            "- Recognition confidence (PaddleOCR)",
            "- Multi-model comparison",
        ]
        for detection in image_result.detections:
            comparison_lines.append(
                f"{detection.model_name} -> Score: {detection.comparison_score:.2f}"
            )
        if image_result.best_model_name:
            best_result = next(
                (
                    detection
                    for detection in image_result.detections
                    if detection.model_name == image_result.best_model_name
                ),
                None,
            )
            comparison_lines.append(f"Selected: {image_result.best_model_name}")
            if best_result is not None:
                comparison_lines.append(f"Final Plate: {best_result.text}")
        panels.append(
            self._make_text_panel(
                comparison_lines,
                "FINAL COMPARISON",
                theme="comparison",
            )
        )

        trace_image = self._stack_panels(panels, columns=2)
        trace_path = trace_dir / f"{image_result.image_path.stem}_trace.jpg"
        cv2.imwrite(str(trace_path), trace_image)
        LOGGER.info("Saved process trace to %s", trace_path)
        return trace_path

    def show_trace_image(self, trace_path: Path, image_name: str) -> bool:
        """Display one process trace board."""
        trace_image = cv2.imread(str(trace_path))
        if trace_image is None:
            return True

        display_image = cv2.resize(
            trace_image,
            None,
            fx=0.55,
            fy=0.55,
            interpolation=cv2.INTER_AREA,
        )
        cv2.imshow(f"ANPR Process Trace - {image_name}", display_image)
        key = cv2.waitKey(0) & 0xFF
        return key != ord("q")

    def _save_preprocess_variants(
        self,
        processed_dir: Path,
        base_name: str,
        processed_plate: PreprocessedPlate,
    ) -> dict[str, str]:
        """Persist preprocessing variants so the trace board can inspect them."""
        variant_images = {
            "original": processed_plate.original,
            "grayscale": processed_plate.grayscale,
            "sharpened": processed_plate.sharpened,
            "thresholded": processed_plate.thresholded,
        }
        saved_paths: dict[str, str] = {}
        for variant_name, variant_image in variant_images.items():
            variant_path = processed_dir / f"{base_name}_{variant_name}.png"
            cv2.imwrite(str(variant_path), variant_image)
            saved_paths[variant_name] = str(variant_path)
        return saved_paths

    @staticmethod
    def _compute_comparison_score(yolo_confidence: float, ocr_confidence: float | None) -> float:
        """Combine detector and OCR confidence into one comparison score."""
        normalized_ocr_confidence = ocr_confidence or 0.0
        return (yolo_confidence * 0.6) + (normalized_ocr_confidence * 0.4)

    @staticmethod
    def _model_display_name(model_name: str) -> str:
        """Return a user-facing display name for one detection model."""
        if model_name == "Model1":
            return "YOLOv8-v1"
        if model_name == "Model2":
            return "YOLOv8-v2"
        return model_name

    @staticmethod
    def _ocr_engine_label() -> str:
        """Return the OCR engine label used in the dashboard."""
        return "PaddleOCR (v2.6.1.3)"

    @staticmethod
    def _backend_label() -> str:
        """Return the OCR deep-learning backend label."""
        return "PaddlePaddle (v2.5.0)"

    @staticmethod
    def _overlay_color(model_name: str, best_model_name: str | None) -> tuple[int, int, int]:
        """Return model-specific overlay color, highlighting the best result."""
        if model_name == best_model_name:
            return (0, 180, 0)
        return (0, 215, 255)

    @staticmethod
    def _make_labeled_panel(
        image: np.ndarray,
        title: str,
        subtitle: str | None = None,
        accent: str | None = None,
        best_model_name: str | None = None,
        width: int = 640,
        height: int = 280,
    ) -> np.ndarray:
        """Create a simple image panel with a title."""
        if image.size == 0:
            image = np.full((40, 120, 3), 255, dtype=np.uint8)
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        panel = np.full((height, width, 3), 255, dtype=np.uint8)
        border_color = ANPRPipeline._panel_color(accent, best_model_name)
        cv2.rectangle(panel, (0, 0), (width - 1, height - 1), border_color, 3)
        fitted = ANPRPipeline._fit_image(image, width - 20, height - 90)
        if len(fitted.shape) == 2:
            fitted = cv2.cvtColor(fitted, cv2.COLOR_GRAY2BGR)
        y_offset = 70 + (height - 90 - fitted.shape[0]) // 2
        x_offset = (width - fitted.shape[1]) // 2
        panel[y_offset:y_offset + fitted.shape[0], x_offset:x_offset + fitted.shape[1]] = fitted
        cv2.putText(panel, title, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (35, 35, 35), 2, cv2.LINE_AA)
        if subtitle:
            cv2.putText(panel, subtitle[:88], (12, 54), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (80, 80, 80), 1, cv2.LINE_AA)
        return panel

    @staticmethod
    def _make_text_panel(
        lines: List[str],
        title: str,
        theme: str = "default",
        accent: str | None = None,
        best_model_name: str | None = None,
        confidence_score: float | None = None,
        width: int = 640,
        height: int = 280,
    ) -> np.ndarray:
        """Create a text panel summarizing OCR pass outputs."""
        panel = np.full((height, width, 3), 255, dtype=np.uint8)
        header_color = ANPRPipeline._theme_header_color(theme, accent, best_model_name)
        cv2.rectangle(panel, (0, 0), (width - 1, height - 1), header_color, 3)
        cv2.rectangle(panel, (0, 0), (width - 1, 44), header_color, -1)
        cv2.putText(panel, title, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (255, 255, 255), 2, cv2.LINE_AA)
        y_position = 60
        for line in lines:
            render_text = line
            render_color = (70, 70, 70)
            if "[REJECTED]" in line or "Text: EMPTY" in line:
                render_color = (0, 0, 220)
            elif line == "LOW CONFIDENCE DETECTION" or line == "Prediction may be unreliable":
                render_color = (0, 0, 255)
            elif line.startswith("Candidate"):
                render_color = (0, 140, 200)
            elif line.startswith("Final Plate") or line.startswith("Selected"):
                render_color = (
                    ANPRPipeline._confidence_color(confidence_score)
                    if confidence_score is not None
                    else (0, 150, 0)
                )
            elif line.startswith("Combined Score:"):
                render_color = (
                    ANPRPipeline._confidence_color(confidence_score)
                    if confidence_score is not None
                    else (70, 70, 70)
                )
            elif line.startswith("-"):
                render_color = (30, 30, 30)
            cv2.putText(panel, render_text[:90], (12, y_position), cv2.FONT_HERSHEY_SIMPLEX, 0.58, render_color, 1, cv2.LINE_AA)
            y_position += 28
            if y_position > height - 12:
                break
        return panel

    @staticmethod
    def _panel_color(model_name: str | None, best_model_name: str | None) -> tuple[int, int, int]:
        """Return panel accent color using green/yellow/red semantics."""
        if model_name is None:
            return (120, 120, 120)
        if model_name == best_model_name:
            return (0, 180, 0)
        return (0, 215, 255)

    @staticmethod
    def _theme_header_color(
        theme: str,
        accent: str | None,
        best_model_name: str | None,
    ) -> tuple[int, int, int]:
        """Return a readable header color for one panel theme."""
        if theme == "comparison":
            return (50, 50, 50)
        if theme == "header":
            return (140, 90, 20)
        if theme in {"section", "ocr", "decision"} and accent is not None:
            return ANPRPipeline._panel_color(accent, best_model_name)
        return (90, 90, 90)

    @staticmethod
    def _confidence_color(score: float | None) -> tuple[int, int, int]:
        """Return a score-based color for final-decision emphasis."""
        if score is None:
            return (70, 70, 70)
        if score >= 0.90:
            return (0, 150, 0)
        if score >= 0.80:
            return (0, 215, 255)
        return (0, 0, 255)

    @staticmethod
    def _fit_image(image: np.ndarray, max_width: int, max_height: int) -> np.ndarray:
        """Resize an image to fit inside a panel."""
        height, width = image.shape[:2]
        scale = min(max_width / width, max_height / height)
        scale = min(scale, 1.0) if width > max_width or height > max_height else scale
        scale = max(scale, 0.1)
        return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

    @staticmethod
    def _stack_panels(panels: List[np.ndarray], columns: int) -> np.ndarray:
        """Arrange panels into a simple grid image."""
        valid_panels: List[np.ndarray] = []
        for panel in panels:
            if panel is None or not isinstance(panel, np.ndarray) or panel.size == 0:
                valid_panels.append(np.full((280, 640, 3), 255, dtype=np.uint8))
                continue
            if len(panel.shape) == 2:
                panel = cv2.cvtColor(panel, cv2.COLOR_GRAY2BGR)
            valid_panels.append(panel)

        rows: List[np.ndarray] = []
        for index in range(0, len(valid_panels), columns):
            row = valid_panels[index:index + columns]
            if len(row) < columns:
                row.extend([np.full_like(row[0], 255)] * (columns - len(row)))
            target_height = max(panel.shape[0] for panel in row)
            normalized_row = [
                ANPRPipeline._pad_to_height(panel, target_height) for panel in row
            ]
            rows.append(np.hstack(normalized_row))

        if not rows:
            return np.full((280, 640, 3), 255, dtype=np.uint8)

        target_width = max(row.shape[1] for row in rows)
        normalized_rows = [
            ANPRPipeline._pad_to_width(row, target_width) for row in rows
        ]
        return np.vstack(normalized_rows)

    @staticmethod
    def _pad_to_height(image: np.ndarray, target_height: int) -> np.ndarray:
        """Pad an image vertically to a target height without resizing content."""
        if image is None or image.size == 0:
            return np.full((target_height, 640, 3), 255, dtype=np.uint8)
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        if image.shape[0] >= target_height:
            return image

        missing = target_height - image.shape[0]
        top = missing // 2
        bottom = missing - top
        return cv2.copyMakeBorder(
            image,
            top,
            bottom,
            0,
            0,
            cv2.BORDER_CONSTANT,
            value=(255, 255, 255),
        )

    @staticmethod
    def _pad_to_width(image: np.ndarray, target_width: int) -> np.ndarray:
        """Pad an image horizontally to a target width without resizing content."""
        if image is None or image.size == 0:
            return np.full((280, target_width, 3), 255, dtype=np.uint8)
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        if image.shape[1] >= target_width:
            return image

        missing = target_width - image.shape[1]
        left = missing // 2
        right = missing - left
        return cv2.copyMakeBorder(
            image,
            0,
            0,
            left,
            right,
            cv2.BORDER_CONSTANT,
            value=(255, 255, 255),
        )

    @staticmethod
    def _shrink_bbox(
        bbox: tuple[int, int, int, int],
        image_shape: tuple[int, ...],
        pad: int = 5,
    ) -> tuple[int, int, int, int]:
        """Trim noisy edges from a detected plate box before OCR cropping."""
        image_height, image_width = image_shape[:2]
        x1, y1, x2, y2 = bbox
        x1 = max(0, min(x1 + pad, image_width - 1))
        y1 = max(0, min(y1 + pad, image_height - 1))
        x2 = max(x1 + 1, min(x2 - pad, image_width))
        y2 = max(y1 + 1, min(y2 - pad, image_height))
        return (x1, y1, x2, y2)
