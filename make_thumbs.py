"""
Tekee galleriaa varten pienennetyt esikatselukuvat.

Käyttö (repon juuressa):
    pip install pillow
    python make_thumbs.py

Käy läpi images/-kansion jpg/jpeg/png-kuvat ja tekee jokaisesta
images/thumbs/<nimi>.jpg -version (pisin sivu 1600 px).
Olemassa olevia esikatselukuvia ei tehdä uudelleen, ellei alkuperäinen
ole muuttunut niiden jälkeen. Sivusto käyttää esikatselukuvaa
automaattisesti, jos sellainen löytyy, muuten alkuperäistä.
"""
from pathlib import Path
from PIL import Image, ImageOps

SRC = Path("images")
DST = SRC / "thumbs"
MAX_SIDE = 1600
QUALITY = 85

DST.mkdir(exist_ok=True)

for src in sorted(SRC.iterdir()):
    if src.suffix.lower() not in (".jpg", ".jpeg", ".png"):
        continue
    dst = DST / (src.stem + ".jpg")
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        print(f"ohitetaan (ajan tasalla): {dst}")
        continue

    with Image.open(src) as im:
        exif = im.getexif()
        im = ImageOps.exif_transpose(im)   # puhelinkuvien kääntö oikein päin
        if im.mode != "RGB":
            im = im.convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)

        exif.pop(0x0112, None)             # kääntötieto pois, kuva on jo käännetty
        im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True,
                exif=exif.tobytes() if len(exif) else b"")

    print(f"{src.name}: {src.stat().st_size / 1e6:.1f} Mt -> {dst.stat().st_size / 1e6:.2f} Mt")
