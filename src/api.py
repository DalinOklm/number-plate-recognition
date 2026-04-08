from __future__ import annotations

import base64
import json
import logging
import sys
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from anpr import ANPRConfig, ANPRPipeline
from anpr.openai_test import interpret_license_plate_image


LOGGER = logging.getLogger("anpr.api")
OPENAI_TRIGGER_THRESHOLD = 0.7


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def decode_base64_image(frame_data: str) -> np.ndarray:
    """Decode a browser base64 image into an OpenCV BGR image."""
    if "," in frame_data:
        _, encoded = frame_data.split(",", 1)
    else:
        encoded = frame_data

    image_bytes = base64.b64decode(encoded)
    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unable to decode frame image")
    return image


class ANPRAPIService:
    """Persistent single-process ANPR service for Next.js API calls."""

    def __init__(self) -> None:
        config = ANPRConfig(
            enable_visualization=False,
            enable_process_trace=False,
            log_level="INFO",
        )
        self.pipeline = ANPRPipeline(config)

    def analyze_frame(
        self,
        frame_data: str,
        image_name: str = "camera-frame.jpg",
        force_finalize: bool = False,
    ) -> dict[str, Any]:
        """Analyze one camera frame and return JSON-serializable results."""
        image = decode_base64_image(frame_data)
        image_result = self.pipeline.process_array(
            image,
            image_name=image_name,
            max_detections=1,
            enable_comparison=False,
        )
        if not image_result.detections:
            return {
                "detected": False,
                "plate": None,
                "yolo_confidence": 0.0,
                "ocr_confidence": 0.0,
                "combined_score": 0.0,
                "bbox": None,
                "status": "searching",
                "low_confidence": True,
                "openai_used": False,
                "openai_plate": None,
                "finalized": False,
            }
        best_detection = image_result.detections[0]
        openai_used = False
        openai_plate: str | None = None
        final_plate = best_detection.text

        if (
            (best_detection.comparison_score >= OPENAI_TRIGGER_THRESHOLD or force_finalize)
            and final_plate
            and final_plate != "UNREADABLE"
        ):
            x1, y1, x2, y2 = best_detection.bbox
            crop = image[y1:y2, x1:x2].copy()
            try:
                openai_plate = interpret_license_plate_image(crop)
                openai_used = True
                if openai_plate and openai_plate != "UNREADABLE":
                    final_plate = openai_plate
            except Exception as error:
                LOGGER.warning("OpenAI frame analysis failed: %s", error)

        status = "good"
        if best_detection.comparison_score < 0.8:
            status = "low"
        elif best_detection.comparison_score < 0.9:
            status = "moderate"

        return {
            "detected": True,
            "plate": final_plate,
            "yolo_confidence": round(best_detection.yolo_confidence, 4),
            "ocr_confidence": round(best_detection.ocr_confidence or 0.0, 4),
            "combined_score": round(best_detection.comparison_score, 4),
            "bbox": list(best_detection.bbox),
            "status": status,
            "low_confidence": best_detection.comparison_score < 0.8,
            "openai_used": openai_used,
            "openai_plate": openai_plate,
            "finalized": openai_used or force_finalize,
        }


def emit_message(message: dict[str, Any]) -> None:
    """Write one JSON message to stdout for the Node bridge."""
    sys.stdout.write(json.dumps(message) + "\n")
    sys.stdout.flush()


def serve() -> int:
    """Serve line-delimited JSON requests over stdin/stdout."""
    configure_logging()
    service = ANPRAPIService()

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        payload: dict[str, Any] | None = None
        try:
            payload = json.loads(line)
            request_id = payload.get("id")
            frame_data = payload["frame"]
            image_name = payload.get("imageName", "camera-frame.jpg")
            force_finalize = bool(payload.get("forceFinalize", False))
            result = service.analyze_frame(
                frame_data,
                image_name=image_name,
                force_finalize=force_finalize,
            )
            emit_message({"id": request_id, "ok": True, "result": result})
        except Exception as error:
            emit_message(
                {
                    "id": payload.get("id") if isinstance(payload, dict) else None,
                    "ok": False,
                    "error": str(error),
                }
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(serve())
