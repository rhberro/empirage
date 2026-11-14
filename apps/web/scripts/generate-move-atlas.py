#!/usr/bin/env python3

import json

from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image

ASSET_DIRECTORY = Path(__file__).parents[1] / "public/assets/moves"
MANIFEST_PATH = ASSET_DIRECTORY / "moves.manifest.json"


def load_manifest() -> dict:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    source = manifest.get("sourceAtlas")
    size = manifest.get("sourceSize")
    if not isinstance(source, dict) or not isinstance(size, dict):
        raise ValueError("Move manifest must define sourceAtlas and sourceSize")
    if not all(isinstance(source.get(key), str) for key in ("data", "image")):
        raise ValueError("Move manifest sourceAtlas must define data and image")
    if not all(isinstance(size.get(key), int) and size[key] > 0 for key in ("width", "height")):
        raise ValueError("Move manifest sourceSize must contain positive dimensions")
    if not isinstance(manifest.get("columns"), int) or manifest["columns"] < 1:
        raise ValueError("Move manifest columns must be a positive integer")
    return manifest


def frame_rectangle(frame: dict, source_size: tuple[int, int], image_size: tuple[int, int]) -> tuple[int, int, int, int]:
    rectangle = frame.get("frame")
    if not isinstance(rectangle, dict):
        raise ValueError("Atlas frame is missing its rectangle")
    required = ("x", "y", "w", "h")
    if not all(isinstance(rectangle.get(key), int) for key in required):
        raise ValueError("Atlas frame rectangle must contain integer coordinates")
    x, y, width, height = (rectangle[key] for key in required)
    if width != source_size[0] or height != source_size[1]:
        raise ValueError(f"Atlas frame must be {source_size[0]}x{source_size[1]}")
    if x < 0 or y < 0 or x + width > image_size[0] or y + height > image_size[1]:
        raise ValueError("Atlas frame is outside the source image")
    return x, y, width, height


def atlas_frame(x: int, y: int, width: int, height: int, pivot: dict) -> dict:
    return {
        "frame": {"x": x, "y": y, "w": width, "h": height},
        "rotated": False,
        "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": width, "h": height},
        "sourceSize": {"w": width, "h": height},
        "pivot": {"x": pivot["x"] / width, "y": pivot["y"] / height},
    }


def validate_generated_atlas(atlas_path: Path, icons: list[tuple[str, Path]], frames: dict) -> None:
    with Image.open(atlas_path) as atlas:
        atlas.load()
        for name, icon_path in icons:
            frame = frames[name]["frame"]
            with Image.open(icon_path) as icon:
                icon.load()
                crop = atlas.crop(
                    (
                        frame["x"],
                        frame["y"],
                        frame["x"] + frame["w"],
                        frame["y"] + frame["h"],
                    )
                )
                if crop.tobytes() != icon.convert("RGBA").tobytes():
                    raise ValueError(f"Generated atlas frame does not match {name}")


def main() -> None:
    manifest = load_manifest()
    source = manifest["sourceAtlas"]
    source_size = (manifest["sourceSize"]["width"], manifest["sourceSize"]["height"])
    source_data_path = ASSET_DIRECTORY / source["data"]
    source_image_path = ASSET_DIRECTORY / source["image"]
    data = json.loads(source_data_path.read_text(encoding="utf-8"))
    frames = data.get("frames")
    if not isinstance(frames, dict) or not frames:
        raise ValueError("Source atlas must contain frames")
    if len(frames) != len(set(frames)):
        raise ValueError("Source atlas contains duplicate frame names")

    with Image.open(source_image_path) as image:
        image.load()
        image = image.convert("RGBA")
        image_size = image.size
        names = sorted(frames)
        output_directory = ASSET_DIRECTORY / manifest["outputDirectory"]
        icons_directory = ASSET_DIRECTORY / manifest["iconsDirectory"]
        with TemporaryDirectory(dir=ASSET_DIRECTORY) as temporary_directory:
            temporary_path = Path(temporary_directory)
            temporary_icons = temporary_path / "icons"
            temporary_icons.mkdir()
            icon_paths = []
            for name in names:
                rectangle = frame_rectangle(frames[name], source_size, image_size)
                icon_path = temporary_icons / f"{name}.png"
                image.crop((rectangle[0], rectangle[1], rectangle[0] + rectangle[2], rectangle[1] + rectangle[3])).save(icon_path, optimize=True)
                icon_paths.append((name, icon_path))

            columns = manifest["columns"]
            rows = (len(icon_paths) + columns - 1) // columns
            atlas = Image.new("RGBA", (columns * source_size[0], rows * source_size[1]))
            generated_frames = {}
            for index, (name, icon_path) in enumerate(icon_paths):
                column = index % columns
                row = index // columns
                with Image.open(icon_path) as icon:
                    icon.load()
                    if icon.size != source_size:
                        raise ValueError(f"Icon {icon_path.name} has an invalid size")
                    atlas.paste(icon.convert("RGBA"), (column * source_size[0], row * source_size[1]))
                generated_frames[name] = atlas_frame(
                    column * source_size[0], row * source_size[1], source_size[0], source_size[1], manifest["pivot"]
                )
            temporary_atlas = temporary_path / manifest["atlasName"]
            temporary_atlas.mkdir()
            image_name = manifest["atlasName"] + ".png"
            atlas.save(temporary_atlas / image_name, optimize=True)
            atlas_data = {
                "frames": generated_frames,
                "animations": {},
                "meta": {
                    "app": "Empirage move atlas generator",
                    "version": "1.0",
                    "image": image_name,
                    "format": "RGBA8888",
                    "size": {"w": atlas.width, "h": atlas.height},
                    "scale": "1",
                    "sourceSize": {"w": source_size[0], "h": source_size[1]},
                },
            }
            atlas_path = temporary_atlas / (manifest["atlasName"] + ".json")
            atlas_path.write_text(json.dumps(atlas_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            validate_generated_atlas(temporary_atlas / image_name, icon_paths, generated_frames)
            if icons_directory.exists():
                for icon_path in icons_directory.glob("*.png"):
                    icon_path.unlink()
            else:
                icons_directory.mkdir()
            for _, icon_path in icon_paths:
                destination = icons_directory / icon_path.name
                destination.write_bytes(icon_path.read_bytes())
            output_directory.mkdir(exist_ok=True)
            for output_path in output_directory.glob("*"):
                output_path.unlink()
            for generated_path in temporary_atlas.iterdir():
                destination = output_directory / generated_path.name
                destination.write_bytes(generated_path.read_bytes())


if __name__ == "__main__":
    main()
