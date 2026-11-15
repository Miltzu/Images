/* ==========================================================================
   Miltzu Images – taivaskartta ja planetaario
   "Taivas nyt": tähtitaivas Etelä-Suomesta valittuna hetkenä (sky.json,
   sky/milkyway.jpg). "Koko taivas": koko taivaan kartta Hammer-projektiolla.
   Kohteet tulevat images.json:sta ja projects.json:sta ("ra" ja "dec").
   Tarvitsee tiedoston assets/site.js (window.MZ).
   ========================================================================== */
(() => {
  "use strict";
  const MZ = window.MZ;
  if (!MZ) return;
  const { num, esc, isEnglish, thumbPath, formatRa, formatDec, formatMinutes, pctText,
          displayTitle, projectSlug, projectProgressText, isTouchDevice, openFromList } = MZ;

  function buildSkyMap(list, projects) {
    const section = document.getElementById("skymap-section");
    const svg = document.getElementById("skyMap");
    const projItems = projects
      .map((p, k) => ({ p, k, ra: num(p.ra), dec: num(p.dec), slug: projectSlug(p) }))
      .filter(o => o.ra !== undefined && o.dec !== undefined);

    const items = list
      .map((d, i) => ({ d, i }))
      .filter(o => o.d.ra !== undefined && o.d.dec !== undefined);
    section.hidden = false;

    const wrap = document.getElementById("skyMapWrap");
    const tip = document.getElementById("skyMapTip");
    const listEl = document.getElementById("skyMapList");

    const D = Math.PI / 180;
    const CENTER_RA = 0;
    const CX = 500, CY = 260, S = 480 / (2 * Math.SQRT2);

    // lam = pituus radiaaneina (-pi..pi, positiivinen = oikealle), phi = leveys
    function hammerLP(lam, phi) {
      const z = Math.sqrt(1 + Math.cos(phi) * Math.cos(lam / 2));
      return [CX + S * 2 * Math.SQRT2 * Math.cos(phi) * Math.sin(lam / 2) / z,
              CY - S * Math.SQRT2 * Math.sin(phi) / z];
    }
    function project(ra, dec) {
      let l = ((ra - CENTER_RA) % 360 + 540) % 360 - 180; // -180..180
      return hammerLP(-l * D, dec * D);
    }
    // polku pisteistä; katkaistaan kohdissa, joissa viiva hyppää reunalta toiselle
    function pathFrom(points) {
      let dStr = "", prev = null;
      points.forEach(p => {
        const jump = !prev || Math.abs(p[0] - prev[0]) > 300;
        dStr += (jump ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1);
        prev = p;
      });
      return dStr;
    }
    const range = (a, b, step) => {
      const r = [];
      if (step > 0) for (let v = a; v <= b + 1e-9; v += step) r.push(v);
      else for (let v = a; v >= b - 1e-9; v += step) r.push(v);
      return r;
    };

    // Galaktinen taso (b = 0) ekvatoriaalisiksi koordinaateiksi (J2000)
    const aG = 192.85948 * D, dG = 27.12825 * D, lNCP = 122.93192 * D;
    function galToEq(l, b) {
      l *= D; b *= D;
      const sd = Math.sin(dG) * Math.sin(b) + Math.cos(dG) * Math.cos(b) * Math.cos(lNCP - l);
      const y = Math.cos(b) * Math.sin(lNCP - l);
      const x = Math.cos(dG) * Math.sin(b) - Math.sin(dG) * Math.cos(b) * Math.cos(lNCP - l);
      return [((aG + Math.atan2(y, x)) / D + 360) % 360, Math.asin(sd) / D];
    }
    // Ekliptika
    const EPS = 23.4393 * D;
    function eclToEq(lam) {
      lam *= D;
      return [((Math.atan2(Math.sin(lam) * Math.cos(EPS), Math.cos(lam)) / D) + 360) % 360,
              Math.asin(Math.sin(EPS) * Math.sin(lam)) / D];
    }

    const outline = pathFrom(range(-90, 90, 2).map(p => hammerLP(Math.PI - 1e-6, p * D)))
                  + pathFrom(range(-90, 90, 2).map(p => hammerLP(-Math.PI + 1e-6, p * D)));

    const meridians = range(0, 22, 2).filter(h => h !== 12)
      .map(h => pathFrom(range(-90, 90, 3).map(dec => project(h * 15, dec)))).join("");
    const parallels = [-60, -30, 0, 30, 60]
      .map(dec => pathFrom(range(-179.9, 179.9, 3).map(l => hammerLP(l * D, dec * D)))).join("");

    // Alue, joka ei koskaan nouse 60° pohjoisella leveydellä: dec < -30°
    const south = pathFrom(range(-179.99, 179.99, 3).map(l => hammerLP(l * D, -30 * D)))
      + range(-30, -90, -3).map(p => { const q = hammerLP(Math.PI - 1e-6, p * D); return "L" + q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("")
      + range(-90, -30, 3).map(p => { const q = hammerLP(-Math.PI + 1e-6, p * D); return "L" + q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("")
      + "Z";

    const milkyWay = pathFrom(range(0, 360, 2).map(l => galToEq(l, 0)).map(([r, d]) => project(r, d)));
    const ecliptic = pathFrom(range(0, 360, 2).map(eclToEq).map(([r, d]) => project(r, d)));

    const raLabels = range(0, 22, 2).filter(h => h !== 12).map(h => {
      const [x, y] = project(h * 15, 0);
      return `<text class="sm-label" x="${x.toFixed(1)}" y="${(y + 18).toFixed(1)}" text-anchor="middle">${h}h</text>`;
    }).join("");
    const decLabels = [-60, -30, 30, 60].map(dec => {
      const [x, y] = hammerLP(-Math.PI + 1e-6, dec * D);
      return `<text class="sm-label" x="${(x - 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end">${dec > 0 ? "+" : "−"}${Math.abs(dec)}°</text>`;
    }).join("");

    const shortName = (d) => {
      const t = displayTitle(d);
      return t.split(/\s+[-–—]\s+/)[0];
    };

    const points = items.map(({ d, i }) => {
      const [x, y] = project(d.ra, d.dec);
      const right = x > 820;
      return `
        <g class="sm-point" data-i="${i}" tabindex="0" role="button" aria-label="${esc(displayTitle(d))}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
          <circle class="sm-hit" r="30"></circle>
          <circle class="sm-glow" r="14"></circle>
          <circle class="sm-ring" r="7"></circle>
          <circle class="sm-dot" r="3"></circle>
          <text class="sm-name" x="${right ? -14 : 14}" y="5" text-anchor="${right ? "end" : "start"}">${esc(shortName(d))}</text>
        </g>`;
    }).join("");

    const projPoints = projItems.map(({ p, k, ra, dec }) => {
      const [x, y] = project(ra, dec);
      const right = x > 820;
      return `
        <g class="sm-point sm-project" data-p="${k}" tabindex="0" role="link" aria-label="${esc(p.name || "")}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
          <circle class="sm-hit" r="30"></circle>
          <circle class="sm-glow" r="14"></circle>
          <circle class="sm-ring" r="7"></circle>
          <circle class="sm-dot" r="3"></circle>
          <text class="sm-name" x="${right ? -14 : 14}" y="5" text-anchor="${right ? "end" : "start"}">${esc(p.name || "")}</text>
        </g>`;
    }).join("");

    svg.innerHTML = `
      <defs>
        <clipPath id="smClip"><path d="${outline}"/></clipPath>
        <filter id="smBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
      </defs>
      <path class="sm-sky" d="M${CX - 480} ${CY} A480 240 0 1 0 ${CX + 480} ${CY} A480 240 0 1 0 ${CX - 480} ${CY}Z"/>
      <g clip-path="url(#smClip)">
        <path class="sm-south" d="${south}"/>
        <image class="sm-mw-img" x="0" y="0" width="1000" height="520" href="" preserveAspectRatio="none"/>
        <path class="sm-grid" d="${meridians}${parallels}"/>
        <path class="sm-equator" d="${pathFrom(range(-179.9, 179.9, 3).map(l => hammerLP(l * D, 0)))}"/>
        <path class="sm-ecl" d="${ecliptic}"/>
      </g>
      <path class="sm-edge" d="M${CX - 480} ${CY} A480 240 0 1 0 ${CX + 480} ${CY} A480 240 0 1 0 ${CX - 480} ${CY}Z"/>
      ${raLabels}${decLabels}
      <text class="sm-label sm-pole" x="${CX}" y="${CY - 248}" text-anchor="middle">+90°</text>
      <text class="sm-label sm-pole" x="${CX}" y="${CY + 262}" text-anchor="middle">−90°</text>
      ${projPoints}${points}`;

    // Linnunrata-tekstuuri karttaan: jokaiselle kartan pikselille haetaan
    // taivaan suunta (Hammerin käänteisprojektio) ja sen väri
    (function paintMilkyWay() {
      const imgEl = svg.querySelector(".sm-mw-img");
      if (!imgEl) return;
      const tex = new Image();
      tex.onload = () => {
        const tc = document.createElement("canvas");
        tc.width = tex.naturalWidth; tc.height = tex.naturalHeight;
        const tx = tc.getContext("2d");
        tx.drawImage(tex, 0, 0);
        const td = tx.getImageData(0, 0, tc.width, tc.height).data;
        const MW = 1000, MH = 520, c = document.createElement("canvas");
        c.width = MW; c.height = MH;
        const cx = c.getContext("2d"), out = cx.createImageData(MW, MH), px = out.data;
        for (let y = 0; y < MH; y++) {
          for (let x = 0; x < MW; x++) {
            const X = (x + 0.5 - CX) / S, Y = -(y + 0.5 - CY) / S;
            if ((X * X) / 8 + (Y * Y) / 2 > 1) continue;
            const z = Math.sqrt(1 - (X / 4) ** 2 - (Y / 2) ** 2);
            const lam = 2 * Math.atan2(z * X, 2 * (2 * z * z - 1));
            const phi = Math.asin(Math.max(-1, Math.min(1, z * Y)));
            const ra = ((CENTER_RA - lam / D) % 360 + 360) % 360;
            const dec = phi / D;
            const tx2 = Math.min(tc.width - 1, (ra / 360 * tc.width) | 0);
            const ty2 = Math.min(tc.height - 1, ((90 - dec) / 180 * tc.height) | 0);
            const t = (ty2 * tc.width + tx2) * 4, o = (y * MW + x) * 4;
            px[o] = td[t]; px[o + 1] = td[t + 1]; px[o + 2] = td[t + 2]; px[o + 3] = 255;
          }
        }
        cx.putImageData(out, 0, 0);
        imgEl.setAttribute("href", c.toDataURL("image/png"));
      };
      tex.src = "sky/milkyway.jpg";
    })();

    listEl.innerHTML = items.map(({ d, i }) => {
      const full = displayTitle(d);
      const sn = shortName(d);
      const rest = full.length > sn.length ? full.slice(sn.length).replace(/^\s*[-–—]\s*/, "") : "";
      return `<li><button class="sm-chip" type="button" data-i="${i}"><span class="sm-chip-dot"></span><b>${esc(sn)}</b>${rest ? `<span>${esc(rest)}</span>` : ""}</button></li>`;
    }).join("") + projItems.map(({ p, k }) => `
      <li><button class="sm-chip sm-chip-project" type="button" data-p="${k}"><span class="sm-chip-dot"></span><b>${esc(p.name || "")}</b><span data-fi="Projekti, kesken" data-en="Project, in progress">${isEnglish() ? "Project, in progress" : "Projekti, kesken"}</span></button></li>`).join("");

    const pointEl = (i) => svg.querySelector(`.sm-point[data-i="${i}"]`);
    const highlight = (i, on) => { const g = pointEl(i); if (g) g.classList.toggle("hot", on); };

    function showTip(i) {
      const d = list[i];
      const g = pointEl(i);
      if (!g || !tip) return;
      const en = isEnglish();
      tip.innerHTML = `
        <img src="${esc(thumbPath(d.file))}" alt="">
        <div>
          <strong>${esc(displayTitle(d))}</strong>
          <span>RA ${formatRa(d.ra)}<br>Dec ${formatDec(d.dec)}</span>
          <em>${en ? "Click to open" : "Avaa klikkaamalla"}</em>
        </div>`;
      tip.hidden = false;
      const wr = wrap.getBoundingClientRect();
      const pr = g.querySelector(".sm-dot").getBoundingClientRect();
      const px = pr.left + pr.width / 2 - wr.left;
      const py = pr.top + pr.height / 2 - wr.top;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let left = px + 16, top = py - th - 12;
      if (left + tw > wr.width - 8) left = px - tw - 16;
      if (left < 8) left = 8;
      if (top < 8) top = py + 16;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }
    function hideTip() { if (tip) tip.hidden = true; }

    const projUrl = (o) => "projektit.html#" + o.slug;
    function showProjectTip(o, g) {
      if (!tip) return;
      const en = isEnglish();
      const prog = projectProgressText(o.p);
      tip.innerHTML = `
        <div class="tip-project-icon"></div>
        <div>
          <strong>${esc(o.p.name || "")}</strong>
          <span>${en ? "Project in progress" : "Projekti kesken"}${prog ? `<br>${prog}` : ""}</span>
          <em>${en ? "Click to see the project" : "Katso projekti klikkaamalla"}</em>
        </div>`;
      tip.hidden = false;
      const wr = wrap.getBoundingClientRect();
      const pr = g.querySelector(".sm-dot").getBoundingClientRect();
      const px = pr.left + pr.width / 2 - wr.left, py = pr.top + pr.height / 2 - wr.top;
      let left = px + 16, top = py - tip.offsetHeight - 12;
      if (left + tip.offsetWidth > wr.width - 8) left = px - tip.offsetWidth - 16;
      if (top < 8) top = py + 16;
      tip.style.left = Math.max(8, left) + "px";
      tip.style.top = top + "px";
    }
    svg.querySelectorAll(".sm-project").forEach(g => {
      const o = projItems.find(x => x.k === +g.dataset.p);
      g.addEventListener("click", () => { location.href = projUrl(o); });
      g.addEventListener("keydown", (e) => { if (e.key === "Enter") location.href = projUrl(o); });
      if (!isTouchDevice) {
        g.addEventListener("mouseenter", () => { g.classList.add("hot"); showProjectTip(o, g); });
        g.addEventListener("mouseleave", () => { g.classList.remove("hot"); hideTip(); });
      }
    });

    svg.querySelectorAll(".sm-point:not(.sm-project)").forEach(g => {
      const i = +g.dataset.i;
      g.addEventListener("click", () => { hideTip(); openFromList(list, i); });
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFromList(list, i); }
      });
      if (!isTouchDevice) {
        g.addEventListener("mouseenter", () => { highlight(i, true); showTip(i); });
        g.addEventListener("mouseleave", () => { highlight(i, false); hideTip(); });
      }
      g.addEventListener("focus", () => highlight(i, true));
      g.addEventListener("blur", () => highlight(i, false));
    });
    // "Taivas nyt" -näkymä ja välilehdet
    const live = initSkyLive(list, items, projItems);
    const liveEl = document.getElementById("skyLive");
    const mapPanel = document.getElementById("skyMapPanel");
    let skyMode = "live";
    function setSkyMode(mode) {
      skyMode = live ? mode : "map";
      section.querySelectorAll("[data-skyview]").forEach(b =>
        b.classList.toggle("active", b.dataset.skyview === skyMode));
      if (liveEl) liveEl.hidden = skyMode !== "live";
      if (mapPanel) mapPanel.hidden = skyMode !== "map";
      section.classList.toggle("mode-live", skyMode === "live");
      if (live) live.setActive(skyMode === "live");
    }
    section.querySelectorAll("[data-skyview]").forEach(b =>
      b.addEventListener("click", () => setSkyMode(b.dataset.skyview)));
    setSkyMode("live");

    // Linkki kuvasta tai projektista: taivas.html#kohde-kuva3 / #projekti-tunniste
    const linked = decodeURIComponent(location.hash.slice(1));
    if (live && linked.startsWith("kohde-")) {
      const o = items.find(x => x.d.slug === linked.slice(6));
      if (o) setTimeout(() => live.locate(o.i), 700);
    }
    if (live && linked.startsWith("projekti-")) {
      const o = projItems.find(x => x.slug === linked.slice(9));
      if (o) setTimeout(() => live.locateProject(o.k), 700);
    }

    listEl.querySelectorAll(".sm-chip-project").forEach(btn => {
      const o = projItems.find(x => x.k === +btn.dataset.p);
      btn.addEventListener("click", () => {
        if (skyMode === "live" && live) live.locateProject(o.k);
        else location.href = projUrl(o);
      });
    });

    listEl.querySelectorAll(".sm-chip:not(.sm-chip-project)").forEach(btn => {
      const i = +btn.dataset.i;
      btn.addEventListener("click", () => {
        if (skyMode === "live" && live) live.locate(i);
        else openFromList(list, i);
      });
      btn.addEventListener("mouseenter", () => highlight(i, true));
      btn.addEventListener("mouseleave", () => highlight(i, false));
      btn.addEventListener("focus", () => highlight(i, true));
      btn.addEventListener("blur", () => highlight(i, false));
    });
  }


  // =========================
  // TAIVAS NYT – planetaario
  // Tähtitaivas Etelä-Suomesta katsottuna valittuna hetkenä.
  // Stereografinen projektio (kuten kalansilmä-/allsky-kamera), katse
  // oletuksena suoraan ylös, pohjoinen ylhäällä ja itä vasemmalla.
  // Tähtiaineisto: sky.json (d3-celestial / Hipparcos, kirkkaus ≤ 6).
  // =========================
  function initSkyLive(list, items, projItems) {
    projItems = projItems || [];
    const root = document.getElementById("skyLive");
    const canvas = document.getElementById("skyCanvas");
    if (!root || !canvas || !canvas.getContext) return null;
    const ctx = canvas.getContext("2d");

    const LAT = 60.17, LON = 24.94;      // Helsinki
    const D = Math.PI / 180;
    const sinLat = Math.sin(LAT * D), cosLat = Math.cos(LAT * D);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const view = { az: 180, alt: 90, fov: 180 };
    const layers = { cons: true, mw: true, grid: false, planets: true };
    let timeOffsetH = 0;
    let sky = null, loading = false, active = false;
    let W = 0, H = 0, dpr = 1;
    let hits = [];
    let dirty = true;
    let cardRef = null;   // { kind: "image", i } tai { kind: "project", k }

    const timeEl = document.getElementById("skyTime");
    const sunNote = document.getElementById("skySunNote");
    const tip = document.getElementById("skyLiveTip");
    const card = document.getElementById("skyCard");
    const fullBtn = document.getElementById("skyFull");

    // ---------- tähtitiede ----------
    function nowDate() { return new Date(Date.now() + timeOffsetH * 3600e3); }
    function daysJ2000(date) { return date.getTime() / 86400000 + 2440587.5 - 2451545.0; }
    function lstDeg(d) { return ((280.46061837 + 360.98564736629 * d + LON) % 360 + 360) % 360; }

    function sunPos(d) {
      const g = (357.528 + 0.9856003 * d) * D;
      const lam = (280.460 + 0.9856474 * d + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D;
      const eps = (23.439 - 0.0000004 * d) * D;
      return { ra: Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / D,
               dec: Math.asin(Math.sin(eps) * Math.sin(lam)) / D, lam };
    }
    function moonPos(d, sunLam) {
      const L0 = 218.316 + 13.176396 * d, M = (134.963 + 13.064993 * d) * D, F = (93.272 + 13.229350 * d) * D;
      const lam = (L0 + 6.289 * Math.sin(M)) * D, bet = 5.128 * Math.sin(F) * D;
      const eps = 23.439 * D;
      const ra = Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(bet) * Math.sin(eps), Math.cos(lam)) / D;
      const dec = Math.asin(Math.sin(bet) * Math.cos(eps) + Math.cos(bet) * Math.sin(eps) * Math.sin(lam)) / D;
      const elong = Math.acos(Math.cos(bet) * Math.cos(lam - sunLam));
      return { ra, dec, illum: (1 - Math.cos(elong)) / 2 };
    }
    // Planeetat: JPL:n likimääräiset rataelementit (Standish, 1800–2050).
    // [a, e, I, L, pitkä perihelin, nouseva solmu] ja muutokset / vuosisata
    const PLANETS = [
      { fi: "Merkurius", en: "Mercury", c: "#cfc6b8", r: 2.6, el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], d: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
      { fi: "Venus", en: "Venus", c: "#fff6dc", r: 4.2, el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], d: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418] },
      { fi: "Mars", en: "Mars", c: "#ff8a5c", r: 3.0, el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], d: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
      { fi: "Jupiter", en: "Jupiter", c: "#f3dfc0", r: 3.8, el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], d: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
      { fi: "Saturnus", en: "Saturn", c: "#ecd9a0", r: 3.2, el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], d: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
      { fi: "Uranus", en: "Uranus", c: "#a8e6ef", r: 2.0, el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], d: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
      { fi: "Neptunus", en: "Neptune", c: "#8fb2ff", r: 1.8, el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], d: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] }
    ];
    const EARTH = { el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], d: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] };

    function helio(pl, T) {
      const v = pl.el.map((x, j) => x + pl.d[j] * T);
      const [a, e, I, L, peri, node] = v;
      const w = (peri - node) * D, O = node * D, inc = I * D;
      let M = ((L - peri) % 360 + 540) % 360 - 180;
      M *= D;
      let E = M + e * Math.sin(M);
      for (let n = 0; n < 8; n++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(inc), sI = Math.sin(inc);
      return [
        (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
        (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
        (sw * sI) * xp + (cw * sI) * yp
      ];
    }
    function planetPositions(d) {
      const T = d / 36525;
      const eps = 23.43928 * D;
      const earth = helio(EARTH, T);
      return PLANETS.map(pl => {
        const h = helio(pl, T);
        const x = h[0] - earth[0], y = h[1] - earth[1], z = h[2] - earth[2];
        const ye = y * Math.cos(eps) - z * Math.sin(eps);
        const ze = y * Math.sin(eps) + z * Math.cos(eps);
        const dist = Math.hypot(x, ye, ze);
        return { pl, ra: ((Math.atan2(ye, x) / D) + 360) % 360, dec: Math.asin(ze / dist) / D };
      });
    }
    // testausta varten: planeettojen paikat annettuna hetkenä
    window.__skyPlanets = (date) => planetPositions(daysJ2000(date || new Date()));

    function altAz(ra, dec, lst) {
      const h = (lst - ra) * D, dd = dec * D;
      const up = sinLat * Math.sin(dd) + cosLat * Math.cos(dd) * Math.cos(h);
      const north = cosLat * Math.sin(dd) - sinLat * Math.cos(dd) * Math.cos(h);
      const east = -Math.cos(dd) * Math.sin(h);
      return { alt: Math.asin(up) / D, az: ((Math.atan2(east, north) / D) + 360) % 360 };
    }

    // ---------- projektio ----------
    // Matriisi: ekvatoriaalinen yksikkövektori -> kameran koordinaatit
    let M = null, S = 1;
    function buildMatrix(lst) {
      const sL = Math.sin(lst * D), cL = Math.cos(lst * D);
      const A = [
        [-sL, cL, 0],                                // itä
        [-sinLat * cL, -sinLat * sL, cosLat],         // pohjoinen
        [cosLat * cL, cosLat * sL, sinLat]            // ylös
      ];
      const az = view.az * D, al = view.alt * D;
      const f = [Math.cos(al) * Math.sin(az), Math.cos(al) * Math.cos(az), Math.sin(al)];
      const r = [Math.cos(az), -Math.sin(az), 0];
      const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      const C = [r, u, f];
      M = C.map(row => [0, 1, 2].map(j => row[0] * A[0][j] + row[1] * A[1][j] + row[2] * A[2][j]));
      S = Math.min(W, H) / 2 / (2 * Math.tan(view.fov * D / 4));
      return { r, u, f, A };
    }
    const out = [0, 0, 0, 0];
    // palauttaa false, jos piste on kameran takana
    function projVec(x, y, z) {
      const cx = M[0][0] * x + M[0][1] * y + M[0][2] * z;
      const cy = M[1][0] * x + M[1][1] * y + M[1][2] * z;
      const cz = M[2][0] * x + M[2][1] * y + M[2][2] * z;
      if (cz < -0.6) return false;
      const k = 2 / (1 + cz);
      out[0] = W / 2 + S * k * cx;
      out[1] = H / 2 - S * k * cy;
      out[2] = k;
      out[3] = cz;
      return true;
    }
    function projRaDec(ra, dec) {
      const a = ra * D, d = dec * D, c = Math.cos(d);
      return projVec(c * Math.cos(a), c * Math.sin(a), Math.sin(d));
    }
    // horisonttikoordinaatit (itä, pohjoinen, ylös) -> näyttö
    let cam = null;
    function projHor(e, n, u) {
      const cx = cam.r[0] * e + cam.r[1] * n;
      const cy = cam.u[0] * e + cam.u[1] * n + cam.u[2] * u;
      const cz = cam.f[0] * e + cam.f[1] * n + cam.f[2] * u;
      if (cz < -0.6) return null;
      const k = 2 / (1 + cz);
      return [W / 2 + S * k * cx, H / 2 - S * k * cy];
    }
    function horVec(az, alt) {
      return [Math.cos(alt * D) * Math.sin(az * D), Math.cos(alt * D) * Math.cos(az * D), Math.sin(alt * D)];
    }
    // näytön piste -> atsimuutti/korkeus
    function unproject(px, py) {
      const X = (px - W / 2) / S, Y = -(py - H / 2) / S;
      const rho2 = X * X + Y * Y;
      const cz = (4 - rho2) / (4 + rho2);
      const cx = X * (1 + cz) / 2, cy = Y * (1 + cz) / 2;
      const h = [0, 1, 2].map(j => cx * cam.r[j] + cy * cam.u[j] + cz * cam.f[j]);
      return { az: ((Math.atan2(h[0], h[1]) / D) + 360) % 360, alt: Math.asin(Math.max(-1, Math.min(1, h[2]))) / D };
    }

    // ---------- aineisto ----------
    let starVec = null, lineVec = null, consVec = null, nameVec = null;
    let mwTex = null;
    function toVecs(arr) {
      const v = new Float32Array(arr.length * 3);
      arr.forEach((p, i) => {
        const a = p[0] * D, d = p[1] * D, c = Math.cos(d);
        v[i * 3] = c * Math.cos(a); v[i * 3 + 1] = c * Math.sin(a); v[i * 3 + 2] = Math.sin(d);
      });
      return v;
    }
    function bvColor(bv) {
      if (bv < 0) return "rgb(175,200,255)";
      if (bv < 0.3) return "rgb(215,228,255)";
      if (bv < 0.6) return "rgb(255,255,255)";
      if (bv < 0.9) return "rgb(255,244,214)";
      if (bv < 1.3) return "rgb(255,222,170)";
      return "rgb(255,196,140)";
    }
    function load() {
      if (sky || loading) return;
      loading = true;
      fetch("sky.json")
        .then(r => r.json())
        .then(data => {
          sky = data;
          starVec = toVecs(sky.stars);
          sky.starColor = sky.stars.map(s => bvColor(s[3]));
          lineVec = sky.lines.map(toVecs);
          consVec = toVecs(sky.cons);
          nameVec = toVecs(sky.names);
          root.classList.add("ready");
          requestDraw();
        })
        .catch(() => { root.classList.add("failed"); });
      // Linnunrata: koko taivaan tekstuuri (RA 0..360 vasemmalta, Dec +90 ylhäällä)
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const cx = c.getContext("2d");
        cx.drawImage(img, 0, 0);
        mwTex = { w: c.width, h: c.height, data: cx.getImageData(0, 0, c.width, c.height).data };
        requestDraw();
      };
      img.src = "sky/milkyway.jpg";
    }

    // ---------- piirto ----------
    const mwCanvas = document.createElement("canvas");
    const mwCtx = mwCanvas.getContext("2d");
    let mwImg = null;

    // Linnunradan tekstuuri piirretään taivaalle pikseli kerrallaan:
    // jokaiselle näytön pisteelle haetaan suunta taivaalla ja sen väri.
    // Lasketaan puolella resoluutiolla ja venytetään (pehmeä hehku).
    function drawMilkyWay(A, alpha) {
      if (!mwTex) return;
      const q = W * H > 900000 ? 3 : 2;
      const w = Math.ceil(W / q), h = Math.ceil(H / q);
      if (mwCanvas.width !== w || mwCanvas.height !== h || !mwImg) {
        mwCanvas.width = w; mwCanvas.height = h;
        mwImg = mwCtx.createImageData(w, h);
      }
      const px = mwImg.data, tex = mwTex.data, TW = mwTex.w, TH = mwTex.h;
      const r = cam.r, u = cam.u, f = cam.f;
      const A0 = A[0], A1 = A[1], A2 = A[2];
      const TWO_PI = Math.PI * 2;
      let o = 0;
      for (let y = 0; y < h; y++) {
        const Y = -((y + 0.5) * q - H / 2) / S;
        for (let x = 0; x < w; x++, o += 4) {
          const X = ((x + 0.5) * q - W / 2) / S;
          const rho2 = X * X + Y * Y;
          const cz = (4 - rho2) / (4 + rho2);
          const k = (1 + cz) / 2;
          const cx = X * k, cy = Y * k;
          const hE = cx * r[0] + cy * u[0] + cz * f[0];
          const hN = cx * r[1] + cy * u[1] + cz * f[1];
          const hU = cy * u[2] + cz * f[2];
          if (hU < -0.01) { px[o + 3] = 0; continue; }
          const ex = hE * A0[0] + hN * A1[0] + hU * A2[0];
          const ey = hE * A0[1] + hN * A1[1] + hU * A2[1];
          const ez = hE * A0[2] + hN * A1[2] + hU * A2[2];
          let ra = Math.atan2(ey, ex); if (ra < 0) ra += TWO_PI;
          const dec = Math.asin(ez > 1 ? 1 : ez < -1 ? -1 : ez);
          const tx = Math.min(TW - 1, (ra / TWO_PI * TW) | 0);
          const ty = Math.min(TH - 1, ((0.5 - dec / Math.PI) * TH) | 0);
          const t = (ty * TW + tx) * 4;
          // ilmakehän himmennys lähellä horisonttia
          const ext = hU > 0.4 ? 1 : 0.2 + hU * 2;
          px[o] = tex[t] * ext; px[o + 1] = tex[t + 1] * ext; px[o + 2] = tex[t + 2] * ext; px[o + 3] = 255;
        }
      }
      mwCtx.putImageData(mwImg, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(mwCanvas, 0, 0, w * q, h * q);
      ctx.restore();
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      const newDpr = Math.min(window.devicePixelRatio || 1, 2);
      // puhelimen osoitepalkki laukaisee resize-tapahtumia selatessa;
      // kankaan tyhjennys ja uudelleenpiirto vain jos koko muuttui
      if (Math.abs(r.width - W) < 0.5 && Math.abs(r.height - H) < 0.5 && newDpr === dpr && canvas.width) return;
      dpr = newDpr;
      W = r.width; H = r.height;
      // puhelimessa tietokortti sijoitetaan painikerivin yläpuolelle
      const bar = root.querySelector(".skylive-bar");
      if (bar) root.style.setProperty("--bar-h", (getComputedStyle(bar).position === "static" ? bar.offsetHeight : 0) + "px");
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      mwImg = null;
      requestDraw();
    }

    let drawPending = false;
    function requestDraw() {
      dirty = true;
      if (drawPending) return;
      drawPending = true;
      requestAnimationFrame(() => { drawPending = false; if (dirty) draw(); });
    }

    function circleFrom3(a, b, c) {
      const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
      if (Math.abs(d) < 1e-9) return null;
      const a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
      const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
      const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
      return [x, y, Math.hypot(a[0] - x, a[1] - y)];
    }

    function polyline(vec, closed) {
      let started = false;
      const n = vec.length / 3;
      for (let i = 0; i < n; i++) {
        if (projVec(vec[i * 3], vec[i * 3 + 1], vec[i * 3 + 2]) && out[3] > -0.3) {
          if (started) ctx.lineTo(out[0], out[1]); else ctx.moveTo(out[0], out[1]);
          started = true;
        } else started = false;
      }
    }

    function draw() {
      dirty = false;
      if (!W || !H) return;
      const en = isEnglish();
      const date = nowDate();
      const d = daysJ2000(date);
      const lst = lstDeg(d);
      cam = buildMatrix(lst);

      const sun = sunPos(d);
      const sunH = altAz(sun.ra, sun.dec, lst);
      // taivaan väri auringon korkeuden mukaan (hämärä / päivä)
      const t = Math.max(0, Math.min(1, (sunH.alt + 18) / 24));   // -18° -> 0, +6° -> 1
      const starDim = 1 - 0.7 * t;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // maa
      ctx.fillStyle = "#050605";
      ctx.fillRect(0, 0, W, H);

      // horisonttiympyrä
      const hp = [view.az, view.az + 90, view.az - 90].map(a => { const v = horVec(a, 0); return projHor(v[0], v[1], v[2]); });
      const circ = hp.every(Boolean) ? circleFrom3(hp[0], hp[1], hp[2]) : null;
      if (!circ) return;
      const zen = projHor(0, 0, 1) || [W / 2, H / 2];

      ctx.save();
      ctx.beginPath();
      ctx.arc(circ[0], circ[1], circ[2], 0, Math.PI * 2);
      ctx.clip();

      const g = ctx.createRadialGradient(zen[0], zen[1], 0, circ[0], circ[1], circ[2]);
      const top = [Math.round(2 + 40 * t), Math.round(4 + 70 * t), Math.round(10 + 120 * t)];
      const bottom = [Math.round(10 + 60 * t), Math.round(16 + 80 * t), Math.round(26 + 110 * t)];
      g.addColorStop(0, `rgb(${top})`);
      g.addColorStop(1, `rgb(${bottom})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      if (!sky) {
        ctx.restore();
        drawHorizon(circ, en);
        return;
      }

      // Linnunrata
      if (layers.mw) drawMilkyWay(cam.A, 0.8 * starDim);

      // koordinaattiruudukko (RA/Dec)
      if (layers.grid) {
        ctx.strokeStyle = "rgba(120,170,220,0.16)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let h = 0; h < 24; h += 2) {
          let first = true;
          for (let dec = -88; dec <= 88; dec += 2) {
            if (projRaDec(h * 15, dec) && out[3] > -0.3) {
              if (first) ctx.moveTo(out[0], out[1]); else ctx.lineTo(out[0], out[1]);
              first = false;
            } else first = true;
          }
        }
        for (let dec = -75; dec <= 75; dec += 15) {
          let first = true;
          for (let ra = 0; ra <= 360; ra += 3) {
            if (projRaDec(ra, dec) && out[3] > -0.3) {
              if (first) ctx.moveTo(out[0], out[1]); else ctx.lineTo(out[0], out[1]);
              first = false;
            } else first = true;
          }
        }
        ctx.stroke();
      }

      // tähtikuviot
      if (layers.cons) {
        ctx.strokeStyle = `rgba(110,170,230,${0.34 * starDim})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        lineVec.forEach(v => polyline(v));
        ctx.stroke();
      }

      // tähdet (kirkkaimmat viimeisenä, aineisto on järjestetty kirkkauden mukaan)
      const zoomBoost = Math.min(2.4, Math.pow(180 / view.fov, 0.3));
      const A2 = cam.A[2];
      const magLimit = 6.2;
      for (let i = sky.stars.length - 1; i >= 0; i--) {
        if (!projVec(starVec[i * 3], starVec[i * 3 + 1], starVec[i * 3 + 2])) continue;
        const x = out[0], y = out[1];
        if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
        const mag = sky.stars[i][2];
        const up = A2[0] * starVec[i * 3] + A2[1] * starVec[i * 3 + 1] + A2[2] * starVec[i * 3 + 2];
        const ext = up > 0.35 ? 1 : Math.max(0.15, 0.3 + up * 2);
        const r = Math.max(0.45, (magLimit - mag) * 0.42) * zoomBoost * (0.6 + 0.4 * ext);
        const alpha = Math.min(1, 0.25 + (magLimit - mag) * 0.2) * starDim * ext;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = sky.starColor[i];
        if (r < 1.1) {
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        } else {
          if (mag < 1.6) {
            const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
            gl.addColorStop(0, "rgba(255,255,255,0.35)");
            gl.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = gl;
            ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = sky.starColor[i];
          }
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // tähtikuvioiden ja tähtien nimet: tiheys sen mukaan, montako pikseliä
      // yksi aste on näytöllä (pienellä näytöllä nimet tulevat zoomatessa)
      const ppd = Math.min(W, H) / view.fov;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (layers.cons) {
        ctx.font = "500 11px \"Archivo Variable\", system-ui, sans-serif";
        ctx.fillStyle = `rgba(130,180,230,${0.62 * starDim})`;
        sky.cons.forEach((c, i) => {
          const need = c[4] === 1 ? 3.4 : c[4] === 2 ? 6 : 9;
          if (ppd < need) return;
          if (!projVec(consVec[i * 3], consVec[i * 3 + 1], consVec[i * 3 + 2]) || out[3] < 0) return;
          ctx.fillText((en ? c[3] : c[2]).toUpperCase(), out[0], out[1]);
        });
      }
      ctx.font = "400 11px \"Archivo Variable\", system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = `rgba(232,238,244,${0.7 * starDim})`;
      sky.names.forEach((s, i) => {
        if (ppd < (s[3] < 1.0 ? 3 : 5.5)) return;
        if (!projVec(nameVec[i * 3], nameVec[i * 3 + 1], nameVec[i * 3 + 2]) || out[3] < 0) return;
        ctx.fillText(s[2], out[0] + 6, out[1] - 6);
      });

      // planeetat
      if (layers.planets) {
        planetPositions(d).forEach(({ pl, ra, dec }) => {
          // Uranus ja Neptunus (ei näy paljain silmin) vasta lähempää katsottaessa
          if (pl.r < 2.2 && ppd < 3.5) return;
          if (!projRaDec(ra, dec) || out[3] < 0) return;
          const x = out[0], y = out[1];
          const r = pl.r * Math.min(1.8, Math.pow(180 / view.fov, 0.2));
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
          g.addColorStop(0, pl.c);
          g.addColorStop(0.3, pl.c + "66");
          g.addColorStop(1, pl.c + "00");
          ctx.globalAlpha = Math.max(0.55, starDim);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, r * 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = pl.c;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.font = "500 11px \"Archivo Variable\", system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillStyle = pl.c;
          ctx.fillText(en ? pl.en : pl.fi, x + r + 5, y + r + 7);
        });
      }

      // Aurinko ja Kuu
      const moon = moonPos(d, sun.lam);
      drawBody(sun.ra, sun.dec, "#ffd36b", 0, en ? "Sun" : "Aurinko", 1);
      drawBody(moon.ra, moon.dec, "#e8e4d8", 1, en ? "Moon" : "Kuu", moon.illum, sun);

      // kuvatut kohteet
      hits = [];
      ctx.font = "600 13px \"Archivo Variable\", system-ui, sans-serif";
      // projektikohteet: oranssi katkoviivarengas
      projItems.forEach(o => {
        if (!projRaDec(o.ra, o.dec) || out[3] < 0) return;
        const x = out[0], y = out[1];
        const hot = cardRef && cardRef.kind === "project" && cardRef.k === o.k;
        ctx.beginPath(); ctx.arc(x, y, hot ? 16 : 12, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(87,208,224,0.14)"; ctx.fill();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.6; ctx.strokeStyle = "#57d0e0";
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        const right = x + 14 + ctx.measureText(o.p.name || "").width > W - 6;
        ctx.textAlign = right ? "right" : "left";
        ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(0,0,0,0.85)";
        const lx = x + (right ? -14 : 14);
        ctx.strokeText(o.p.name || "", lx, y + 1);
        ctx.fillStyle = "#57d0e0";
        ctx.fillText(o.p.name || "", lx, y + 1);
        hits.push({ x, y, kind: "project", k: o.k });
      });
      items.forEach(({ d: item, i }) => {
        if (!projRaDec(item.ra, item.dec) || out[3] < 0) return;
        const x = out[0], y = out[1];
        const hot = cardRef && cardRef.kind === "image" && cardRef.i === i;
        ctx.beginPath();
        ctx.arc(x, y, hot ? 16 : 12, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(245,185,74,0.16)";
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = "#f5b94a";
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
        const label = displayTitle(item).split(/\s+[-–—]\s+/)[0];
        const flip = x + 14 + ctx.measureText(label).width > W - 6;
        ctx.textAlign = flip ? "right" : "left";
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        const lx = x + (flip ? -14 : 14);
        ctx.strokeText(label, lx, y + 1);
        ctx.fillStyle = hot ? "#f5b94a" : "#e8eef4";
        ctx.fillText(label, lx, y + 1);
        hits.push({ x, y, kind: "image", i });
      });

      ctx.restore();
      drawHorizon(circ, en);

      // aikaleima ja huomautukset
      if (timeEl) {
        timeEl.textContent = date.toLocaleString(en ? "en-GB" : "fi-FI", {
          timeZone: "Europe/Helsinki", weekday: "short", day: "numeric", month: "numeric",
          hour: "2-digit", minute: "2-digit"
        });
      }
      if (sunNote) {
        let note = "";
        if (sunH.alt > 0) note = en ? "The Sun is up – stars shown dimmed" : "Aurinko on ylhäällä – tähdet himmennetty";
        else if (sunH.alt > -12) note = en ? "Twilight" : "Hämärä";
        sunNote.textContent = note;
        sunNote.hidden = !note;
      }
      if (cardRef) renderCard();
    }

    function drawBody(ra, dec, color, kind, label, illum, sun) {
      if (!projRaDec(ra, dec) || out[3] < 0) return;
      const x = out[0], y = out[1];
      const r = Math.max(5, S * out[2] * 0.26 * D * 2.2);
      ctx.save();
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      glow.addColorStop(0, kind ? "rgba(232,228,216,0.28)" : "rgba(255,211,107,0.45)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
      if (kind && sun && projRaDec(sun.ra, sun.dec)) {
        // Kuun vaihe: valaistu puoli osoittaa kohti aurinkoa
        const ang = Math.atan2(out[1] - y, out[0] - x);
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = "#1a1c22";
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
        const ex = r * (1 - 2 * illum);
        ctx.ellipse(0, 0, Math.abs(ex), r, 0, Math.PI / 2, -Math.PI / 2, ex < 0);
        ctx.fill();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.font = "500 11px \"Archivo Variable\", system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = color;
      ctx.fillText(label, x + r + 6, y - r - 2);
    }

    function drawHorizon(circ, en) {
      ctx.strokeStyle = "rgba(245,185,74,0.35)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(circ[0], circ[1], circ[2], 0, Math.PI * 2);
      ctx.stroke();
      const names = en ? ["N", "E", "S", "W"] : ["P", "I", "E", "L"];
      ctx.font = "600 13px \"Archivo Variable\", system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      [0, 90, 180, 270].forEach((az, k) => {
        const v = horVec(az, 0);
        const p = projHor(v[0], v[1], v[2]);
        if (!p) return;
        // nimi horisontin ulkopuolelle (maan puolelle)
        let dx = p[0] - circ[0], dy = p[1] - circ[1];
        const len = Math.hypot(dx, dy) || 1;
        const x = p[0] + dx / len * 14, y = p[1] + dy / len * 14;
        if (x < 8 || y < 8 || x > W - 8 || y > H - 8) return;
        ctx.fillStyle = k === 0 ? "#f5b94a" : "rgba(232,238,244,0.75)";
        ctx.fillText(names[k], x, y);
      });
    }

    // ---------- kohteen tietokortti ----------
    function riseTime(item) {
      const start = nowDate().getTime();
      for (let m = 5; m <= 24 * 60; m += 5) {
        const dt = new Date(start + m * 60000);
        if (altAz(item.ra, item.dec, lstDeg(daysJ2000(dt))).alt > 0) return dt;
      }
      return null;
    }
    function renderCard() {
      if (!card || !cardRef) { if (card) card.hidden = true; return; }
      const en = isEnglish();
      const isProj = cardRef.kind === "project";
      const o = isProj ? projItems.find(x => x.k === cardRef.k) : items.find(x => x.i === cardRef.i);
      if (!o) { card.hidden = true; return; }
      const ra = isProj ? o.ra : o.d.ra, dec = isProj ? o.dec : o.d.dec;
      const pos = altAz(ra, dec, lstDeg(daysJ2000(nowDate())));
      let status;
      if (pos.alt > 0) {
        status = en ? `${Math.round(pos.alt)}° above the horizon` : `${Math.round(pos.alt)}° horisontin yläpuolella`;
      } else {
        const rt = riseTime({ ra, dec });
        const hhmm = rt ? rt.toLocaleTimeString(en ? "en-GB" : "fi-FI", { timeZone: "Europe/Helsinki", hour: "2-digit", minute: "2-digit" }) : "";
        status = rt ? (en ? `Below the horizon – rises at ${hhmm}` : `Horisontin alla – nousee klo ${hhmm}`)
                    : (en ? "Does not rise in Finland" : "Ei nouse Suomessa");
      }
      const key = JSON.stringify(cardRef) + "|" + status + "|" + en;
      if (card.dataset.key === key && !card.hidden) return;
      card.dataset.key = key;
      if (isProj) {
        const prog = projectProgressText(o.p);
        card.innerHTML = `
          <button class="skylive-card-close" type="button" aria-label="${en ? "Close" : "Sulje"}">×</button>
          <div class="skylive-card-proj"></div>
          <div>
            <strong>${esc(o.p.name || "")}</strong>
            <span class="proj">${en ? "Project in progress" : "Projekti kesken"}${prog ? ` · ${prog}` : ""}</span>
            <span class="${pos.alt > 0 ? "up" : "down"}">${status}</span>
            <a class="btn btn-project" href="projektit.html#${o.slug}">${en ? "See project" : "Katso projekti"}</a>
          </div>`;
        card.classList.add("is-project");
      } else {
        card.innerHTML = `
          <button class="skylive-card-close" type="button" aria-label="${en ? "Close" : "Sulje"}">×</button>
          <img src="${esc(thumbPath(o.d.file))}" alt="">
          <div>
            <strong>${esc(displayTitle(o.d))}</strong>
            <span class="${pos.alt > 0 ? "up" : "down"}">${status}</span>
            <button class="btn btn-primary skylive-open" type="button">${en ? "Open image" : "Avaa kuva"}</button>
          </div>`;
        card.classList.remove("is-project");
        card.querySelector(".skylive-open").addEventListener("click", () => openFromList(list, o.i));
      }
      card.hidden = false;
      card.querySelector(".skylive-card-close").addEventListener("click", () => { cardRef = null; card.hidden = true; requestDraw(); });
    }

    // kääntää katseen kohteeseen
    let anim = 0;
    function lookAt(az, alt, fov) {
      const from = { ...view };
      let dAz = ((az - from.az + 540) % 360) - 180;
      const to = { az: from.az + dAz, alt: Math.max(15, Math.min(90, alt)), fov };
      cancelAnimationFrame(anim);
      if (reduceMotion) { Object.assign(view, to); view.az = (view.az + 360) % 360; requestDraw(); return; }
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 900);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        view.az = (from.az + (to.az - from.az) * e + 360) % 360;
        view.alt = from.alt + (to.alt - from.alt) * e;
        view.fov = from.fov + (to.fov - from.fov) * e;
        draw();
        if (k < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }

    function locateAt(ref, ra, dec) {
      cardRef = ref;
      const pos = altAz(ra, dec, lstDeg(daysJ2000(nowDate())));
      if (pos.alt > 0) lookAt(pos.az, pos.alt, 70);
      if (card) card.dataset.key = "";
      renderCard();
      requestDraw();
      root.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    }

    function locate(i) {
      const o = items.find(x => x.i === i);
      if (o) locateAt({ kind: "image", i }, o.d.ra, o.d.dec);
    }
    function locateProject(k) {
      const o = projItems.find(x => x.k === k);
      if (o) locateAt({ kind: "project", k }, o.ra, o.dec);
    }

    // ---------- ohjaus ----------
    const pointers = new Map();
    let dragStart = null, pinchStart = null, moved = false;

    function hitAt(x, y) {
      let best = null, bd = 22;
      hits.forEach(h => { const dd = Math.hypot(h.x - x, h.y - y); if (dd < bd) { bd = dd; best = h; } });
      return best;
    }
    function localXY(e) {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    function setFov(f) { view.fov = Math.max(4, Math.min(185, f)); requestDraw(); }

    canvas.addEventListener("pointerdown", (e) => {
      cancelAnimationFrame(anim);
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, localXY(e));
      moved = false;
      if (pointers.size === 1) dragStart = { xy: localXY(e), az: view.az, alt: view.alt };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), fov: view.fov };
      }
      hideTip();
    });
    canvas.addEventListener("pointermove", (e) => {
      const xy = localXY(e);
      if (!pointers.has(e.pointerId)) {
        // hiiren leijunta: vihje kohteen päällä
        if (e.pointerType === "mouse") {
          const h = hitAt(xy[0], xy[1]);
          canvas.style.cursor = h ? "pointer" : "grab";
          if (h) showTip(h); else hideTip();
        }
        return;
      }
      pointers.set(e.pointerId, xy);
      if (pointers.size === 2 && pinchStart) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        setFov(pinchStart.fov * pinchStart.dist / Math.max(dist, 1));
        moved = true;
        return;
      }
      if (pointers.size === 1 && dragStart) {
        const dx = xy[0] - dragStart.xy[0], dy = xy[1] - dragStart.xy[1];
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        const radPerPx = 1 / S;
        const cosAlt = Math.max(Math.cos(view.alt * D), 0.35);
        view.az = ((dragStart.az - dx * radPerPx / D / cosAlt) % 360 + 360) % 360;
        view.alt = Math.max(2, Math.min(90, dragStart.alt + dy * radPerPx / D));
        canvas.style.cursor = "grabbing";
        requestDraw();
      }
    });
    function endPointer(e) {
      const wasTap = pointers.size === 1 && !moved;
      const xy = localXY(e);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (pointers.size === 1) {
        const [p] = [...pointers.values()];
        dragStart = { xy: p, az: view.az, alt: view.alt };
      } else if (pointers.size === 0) dragStart = null;
      canvas.style.cursor = "grab";
      if (wasTap && e.type === "pointerup") {
        const h = hitAt(xy[0], xy[1]);
        if (h && h.kind === "project") locateProject(h.k);
        else if (h) openFromList(list, h.i);
      }
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      cancelAnimationFrame(anim);
      setFov(view.fov * Math.exp(e.deltaY * 0.0015));
    }, { passive: false });
    canvas.addEventListener("dblclick", (e) => {
      const [x, y] = localXY(e);
      const p = unproject(x, y);
      lookAt(p.az, p.alt, Math.max(4, view.fov / 2));
    });

    function showTip(h) {
      const en = isEnglish();
      if (h.kind === "project") {
        const o = projItems.find(x => x.k === h.k);
        if (!tip || !o) return;
        const prog = projectProgressText(o.p);
        tip.innerHTML = `
          <div class="tip-project-icon"></div>
          <div>
            <strong>${esc(o.p.name || "")}</strong>
            <span>${en ? "Project in progress" : "Projekti kesken"}${prog ? `<br>${prog}` : ""}</span>
            <em>${en ? "Click for details" : "Lisätietoja klikkaamalla"}</em>
          </div>`;
        placeTip(h);
        return;
      }
      const d = list[h.i];
      if (!tip || !d) return;
      tip.innerHTML = `
        <img src="${esc(thumbPath(d.file))}" alt="">
        <div>
          <strong>${esc(displayTitle(d))}</strong>
          <span>RA ${formatRa(d.ra)}<br>Dec ${formatDec(d.dec)}</span>
          <em>${en ? "Click to open" : "Avaa klikkaamalla"}</em>
        </div>`;
      placeTip(h);
    }
    function placeTip(h) {
      tip.hidden = false;
      const cr = canvas.getBoundingClientRect(), rr = root.getBoundingClientRect();
      const px = h.x + cr.left - rr.left, py = h.y + cr.top - rr.top;
      let left = px + 16, top = py - tip.offsetHeight - 12;
      if (left + tip.offsetWidth > rr.width - 8) left = px - tip.offsetWidth - 16;
      if (top < 8) top = py + 16;
      tip.style.left = Math.max(8, left) + "px";
      tip.style.top = top + "px";
    }
    function hideTip() { if (tip) tip.hidden = true; }
    canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hideTip(); });

    // "Yö": seuraava klo 23 Suomen aikaa (tai nyt, jos on jo yö)
    function hoursToNight() {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", hour: "numeric", minute: "numeric", hourCycle: "h23" })
        .formatToParts(new Date());
      const h = +parts.find(p => p.type === "hour").value + (+parts.find(p => p.type === "minute").value) / 60;
      if (h >= 23 || h < 3) return 0;
      return 23 - h;
    }
    root.querySelectorAll("[data-time]").forEach(b => b.addEventListener("click", () => {
      const v = b.dataset.time;
      if (v === "night") timeOffsetH = hoursToNight();
      else timeOffsetH = +v === 0 ? 0 : timeOffsetH + (+v);
      root.querySelector(".sky-now").classList.toggle("active", timeOffsetH === 0);
      const night = root.querySelector(".sky-night");
      if (night) night.classList.toggle("active", v === "night" && timeOffsetH !== 0);
      requestDraw();
    }));
    root.querySelectorAll("[data-layer]").forEach(b => b.addEventListener("click", () => {
      layers[b.dataset.layer] = !layers[b.dataset.layer];
      b.classList.toggle("active", layers[b.dataset.layer]);
      requestDraw();
    }));
    root.querySelectorAll("[data-zoom]").forEach(b => b.addEventListener("click", () => {
      const z = b.dataset.zoom;
      if (z === "in") lookAt(view.az, view.alt, Math.max(4, view.fov / 1.6));
      if (z === "out") lookAt(view.az, view.alt, Math.min(185, view.fov * 1.6));
      if (z === "reset") lookAt(180, 90, 180);
    }));

    // koko näyttö (CSS-pohjainen, toimii myös iPhonessa)
    function setFull(on) {
      root.classList.toggle("is-full", on);
      document.body.classList.toggle("sky-full", on);
      if (fullBtn) fullBtn.classList.toggle("active", on);
      if (on && !(history.state && history.state.skyFull)) history.pushState({ skyFull: true }, "");
      resize();
    }
    if (fullBtn) fullBtn.addEventListener("click", () => {
      if (root.classList.contains("is-full")) {
        if (history.state && history.state.skyFull) history.back(); else setFull(false);
      } else setFull(true);
    });
    window.addEventListener("popstate", () => {
      if (root.classList.contains("is-full") && !(history.state && history.state.skyFull)) setFull(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && root.classList.contains("is-full") && !MZ.viewerIsOpen()) {
        if (history.state && history.state.skyFull) history.back(); else setFull(false);
      }
    });

    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    window.addEventListener("resize", resize);
    document.addEventListener("langchange", () => { if (card) card.dataset.key = ""; requestDraw(); });

    // taivas päivittyy itsestään, kun näkymä on esillä ja aika on "nyt"
    setInterval(() => { if (active && timeOffsetH === 0 && !document.hidden) requestDraw(); }, 30000);

    // aineisto ladataan vasta kun kartta on lähellä näkyvää aluetta
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some(en => en.isIntersecting)) { load(); io.disconnect(); }
      }, { rootMargin: "600px" });
      io.observe(root);
    } else load();

    resize();

    return {
      locate,
      locateProject,
      setActive(on) {
        active = on;
        if (on) { load(); resize(); }
        else { hideTip(); if (card) card.hidden = true; cardRef = null; }
      }
    };
  }

  MZ.initSkyMap = (list, projects) => {
    if (document.getElementById("skymap-section") && document.getElementById("skyMap")) {
      buildSkyMap(list, Array.isArray(projects) ? projects : []);
    }
  };
})();
