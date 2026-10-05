"""
Tekee galleriaa varten kevyemmät kuvaversiot.

GitHub ajaa tämän automaattisesti (.github/workflows/thumbs.yml), kun
images/-kansioon lisätään tai siinä muutetaan kuva. Voit ajaa sen myös itse:
    pip install pillow
    python make_thumbs.py

Käy läpi images/-kansion jpg/jpeg/png-kuvat ja tekee jokaisesta:
  images/thumbs/<nimi>.jpg  - esikatselukuva galleriaan (pisin sivu 1600 px)
  images/large/<nimi>.jpg   - näyttöversio lightboxiin (pisin sivu 3200 px)

Alkuperäinen kuva jää ennalleen ja on edelleen ladattavissa lataa-napista.
Kuvan sisällön tarkiste tallennetaan tiedostoon images/thumbs/sources.json,
joten vain uudet tai muuttuneet kuvat käsitellään.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None  # isot astrokuvat sallittu

SRC = Path("images")
VERSIONS = [
    # (kansio, pisin sivu, jpg-laatu)
    (SRC / "thumbs", 1600, 85),
    (SRC / "large", 3200, 90),
]
MANIFEST = SRC / "thumbs" / "sources.json"

for folder, _, _ in VERSIONS:
    folder.mkdir(exist_ok=True)

try:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
except (FileNotFoundError, json.JSONDecodeError):
    manifest = {}


def file_hash(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


changed = 0
for src in sorted(SRC.iterdir()):
    if not src.is_file() or src.suffix.lower() not in (".jpg", ".jpeg", ".png"):
        continue

    digest = file_hash(src)
    outputs = [(folder / (src.stem + ".jpg"), max_side, quality)
               for folder, max_side, quality in VERSIONS]
    if manifest.get(src.name) == digest and all(dst.exists() for dst, _, _ in outputs):
        print(f"ohitetaan (ajan tasalla): {src.name}")
        continue

    with Image.open(src) as original:
        exif = original.getexif()
        base = ImageOps.exif_transpose(original)  # puhelinkuvat oikein päin
        if base.mode != "RGB":
            base = base.convert("RGB")
        exif.pop(0x0112, None)  # kääntötieto pois, kuva on jo käännetty
        exif_bytes = exif.tobytes() if len(exif) else b""

        for dst, max_side, quality in outputs:
            im = base.copy()
            im.thumbnail((max_side, max_side), Image.LANCZOS)
            im.save(dst, "JPEG", quality=quality, optimize=True,
                    progressive=True, exif=exif_bytes)
            print(f"{src.name} -> {dst} ({im.width}x{im.height}, "
                  f"{dst.stat().st_size / 1e6:.2f} Mt)")

    manifest[src.name] = digest
    changed += 1

# poistetaan luettelosta kuvat, joita ei enää ole
for name in list(manifest):
    if not (SRC / name).exists():
        del manifest[name]

MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(f"valmis, käsiteltiin {changed} kuvaa")
