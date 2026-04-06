from __future__ import annotations

from pathlib import Path

from huggingface_hub import snapshot_download


REPO_ID = "PaddlePaddle/PP-OCRv3"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
TARGET_DIR = PROJECT_ROOT / "models" / "paddle_full"


def find_candidate_dir(base_dir: Path, keywords: tuple[str, ...]) -> str:
    """Return the most likely model directory path for one PaddleOCR component."""
    candidates = [
        path
        for path in base_dir.rglob("*")
        if path.is_dir() and all(keyword.lower() in path.name.lower() for keyword in keywords)
    ]
    if not candidates:
        return "Not found automatically"

    candidates.sort(key=lambda path: (len(path.parts), str(path)))
    return str(candidates[0])


def main() -> int:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Downloading PaddleOCR models from '{REPO_ID}'")
    print(f"Target directory: {TARGET_DIR}")

    try:
        local_path = snapshot_download(
            repo_id=REPO_ID,
            local_dir=str(TARGET_DIR),
            local_dir_use_symlinks=False,
        )
    except Exception as error:
        print("\nDownload failed.")
        print(f"Error: {error}")
        print("\nCheck your internet connection and make sure 'huggingface_hub' is installed.")
        return 1

    print("\nDownload completed successfully.")
    print(f"Local snapshot path: {local_path}")

    det_model_dir = find_candidate_dir(TARGET_DIR, ("det",))
    rec_model_dir = find_candidate_dir(TARGET_DIR, ("rec",))
    cls_model_dir = find_candidate_dir(TARGET_DIR, ("cls",))

    print("\nExpected folder structure example:")
    print("models/")
    print("   paddle_full/")
    print("      det/")
    print("      rec/")
    print("      cls/")

    print("\nUse these paths in PaddleOCR initialization:")
    print(f'det_model_dir = r"{det_model_dir}"')
    print(f'rec_model_dir = r"{rec_model_dir}"')
    print(f'cls_model_dir = r"{cls_model_dir}"')

    print("\nIf the auto-detected paths are not exact, inspect the downloaded folders under:")
    print(TARGET_DIR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
