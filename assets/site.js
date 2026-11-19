/* ==========================================================================
   Miltzu Images – sivuston ydin
   Kieli, valikko, tähtitausta, galleria, kuvanäkymä (zoom + koordinaatti-
   ruudukko + kohteen tiedot), projektit ja prosessointi.
   Taivaskartta ja planetaario ovat tiedostossa assets/sky.js.

   Sisältö tulee näistä tiedostoista:
     images.json      galleria
     projects.json    kuvausprojektit
     processing.json  ennen/jälkeen-vertailut
   ========================================================================== */
(() => {
  "use strict";

  const MZ = (window.MZ = {});
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ------------------------------------------------------------------------
     Kieli (FI / EN)
     Kiinteät tekstit: data-fi / data-en. Sisältötiedostoissa teksti voi olla
     joko merkkijono tai { "fi": "...", "en": "..." }.
     ------------------------------------------------------------------------ */
  function storedLang() {
    try { return localStorage.getItem("siteLang"); } catch (e) { return null; }
  }
  const urlLang = new URLSearchParams(location.search).get("lang");
  let lang = (urlLang === "en" || urlLang === "fi") ? urlLang : (storedLang() === "en" ? "en" : "fi");

  const isEnglish = () => lang === "en";
  const t = (fi, en) => (lang === "en" ? en : fi);

  // merkkijono tai {fi, en} -> nykyisen kielen teksti
  function tr(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return String(v[lang] || v.fi || v.en || "");
    return String(v);
  }

  function translate(root) {
    $$("[data-fi]", root).forEach(el => {
      const v = el.dataset[lang];
      if (v !== undefined) el.textContent = v;
    });
    $$("[data-fi-label]", root).forEach(el => {
      el.setAttribute("aria-label", lang === "en" ? el.dataset.enLabel : el.dataset.fiLabel);
    });
  }

  function setLang(next, silent) {
    lang = next === "en" ? "en" : "fi";
    document.documentElement.lang = lang;
    try { localStorage.setItem("siteLang", lang); } catch (e) { /* yksityinen selaus */ }
    translate(document);
    $$(".lang button").forEach(b => {
      const on = b.dataset.lang === lang;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    if (!silent) document.dispatchEvent(new CustomEvent("langchange"));
  }

  /* ------------------------------------------------------------------------
     Apufunktiot
     ------------------------------------------------------------------------ */
  function esc(text) {
    return String(text).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }

  // images/kuva1.jpg -> images/thumbs/kuva1.jpg (GitHub tekee nämä automaattisesti)
  function thumbPath(file) {
    const slash = file.lastIndexOf("/");
    const dir = slash >= 0 ? file.slice(0, slash + 1) : "";
    const name = file.slice(slash + 1);
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    return dir + "thumbs/" + stem + ".jpg";
  }
  function largePath(file) {
    return thumbPath(file).replace(/(^|\/)thumbs\//, "$1large/");
  }
  // esikatselukuva -> alkuperäinen, jos esikatselua ei (vielä) ole
  function setThumbSrc(imgEl, file, onFinalError) {
    imgEl.addEventListener("error", function handler() {
      if (imgEl.dataset.fallback !== "1") {
        imgEl.dataset.fallback = "1";
        imgEl.src = file;
      } else {
        imgEl.removeEventListener("error", handler);
        if (onFinalError) onFinalError();
      }
    });
    imgEl.src = thumbPath(file);
  }
  function setLargeSrc(imgEl, file) {
    imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = file; };
    imgEl.src = largePath(file);
  }

  function slugify(text) {
    return String(text || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  // kuvan tunniste osoitteessa: images/kuva3.jpg -> "kuva3"
  function imageSlug(file) {
    const name = file.slice(file.lastIndexOf("/") + 1);
    const dot = name.lastIndexOf(".");
    return slugify(dot > 0 ? name.slice(0, dot) : name);
  }
  function projectSlug(p) {
    return slugify(p.id || p.name || "projekti");
  }

  function formatRa(deg) {
    deg = ((deg % 360) + 360) % 360;
    const totalSec = Math.round(deg / 15 * 3600);
    const hh = Math.floor(totalSec / 3600) % 24;
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return `${hh}h ${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
  }
  function formatDec(deg) {
    const sign = deg < 0 ? "−" : "+";
    const totalSec = Math.round(Math.abs(deg) * 3600);
    const dd = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return `${sign}${dd}° ${String(mm).padStart(2, "0")}′ ${String(ss).padStart(2, "0")}″`;
  }
  // 1350 s -> "22 min 30 s", 18000 s -> "5 h"
  function formatSeconds(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
    if (m > 0) return s ? `${m} min ${s} s` : `${m} min`;
    return `${s} s`;
  }
  const formatMinutes = (min) => formatSeconds(min * 60);

  function pctText(done, goal) {
    const pct = goal > 0 ? Math.min(100, (done / goal) * 100) : 0;
    if (pct > 0 && pct < 1) return "<1";
    return Math.round(pct);
  }

  function nf(n, maxFrac) {
    return n.toLocaleString(lang === "en" ? "en-GB" : "fi-FI", { maximumFractionDigits: maxFrac === undefined ? 1 : maxFrac });
  }

  // Otsikko: "title" tai, jos se puuttuu tai on "-", kuvaus
  function displayTitle(d) {
    const title = tr(d.title).trim();
    return title && title !== "-" ? title : tr(d.desc);
  }
  // "M31 - Andromeda Galaxy" -> ["M31", "Andromeda Galaxy"]
  function splitTitle(d) {
    const full = displayTitle(d);
    const m = full.match(/^(.*?)\s+[-–—]\s+(.*)$/);
    return m ? [m[1], m[2]] : ["", full];
  }
  // oma kuvaus näytetään vain, jos sitä ei jo käytetty otsikkona
  function ownNote(d) {
    const title = tr(d.title).trim();
    return title && title !== "-" ? tr(d.desc) : "";
  }

  const CATEGORIES = {
    deepsky: ["Deep sky", "Deep sky"],
    narrowband: ["Kapeakaista", "Narrowband"],
    planeetta: ["Planeetat", "Planets"],
    kuu: ["Kuu", "Moon"],
    aurinko: ["Aurinko", "Sun"],
    revontuli: ["Revontulet", "Aurora"],
    widefield: ["Laajakulma", "Wide field"]
  };
  const CATEGORY_ORDER = ["deepsky", "narrowband", "planeetta", "kuu", "aurinko", "revontuli", "widefield"];
  function categoryName(key) {
    const c = CATEGORIES[key];
    return c ? c[lang === "en" ? 1 : 0] : (key || "");
  }

  // Kapeakaistakuva: "narrowband": true tai kaikki suodattimet kapeakaistaisia
  const NB_FILTERS = ["ha", "oiii", "o3", "sii", "s2", "hb", "hbeta", "nii", "n2"];
  function isNarrowband(img) {
    if (img.narrowband === true) return true;
    if (img.narrowband === false) return false;
    const tags = (img.tags || []).map(x => String(x).toLowerCase());
    if (tags.includes("narrowband") || tags.includes("kapeakaista")) return true;
    let names = (Array.isArray(img.acquisition) ? img.acquisition : []).map(a => a && a.filter);
    if (!names.length && img.filters) names = String(img.filters).split(/[,/+&·]|\s+ja\s+|\s+and\s+/);
    names = names.map(n => String(n || "").toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
    return names.length > 0 && names.every(n => NB_FILTERS.includes(n));
  }

  /* ------------------------------------------------------------------------
     Etäisyys
     images.json:
       "distance": { "ly": 2500000 }                      valovuosina
       "distance": { "km": 384400 }                       kilometreinä
       "distance": { "text": { "fi": "...", "en": "..." },
                     "label": { "fi": "Korkeus", "en": "Altitude" } }
     Lisäksi vapaaehtoiset "approx": true ja "note": { "fi", "en" }.
     ------------------------------------------------------------------------ */
  const LIGHT_KM_S = 299792.458;

  function distanceInfo(d) {
    const dist = d && d.distance;
    if (!dist || typeof dist !== "object") return null;
    const label = tr(dist.label) || t("Etäisyys", "Distance");
    const note = tr(dist.note);
    const approx = dist.approx ? t("noin ", "about ") : "";
    const ly = num(dist.ly), km = num(dist.km);

    if (ly > 0) {
      let value, unit, years;
      if (ly >= 1e9) { value = nf(ly / 1e9); unit = t("mrd. valovuotta", "billion light-years"); years = nf(ly / 1e9) + t(" miljardia vuotta", " billion years"); }
      else if (ly >= 1e6) { value = nf(ly / 1e6); unit = t("milj. valovuotta", "million light-years"); years = nf(ly / 1e6) + t(" miljoonaa vuotta", " million years"); }
      else { value = nf(ly, 0); unit = t("valovuotta", "light-years"); years = nf(ly, 0) + t(" vuotta", " years"); }
      return {
        label, value, unit, note, prefix: approx.trim(),
        short: `${approx}${value} ${unit}`,
        light: t(`Kuvaan tallentunut valo lähti matkaan noin ${years} sitten.`,
                 `The light captured here set out about ${years} ago.`)
      };
    }
    if (km > 0) {
      let value, unit;
      if (km >= 1e9) { value = nf(km / 1e9); unit = t("mrd. km", "billion km"); }
      else if (km >= 1e6) { value = nf(km / 1e6); unit = t("milj. km", "million km"); }
      else { value = nf(km, 0); unit = "km"; }
      const secs = km / LIGHT_KM_S;
      let time;
      if (secs < 60) time = t(`${nf(secs)} sekunnissa`, `${nf(secs)} seconds`);
      else if (secs < 3600) time = t(`${Math.round(secs / 60)} minuutissa`, `${Math.round(secs / 60)} minutes`);
      else {
        const h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60);
        time = t(`${h} tunnissa ${m} minuutissa`, `${h} h ${m} min`);
      }
      return {
        label, value, unit, note, prefix: approx.trim(),
        short: `${approx}${value} ${unit}`,
        light: t(`Valo kulkee tämän matkan noin ${time}.`, `Light covers this distance in about ${time}.`)
      };
    }
    const text = tr(dist.text);
    if (text) return { label, value: text, unit: "", note, short: text, light: "" };
    return null;
  }

  /* ------------------------------------------------------------------------
     Valotukset
       "acquisition": [ { "filter": "Ha", "count": 20, "exposure": 300 }, ... ]
     exposure = yhden valotuksen pituus sekunteina.
     ------------------------------------------------------------------------ */
  function acquisitionRows(d) {
    return (Array.isArray(d.acquisition) ? d.acquisition : []).filter(a => a && a.count > 0 && a.exposure > 0);
  }
  const filterKey = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  /* ------------------------------------------------------------------------
     Projektin edistyminen
     ------------------------------------------------------------------------ */
  function progressChannels(p) {
    const list = Array.isArray(p.progress) ? p.progress : (p.progress ? [p.progress] : []);
    return list.filter(c => c && c.goal_min > 0);
  }
  function projectProgressText(p) {
    const ch = progressChannels(p);
    if (!ch.length) return "";
    const done = ch.reduce((a, c) => a + Math.max(0, c.done_min || 0), 0);
    const goal = ch.reduce((a, c) => a + c.goal_min, 0);
    return `${formatMinutes(done)} / ${formatMinutes(goal)}, ${pctText(done, goal)} %`;
  }
  function statusName(status) {
    const s = String(status || "suunnitteilla").toLowerCase();
    const map = { kesken: ["Kesken", "In progress"], valmis: ["Valmis", "Finished"], suunnitteilla: ["Suunnitteilla", "Planned"] };
    return map[s] ? map[s][lang === "en" ? 1 : 0] : status;
  }
  function progressHTML(p) {
    const channels = progressChannels(p);
    if (!channels.length) return "";
    const totalDone = channels.reduce((a, c) => a + Math.max(0, c.done_min || 0), 0);
    const totalGoal = channels.reduce((a, c) => a + c.goal_min, 0);
    const rows = channels.map(c => {
      const done = Math.max(0, c.done_min || 0);
      const pct = Math.min(100, (done / c.goal_min) * 100);
      return `
        <div class="bar-row">
          <span class="filter-chip" data-filter="${esc(filterKey(c.filter))}">${esc(c.filter || "")}</span>
          <div class="bar" role="progressbar" aria-label="${esc(c.filter || "")}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}">
            <i style="width:${pct.toFixed(2)}%"${done > 0 ? ' class="has"' : ""}></i>
          </div>
          <span class="bar-value">${formatMinutes(done)} / ${formatMinutes(c.goal_min)}</span>
        </div>`;
    }).join("");
    return `
      <div class="progress">
        <div class="progress-head">
          <span>${t("Integraatio", "Integration")}</span>
          <strong>${formatMinutes(totalDone)} / ${formatMinutes(totalGoal)}</strong>
          <em>${pctText(totalDone, totalGoal)}&nbsp;%</em>
        </div>
        ${rows}
      </div>`;
  }

  /* ------------------------------------------------------------------------
     Sisällön lataus
     ------------------------------------------------------------------------ */
  let imagesPromise = null;
  function loadImages() {
    if (!imagesPromise) {
      imagesPromise = fetch("images.json")
        .then(r => (r.ok ? r.json() : []))
        .then(list => (Array.isArray(list) ? list : []).filter(i => i && i.file).map(img => Object.assign({}, img, {
          slug: imageSlug(img.file),
          ra: num(img.ra), dec: num(img.dec), fov: num(img.fov),
          rotation: num(img.rotation) || 0,
          flipped: img.flipped === true,
          isNarrowband: isNarrowband(img)
        })))
        .catch(() => []);
    }
    return imagesPromise;
  }
  let projectsPromise = null;
  function loadProjects() {
    if (!projectsPromise) {
      projectsPromise = fetch("projects.json")
        .then(r => (r.ok ? r.json() : []))
        .then(list => (Array.isArray(list) ? list : []))
        .catch(() => []);
    }
    return projectsPromise;
  }

  /* ------------------------------------------------------------------------
     Tähtitausta
     Kaksi kangasta: toinen pysyy paikallaan, toisen kirkkaus vaihtelee hyvin
     hitaasti (yksi kevyt animaatio koko taustalle). Tähdet piirretään kerran
     samalla siemenluvulla, joten ne ovat aina samoissa kohdissa.
     ------------------------------------------------------------------------ */
  function mulberry(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let x = Math.imul(s ^ (s >>> 15), 1 | s);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function initStars() {
    const host = $("#stars");
    if (!host) return;
    const layers = [document.createElement("canvas"), document.createElement("canvas")];
    layers[1].className = "pulse";
    layers.forEach(c => host.appendChild(c));
    let lastW = 0;
    function paint() {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h || Math.abs(w - lastW) < 2) return;
      lastW = w;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rand = mulberry(42);
      const count = Math.round(Math.min(900, (w * h) / 3200));
      layers.forEach(c => {
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        const ctx = c.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
      });
      for (let i = 0; i < count; i++) {
        const x = rand() * w, y = rand() * h;
        const m = rand();
        const r = m > 0.985 ? 1.5 : m > 0.9 ? 1.05 : 0.6;
        const a = 0.25 + rand() * 0.6;
        const tint = rand();
        const ctx = layers[i % 4 === 0 ? 1 : 0].getContext("2d");
        ctx.fillStyle = tint > 0.86 ? `rgba(255,224,170,${a})` : tint < 0.16 ? `rgba(170,205,255,${a})` : `rgba(238,241,248,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    paint();
    window.addEventListener("resize", paint);
  }

  /* ------------------------------------------------------------------------
     Yläpalkki ja valikko
     ------------------------------------------------------------------------ */
  function initChrome() {
    const header = $(".top");
    if (header) {
      const onScroll = () => header.classList.toggle("solid", window.scrollY > 24);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    const menuBtn = $(".menu-btn");
    const nav = $(".nav");
    if (menuBtn && nav) {
      const setOpen = (on) => {
        document.body.classList.toggle("menu-open", on);
        menuBtn.setAttribute("aria-expanded", on);
      };
      menuBtn.addEventListener("click", () => setOpen(!document.body.classList.contains("menu-open")));
      nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
    }
    $$(".lang button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ------------------------------------------------------------------------
     3D-kallistus
     Kortti kallistuu kohti osoitinta. Tapahtumat kuunnellaan paikallaan
     pysyvästä kääreestä, jotta kortti ei "karkaa" osoittimen alta.
     ------------------------------------------------------------------------ */
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function addTilt(cell, card, max) {
    if (!finePointer || reduceMotion) return;
    const limit = max || 7;
    let raf = 0;
    cell.addEventListener("pointermove", (e) => {
      const r = cell.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.setProperty("--ry", ((px - 0.5) * 2 * limit).toFixed(2) + "deg");
        card.style.setProperty("--rx", ((0.5 - py) * 2 * limit).toFixed(2) + "deg");
        card.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
      });
      cell.classList.add("tilting");
    });
    cell.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      cell.classList.remove("tilting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  }

  /* ------------------------------------------------------------------------
     Etusivu: iso kuva
     Näytetään kuva, jolla on "featured": true, muuten listan viimeinen.
     "focus": "50% 30%" siirtää rajausta.
     ------------------------------------------------------------------------ */
  function initHero(list) {
    const hero = $("#hero");
    if (!hero) return;
    let idx = list.findIndex(d => d.featured);
    if (idx < 0) idx = list.length - 1;
    if (idx < 0) { hero.classList.add("empty"); return; }
    const d = list[idx];
    const img = $("#heroImg");
    const small = thumbPath(d.file), big = largePath(d.file);
    if (d.focus) img.style.objectPosition = d.focus;
    img.onload = () => hero.classList.add("ready");
    img.onerror = () => {
      if (img.dataset.fallback === "1") { hero.classList.add("ready"); return; }
      img.dataset.fallback = "1";
      img.removeAttribute("srcset");
      img.src = d.file;
    };
    img.sizes = "100vw";
    img.srcset = `${small} 1600w, ${big} 3200w`;
    img.src = small;

    function render() {
      const [desig, name] = splitTitle(d);
      img.alt = displayTitle(d);
      $("#heroTitle").innerHTML = desig
        ? `<span class="desig">${esc(desig)}</span> ${esc(name)}`
        : esc(name);
      const facts = [];
      const dist = distanceInfo(d);
      if (dist) facts.push([dist.label, dist.short]);
      if (d.constellation) facts.push([t("Tähdistö", "Constellation"), tr(d.constellation)]);
      if (d.type) facts.push([t("Tyyppi", "Type"), tr(d.type)]);
      if (!facts.length) facts.push([t("Kategoria", "Category"), categoryName(d.category)]);
      $("#heroFacts").innerHTML = facts.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join("");
    }
    render();
    document.addEventListener("langchange", render);
    const open = () => MZ.openViewer(list, idx);
    $("#heroOpen").addEventListener("click", open);
    $(".hero-media", hero).addEventListener("click", open);
  }

  /* ------------------------------------------------------------------------
     Etusivu: galleria
     ------------------------------------------------------------------------ */
  function initGallery(list) {
    const grid = $("#gallery");
    if (!grid) return;
    const filters = $("#filters");
    const countEl = $("#galleryCount");
    let active = "all";

    const matches = (d, key) => key === "all" || d.category === key || (key === "narrowband" && d.isNarrowband);

    function renderFilters() {
      const keys = CATEGORY_ORDER.filter(k => list.some(d => matches(d, k)));
      filters.innerHTML = [["all", t("Kaikki", "All")]].concat(keys.map(k => [k, categoryName(k)]))
        .map(([k, label]) => {
          const n = list.filter(d => matches(d, k)).length;
          return `<button type="button" class="chip${k === active ? " active" : ""}" data-cat="${k}" aria-pressed="${k === active}">${esc(label)}<span>${n}</span></button>`;
        }).join("");
    }

    function render() {
      const shown = list.filter(d => matches(d, active));
      if (countEl) countEl.textContent = shown.length;
      grid.innerHTML = "";
      if (!shown.length) {
        grid.innerHTML = `<li class="g-empty">${t("Galleriassa ei ole vielä kuvia.", "There are no images in the gallery yet.")}</li>`;
        return;
      }
      shown.forEach((d, i) => {
        const [desig, name] = splitTitle(d);
        const dist = distanceInfo(d);
        const cell = document.createElement("li");
        // vuorotellen leveä ja kapea kortti; yksinäinen viimeinen täyttää rivin
        const wide = (i % 4 === 0 || i % 4 === 3);
        cell.className = "g-cell " + (i === shown.length - 1 && shown.length % 2 === 1 ? "full" : wide ? "wide" : "narrow");
        cell.innerHTML = `
          <a class="g-card" href="#${esc(d.slug)}">
            <span class="g-media"><img alt="" loading="lazy" decoding="async"><i class="g-glare"></i></span>
            <span class="g-info">
              <span class="tag">${esc(categoryName(d.category))}${d.isNarrowband && d.category !== "narrowband" ? `<b>${esc(categoryName("narrowband"))}</b>` : ""}</span>
              <span class="g-title">${desig ? `<span class="desig">${esc(desig)}</span> ` : ""}${esc(name)}</span>
              ${dist ? `<span class="g-meta">${esc(dist.short)}</span>` : ""}
            </span>
          </a>`;
        const img = $("img", cell);
        img.alt = displayTitle(d);
        if (d.focus) img.style.objectPosition = d.focus;
        setThumbSrc(img, d.file);
        const card = $(".g-card", cell);
        card.addEventListener("click", (e) => {
          e.preventDefault();
          MZ.openViewer(shown, i, card);
        });
        addTilt(cell, card, 6);
        grid.appendChild(cell);
      });
    }

    filters.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      active = b.dataset.cat;
      renderFilters();
      render();
    });
    document.addEventListener("langchange", () => { renderFilters(); render(); });
    renderFilters();
    render();
  }

  /* ------------------------------------------------------------------------
     Etusivu: käynnissä oleva projekti
     ------------------------------------------------------------------------ */
  function initHomeProject(projects) {
    const box = $("#homeProject");
    if (!box) return;
    const p = projects.find(x => String(x.status || "").toLowerCase() === "kesken") || projects[0];
    if (!p) { const sec = box.closest("section"); if (sec) sec.hidden = true; return; }
    function render() {
      const last = (p.updates || []).slice(-1)[0];
      box.innerHTML = `
        <div class="hp-main">
          <p class="status">${esc(statusName(p.status))}</p>
          <h3 class="hp-name">${esc(p.name || "")}</h3>
          ${p.desc ? `<p class="hp-desc">${esc(tr(p.desc))}</p>` : ""}
          <a class="btn btn-line" href="projektit.html#${esc(projectSlug(p))}">${t("Katso projekti", "See the project")}</a>
        </div>
        <div class="hp-side">
          ${progressHTML(p)}
          ${last && last.text ? `<blockquote class="hp-note"><time>${esc(last.date || "")}</time><p>${esc(tr(last.text))}</p></blockquote>` : ""}
        </div>`;
    }
    render();
    document.addEventListener("langchange", render);
  }

  /* ------------------------------------------------------------------------
     Projektit-sivu
     ------------------------------------------------------------------------ */
  function initProjects(projects) {
    const host = $("#projects");
    if (!host) return;
    function render() {
      if (!projects.length) {
        host.innerHTML = `<p class="empty">${t("Ei vielä kuvausprojekteja.", "No imaging projects yet.")}</p>`;
        return;
      }
      host.innerHTML = "";
      projects.forEach(p => {
        const article = document.createElement("article");
        article.className = "proj";
        article.id = projectSlug(p);
        const ra = num(p.ra), dec = num(p.dec);
        const facts = [];
        if (p.category) facts.push([t("Kategoria", "Category"), categoryName(p.category)]);
        if (p.constellation) facts.push([t("Tähdistö", "Constellation"), tr(p.constellation)]);
        if (p.distance) { const di = distanceInfo(p); if (di) facts.push([di.label, di.short]); }
        if (ra !== undefined && dec !== undefined) facts.push(["RA / Dec", `${formatRa(ra)}, ${formatDec(dec)}`]);
        if (p.integration) facts.push([t("Integraatio", "Integration"), p.integration]);
        // uusin merkintä ylimpänä; projects.json:iin lisätään aina loppuun
        const log = (p.updates || []).slice().reverse().map(u => `
          <li class="log-item${u.image ? " has-img" : ""}">
            ${u.image ? `<a class="log-img" href="${esc(u.image)}" target="_blank" rel="noopener"><img data-file="${esc(u.image)}" alt="${esc(p.name || "")}" loading="lazy"></a>` : ""}
            <div class="log-body">
              ${u.date ? `<time>${esc(u.date)}</time>` : ""}
              ${u.text ? `<p>${esc(tr(u.text))}</p>` : ""}
            </div>
          </li>`).join("");
        article.innerHTML = `
          <header class="proj-head">
            <div>
              <p class="status">${esc(statusName(p.status))}</p>
              <h2>${esc(p.name || "")}</h2>
              ${p.desc ? `<p class="proj-desc">${esc(tr(p.desc))}</p>` : ""}
              ${facts.length ? `<dl class="facts">${facts.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join("")}</dl>` : ""}
              ${ra !== undefined && dec !== undefined ? `<a class="btn btn-line" href="taivas.html#projekti-${esc(projectSlug(p))}">${t("Näytä taivaalla", "Show on the sky")}</a>` : ""}
            </div>
            <div>${progressHTML(p)}</div>
          </header>
          ${log ? `<h3 class="proj-log-title">${t("Päiväkirja", "Journal")}</h3><ol class="proj-log">${log}</ol>` : ""}`;
        $$(".log-img img", article).forEach(imgEl => {
          const file = imgEl.dataset.file;
          setThumbSrc(imgEl, file, () => {
            const miss = document.createElement("p");
            miss.className = "log-missing";
            miss.textContent = t("Kuvaa ei löytynyt: ", "Image not found: ") + file;
            imgEl.closest(".log-img").replaceWith(miss);
          });
        });
        host.appendChild(article);
      });
    }
    render();
    document.addEventListener("langchange", render);
    // taivaskartalta tultaessa (#projektin-tunniste) vieritetään projektiin
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target && target.classList.contains("proj")) {
        target.classList.add("is-target");
        setTimeout(() => target.scrollIntoView({ block: "start" }), 60);
      }
    }
  }

  /* ------------------------------------------------------------------------
     Software-sivu
     software.json:
     { "platforms": [                         alustat = napit sivun yläosassa
         { "id": "pixinsight",                osoitteessa software.html#pixinsight
           "name": "PixInsight",
           "intro": { "fi": "...", "en": "..." },               (vapaaehtoinen)
           "install": { "title": { "fi": "...", "en": "..." },  (vapaaehtoinen)
                        "steps": [ { "fi": "...", "en": "..." } ],
                        "note": { "fi": "...", "en": "..." } } } ],
       "items": [
         { "name": "Ohjelman nimi",
           "desc": { "fi": "Mitä ohjelma tekee.", "en": "What it does." },
           "platform": "PixInsight",            alustan name tai id
           "status": "kehitteillä",             kehitteillä / testissä / julkaistu / suunnitteilla
           "version": "1.0",
           "features": [ "Ominaisuus 1", { "fi": "...", "en": "..." } ],
           "image": "images/software/kuva.jpg", kuvakaappaus
           "link": "https://...",               lataus- tai kotisivu
           "link_label": { "fi": "...", "en": "..." },
           "hidden": true } ] }                 true = ei näy sivulla
     Pelkkä lista [ {...}, ... ] käy myös (silloin ei ohjeita).
     Vain "name" on pakollinen. Alustan nappi näkyy, kun sillä on näkyviä ohjelmia.
     ------------------------------------------------------------------------ */
  function initSoftware() {
    const host = $("#software");
    if (!host) return;
    const STATUS = {
      "kehitteillä": ["Kehitteillä", "In development"],
      "testissä": ["Testissä", "In testing"],
      "julkaistu": ["Julkaistu", "Released"],
      "suunnitteilla": ["Suunnitteilla", "Planned"]
    };
    const OTHER = "muut";
    let items = [], platforms = [], active = "";
    const slug = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // ohjelman alusta -> alustan id (name tai id kelpaa)
    function platformOf(it) {
      const key = slug(tr(it.platform));
      if (!key) return OTHER;
      const p = platforms.find(pl => pl.id === key || slug(tr(pl.name)) === key);
      return p ? p.id : key;
    }
    function platformInfo(id) {
      return platforms.find(pl => pl.id === id) || { id: id, name: id === OTHER ? { fi: "Muut", en: "Other" } : id };
    }
    function card(it) {
      const cell = document.createElement("li");
      cell.className = "sw-cell";
      const st = STATUS[String(it.status || "").toLowerCase()];
      const status = st ? st[lang === "en" ? 1 : 0] : tr(it.status);
      const meta = [tr(it.platform), it.version ? t("versio ", "version ") + it.version : ""].filter(Boolean);
      const features = (Array.isArray(it.features) ? it.features : []).map(f => `<li>${esc(tr(f))}</li>`).join("");
      const tag = it.link ? "a" : "div";
      // oma sivu (esim. infinite-studio.html) aukeaa samaan välilehteen, ulkoiset linkit uuteen
      const ext = /^https?:\/\//i.test(String(it.link || ""));
      cell.innerHTML = `
        <${tag} class="sw-card"${it.link ? ` href="${esc(it.link)}"${ext ? ` target="_blank" rel="noopener"` : ""}` : ""}>
          ${it.image ? `<span class="sw-shot"><img alt="" loading="lazy"></span>` : ""}
          <span class="sw-body">
            ${status ? `<span class="status">${esc(status)}</span>` : ""}
            <span class="sw-name">${esc(tr(it.name))}</span>
            ${meta.length ? `<span class="sw-meta">${esc(meta.join(", "))}</span>` : ""}
            ${it.desc ? `<span class="sw-desc">${esc(tr(it.desc))}</span>` : ""}
            ${features ? `<ul class="sw-features">${features}</ul>` : ""}
            ${it.link ? `<span class="sw-link">${esc(tr(it.link_label) || t("Avaa sivu", "Open page"))}</span>` : ""}
          </span>
        </${tag}>`;
      const img = $(".sw-shot img", cell);
      if (img) { img.alt = tr(it.name); img.onerror = () => img.closest(".sw-shot").remove(); img.src = it.image; }
      addTilt(cell, $(".sw-card", cell), 4);
      return cell;
    }
    function guide(p) {
      const g = p.install;
      if (!g || !Array.isArray(g.steps) || !g.steps.length) return "";
      const steps = g.steps.map(s => `<li>${esc(tr(s))}</li>`).join("");
      return `
        <details class="sw-guide" open>
          <summary>${esc(tr(g.title) || t("Näin otat työkalun käyttöön", "How to install"))}</summary>
          <ol>${steps}</ol>
          ${g.note ? `<p class="sw-guide-note">${esc(tr(g.note))}</p>` : ""}
        </details>`;
    }
    function render() {
      const visible = items.filter(it => !it.hidden);
      if (!visible.length) {
        host.innerHTML = `
          <div class="empty-card">
            <h2>${t("Ohjelmia ei ole vielä lisätty", "No software listed yet")}</h2>
            <p>${t("Tänne tulevat omat astrokuvauksen työkalut ja ohjelmat.", "My own astrophotography tools and programs will be listed here.")}</p>
          </div>`;
        return;
      }
      // alustat siinä järjestyksessä kuin software.json ne antaa, sitten muut
      const ids = [];
      platforms.forEach(pl => { if (visible.some(it => platformOf(it) === pl.id)) ids.push(pl.id); });
      visible.forEach(it => { const id = platformOf(it); if (ids.indexOf(id) < 0) ids.push(id); });
      if (ids.indexOf(active) < 0) active = ids[0];
      const p = platformInfo(active);
      const shown = visible.filter(it => platformOf(it) === active);
      host.innerHTML = `
        <div class="chips sw-tabs" role="tablist" aria-label="${t("Alusta", "Platform")}">
          ${ids.map(id => {
            const n = visible.filter(it => platformOf(it) === id).length;
            return `<button type="button" class="chip${id === active ? " active" : ""}" role="tab" data-platform="${esc(id)}" aria-selected="${id === active}">${esc(tr(platformInfo(id).name))}<span>${n}</span></button>`;
          }).join("")}
        </div>
        ${p.intro ? `<p class="sw-intro">${esc(tr(p.intro))}</p>` : ""}
        ${guide(p)}
        <ul class="sw-grid"></ul>`;
      const grid = $(".sw-grid", host);
      shown.forEach(it => grid.appendChild(card(it)));
    }
    host.addEventListener("click", (e) => {
      const b = e.target.closest(".sw-tabs .chip");
      if (!b) return;
      active = b.dataset.platform;
      history.replaceState(null, "", "#" + active);
      render();
    });
    fetch("software.json")
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : []);
        platforms = (data && Array.isArray(data.platforms) ? data.platforms : [])
          .filter(pl => pl && pl.name)
          .map(pl => Object.assign({}, pl, { id: slug(pl.id || tr(pl.name)) }));
        items = list.filter(x => x && x.name);
      })
      .catch(() => { items = []; })
      .then(() => {
        if (location.hash) active = slug(decodeURIComponent(location.hash.slice(1)));
        render();
        document.addEventListener("langchange", render);
        // linkki toiselle alustalle samalla sivulla (esim. #infinite-studio)
        window.addEventListener("hashchange", () => {
          const h = slug(decodeURIComponent(location.hash.slice(1)));
          if (h && h !== active) { active = h; render(); }
        });
      });
  }

  /* ------------------------------------------------------------------------
     Alasivujen otsikkotausta: himmennetty kuva galleriasta.
     Sivun <header class="page-head" data-banner="2"> valitsee kuvan
     järjestysnumerolla deep sky -kuvien joukosta.
     ------------------------------------------------------------------------ */
  function initPageBanner(list) {
    const head = $(".page-head[data-banner]");
    if (!head || !list.length) return;
    const pool = list.filter(d => d.category === "deepsky" || d.category === "widefield");
    const pick = (pool.length ? pool : list);
    const d = pick[(parseInt(head.dataset.banner, 10) || 0) % pick.length];
    const bg = document.createElement("div");
    bg.className = "page-bg";
    bg.setAttribute("aria-hidden", "true");
    const img = new Image();
    img.onload = () => { bg.style.backgroundImage = `url("${img.src}")`; bg.classList.add("ready"); };
    img.onerror = () => { if (img.dataset.fb !== "1") { img.dataset.fb = "1"; img.src = d.file; } };
    img.src = thumbPath(d.file);
    head.prepend(bg);
  }

  /* ------------------------------------------------------------------------
     Prosessointi-sivu: ennen/jälkeen-liukuri
     processing.json:
     [ { "title": "M31 - Andromeda Galaxy", "desc": "...",
         "steps": [ { "label": "Lineaarinen", "image": "images/m31-p1.jpg", "text": "..." },
                    { "label": "Valmis", "image": "images/kuva3.jpg" } ] } ]
     Vähintään kaksi vaihetta; kuvien pitää olla samaa rajausta ja kokoa.
     ------------------------------------------------------------------------ */
  const translateNew = translate;
  function buildCompare(item) {
    const steps = (item.steps || []).filter(s => s && s.image);
    const article = document.createElement("article");
    article.className = "process";

    const transitions = steps.length > 2
      ? [{ from: 0, to: steps.length - 1, start: true }]
          .concat(steps.slice(1).map((s, i) => ({ from: i, to: i + 1 })))
      : [];

    article.innerHTML = `
      <header class="process-head">
        <h2>${esc(item.title || "")}</h2>
        ${item.desc ? `<p>${esc(item.desc)}</p>` : ""}
      </header>
      <div class="compare">
        <img class="compare-after" alt="" draggable="false">
        <div class="compare-before"><img alt="" draggable="false"></div>
        <span class="compare-tag compare-tag-before"></span>
        <span class="compare-tag compare-tag-after"></span>
        <div class="compare-handle" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-label="Ennen / jälkeen">
          <span class="compare-knob">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5l-4 5 4 5M13 5l4 5-4 5"/></svg>
          </span>
        </div>
      </div>
      ${transitions.length ? `<div class="process-steps">${transitions.map((t, i) => `
        <button class="step-chip${i === 0 ? " active" : ""}" type="button" data-i="${i}">
          ${t.start
            ? `<span data-fi="Alku → valmis" data-en="Start → finished">Alku → valmis</span>`
            : `<b>${t.to + 1}</b> ${esc(steps[t.to].label || "")}`}
        </button>`).join("")}</div>` : ""}
      <p class="process-step-text"></p>`;

    const compare = article.querySelector(".compare");
    const afterImg = article.querySelector(".compare-after");
    const beforeImg = article.querySelector(".compare-before img");
    const tagBefore = article.querySelector(".compare-tag-before");
    const tagAfter = article.querySelector(".compare-tag-after");
    const handle = article.querySelector(".compare-handle");
    const stepText = article.querySelector(".process-step-text");

    let pos = 50;
    function setPos(p) {
      pos = Math.max(0, Math.min(100, p));
      compare.style.setProperty("--pos", pos + "%");
      handle.setAttribute("aria-valuenow", Math.round(pos));
    }
    setPos(50);

    afterImg.addEventListener("load", () => {
      if (afterImg.naturalWidth && afterImg.naturalHeight) {
        compare.style.setProperty("--ratio", afterImg.naturalWidth / afterImg.naturalHeight);
      }
    });

    function show(from, to) {
      const a = steps[from], b = steps[to];
      setLargeSrc(beforeImg, a.image);
      setLargeSrc(afterImg, b.image);
      tagBefore.textContent = a.label || "";
      tagAfter.textContent = b.label || "";
      tagBefore.hidden = !a.label;
      tagAfter.hidden = !b.label;
      stepText.textContent = b.text || "";
      stepText.hidden = !b.text;
    }
    show(0, steps.length - 1);

    article.querySelectorAll(".step-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        article.querySelectorAll(".step-chip").forEach(c => c.classList.toggle("active", c === chip));
        const t = transitions[+chip.dataset.i];
        show(t.from, t.to);
      });
    });

    // Vetäminen hiirellä, kosketuksella tai kynällä. touch-action: pan-y
    // (CSS) pitää sivun pystyvierityksen toimivana puhelimella.
    let dragging = false;
    const fromEvent = (e) => {
      const r = compare.getBoundingClientRect();
      setPos(((e.clientX - r.left) / r.width) * 100);
    };
    compare.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      compare.classList.add("dragging");
      try { compare.setPointerCapture(e.pointerId); } catch (err) { /* ei tuettu */ }
      fromEvent(e);
    });
    compare.addEventListener("pointermove", (e) => { if (dragging) fromEvent(e); });
    const stop = () => { dragging = false; compare.classList.remove("dragging"); };
    compare.addEventListener("pointerup", stop);
    compare.addEventListener("pointercancel", stop);

    handle.addEventListener("keydown", (e) => {
      const stepSize = e.shiftKey ? 10 : 2;
      if (e.key === "ArrowLeft") { setPos(pos - stepSize); e.preventDefault(); }
      if (e.key === "ArrowRight") { setPos(pos + stepSize); e.preventDefault(); }
      if (e.key === "Home") { setPos(0); e.preventDefault(); }
      if (e.key === "End") { setPos(100); e.preventDefault(); }
    });

    translateNew(article);
    return article;
  }


  function initProcessing() {
    const host = $("#process-list");
    if (!host) return;
    const empty = () => {
      host.innerHTML = `
        <div class="empty-card">
          <h2 data-fi="Prosessikuvia ei ole vielä lisätty" data-en="No processing images yet">Prosessikuvia ei ole vielä lisätty</h2>
          <p data-fi="Tänne tulee vertailuja siitä, miltä kuva näyttää prosessoinnin eri vaiheissa." data-en="Comparisons of how an image looks at each stage of processing will appear here.">Tänne tulee vertailuja siitä, miltä kuva näyttää prosessoinnin eri vaiheissa.</p>
        </div>`;
      translate(host);
    };
    fetch("processing.json")
      .then(r => (r.ok ? r.json() : []))
      .then(items => {
        const valid = (Array.isArray(items) ? items : [])
          .filter(it => it && Array.isArray(it.steps) && it.steps.filter(s => s && s.image).length >= 2);
        if (!valid.length) { empty(); return; }
        valid.forEach(it => host.appendChild(buildCompare(it)));
      })
      .catch(empty);
  }

  /* ------------------------------------------------------------------------
     KUVANÄKYMÄ
     Vasemmalla kuva (zoom, panorointi, koordinaattiruudukko), oikealla
     kohteen tiedot kortteina. Osoite päivittyy muotoon #kuva3, joten
     kuvaan voi linkittää ja selaimen paluu sulkee näkymän.
     ------------------------------------------------------------------------ */
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  let viewer = null, lightboxImg = null, lbFrame = null, lbStage = null, skyGrid = null, skyBtn = null;
  let currentImages = [];
  let currentIndex = -1;
  let currentData = null;
  let viewerOpen = false;
  let pushedEntry = false;
  let lastFocus = null;
  let loadToken = 0;
  let allProjects = [];

  function buildViewer() {
    viewer = document.createElement("div");
    viewer.className = "viewer";
    viewer.id = "viewer";
    viewer.hidden = true;
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.innerHTML = `
      <div class="vw-ambient" aria-hidden="true"><img alt=""></div>
      <div class="vw-scroll">
        <div class="vw-stage">
          <div id="lbFrame" class="vw-frame">
            <div id="lbStage" class="vw-inner">
              <img id="vwImg" alt="">
              <svg id="skyGrid" class="sky-grid" aria-hidden="true"></svg>
            </div>
          </div>
          <div class="vw-tools">
            <button type="button" class="tool" id="vwPrev" data-fi-label="Edellinen kuva" data-en-label="Previous image">
              <svg viewBox="0 0 20 20"><path d="M12.5 4.5L7 10l5.5 5.5"/></svg>
            </button>
            <span class="vw-count" id="vwCount"></span>
            <button type="button" class="tool" id="vwNext" data-fi-label="Seuraava kuva" data-en-label="Next image">
              <svg viewBox="0 0 20 20"><path d="M7.5 4.5L13 10l-5.5 5.5"/></svg>
            </button>
            <button type="button" class="tool tool-text" id="skyLocationBtn">
              <svg viewBox="0 0 20 20"><path d="M2 7c5-2 11-2 16 0M2 13c5 2 11 2 16 0M7 2c-2 5-2 11 0 16M13 2c2 5 2 11 0 16"/></svg>
              <span data-fi="Koordinaatit" data-en="Coordinates">Koordinaatit</span>
            </button>
            <a class="tool tool-text" id="vwDownload" download>
              <svg viewBox="0 0 20 20"><path d="M10 3v10M6 9.5l4 4 4-4M4 16.5h12"/></svg>
              <span data-fi="Lataa" data-en="Download">Lataa</span>
            </a>
          </div>
          <p class="vw-hint" data-fi="Rulla tai nipistys zoomaa, tuplaklikkaus lähentää" data-en="Scroll or pinch to zoom, double-click to zoom in">Rulla tai nipistys zoomaa, tuplaklikkaus lähentää</p>
        </div>
        <aside class="vw-dossier" id="vwDossier"></aside>
      </div>
      <button type="button" class="vw-close" id="vwClose" data-fi-label="Sulje" data-en-label="Close">
        <svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15"/></svg>
      </button>`;
    document.body.appendChild(viewer);
    translate(viewer);

    lightboxImg = $("#vwImg", viewer);
    lbFrame = $("#lbFrame", viewer);
    lbStage = $("#lbStage", viewer);
    skyGrid = $("#skyGrid", viewer);
    skyBtn = $("#skyLocationBtn", viewer);

    $("#vwClose", viewer).addEventListener("click", () => closeViewer());
    $("#vwPrev", viewer).addEventListener("click", prevImage);
    $("#vwNext", viewer).addEventListener("click", nextImage);
    // napautus kuvan ulkopuolelle (tyhjään taustaan) sulkee
    $(".vw-stage", viewer).addEventListener("click", (e) => {
      if (e.target.classList.contains("vw-stage")) closeViewer();
    });
    document.addEventListener("keydown", (e) => {
      if (!viewerOpen) return;
      if (e.key === "Escape") closeViewer();
      else if (e.key === "ArrowRight") nextImage();
      else if (e.key === "ArrowLeft") prevImage();
    });
    document.addEventListener("langchange", () => { if (viewerOpen && currentData) renderDossier(currentData); });
    window.addEventListener("hashchange", syncFromHash);
  }

  // Kuvan lataus: esikatselu heti, näyttöversio (3200 px) perään. Alkuperäistä
  // (jopa 45 Mpix) ei ladata puhelimella, koska se kaataa mobiiliselaimen.
  function loadViewerImage(d) {
    const token = ++loadToken;
    const file = d.file;
    let stage = "thumb";
    lightboxImg.onerror = () => {
      if (token !== loadToken) return;
      if (stage === "thumb") { stage = "large"; lightboxImg.src = largePath(file); }
      else if (stage === "large") { stage = "original"; lightboxImg.onerror = null; lightboxImg.src = file; }
    };
    lightboxImg.alt = displayTitle(d);
    lightboxImg.src = thumbPath(file);
    const ambient = $(".vw-ambient img", viewer);
    ambient.onerror = () => { ambient.onerror = null; ambient.src = file; };
    ambient.src = thumbPath(file);

    const large = new Image();
    large.onload = () => {
      if (token !== loadToken) return;
      stage = "large";
      lightboxImg.onerror = null;
      lightboxImg.src = large.src;
    };
    large.onerror = () => {
      if (token !== loadToken || isTouchDevice) return;
      const full = new Image();
      full.onload = () => {
        if (token !== loadToken) return;
        lightboxImg.onerror = null;
        lightboxImg.src = file;
      };
      full.src = file;
    };
    large.src = largePath(file);
  }

  function dossierCard(cls, inner) {
    return `<section class="dc ${cls}">${inner}</section>`;
  }

  function renderDossier(d) {
    const box = $("#vwDossier", viewer);
    const [desig, name] = splitTitle(d);
    const note = ownNote(d);
    const cards = [];

    cards.push(dossierCard("dc-title", `
      <p class="tag">${esc(categoryName(d.category))}${d.isNarrowband && d.category !== "narrowband" ? `<b>${esc(categoryName("narrowband"))}</b>` : ""}</p>
      <h2>${desig ? `<span class="desig">${esc(desig)}</span>` : ""}<span>${esc(name)}</span></h2>
      ${note ? `<p class="dc-note">${esc(note)}</p>` : ""}`));

    const dist = distanceInfo(d);
    if (dist) {
      cards.push(dossierCard("dc-distance", `
        <h3>${esc(dist.label)}</h3>
        <p class="big">${dist.prefix ? `<span class="pre">${esc(dist.prefix)}</span> ` : ""}<strong>${esc(dist.value)}</strong>${dist.unit ? ` <span>${esc(dist.unit)}</span>` : ""}</p>
        ${dist.light ? `<p class="dc-sub">${esc(dist.light)}</p>` : ""}
        ${dist.note ? `<p class="dc-sub">${esc(dist.note)}</p>` : ""}`));
    }

    const about = tr(d.about);
    const facts = [];
    if (d.constellation) facts.push([t("Tähdistö", "Constellation"), tr(d.constellation)]);
    if (d.type) facts.push([t("Tyyppi", "Type"), tr(d.type)]);
    if (d.size) facts.push([t("Koko", "Size"), tr(d.size)]);
    if (about || facts.length) {
      cards.push(dossierCard("dc-story", `
        <h3>${t("Kohteen tarina", "About the object")}</h3>
        ${about ? about.split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join("") : ""}
        ${facts.length ? `<dl class="facts">${facts.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join("")}</dl>` : ""}`));
    }

    // Valotukset ja kalusto
    const acq = acquisitionRows(d);
    const totalSec = acq.reduce((sum, a) => sum + a.count * a.exposure, 0);
    const gear = [];
    if (d.telescope) gear.push([t("Kaukoputki", "Telescope"), tr(d.telescope)]);
    if (d.camera) gear.push([t("Kamera", "Camera"), tr(d.camera)]);
    if (d.mount) gear.push([t("Jalusta", "Mount"), tr(d.mount)]);
    if (!acq.length && d.filters) gear.push([t("Suodattimet", "Filters"), tr(d.filters)]);
    if (!totalSec && d.integration) gear.push([t("Integraatio", "Integration"), tr(d.integration)]);
    if (d.date) gear.push([t("Päivämäärä", "Date"), tr(d.date)]);
    if (d.location) gear.push([t("Kuvauspaikka", "Location"), tr(d.location)]);
    if (d.bortle) gear.push(["Bortle", String(d.bortle)]);
    if (acq.length || gear.length) {
      cards.push(dossierCard("dc-acq", `
        <h3>${t("Valotukset ja kalusto", "Exposures and equipment")}</h3>
        ${totalSec ? `<p class="big small"><strong>${formatSeconds(totalSec)}</strong> <span>${t("kokonaisvalotus", "total integration")}</span></p>` : ""}
        ${acq.length ? `<table class="acq">
          <thead><tr><th>${t("Suodatin", "Filter")}</th><th>${t("Valotukset", "Frames")}</th><th>${t("Yhteensä", "Total")}</th></tr></thead>
          <tbody>${acq.map(a => `<tr>
            <td><span class="filter-chip" data-filter="${esc(filterKey(a.filter))}">${esc(a.filter || "")}</span></td>
            <td>${a.count} × ${a.exposure} s</td>
            <td>${formatSeconds(a.count * a.exposure)}</td></tr>`).join("")}</tbody></table>` : ""}
        ${gear.length ? `<dl class="facts">${gear.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join("")}</dl>` : ""}`));
    }

    // Projekti, johon kuva kuuluu: "project": "PN G75.5+1.7"
    const proj = d.project ? allProjects.find(p => p.name === d.project || projectSlug(p) === slugify(d.project)) : null;
    if (proj) {
      cards.push(dossierCard("dc-project", `
        <h3>${t("Projekti", "Project")}</h3>
        <p class="dc-lead"><strong>${esc(proj.name || "")}</strong> <span class="status">${esc(statusName(proj.status))}</span></p>
        ${progressHTML(proj)}
        <a class="btn btn-line" href="projektit.html#${esc(projectSlug(proj))}">${t("Katso projekti", "See the project")}</a>`));
    }

    if (d.ra !== undefined && d.dec !== undefined) {
      const rows = [["RA", formatRa(d.ra)], ["Dec", formatDec(d.dec)]];
      if (d.fov > 0) rows.push([t("Kuvakentän leveys", "Field width"), nf(d.fov, 2) + "°"]);
      cards.push(dossierCard("dc-sky", `
        <h3>${t("Sijainti taivaalla", "Position on the sky")}</h3>
        <dl class="facts">${rows.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join("")}</dl>
        <a class="btn btn-line" href="taivas.html#kohde-${esc(d.slug)}">${t("Näytä taivaalla", "Show on the sky")}</a>`));
    }

    box.innerHTML = cards.join("");
    box.scrollTop = 0;
  }

  function showData(d) {
    currentData = d;
    loadViewerImage(d);
    renderDossier(d);
    resetZoom();
    const dl = $("#vwDownload", viewer);
    dl.href = d.file;
    dl.setAttribute("download", d.file.split("/").pop());
    $("#vwCount", viewer).textContent = currentImages.length > 1 ? `${currentIndex + 1} / ${currentImages.length}` : "";
    const many = currentImages.length > 1;
    $("#vwPrev", viewer).hidden = !many;
    $("#vwNext", viewer).hidden = !many;
    updateGridButton();
    // kortit saapuvat uudelleen joka kuvalle
    viewer.classList.remove("swap");
    void viewer.offsetWidth;
    viewer.classList.add("swap");
  }

  function setHash(slug, push) {
    const url = location.pathname + location.search + "#" + slug;
    if (push) { history.pushState({ viewer: true }, "", url); pushedEntry = true; }
    else history.replaceState(history.state, "", url);
  }

  function openViewer(list, index, originEl) {
    if (!viewer) buildViewer();
    currentImages = list.slice();
    currentIndex = index;
    const d = currentImages[index];
    if (!d) return;
    if (!viewerOpen) {
      lastFocus = originEl || document.activeElement;
      viewerOpen = true;
      viewer.hidden = false;
      document.body.classList.add("viewer-open");
      if (location.hash.slice(1) !== d.slug) setHash(d.slug, true);
      requestAnimationFrame(() => viewer.classList.add("open"));
      $("#vwClose", viewer).focus({ preventScroll: true });
    } else {
      setHash(d.slug, false);
    }
    $(".vw-scroll", viewer).scrollTop = 0;
    showData(d);
  }

  function showImageAt(index) {
    if (!currentImages.length) return;
    currentIndex = (index + currentImages.length) % currentImages.length;
    setHash(currentImages[currentIndex].slug, false);
    showData(currentImages[currentIndex]);
  }
  function nextImage() { showImageAt(currentIndex + 1); }
  function prevImage() { showImageAt(currentIndex - 1); }

  function closeViewer(fromHistory) {
    if (!viewerOpen) return;
    if (!fromHistory) {
      if (pushedEntry) { history.back(); return; } // hashchange sulkee näkymän
      history.replaceState(history.state, "", location.pathname + location.search);
    }
    pushedEntry = false;
    viewerOpen = false;
    viewer.classList.remove("open", "swap");
    viewer.hidden = true;
    document.body.classList.remove("viewer-open");
    loadToken++;
    lightboxImg.onerror = null;
    lightboxImg.removeAttribute("src");
    setGrid(false);
    resetZoom();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // Osoitteen #tunniste -> avaa tai sulkee näkymän
  let hashList = [];
  function syncFromHash() {
    const slug = decodeURIComponent(location.hash.slice(1));
    const idx = slug ? hashList.findIndex(d => d.slug === slug) : -1;
    if (idx >= 0) {
      if (!viewerOpen || !currentData || currentData.slug !== slug) {
        const inCurrent = viewerOpen ? currentImages.findIndex(d => d.slug === slug) : -1;
        if (inCurrent >= 0) { currentIndex = inCurrent; showData(currentImages[inCurrent]); }
        else openViewer(hashList, idx);
      }
    } else if (viewerOpen) {
      closeViewer(true);
    }
  }

  // Skripti ladataan sivun lopussa, joten näkymän voi rakentaa heti.
  // Zoom- ja ruudukkokoodi alla tarvitsee sen elementit.
  buildViewer();

  // =========================
  // ZOOM JA PANOROINTI
  // Muunnos kohdistuu .lb-stage-elementtiin (kuva + koordinaattiruudukko),
  // joten ruudukko liikkuu ja zoomautuu kuvan mukana. .lb-frame rajaa
  // näkymän: kuva ei voi koskaan karata kehyksen ulkopuolelle.
  // Kaikki koordinaatit ovat suhteessa kehyksen keskipisteeseen.
  // =========================
  const MAX_SCALE = 6;
  let gridOn = false;
  let scale = 1;
  let tx = 0;
  let ty = 0;

  function frameInfo() {
    const r = lbFrame.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
  }

  function clampPan() {
    const f = frameInfo();
    const maxX = Math.max(0, (scale - 1) * f.w / 2);
    const maxY = Math.max(0, (scale - 1) * f.h / 2);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  }

  let gridRedrawQueued = false;

  function applyTransform(animate) {
    lbStage.style.transition = animate ? "transform 0.22s ease" : "none";
    lbStage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    lbFrame.classList.toggle("zoomed", scale > 1.01);

    // ruudukon tekstien koko päivitetään zoomin mukana (kerran ruudunpäivitystä kohden)
    if (gridOn && !gridRedrawQueued) {
      gridRedrawQueued = true;
      requestAnimationFrame(() => { gridRedrawQueued = false; drawSkyGrid(); });
    }
  }

  function resetZoom(animate) {
    scale = 1; tx = 0; ty = 0;
    applyTransform(animate);
  }

  // Zoomaa niin, että kuvan kohta pisteen (px, py) alla pysyy paikallaan
  function zoomAt(newScale, px, py, base) {
    const f = frameInfo();
    const s0 = base ? base.scale : scale;
    const t0x = base ? base.tx : tx;
    const t0y = base ? base.ty : ty;
    const ax = (base ? base.px : px) - f.cx;
    const ay = (base ? base.py : py) - f.cy;
    newScale = Math.min(MAX_SCALE, Math.max(1, newScale));
    const qx = (ax - t0x) / s0;
    const qy = (ay - t0y) / s0;
    tx = (px - f.cx) - newScale * qx;
    ty = (py - f.cy) - newScale * qy;
    scale = newScale;
    clampPan();
  }

  // Hiiren rulla (tietokone): zoomaus kursorin kohdalta
  lbFrame.addEventListener("wheel", (e) => {
    e.preventDefault();
    e.stopPropagation();
    zoomAt(scale * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    applyTransform(false);
  }, { passive: false });

  // Tuplaklikkaus (tietokone): zoomaa 2,5x / palauta
  lbFrame.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    if (scale > 1.01) resetZoom(true);
    else { zoomAt(2.5, e.clientX, e.clientY); applyTransform(true); }
  });

  lbFrame.addEventListener("click", (e) => e.stopPropagation());

  // Kosketus (mobiili)
  let gesture = null;
  let lastTap = { t: 0, x: 0, y: 0 };

  function touchMid(t) {
    return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
  }
  function touchDist(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }

  lbFrame.addEventListener("touchstart", (e) => {
    e.stopPropagation();
    if (e.touches.length === 2) {
      const m = touchMid(e.touches);
      gesture = { type: "pinch", dist: touchDist(e.touches),
                  base: { scale, tx, ty, px: m.x, py: m.y } };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      gesture = { type: "pan", x: t.clientX, y: t.clientY, tx, ty, moved: false };
    }
  }, { passive: true });

  lbFrame.addEventListener("touchmove", (e) => {
    if (!gesture) return;
    e.preventDefault();
    e.stopPropagation();

    if (gesture.type === "pinch" && e.touches.length === 2) {
      const m = touchMid(e.touches);
      const factor = touchDist(e.touches) / gesture.dist;
      zoomAt(gesture.base.scale * factor, m.x, m.y, gesture.base);
      applyTransform(false);
    } else if (gesture.type === "pan" && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - gesture.x;
      const dy = t.clientY - gesture.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) gesture.moved = true;
      if (scale > 1.01) {
        tx = gesture.tx + dx;
        ty = gesture.ty + dy;
        clampPan();
        applyTransform(false);
      }
    }
  }, { passive: false });

  lbFrame.addEventListener("touchend", (e) => {
    e.stopPropagation();
    if (!gesture) return;
    const g = gesture;

    if (g.type === "pinch") {
      // toinen sormi jäi ruudulle -> jatketaan panorointina siitä
      if (e.touches.length === 1) {
        const t = e.touches[0];
        gesture = { type: "pan", x: t.clientX, y: t.clientY, tx, ty, moved: true };
      } else {
        gesture = null;
      }
      if (scale < 1.03) resetZoom(true);
      return;
    }

    gesture = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;

    // pyyhkäisy vaihtaa kuvaa vain kun ei olla zoomattu
    if (scale <= 1.01 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) nextImage(); else prevImage();
      return;
    }

    // tuplanapautus: zoomaa 2,5x napautuskohtaan / palauta
    if (!g.moved) {
      const now = Date.now();
      if (now - lastTap.t < 320 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 30) {
        if (scale > 1.01) resetZoom(true);
        else { zoomAt(2.5, t.clientX, t.clientY); applyTransform(true); }
        lastTap.t = 0;
      } else {
        lastTap = { t: now, x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (!viewerOpen) return;
    clampPan();
    applyTransform(false);
    if (gridOn) drawSkyGrid();
  });

  // =========================
  // KOORDINAATTIRUUDUKKO KUVAN PÄÄLLÄ (AstroBin-tyyliin)
  // Tarvitsee plate solve -tiedot images.json:iin:
  //   "ra"       kuvan keskipisteen RA asteina
  //   "dec"      kuvan keskipisteen Dec asteina
  //   "fov"      kuvakentän leveys asteina (kuvan vaakasuunnassa)
  //   "rotation" kuvan suunta: astrometry.net:n "Up is X degrees E of N" (oletus 0)
  //   "flipped"  true jos kuva on peilattu (astrometry.net: parity flipped)
  // Projektio: gnomoninen (TAN), sama jota plate solverit käyttävät.
  // =========================
  const SKY_CATEGORIES = ["deepsky", "widefield"];
  const DEG = Math.PI / 180;

  function hasSolve(d) {
    return d && SKY_CATEGORIES.includes(d.category || "deepsky") &&
      d.ra !== undefined && d.dec !== undefined && d.fov > 0;
  }

  function updateGridButton() {
    const ok = hasSolve(currentData);
    if (skyBtn) skyBtn.classList.toggle("visible", ok);
    if (!ok) setGrid(false);
    else if (gridOn) drawSkyGrid();
  }

  function setGrid(on) {
    gridOn = on;
    if (skyGrid) skyGrid.classList.toggle("on", on);
    if (skyBtn) skyBtn.classList.toggle("active", on);
    if (on) drawSkyGrid();
  }

  function makeProjector(d, W, H) {
    const a0 = d.ra * DEG, d0 = d.dec * DEG;
    const th = (d.rotation || 0) * DEG;
    const ppd = W / d.fov;
    const sd0 = Math.sin(d0), cd0 = Math.cos(d0);
    const ct = Math.cos(th), st = Math.sin(th);
    return (raDeg, decDeg) => {
      const a = raDeg * DEG, dd = decDeg * DEG, da = a - a0;
      const cosc = sd0 * Math.sin(dd) + cd0 * Math.cos(dd) * Math.cos(da);
      if (cosc <= 0.05) return null;
      const xi = Math.cos(dd) * Math.sin(da) / cosc / DEG;                  // itään
      const eta = (cd0 * Math.sin(dd) - sd0 * Math.cos(dd) * Math.cos(da)) / cosc / DEG; // pohjoiseen
      let x = -(xi * ct - eta * st);   // itä vasemmalle kun kuva ei ole peilattu
      const y = -(eta * ct + xi * st); // pohjoinen ylös, ruudun y kasvaa alaspäin
      if (d.flipped) x = -x;
      return [W / 2 + x * ppd, H / 2 + y * ppd];
    };
  }

  function pickStep(span, steps, maxLines) {
    for (const s of steps) if (span / s <= maxLines) return s;
    return steps[steps.length - 1];
  }

  function raLabel(deg, stepSec) {
    deg = ((deg % 360) + 360) % 360;
    const total = Math.round(deg / 15 * 3600);
    const h = Math.floor(total / 3600) % 24;
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (stepSec >= 3600) return `${h}h`;
    if (stepSec >= 60) return `${h}h${String(m).padStart(2, "0")}m`;
    return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
  }

  function decLabel(deg, stepDeg) {
    const sign = deg < 0 ? "−" : "+";
    const total = Math.round(Math.abs(deg) * 3600);
    const d = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (stepDeg >= 1) return `${sign}${d}°`;
    if (stepDeg >= 1 / 60) return `${sign}${d}°${String(m).padStart(2, "0")}′`;
    return `${sign}${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″`;
  }

  function drawSkyGrid() {
    const d = currentData;
    if (!skyGrid || !hasSolve(d)) return;
    const nw = lightboxImg.naturalWidth, nh = lightboxImg.naturalHeight;
    if (!nw || !nh) return; // piirretään kun kuva on latautunut

    const W = 1000;
    const H = W * nh / nw;
    // 1 näytön pikseli viewBox-yksiköissä; zoom huomioidaan, jotta tekstit
    // ja kompassi pysyvät saman kokoisina zoomauksesta riippumatta
    const u = W / Math.max(1, lbFrame.clientWidth * scale);
    const proj = makeProjector(d, W, H);

    const fovW = d.fov;
    const fovH = d.fov * H / W;
    const R = Math.hypot(fovW, fovH) / 2 * 1.3;
    const cosDec0 = Math.max(Math.cos(d.dec * DEG), 0.02);

    // Dec-viivojen väli
    const decSteps = [1/3600, 2/3600, 5/3600, 10/3600, 15/3600, 30/3600,
      1/60, 2/60, 5/60, 10/60, 15/60, 20/60, 30/60, 1, 2, 5, 10, 15, 30];
    // Viivoja enintään ~1 per 140 näytön pikseliä (zoomatessa tiheämpi ruudukko)
    const shownW = lbFrame.clientWidth * scale;
    const maxLines = Math.max(3, Math.min(8, Math.round(shownW / 140)));
    const decStep = pickStep(fovW, decSteps, maxLines);

    // RA-viivojen väli (aikasekunteina)
    const raStepsSec = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1200, 1800, 3600, 7200, 10800];
    const raStepSec = raStepsSec.find(s => fovW / (s / 240 * cosDec0) <= maxLines) || 10800;
    const raStep = raStepSec / 240;

    const decMin = Math.max(-89.999, d.dec - R);
    const decMax = Math.min(89.999, d.dec + R);
    const maxAbsDec = Math.max(Math.abs(decMin), Math.abs(decMax));
    let raHalf = R / Math.max(Math.cos(maxAbsDec * DEG), 0.01);
    const fullRa = raHalf >= 180 || decMax > 89 || decMin < -89;
    const raMin = fullRa ? d.ra - 180 : d.ra - raHalf;
    const raMax = fullRa ? d.ra + 180 : d.ra + raHalf;

    const inside = (p) => p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H;

    // Kumpikin viivaperhe saa oman reunansa arvoilleen kuvan kierrosta riippuen,
    // jotta RA- ja Dec-arvot eivät mene päällekkäin. Dec-viiva kulkee itä-länsi-suunnassa.
    const pc = proj(d.ra, d.dec);
    const pe = proj(d.ra + 0.01 / cosDec0, d.dec);
    const decHorizontal = !(pc && pe) || Math.abs(pe[0] - pc[0]) >= Math.abs(pe[1] - pc[1]);
    // Etsitään kohta, jossa viiva leikkaa vasemman reunan (x = 0) tai alareunan (y = H).
    // Jos viiva ei ylety kyseiseen reunaan, arvoa ei piirretä.
    const crossing = (all, edge) => {
      for (let i = 1; i < all.length; i++) {
        const a = all[i - 1], b = all[i];
        if (!a || !b) continue;
        if (edge === "left" && (a[0] - 0) * (b[0] - 0) <= 0 && a[0] !== b[0]) {
          const t = (0 - a[0]) / (b[0] - a[0]);
          const y = a[1] + t * (b[1] - a[1]);
          if (y >= 0 && y <= H) return [0, y];
        }
        if (edge === "bottom" && (a[1] - H) * (b[1] - H) <= 0 && a[1] !== b[1]) {
          const t = (H - a[1]) / (b[1] - a[1]);
          const x = a[0] + t * (b[0] - a[0]);
          if (x >= 0 && x <= W) return [x, H];
        }
      }
      return null;
    };
    const leftLabel = (all) => {
      const p = crossing(all, "left");
      return p && p[1] > 16 * u && p[1] < H - 22 * u ? { x: 5 * u, y: p[1] - 5 * u } : null;
    };
    const bottomLabel = (all) => {
      const p = crossing(all, "bottom");
      return p && p[0] > 8 * u && p[0] < W - 60 * u ? { x: p[0] + 5 * u, y: H - 6 * u } : null;
    };
    const fmt = (v) => v.toFixed(1);
    const paths = [];
    const labels = [];
    const N = 160;

    function polyline(pointFn) {
      let dStr = "", pen = false;
      const all = [];
      for (let i = 0; i <= N; i++) {
        const p = pointFn(i / N);
        if (!p || Math.abs(p[0]) > 20 * W || Math.abs(p[1]) > 20 * H) { pen = false; all.push(null); continue; }
        dStr += (pen ? "L" : "M") + fmt(p[0]) + " " + fmt(p[1]);
        pen = true;
        all.push(p);
      }
      return { dStr, all };
    }

    // Deklinaatioviivat (vakio Dec)
    for (let dec = Math.ceil(decMin / decStep) * decStep; dec <= decMax + 1e-9; dec += decStep) {
      const { dStr, all } = polyline(f => proj(raMin + (raMax - raMin) * f, dec));
      if (!dStr) continue;
      paths.push(dStr);
      const pos = decHorizontal ? leftLabel(all) : bottomLabel(all);
      if (pos) labels.push({ ...pos, text: decLabel(dec, decStep) });
    }

    // Rektaskensioviivat (vakio RA)
    for (let ra = Math.ceil(raMin / raStep) * raStep; ra <= raMax + 1e-9; ra += raStep) {
      const { dStr, all } = polyline(f => proj(ra, decMin + (decMax - decMin) * f));
      if (!dStr) continue;
      paths.push(dStr);
      const pos = decHorizontal ? bottomLabel(all) : leftLabel(all);
      if (pos) labels.push({ ...pos, text: raLabel(ra, raStepSec) });
    }

    // Kohdemerkinnät: "annotations": [ { "name": "M32", "ra": 10.674, "dec": 40.865, "size": 8 } ]
    // size (valinnainen) on kohteen halkaisija kaariminuutteina; ilman sitä piirretään pieni rengas
    const ppdVB = W / d.fov;
    const annHTML = (d.annotations || []).map(a => {
      const ra = num(a.ra), dec = num(a.dec);
      if (ra === undefined || dec === undefined) return "";
      const p = proj(ra, dec);
      if (!p || p[0] < -20 * u || p[0] > W + 20 * u || p[1] < -20 * u || p[1] > H + 20 * u) return "";
      const r = num(a.size) ? Math.max(6 * u, num(a.size) / 60 / 2 * ppdVB) : 9 * u;
      const name = String(a.name || "").replace(/[&<>"]/g, "");
      return `
        <g class="grid-ann">
          <circle cx="${fmt(p[0])}" cy="${fmt(p[1])}" r="${fmt(r)}"/>
          <text x="${fmt(p[0] + r + 5 * u)}" y="${fmt(p[1] + 4 * u)}" font-size="${fmt(13 * u)}">${name}</text>
        </g>`;
    }).join("");

    // Kompassi (N ja E) oikeaan yläkulmaan
    const c0 = proj(d.ra, d.dec);
    const cN = proj(d.ra, Math.min(89.99, d.dec + 0.01));
    const cE = proj(d.ra + 0.01 / cosDec0, d.dec);
    let compass = "";
    if (c0 && cN && cE) {
      const L = 34 * u;
      const ox = W - 58 * u, oy = 58 * u;
      const dir = (p) => {
        const vx = p[0] - c0[0], vy = p[1] - c0[1];
        const len = Math.hypot(vx, vy) || 1;
        return [vx / len, vy / len];
      };
      const n = dir(cN), e = dir(cE);
      compass = `
        <g class="grid-compass">
          <line x1="${fmt(ox)}" y1="${fmt(oy)}" x2="${fmt(ox + n[0] * L)}" y2="${fmt(oy + n[1] * L)}"/>
          <line x1="${fmt(ox)}" y1="${fmt(oy)}" x2="${fmt(ox + e[0] * L)}" y2="${fmt(oy + e[1] * L)}"/>
          <text x="${fmt(ox + n[0] * (L + 10 * u))}" y="${fmt(oy + n[1] * (L + 10 * u))}" font-size="${fmt(12 * u)}">N</text>
          <text x="${fmt(ox + e[0] * (L + 10 * u))}" y="${fmt(oy + e[1] * (L + 10 * u))}" font-size="${fmt(12 * u)}">E</text>
        </g>`;
    }

    skyGrid.setAttribute("viewBox", `0 0 ${W} ${fmt(H)}`);
    skyGrid.setAttribute("preserveAspectRatio", "none");
    skyGrid.innerHTML = `
      <g class="grid-lines">${paths.map(p => `<path d="${p}"/>`).join("")}</g>
      <g class="grid-labels" font-size="${fmt(11 * u)}">${labels.map(l =>
        `<text x="${fmt(l.x)}" y="${fmt(l.y)}">${l.text}</text>`).join("")}</g>
      ${annHTML}
      ${compass}`;
  }

  // ruudukko piirretään uudelleen kun parempi kuvaversio vaihtuu tilalle
  lightboxImg.addEventListener("load", () => { if (gridOn) drawSkyGrid(); });

  if (skyBtn) {
    skyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setGrid(!gridOn);
    });
  }


  /* ------------------------------------------------------------------------
     Julkiset funktiot (assets/sky.js käyttää näitä)
     ------------------------------------------------------------------------ */
  Object.assign(MZ, {
    num, esc, tr, t, isEnglish, thumbPath, largePath, formatRa, formatDec,
    formatMinutes, formatSeconds, pctText, displayTitle, projectSlug,
    projectProgressText, isTouchDevice, loadImages, loadProjects,
    openViewer,
    openFromList: (list, i) => openViewer(list, i),
    viewerIsOpen: () => viewerOpen
  });

  /* ------------------------------------------------------------------------
     Käynnistys
     ------------------------------------------------------------------------ */
  function start() {
    setLang(lang, true);
    initChrome();
    initStars();
    initProcessing();
    initSoftware();

    Promise.all([loadImages(), loadProjects()]).then(([images, projects]) => {
      allProjects = projects;
      hashList = images;
      initHero(images);
      initPageBanner(images);
      initGallery(images);
      initHomeProject(projects);
      initProjects(projects);
      if (MZ.initSkyMap) MZ.initSkyMap(images, projects);
      syncFromHash();
      document.documentElement.classList.add("loaded");
    });
  }
  // sky.js ladataan tämän jälkeen, joten käynnistys vasta kun sivu on valmis
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else setTimeout(start, 0);
})();
