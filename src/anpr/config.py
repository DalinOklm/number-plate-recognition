from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple


@dataclass(slots=True)
class ANPRConfig:
    """Configuration for the ANPR pipeline."""

    project_root: Path = field(
        default_factory=lambda: Path(__file__).resolve().parents[2]
    )
    input_dir: Optional[Path] = None
    detector_model_v1_path: Optional[Path] = None
    detector_model_v2_path: Optional[Path] = None
    output_dir: Optional[Path] = None
    ocr_languages: Tuple[str, ...] = ("en",)
    detection_confidence: float = 0.25
    threshold_block_size: int = 31
    threshold_c: int = 15
    bilateral_filter_diameter: int = 9
    bilateral_sigma_color: int = 75
    bilateral_sigma_space: int = 75
    min_text_length: int = 4
    log_level: str = "INFO"
    enable_visualization: bool = True
    enable_deskew: bool = True
    enable_process_trace: bool = False
    focus_image_name: Optional[str] = None

    def __post_init__(self) -> None:
        self.project_root = self.project_root.resolve()
        self.input_dir = (
            self.input_dir or self.project_root / "data" / "test_images"
        ).resolve()
        self.output_dir = (
            self.output_dir or self.project_root / "data" / "output"
        ).resolve()
        self.detector_model_v1_path = (
            self.detector_model_v1_path
            or self.project_root / "models" / "license_plate_detector.pt"
        )
        self.detector_model_v1_path = self.detector_model_v1_path.resolve()
        self.detector_model_v2_path = (
            self.detector_model_v2_path
            or self.project_root / "models" / "license_plate_detector_v2.pt"
        )
        self.detector_model_v2_path = self.detector_model_v2_path.resolve()
