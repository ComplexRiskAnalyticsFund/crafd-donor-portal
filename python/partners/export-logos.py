"""
Export logos from /color to /thumb and /white.

Does NOT pull from Airtable. Reads existing files in public/logos/partners/color/
and produces:
  - /thumb  — 300px grayscale WebP thumbnails, white-point normalised so the
              brightest opaque pixel maps to full white (raster only; SVGs copied as-is)
  - /white  — full-size grayscale PNG (raster); SVGs copied as-is

Usage:
  uv run python -m python.partners.export-logos
  uv run python -m python.partners.export-logos --force   # overwrite existing files

Run from the repo root.
"""

import argparse
import shutil
from pathlib import Path

import numpy as np
from PIL import Image as PILImage
from tqdm import tqdm

RASTER_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
SVG_SUFFIX = ".svg"

COLOR_DIR = Path("public") / "logos" / "partners" / "color"
THUMB_DIR = Path("public") / "logos" / "partners" / "thumb"
WHITE_DIR = Path("public") / "logos" / "partners" / "white"

THUMB_SIZE = 300  # max dimension in pixels


def _to_grayscale_rgba(img: PILImage.Image) -> PILImage.Image:
    """Plain grayscale conversion, preserving alpha. Used for /white exports."""
    img = img.convert("RGBA")
    r, g, b, a = img.split()
    gray = PILImage.merge("RGB", (r, g, b)).convert("L")
    return PILImage.merge("RGBA", (gray, gray, gray, a))


# Hard floor for the darkest pixel — no output value below this.
# Compresses the grayscale spectrum into [BLACK_FLOOR, 255].
BLACK_FLOOR = 140

# Extra brightness boost applied after white-point normalisation.
# Multiplies all pixel values; >1.0 pushes more pixels toward white.
BRIGHTNESS_BOOST = 1.25


def _process_thumb(img: PILImage.Image) -> PILImage.Image:
    """
    Prepare a color logo for use as a monochrome hex thumbnail:
      1. Convert to grayscale (luminance), preserve alpha.
      2. Compress range into [BLACK_FLOOR, 255] — eliminates pure black.
      3. Normalize the white point using the 99th percentile of opaque pixels.
      4. Apply brightness boost, then clamp back to [BLACK_FLOOR, 255].
    """
    img = img.convert("RGBA")
    r, g, b, a = img.split()
    gray_pil = PILImage.merge("RGB", (r, g, b)).convert("L")
    arr_a = np.array(a, dtype=np.float32)
    arr_g = np.array(gray_pil, dtype=np.float32)

    opaque_mask = arr_a > 0
    if not opaque_mask.any():
        return img

    # Step 1: compress into [BLACK_FLOOR, 255]
    arr_g = arr_g * ((255.0 - BLACK_FLOOR) / 255.0) + BLACK_FLOOR

    # Step 2: white-point normalisation (99th percentile of opaque pixels)
    white_point = float(np.percentile(arr_g[opaque_mask], 99))
    if 0 < white_point < 255:
        arr_g = BLACK_FLOOR + (arr_g - BLACK_FLOOR) * ((255.0 - BLACK_FLOOR) / (white_point - BLACK_FLOOR))

    # Step 3: brightness boost, then clamp to [BLACK_FLOOR, 255]
    arr_g = BLACK_FLOOR + (arr_g - BLACK_FLOOR) * BRIGHTNESS_BOOST

    gray_out = np.clip(arr_g, BLACK_FLOOR, 255).astype(np.uint8)
    out = np.stack([gray_out, gray_out, gray_out, arr_a.astype(np.uint8)], axis=2)
    return PILImage.fromarray(out, mode="RGBA")


def export_thumbs(force: bool) -> None:
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(COLOR_DIR.iterdir())
    ok = skip = fail = 0

    with tqdm(files, desc="Thumbs      ", unit="file") as pbar:
        for src in pbar:
            stem = src.stem
            pbar.set_postfix(file=stem[:24], refresh=False)

            if src.suffix.lower() == SVG_SUFFIX:
                # Copy SVG as-is — infinitely sharp at any size
                dest = THUMB_DIR / src.name
                if not force and dest.exists():
                    skip += 1
                    continue
                shutil.copy2(src, dest)
                ok += 1
                continue

            if src.suffix.lower() not in RASTER_SUFFIXES:
                continue

            dest = THUMB_DIR / f"{stem}.webp"
            if not force and dest.exists():
                skip += 1
                continue

            try:
                img = PILImage.open(src)
                img = _process_thumb(img)
                img.thumbnail((THUMB_SIZE, THUMB_SIZE), PILImage.Resampling.LANCZOS)
                img.save(dest, "webp", quality=85)
                ok += 1
            except Exception as e:
                tqdm.write(f"  ✗ {stem}: {e}")
                fail += 1

    tqdm.write(f"  Thumbs: {ok} generated, {skip} skipped, {fail} failed")


def export_white(force: bool) -> None:
    WHITE_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(COLOR_DIR.iterdir())
    ok = skip = fail = 0

    with tqdm(files, desc="White logos ", unit="file") as pbar:
        for src in pbar:
            stem = src.stem
            pbar.set_postfix(file=stem[:24], refresh=False)

            if src.suffix.lower() == SVG_SUFFIX:
                dest = WHITE_DIR / src.name
                if not force and dest.exists():
                    skip += 1
                    continue
                shutil.copy2(src, dest)
                ok += 1
                continue

            if src.suffix.lower() not in RASTER_SUFFIXES:
                continue

            dest = WHITE_DIR / f"{stem}.png"
            if not force and dest.exists():
                skip += 1
                continue

            try:
                img = PILImage.open(src)
                img = _to_grayscale_rgba(img)
                img.save(dest, "png", optimize=True)
                ok += 1
            except Exception as e:
                tqdm.write(f"  ✗ {stem}: {e}")
                fail += 1

    tqdm.write(f"  White:  {ok} generated, {skip} skipped, {fail} failed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing files (default: skip existing)",
    )
    args = parser.parse_args()

    if not COLOR_DIR.exists():
        raise FileNotFoundError(f"Color logo directory not found: {COLOR_DIR}")

    tqdm.write(f"Source: {COLOR_DIR} ({len(list(COLOR_DIR.iterdir()))} files)")
    export_thumbs(force=args.force)
    export_white(force=args.force)
    tqdm.write("Done.")


if __name__ == "__main__":
    main()
