#!/usr/bin/env python3

import json
import sys
from pathlib import Path
from PIL import Image

TILE_SIZE = 16

def pack_tileset(slug: str, frame_ids: list[int]) -> dict:
    web_dir = Path(__file__).resolve().parents[1]
    tiles_dir = web_dir / "public/assets/tiles"
    output_dir = web_dir / "public/assets/tilesets"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Ensure unique and sorted frames
    unique_frames = sorted(list(set(frame_ids)))
    if not unique_frames:
        unique_frames = [0]

    count = len(unique_frames)
    # Arrange in a grid with max 16 columns
    cols = min(16, count)
    rows = (count + cols - 1) // cols

    tileset_img = Image.new("RGBA", (cols * TILE_SIZE, rows * TILE_SIZE), (0, 0, 0, 0))

    frames_meta = {}
    mapping = {}

    for local_idx, global_frame in enumerate(unique_frames):
        gx = local_idx % cols
        gy = local_idx // cols
        tile_file = tiles_dir / f"{global_frame}.png"
        if tile_file.exists():
            with Image.open(tile_file) as t_img:
                tileset_img.paste(t_img.convert("RGBA"), (gx * TILE_SIZE, gy * TILE_SIZE))
        else:
            print(f"Warning: tile file {tile_file} does not exist", file=sys.stderr)

        frame_str = str(local_idx)
        frames_meta[frame_str] = {
            "frame": {"h": TILE_SIZE, "w": TILE_SIZE, "x": gx * TILE_SIZE, "y": gy * TILE_SIZE},
            "rotated": False,
            "sourceSize": {"h": TILE_SIZE, "w": TILE_SIZE},
            "spriteSourceSize": {"h": TILE_SIZE, "w": TILE_SIZE, "x": 0, "y": 0},
            "trimmed": False,
        }
        mapping[str(global_frame)] = local_idx

    img_filename = f"{slug}.png"
    json_filename = f"{slug}.json"
    tileset_img.save(output_dir / img_filename, optimize=True)

    atlas = {
        "frames": frames_meta,
        "meta": {
            "app": "empirage-map-tileset-packer",
            "format": "RGBA8888",
            "image": img_filename,
            "scale": "1",
            "size": {"h": rows * TILE_SIZE, "w": cols * TILE_SIZE},
            "version": "1.0",
        },
        "mapping": mapping,
    }

    with open(output_dir / json_filename, "w", encoding="utf-8") as f:
        json.dump(atlas, f, indent=2)

    return {
        "atlasUrl": f"/assets/tilesets/{json_filename}",
        "mapping": mapping,
        "tilesetUrl": f"/assets/tilesets/{img_filename}",
        "totalTiles": count,
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: pack-map-tileset.py <payload_json>", file=sys.stderr)
        sys.exit(1)

    payload_raw = sys.argv[1]
    if payload_raw == "-":
        payload = json.load(sys.stdin)
    else:
        payload = json.loads(payload_raw)

    slug = payload.get("slug", "map")
    frame_ids = payload.get("frames", [0])

    result = pack_tileset(slug, frame_ids)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
