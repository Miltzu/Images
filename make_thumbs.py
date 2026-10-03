"""
Tekee galleriaa varten kevyemmät kuvaversiot.

Käyttö (repon juuressa):
    pip install pillow
    python make_thumbs.py

Käy läpi images/-kansion jpg/jpeg/png-kuvat ja tekee jokaisesta:
  images/thumbs/<nimi>.jpg  - esikatselukuva galleriaan (pisin sivu 1600 px)
  images/large/<nimi>.jpg   - näyttöversio lightboxiin (pisin sivu 3200 px)

Alkuperäinen kuva jää ennalleen ja on edelleen ladattavissa lataa-napista.
Valmiita versioita ei tehdä uudelleen, ellei alkuperäinen ole muuttunut.
Sivusto käyttää näitä automaattisesti, jos ne löytyvät.
"""
from pathlib import Path
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None  # isot astrokuvat sallittu

SRC = Path("images")
VERSIONS = [
    # (kansio, pisin sivu, jpg-laatu)
    (SRC / "thumbs", 1600, 85),
    (SRC / "large", 3200, 90),
]

for folder, _, _ in VERSIONS:
    folder.mkdir(exist_ok=True)

for src in sorted(SRC.iterdir()):
    if src.suffix.lower() not in (".jpg", ".jpeg", ".png"):
        continue

    todo = []
    for folder, max_side, quality in VERSIONS:
        dst = folder / (src.stem + ".jpg")
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            print(f"ohitetaan (ajan tasalla): {dst}")
        else:
            todo.append((dst, max_side, quality))
    if not todo:
        continue

    with Image.open(src) as original:
        exif = original.getexif()
        base = ImageOps.exif_transpose(original)  # puhelinkuvat oikein päin
        if base.mode != "RGB":
            base = base.convert("RGB")
        exif.pop(0x0112, None)  # kääntötieto pois, kuva on jo käännetty
        exif_bytes = exif.tobytes() if len(exif) else b""

        for dst, max_side, quality in todo:
            im = base.copy()
            im.thumbnail((max_side, max_side), Image.LANCZOS)
            im.save(dst, "JPEG", quality=quality, optimize=True,
                    progressive=True, exif=exif_bytes)
            print(f"{src.name} -> {dst} ({im.width}x{im.height}, "
                  f"{dst.stat().st_size / 1e6:.2f} Mt)")
