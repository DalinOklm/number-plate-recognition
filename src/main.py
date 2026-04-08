from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from anpr import ANPRConfig, ANPRPipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run ANPR on all images in a directory."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data/test_images"),
        help="Directory containing test images.",
    )
    parser.add_argument(
        "--model-v1-path",
        type=Path,
        default=Path("models/license_plate_detector.pt"),
        help="Path to the first YOLO plate detector.",
    )
    parser.add_argument(
        "--model-v2-path",
        type=Path,
        default=Path("models/license_plate_detector_v2.pt"),
        help="Path to the second YOLO plate detector.",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="YOLO detection confidence threshold.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Logging verbosity for the ANPR pipeline.",
    )
    parser.add_argument(
        "--no-display",
        action="store_true",
        help="Disable OpenCV debug windows and save annotated images only.",
    )
    parser.add_argument(
        "--focus-image",
        default=None,
        help="Process only one image filename from data/test_images.",
    )
    parser.add_argument(
        "--trace",
        action="store_true",
        help="Save a step-by-step process trace board for each processed image.",
    )
    return parser.parse_args()


def configure_logging(log_level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def serialize_results(image_results: list) -> list[dict]:
    serialized = []
    for image_result in image_results:
        serialized.append(
            {
                "image_path": str(image_result.image_path),
                "detections": [
                    {
                        "model_name": detection.model_name,
                        "raw_bbox": list(detection.raw_bbox),
                        "text": detection.text,
                        "yolo_confidence": detection.yolo_confidence,
                        "ocr_confidence": detection.ocr_confidence,
                        "quality_score": detection.quality_score,
                        "is_low_confidence": detection.is_low_confidence,
                        "comparison_score": detection.comparison_score,
                        "processed_plate_path": detection.processed_plate_path,
                        "preprocess_variant_paths": detection.preprocess_variant_paths,
                        "ocr_comparison": {
                            "easyocr_text": detection.ocr_comparison.easyocr_text,
                            "paddleocr_text": detection.ocr_comparison.paddleocr_text,
                            "openai_text": detection.ocr_comparison.openai_text,
                            "disagreement_detected": detection.ocr_comparison.disagreement_detected,
                        },
                        "ocr_pass_results": [
                            {
                                "pass_name": pass_result.pass_name,
                                "text": pass_result.text,
                                "confidence": pass_result.confidence,
                                "quality_score": pass_result.quality_score,
                                "is_low_confidence": pass_result.is_low_confidence,
                            }
                            for pass_result in detection.ocr_pass_results
                        ],
                        "bbox": list(detection.bbox),
                    }
                    for detection in image_result.detections
                ],
                "best_model_name": image_result.best_model_name,
            }
        )

    return serialized


def main() -> int:
    args = parse_args()
    config = ANPRConfig(
        input_dir=args.input_dir,
        detector_model_v1_path=args.model_v1_path,
        detector_model_v2_path=args.model_v2_path,
        detection_confidence=args.conf,
        log_level=args.log_level,
        enable_visualization=not args.no_display,
        enable_process_trace=args.trace,
        focus_image_name=args.focus_image,
    )
    configure_logging(config.log_level)

    try:
        pipeline = ANPRPipeline(config)
    except FileNotFoundError as error:
        print(error)
        return 1

    if not config.input_dir.exists():
        print(f"Input directory not found: {config.input_dir}")
        return 1

    image_results = pipeline.process_directory()

    if not image_results:
        print(f"No supported images found in: {config.input_dir}")
        return 0

    config.output_dir.mkdir(parents=True, exist_ok=True)
    output_path = config.output_dir / "results.json"
    output_path.write_text(
        json.dumps(serialize_results(image_results), indent=2),
        encoding="utf-8",
    )

    for image_result in image_results:
        print(f"\nImage: {image_result.image_path.name}")
        if not image_result.detections:
            print("  No license plates detected.")
            continue

        selected_detection = next(
            (
                detection
                for detection in image_result.detections
                if detection.model_name == image_result.best_model_name
            ),
            image_result.detections[0],
        )
        print("------------------------------")
        print(f"Model 1   : {selected_detection.ocr_comparison.easyocr_text}")
        print(f"Model 2   : {selected_detection.ocr_comparison.paddleocr_text}")
        print(f"Model 3   : {selected_detection.ocr_comparison.openai_text}")
        print("------------------------------")
        if selected_detection.ocr_comparison.disagreement_detected:
            print("OCR disagreement detected")

        for detection in image_result.detections:
            print(f"[{detection.model_name}]")
            print(f"YOLO: {detection.yolo_confidence:.2f}")
            print(
                "OCR: "
                f"{detection.ocr_confidence:.2f}"
                if detection.ocr_confidence is not None
                else "OCR: n/a"
            )
            print(f"Final: {detection.text}")
            print(f"Score: {detection.comparison_score:.2f}")
            print("")
        if image_result.best_model_name:
            print(f"Selected: {image_result.best_model_name}")

    print(f"\nSaved structured results to: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
