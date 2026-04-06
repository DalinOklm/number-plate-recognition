"""ANPR package for license plate detection and OCR."""

from .config import ANPRConfig
from .pipeline import ANPRPipeline, ImageResult, PlateDetectionResult

__all__ = [
    "ANPRConfig",
    "ANPRPipeline",
    "ImageResult",
    "PlateDetectionResult",
]
