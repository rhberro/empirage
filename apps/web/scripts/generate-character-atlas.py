#!/usr/bin/env python3

import json

from pathlib import Path
from PIL import Image

ASSET_DIRECTORY = Path(__file__).parents[1] / "public/assets/characters"
MANIFEST_PATH = ASSET_DIRECTORY / "characters.manifest.json"


def numeric_frame_paths(direction_directory: Path) -> list[Path]:
    paths = list(direction_directory.glob("*.png"))
    try:
        paths.sort(key=lambda path: int(path.stem))
    except ValueError as error:
        raise ValueError(f"Frame names in {direction_directory} must be integers") from error

    expected_names = [f"{index}.png" for index in range(1, len(paths) + 1)]
    if [path.name for path in paths] != expected_names:
        raise ValueError(f"Frames in {direction_directory} must be numbered sequentially from 1")
    return paths


def source_groups(
    body_directory: Path,
    directions: list[str],
) -> list[tuple[str, str, list[Path]]]:
    actions = sorted(path for path in body_directory.iterdir() if path.is_dir())
    if not actions:
        raise ValueError(f"No character actions found in {body_directory}")

    groups = []
    expected_directions = set(directions)
    for action_directory in actions:
        actual_directions = {
            path.name for path in action_directory.iterdir() if path.is_dir()
        }
        if actual_directions != expected_directions:
            missing = sorted(expected_directions - actual_directions)
            unexpected = sorted(actual_directions - expected_directions)
            raise ValueError(
                f"Invalid directions in {action_directory}: missing={missing}, unexpected={unexpected}"
            )

        frame_count = None
        for direction in directions:
            paths = numeric_frame_paths(action_directory / direction)
            if not paths:
                raise ValueError(f"No frames found in {action_directory / direction}")
            if frame_count is not None and len(paths) != frame_count:
                raise ValueError(
                    f"All directions in {action_directory} must have the same frame count"
                )
            frame_count = len(paths)
            groups.append((action_directory.name, direction, paths))
    return groups


def generate_atlas(
    body: str,
    configuration: dict,
    directions: list[str],
    cell_width: int,
    cell_height: int,
) -> None:
    body_directory = ASSET_DIRECTORY / body
    groups = source_groups(body_directory, directions)
    column_count = max(len(paths) for _, _, paths in groups)
    atlas = Image.new("RGBA", (cell_width * column_count, cell_height * len(groups)))
    frames = {}

    for row, (action, direction, paths) in enumerate(groups):
        for column, source_path in enumerate(paths):
            with Image.open(source_path) as image:
                image.load()
                if image.size != (cell_width, cell_height):
                    raise ValueError(f"{source_path} must be {cell_width}x{cell_height}")
                atlas.paste(image.convert("RGBA"), (column * cell_width, row * cell_height))

            frame_name = f"{action}/{direction}/frame_{source_path.stem}"
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
            }

    output_directory = ASSET_DIRECTORY / configuration["outputDirectory"]
    output_directory.mkdir(parents=True, exist_ok=True)
    atlas_name = configuration["atlasName"]
    image_name = f"{atlas_name}.png"
    atlas.save(output_directory / image_name, optimize=True)
    data = {
        "frames": frames,
        "animations": {},
        "meta": {
            "app": "Empirage character atlas generator",
            "version": "1.0",
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": atlas.width, "h": atlas.height},
            "scale": "1",
            "body": body,
        },
    }
    data_path = output_directory / f"{atlas_name}.json"
    data_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    directions = manifest["directions"]
    if not directions or len(directions) != len(set(directions)):
        raise ValueError("Manifest directions must be a non-empty list without duplicates")

    cell_width = manifest["sourceSize"]["width"]
    cell_height = manifest["sourceSize"]["height"]
    for body, configuration in manifest["bodies"].items():
        generate_atlas(body, configuration, directions, cell_width, cell_height)


if __name__ == "__main__":
    main()
