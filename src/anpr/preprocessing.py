from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np


LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class PreprocessedPlate:
    original: cv2.typing.MatLike
    grayscale: cv2.typing.MatLike
    sharpened: cv2.typing.MatLike
    thresholded: cv2.typing.MatLike
    primary: cv2.typing.MatLike


def preprocess_plate_image(
    plate_image: cv2.typing.MatLike,
    block_size: int,
    threshold_c: int,
    bilateral_filter_diameter: int,
    bilateral_sigma_color: int,
    bilateral_sigma_space: int,
    deskew: bool = True,
) -> PreprocessedPlate:
    """Prepare multiple plate-image variants to improve OCR accuracy."""
    LOGGER.debug(
        "Preprocessing cropped plate image with shape=%s",
        getattr(plate_image, "shape", None),
    )

    cropped_plate = crop_to_largest_contour(plate_image)
    grayscale = cv2.cvtColor(cropped_plate, cv2.COLOR_BGR2GRAY)
    denoised = cv2.bilateralFilter(
        grayscale,
        bilateral_filter_diameter,
        bilateral_sigma_color,
        bilateral_sigma_space,
    )

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    if deskew:
        enhanced = deskew_image(enhanced)

    sharpen_kernel = np.array(
        [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
        dtype=np.float32,
    )
    sharpened = cv2.filter2D(enhanced, -1, sharpen_kernel)

    resized_gray = cv2.resize(
        enhanced,
        None,
        fx=3.0,
        fy=3.0,
        interpolation=cv2.INTER_CUBIC,
    )
    resized_sharpened = cv2.resize(
        sharpened,
        None,
        fx=3.0,
        fy=3.0,
        interpolation=cv2.INTER_CUBIC,
    )

    if block_size % 2 == 0:
        block_size += 1
    block_size = max(block_size, 3)

    thresholded = cv2.adaptiveThreshold(
        resized_sharpened,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block_size,
        threshold_c,
    )

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    cleaned = cv2.morphologyEx(thresholded, cv2.MORPH_OPEN, kernel)

    original_for_ocr = cv2.resize(
        cropped_plate,
        None,
        fx=3.0,
        fy=3.0,
        interpolation=cv2.INTER_CUBIC,
    )

    LOGGER.debug(
        "Completed preprocessing for cropped plate image with primary shape=%s grayscale shape=%s thresholded shape=%s",
        getattr(cleaned, "shape", None),
        getattr(resized_gray, "shape", None),
        getattr(cleaned, "shape", None),
    )
    return PreprocessedPlate(
        original=original_for_ocr,
        grayscale=resized_gray,
        sharpened=resized_sharpened,
        thresholded=cleaned,
        primary=cleaned,
    )


def crop_to_largest_contour(plate_image: cv2.typing.MatLike) -> cv2.typing.MatLike:
    """Crop plate to the largest contour to suppress background noise."""
    grayscale = cv2.cvtColor(plate_image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(grayscale, (5, 5), 0)
    _, binary = cv2.threshold(
        blurred,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return plate_image

    largest = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest)
    if w <= 0 or h <= 0:
        return plate_image

    min_area = plate_image.shape[0] * plate_image.shape[1] * 0.15
    if cv2.contourArea(largest) < min_area:
        return plate_image

    return plate_image[y : y + h, x : x + w].copy()


def deskew_image(image: cv2.typing.MatLike) -> cv2.typing.MatLike:
    """Rotate a plate crop toward horizontal alignment when text is tilted."""
    inverted = cv2.bitwise_not(image)
    coordinates = cv2.findNonZero(inverted)
    if coordinates is None:
        return image

    angle = cv2.minAreaRect(coordinates)[-1]
    if angle < -45:
        angle = 90 + angle
    if abs(angle) < 1.0:
        return image

    height, width = image.shape[:2]
    center = (width // 2, height // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        image,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
