# Miltzu Images

Astrokuvagalleria GitHub Pagesissa: <https://miltzu.github.io/Images/>

## Rakenne

| Tiedosto | Sisältö |
| --- | --- |
| `index.html` | Etusivu: iso kuva, galleria, taivaskartta, käynnissä oleva projekti |
| `taivas.html` | Tähtitaivas Suomesta juuri nyt ja koko taivaan kartta |
| `projektit.html` | Kuvausprojektit ja niiden edistyminen |
| `prosessointi.html` | Ennen/jälkeen-vertailut |
| `equipment.html`, `loki.html` | Laitteisto ja päivitysloki |
| `assets/site.css`, `assets/site.js`, `assets/sky.js` | Ulkoasu ja toiminnot |
| `images.json`, `projects.json`, `processing.json` | **Sisältö: näitä muokataan** |
| `sky.json`, `sky/milkyway.jpg` | Tähtiluettelo ja Linnunrata taivaskarttaa varten |

Sivua pitää katsoa palvelimen kautta (GitHub Pages tai `python -m http.server`),
koska sisältö luetaan JSON-tiedostoista.

## Uuden kuvan lisääminen

1. Kopioi kuva kansioon `images/` (esim. `images/kuva7.jpg`).
2. Lisää kuvalle merkintä tiedoston `images.json` loppuun.
3. `git pull`, `git add -A`, `git commit -m "Uusi kuva"`, `git push`.

GitHub tekee esikatselukuvat (`images/thumbs/`, `images/large/`) automaattisesti.

### images.json: kentät

Vain `file` on pakollinen. Tekstikenttä voi olla merkkijono tai
`{ "fi": "...", "en": "..." }`, jolloin se vaihtuu kielen mukana.

```json
{
  "file": "images/kuva7.jpg",
  "title": "M42 - Orion Nebula",
  "desc": "Oma lyhyt huomio kuvasta.",
  "category": "deepsky",
  "featured": true,

  "distance": { "ly": 1344 },
  "constellation": { "fi": "Orion", "en": "Orion" },
  "type": { "fi": "Emissiosumu", "en": "Emission nebula" },
  "about": { "fi": "Kohteen tarina...", "en": "The story of the object..." },

  "acquisition": [
    { "filter": "Ha", "count": 40, "exposure": 300 },
    { "filter": "OIII", "count": 40, "exposure": 300 }
  ],
  "telescope": "...", "camera": "...", "mount": "...",
  "date": "12.11.2026", "location": "...", "bortle": 6,
  "project": "PN G75.5+1.7",

  "ra": 83.82, "dec": -5.39,
  "fov": 1.9, "rotation": 104.9, "flipped": false,
  "annotations": [ { "name": "M42", "ra": 83.82, "dec": -5.39 } ]
}
```

- `category`: `deepsky`, `planeetta`, `kuu`, `aurinko`, `revontuli` tai `widefield`.
  Kapeakaistakuva tunnistetaan suodattimista tai kentällä `"narrowband": true`.
- `featured`: tämä kuva näkyy etusivulla isona. Ilman sitä näytetään listan viimeinen.
  `"focus": "50% 30%"` siirtää ison kuvan rajausta.
- `distance`: `{ "ly": valovuodet }`, `{ "km": kilometrit }` tai
  `{ "text": { "fi": "...", "en": "..." } }`. Lisäksi `"approx": true` ja `"note"`.
- `acquisition`: `exposure` on yhden valotuksen pituus sekunteina. Kokonaisaika lasketaan itse.
- `project`: projektin nimi tiedostosta `projects.json`; kuvan tietoihin tulee linkki projektiin.
- `ra`, `dec` (asteina): kohde näkyy taivaskartalla.
- `fov`, `rotation`, `flipped` (plate solve): kuvan päälle saa koordinaattiruudukon.

## projects.json

```json
{
  "name": "PN G75.5+1.7",
  "status": "kesken",
  "category": "deepsky",
  "ra": 303.8425, "dec": 38.0494,
  "desc": "Lyhyt kuvaus.",
  "progress": [ { "filter": "Ha", "done_min": 22.5, "goal_min": 900 } ],
  "updates": [ { "date": "10-1-2026", "text": "...", "image": "images/projektikuva1.jpg" } ]
}
```

`status`: `kesken`, `valmis` tai `suunnitteilla`. Uudet päiväkirjamerkinnät lisätään listan loppuun.

## processing.json

```json
[ { "title": "M31 - Andromeda Galaxy", "desc": "...",
    "steps": [ { "label": "Lineaarinen", "image": "images/m31-p1.jpg", "text": "..." },
               { "label": "Valmis", "image": "images/kuva3.jpg" } ] } ]
```

Vähintään kaksi vaihetta; kuvien pitää olla samaa rajausta ja kokoa.

## Lähteet

Tähtiluettelo ja Linnunradan muoto: d3-celestial (Olaf Frohn, BSD), Hipparcos-aineistoon perustuen.
Planeettojen paikat: NASA JPL:n likimääräiset rataelementit. Fontti: Archivo (SIL Open Font License).
