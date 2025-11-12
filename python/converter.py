from PIL import Image
import sys
import os

def convert_image(input_path, output_format, output_path):
    try:
        format_map = {
            "jpg": "JPEG",
            "jpeg": "JPEG",
            "png": "PNG",
            "webp": "WEBP"
        }
        fmt = format_map.get(output_format.lower(), output_format.upper())

        with Image.open(input_path) as img:
            # Handle transparency and mode conversion
            if fmt in ["JPEG"] and img.mode in ("RGBA", "LA"):
                img = img.convert("RGB")

            save_params = {}

            # Preserve quality settings
            if fmt == "JPEG":
                save_params = {"quality": 95, "optimize": True}
            elif fmt == "WEBP":
                save_params = {"quality": 95, "method": 6}
            elif fmt == "PNG":
                save_params = {"optimize": True}

            # Preserve EXIF data if available
            exif_data = img.info.get("exif")
            if exif_data:
                save_params["exif"] = exif_data

            img.save(output_path, format=fmt, **save_params)

        print("done")
    except Exception as e:
        print("error:", e)


if __name__ == "__main__":
    input_path = sys.argv[1]
    output_format = sys.argv[2]
    output_path = sys.argv[3]
    convert_image(input_path, output_format, output_path)
