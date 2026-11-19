#!/usr/bin/env python3

import json
from pathlib import Path
from PIL import Image

WEB_DIR = Path(__file__).resolve().parents[1]
INPUT_IMAGE = WEB_DIR / "public/assets/tilesets/exterior2.png"
TILES_DIR = WEB_DIR / "public/assets/tiles"
CATALOG_PATH = TILES_DIR / "tiles-catalog.json"
EDITOR_TILESET_IMG = TILES_DIR / "editor-tileset.png"
EDITOR_TILESET_JSON = TILES_DIR / "editor-tileset.json"

TILE_SIZE = 16

def main() -> None:
    if not INPUT_IMAGE.exists():
        print(f"Error: {INPUT_IMAGE} does not exist")
        return

    TILES_DIR.mkdir(parents=True, exist_ok=True)

    with Image.open(INPUT_IMAGE) as img:
        img = img.convert("RGBA")
        width, height = img.size
        cols = width // TILE_SIZE
        rows = height // TILE_SIZE
        total_tiles = cols * rows

        print(f"Slicing {total_tiles} tiles ({cols}x{rows}) from {INPUT_IMAGE.name}...")

        # Also prepare the editor tileset (a copy or identical layout)
        img.save(EDITOR_TILESET_IMG)

        frames = {}
        catalog_tiles = []

        idx = 0
        for r in range(rows):
            for c in range(cols):
                box = (c * TILE_SIZE, r * TILE_SIZE, (c + 1) * TILE_SIZE, (r + 1) * TILE_SIZE)
                tile_img = img.crop(box)
                tile_file = TILES_DIR / f"{idx}.png"
                tile_img.save(tile_file, optimize=True)

                frames[str(idx)] = {
                    "frame": {"h": TILE_SIZE, "w": TILE_SIZE, "x": c * TILE_SIZE, "y": r * TILE_SIZE},
                    "rotated": False,
                    "sourceSize": {"h": TILE_SIZE, "w": TILE_SIZE},
                    "spriteSourceSize": {"h": TILE_SIZE, "w": TILE_SIZE, "x": 0, "y": 0},
                    "trimmed": False,
                }

                catalog_tiles.append({
                    "id": idx,
                    "file": f"/assets/tiles/{idx}.png",
                    "x": c,
                    "y": r,
                })
                idx += 1

    editor_atlas = {
        "frames": frames,
        "meta": {
            "app": "empirage-editor-packer",
            "format": "RGBA8888",
            "image": "editor-tileset.png",
            "scale": "1",
            "size": {"h": height, "w": width},
            "version": "1.0",
        },
    }

    with open(EDITOR_TILESET_JSON, "w", encoding="utf-8") as f:
        json.dump(editor_atlas, f, indent=2)

    catalog = {
        "tileSize": TILE_SIZE,
        "totalTiles": total_tiles,
        "editorTileset": "/assets/tiles/editor-tileset.png",
        "editorAtlas": "/assets/tiles/editor-tileset.json",
        "animations": [],
        "tiles": catalog_tiles,
    }

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)

    print(f"Successfully generated {total_tiles} tile images, editor tileset, and {CATALOG_PATH.name}!")

if __name__ == "__main__":
    main()
