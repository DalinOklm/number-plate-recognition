from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Iterable, List

import cv2

from .preprocessing import PreprocessedPlate


LOGGER = logging.getLogger(__name__)
NUMERIC_CORRECTIONS = {
    "O": "0",
    "Q": "0",
    "D": "0",
    "I": "1",
    "L": "4",
    "S": "5",
    "Z": "2",
    "B": "8",
}
GENERIC_PLATE_PATTERN = re.compile(r"^[A-Z0-9]{4,12}$")


@dataclass(slots=True)
class OCRResult:
    text: str
    confidence: float | None
    quality_score: int
    is_low_confidence: bool
    pass_results: List["OCRPassResult"]


@dataclass(slots=True)
class OCRPassResult:
    pass_name: str
    text: str
    confidence: float | None
    quality_score: int
    is_low_confidence: bool


class PlateOCR:
    """OCR wrapper using PaddleOCR for license plate recognition."""

    def __init__(self, languages: Iterable[str]) -> None:
        del languages
        self.backend_name = "paddleocr"
        os.environ["FLAGS_use_mkldnn"] = "0"
        os.environ["OMP_NUM_THREADS"] = "1"

        try:
            from paddleocr import PaddleOCR
        except ImportError as error:
            raise ImportError(
                "PaddleOCR is not available in the current Python environment."
            ) from error

        LOGGER.info("Initializing PaddleOCR with automatic model download enabled")
        self.reader = PaddleOCR(
            use_angle_cls=True,
            lang="en",
        )
        LOGGER.info("PaddleOCR running in CPU safe mode (MKLDNN disabled)")
        LOGGER.info("Using PaddleOCR successfully")

    def extract_text(self, processed_plate: PreprocessedPlate) -> OCRResult:
        """Run multi-pass OCR and select the strongest merged plate string."""
        LOGGER.debug(
            "Passing plate variants to %s with original=%s grayscale=%s thresholded=%s",
            self.backend_name,
            getattr(processed_plate.original, "shape", None),
            getattr(processed_plate.grayscale, "shape", None),
            getattr(processed_plate.thresholded, "shape", None),
        )
        candidates = [
            self._run_single_pass("original", processed_plate.original),
            self._run_single_pass("thresholded", processed_plate.thresholded),
            self._run_single_pass("grayscale", processed_plate.grayscale),
        ]
        pass_results = list(candidates)
        candidates.sort(
            key=lambda result: (
                result.quality_score,
                result.confidence if result.confidence is not None else -1.0,
                len(result.text),
            ),
            reverse=True,
        )
        best_result = candidates[0]
        LOGGER.debug(
            "Selected %s pass result text=%s confidence=%s quality_score=%d low_confidence=%s",
            self.backend_name,
            best_result.text,
            f"{best_result.confidence:.4f}" if best_result.confidence is not None else "n/a",
            best_result.quality_score,
            best_result.is_low_confidence,
        )
        return OCRResult(
            text=best_result.text,
            confidence=best_result.confidence,
            quality_score=best_result.quality_score,
            is_low_confidence=best_result.is_low_confidence,
            pass_results=pass_results,
        )

    def _run_single_pass(
        self,
        pass_name: str,
        image: cv2.typing.MatLike,
    ) -> OCRPassResult:
        """Run one OCR pass and merge fragments left-to-right."""
        fragments, confidences = self._run_paddle_pass(image)

        if not fragments:
            LOGGER.debug(
                "%s pass '%s' returned no valid alphanumeric candidates",
                self.backend_name,
                pass_name,
            )
            return OCRPassResult(
                pass_name=pass_name,
                text="",
                confidence=None,
                quality_score=0,
                is_low_confidence=True,
            )

        fragments.sort(key=lambda item: item[0])
        merged_text = "".join(fragment[2] for fragment in fragments)
        merged_text = clean_plate_text(merged_text)
        merged_text = normalize_plate_text(merged_text)
        merged_confidence = sum(confidences) / len(confidences)
        quality_score = score_plate_text(merged_text)
        is_low_confidence = quality_score < 2

        LOGGER.debug(
            "%s pass '%s' merged %d fragments into text=%s confidence=%.4f quality_score=%d low_confidence=%s",
            self.backend_name,
            pass_name,
            len(fragments),
            merged_text,
            merged_confidence,
            quality_score,
            is_low_confidence,
        )
        return OCRPassResult(
            pass_name=pass_name,
            text=merged_text,
            confidence=merged_confidence,
            quality_score=quality_score,
            is_low_confidence=is_low_confidence,
        )

    @staticmethod
    def _prepare_image_for_paddle(image: cv2.typing.MatLike) -> cv2.typing.MatLike:
        """Ensure OCR input is a 3-channel image for PaddleOCR."""
        if len(image.shape) == 2:
            return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        return image

    def _run_paddle_pass(
        self,
        image: cv2.typing.MatLike,
    ) -> tuple[List[tuple[float, float, str]], List[float]]:
        """Run one PaddleOCR pass and normalize fragments."""
        LOGGER.debug("Running PaddleOCR on one image variant")
        paddle_input = self._prepare_image_for_paddle(image)
        raw_result = self.reader.ocr(paddle_input)
        LOGGER.info("Running PaddleOCR pass successfully")
        LOGGER.debug("PaddleOCR completed successfully for one image variant")

        fragments: List[tuple[float, float, str]] = []
        confidences: List[float] = []
        for box, text, confidence in self._iter_ocr_lines(raw_result):
            cleaned_text = clean_plate_text(text)
            if cleaned_text:
                x_coordinate = float(box[0][0])
                fragments.append((x_coordinate, float(confidence), cleaned_text))
                confidences.append(float(confidence))
        return fragments, confidences

    @staticmethod
    def _iter_ocr_lines(raw_result: object) -> List[tuple[list, str, float]]:
        """Normalize PaddleOCR output into box/text/confidence tuples."""
        lines: List[tuple[list, str, float]] = []
        if not isinstance(raw_result, list):
            return lines

        for page_result in raw_result:
            if not page_result:
                continue
            for line in page_result:
                if not isinstance(line, list) or len(line) < 2:
                    continue
                box = line[0]
                text_info = line[1]
                if not isinstance(text_info, (list, tuple)) or len(text_info) < 2:
                    continue
                text = str(text_info[0])
                confidence = float(text_info[1])
                lines.append((box, text, confidence))
        return lines

def clean_plate_text(text: str) -> str:
    """Normalize OCR output to alphanumeric plate characters only."""
    upper_text = text.upper().strip()
    return re.sub(r"[^A-Z0-9]", "", upper_text)


def normalize_plate_text(text: str) -> str:
    """Apply light OCR normalization without strict rejection."""
    cleaned = clean_plate_text(text)
    if not cleaned:
        return ""
    corrected_chars: List[str] = []
    digit_run_started = False
    for char in cleaned:
        if char.isdigit():
            digit_run_started = True
            corrected_chars.append(char)
            continue

        if digit_run_started and char in NUMERIC_CORRECTIONS:
            corrected_chars.append(NUMERIC_CORRECTIONS[char])
            continue

        corrected_chars.append(char)

    normalized = "".join(corrected_chars)
    if GENERIC_PLATE_PATTERN.fullmatch(normalized):
        return normalized
    return cleaned


def score_plate_text(text: str) -> int:
    """Soft-score OCR text quality without discarding imperfect outputs."""
    compact = clean_plate_text(text)
    score = 0
    if re.search(r"[A-Z]", compact):
        score += 1
    if re.search(r"\d", compact):
        score += 1
    if 6 <= len(compact) <= 10:
        score += 1
    return score
