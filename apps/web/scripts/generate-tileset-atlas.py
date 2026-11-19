#!/usr/bin/env python3

import json
from pathlib import Path
from PIL import Image

ASSETS_DIR = Path(__file__).parents[1] / "public/assets/tilesets"
TILE_SIZE = 16
BLOCK_WIDTH = 8
TILESETS = [
    ("exterior.png", "exterior.json"),
    ("exterior2.png", "exterior2.json"),
]


def generate_tileset_atlas(image_name: str, atlas_name: str) -> None:
    image_path = ASSETS_DIR / image_name
    atlas_path = ASSETS_DIR / atlas_name
    if not image_path.exists():
        print(f"Skipping {image_name}: file does not exist")
        return

    with Image.open(image_path) as image:
        width, height = image.size

    cols = width // TILE_SIZE
    rows = height // TILE_SIZE

    blocks_x = cols // BLOCK_WIDTH
    block_size = BLOCK_WIDTH * rows

    frames = {}
    for block_idx in range(blocks_x):
        for row in range(rows):
            for col_in_block in range(BLOCK_WIDTH):
                col = block_idx * BLOCK_WIDTH + col_in_block
                idx = block_idx * block_size + row * BLOCK_WIDTH + col_in_block

                frames[str(idx)] = {
                    "frame": {
                        "h": TILE_SIZE,
                        "w": TILE_SIZE,
                        "x": col * TILE_SIZE,
                        "y": row * TILE_SIZE,
                    },
                    "rotated": False,
                    "sourceSize": {"h": TILE_SIZE, "w": TILE_SIZE},
                    "spriteSourceSize": {
                        "h": TILE_SIZE,
                        "w": TILE_SIZE,
                        "x": 0,
                        "y": 0,
                    },
                    "trimmed": False,
                }

    atlas = {
        "frames": frames,
        "meta": {
            "app": "empirage-tileset-packer",
            "format": "RGBA8888",
            "image": image_name,
            "scale": "1",
            "size": {"h": height, "w": width},
            "version": "1.0",
        },
    }

    with open(atlas_path, "w", encoding="utf-8") as f:
        json.dump(atlas, f, indent=2)

    print(f"Generated atlas for {image_name}: {len(frames)} frames at {atlas_path}")


def main() -> None:
    for image_name, atlas_name in TILESETS:
        generate_tileset_atlas(image_name, atlas_name)


if __name__ == "__main__":
    main()
