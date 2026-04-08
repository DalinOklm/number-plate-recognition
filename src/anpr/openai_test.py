from __future__ import annotations

import base64
import logging
import os
import re
from pathlib import Path

import cv2
import numpy as np
from openai import OpenAI


LOGGER = logging.getLogger(__name__)


def _load_env_file() -> None:
    """Load simple KEY=VALUE pairs from the project .env file if present."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


_load_env_file()


def _get_openai_client() -> OpenAI:
    """Create a configured OpenAI client from OPENAI_API_KEY."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "YOUR_OPENAI_API_KEY_HERE":
        raise ValueError(
            "OPENAI_API_KEY is missing. Add it to the project .env file or your environment."
        )

    return OpenAI(api_key=api_key)


def interpret_license_plate_image(image: np.ndarray) -> str:
    """Send an in-memory plate image to OpenAI Vision for independent reading."""
    client = _get_openai_client()
    if image is None or image.size == 0:
        raise ValueError("Unable to send empty image to OpenAI vision.")
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    success, buffer = cv2.imencode(".jpg", image)
    if not success:
        raise ValueError("Unable to encode image for OpenAI vision test.")

    b64_image = base64.b64encode(buffer).decode("utf-8")
    response = client.responses.create(
        model="gpt-4.1",
        input=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "Read the license plate in this image and reply with only "
                            "the license plate text. Do not add labels, explanations, "
                            "quotes, markdown, or extra words. If the plate contains "
                            "spaces, preserve them."
                        ),
                    },
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{b64_image}",
                        "detail": "high",
                    },
                ],
            }
        ],
    )

    result = _clean_openai_plate_text((response.output_text or "").strip())
    LOGGER.info("OpenAI vision test executed")
    return result


def test_openai_on_image(image_path: str | Path) -> str:
    """Send one image to OpenAI Vision and return its independent plate reading."""
    resolved_path = Path(image_path)
    image = cv2.imread(str(resolved_path))
    if image is None:
        raise ValueError(f"Unable to read image for OpenAI vision test: {resolved_path}")

    result = interpret_license_plate_image(image)
    print("OpenAI Interpretation:", result)
    return result


def _clean_openai_plate_text(text: str) -> str:
    """Reduce model output to the plate text only."""
    cleaned = text.strip().replace("\n", " ")
    cleaned = cleaned.replace("**", "").replace("`", "").strip()

    prefixes = (
        "the exact text on the license plate is:",
        "the license plate is:",
        "license plate:",
        "plate:",
    )
    lowered = cleaned.lower()
    for prefix in prefixes:
        if lowered.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
            break

    cleaned = cleaned.strip("\"'[](){} ")
    candidate = re.sub(r"[^A-Z0-9 ]", "", cleaned.upper()).strip()
    candidate = re.sub(r"\s+", " ", candidate)
    return candidate or "UNREADABLE"
