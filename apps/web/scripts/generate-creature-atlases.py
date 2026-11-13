#!/usr/bin/env python3

import json

from pathlib import Path
from PIL import Image

ASSET_DIRECTORY = Path(__file__).parents[1] / "public/assets/creatures"
MANIFEST_PATH = ASSET_DIRECTORY / "creatures.manifest.json"


def creature_ids(directions: list[str], source_frames: list[str]) -> list[str]:
    identifiers = {
        path.stem
        for direction in directions
        for source_frame in source_frames
        for path in (ASSET_DIRECTORY / direction / source_frame).glob("*.png")
    }
    return sorted(identifiers, key=int)


def generate_atlas(
    identifier: str,
    directions: list[str],
    source_frames: list[str],
    cell_width: int,
    cell_height: int,
    pivot: dict[str, int],
    output_directory: Path,
) -> None:
    expected_paths = [
        ASSET_DIRECTORY / direction / source_frame / f"{identifier}.png"
        for direction in directions
        for source_frame in source_frames
    ]
    missing_paths = [path for path in expected_paths if not path.is_file()]
    if missing_paths:
        missing = ", ".join(str(path.relative_to(ASSET_DIRECTORY)) for path in missing_paths)
        raise ValueError(f"Creature {identifier} is missing frames: {missing}")

    atlas = Image.new(
        "RGBA",
        (cell_width * len(source_frames), cell_height * len(directions)),
    )
    frames = {}

    for row, direction in enumerate(directions):
        for column, source_frame in enumerate(source_frames):
            source_path = ASSET_DIRECTORY / direction / source_frame / f"{identifier}.png"
            with Image.open(source_path) as image:
                image.load()
                if image.size != (cell_width, cell_height):
                    raise ValueError(f"{source_path} must be {cell_width}x{cell_height}")
                atlas.paste(image.convert("RGBA"), (column * cell_width, row * cell_height))

            frame_name = f"{direction}/{source_frame}"
            frames[frame_name] = {
                "frame": {
                    "x": column * cell_width,
                    "y": row * cell_height,
                    "w": cell_width,
                    "h": cell_height,
                },
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": cell_width, "h": cell_height},
                "sourceSize": {"w": cell_width, "h": cell_height},
                "pivot": {
                    "x": pivot["x"] / cell_width,
                    "y": pivot["y"] / cell_height,
                },
            }

    image_name = f"{identifier}.png"
    atlas.save(output_directory / image_name, optimize=True)
    data = {
        "frames": frames,
        "animations": {},
        "meta": {
            "app": "Empirage creature atlas generator",
            "version": "1.0",
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": atlas.width, "h": atlas.height},
            "scale": "1",
        },
    }
    (output_directory / f"{identifier}.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    directions = manifest["directions"]
    source_frames = manifest["frames"]
    cell_width = manifest["sourceSize"]["width"]
    cell_height = manifest["sourceSize"]["height"]
    output_directory = ASSET_DIRECTORY / manifest["outputDirectory"]
    output_directory.mkdir(parents=True, exist_ok=True)

    identifiers = creature_ids(directions, source_frames)
    if not identifiers:
        raise ValueError("No creature source frames found")

    for identifier in identifiers:
        generate_atlas(
            identifier,
            directions,
            source_frames,
            cell_width,
            cell_height,
            manifest["pivot"],
            output_directory,
        )


if __name__ == "__main__":
    main()
