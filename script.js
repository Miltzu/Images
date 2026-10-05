document.addEventListener("DOMContentLoaded", () => {
  const gallery = document.getElementById("gallery");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxText = document.getElementById("text");
  const starfield = document.getElementById("starfield");

  
  // =========================
// ⭐ STARFIELD (kiinteä siemenluku -> sama kuvio joka sivulla)
// =========================
if (starfield) {
  const STAR_COUNT = 250;

  // Yksinkertainen siemenellinen pseudosatunnaisgeneraattori. Sama
  // siemen tuottaa aina täsmälleen saman sarjan lukuja, joten tähdet
  // pysyvät samoissa kohdissa vaikka sivu vaihtuu tai ladataan uudelleen.
  function seededRandom(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = seededRandom(42);

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement("div");
    star.className = "star";

    const x = rand() * 100;
    const y = rand() * 100;

    // enemmän pieniä tähtiä, vähemmän isoja
    const size = rand() < 0.85 ? 1 : (1.5 + rand());

    // SELVÄSTI HITAAMPI ja tasaisempi twinkle: 18-45s täysi kierto
    const duration = 18 + rand() * 27;

    // pitkä, hajautettu delay ettei tähdet syty samassa tahdissa
    const delay = rand() * 30;

    // pieni ja sulava kirkkausvaihtelu per tähti (ei rajua välkyntää)
    const minOpacity = 0.2 + rand() * 0.3;   // 0.2–0.5
    const maxOpacity = Math.min(minOpacity + 0.2 + rand() * 0.2, 1); // +0.2–0.4

    star.style.left = x + "vw";
    star.style.top = y + "vh";

    star.style.width = size + "px";
    star.style.height = size + "px";

    star.style.animationDuration = duration + "s";
    star.style.animationDelay = delay + "s";

    star.style.setProperty("--min-opacity", minOpacity.toFixed(2));
    star.style.setProperty("--max-opacity", maxOpacity.toFixed(2));

    starfield.appendChild(star);
  }
}

  // =========================
  // KIELIVALINTA (FI / EN)
  // =========================
  const langButtons = document.querySelectorAll(".lang-btn");
  const navLinks = document.querySelectorAll(".site-nav a");

  function applyLanguage(lang) {
    document.querySelectorAll("[data-fi]").forEach(el => {
      const text = el.dataset[lang];
      if (text !== undefined) el.textContent = text;
    });
    langButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
    navLinks.forEach(a => {
      const url = new URL(a.getAttribute("href"), location.href);
      url.searchParams.set("lang", lang);
      a.href = url.pathname + url.search;
    });
    document.documentElement.lang = lang;
    localStorage.setItem("siteLang", lang);
    document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }

  const urlLang = new URLSearchParams(location.search).get("lang");
  applyLanguage(urlLang || localStorage.getItem("siteLang") || "fi");

  langButtons.forEach(btn => {
    btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
  });

  // =========================
  // ESIKATSELUKUVAT
  // images/kuva1.jpg -> images/thumbs/kuva1.jpg (tehdään make_thumbs.py:llä).
  // Jos esikatselukuvaa ei ole, käytetään automaattisesti alkuperäistä.
  // =========================
  function thumbPath(file) {
    const slash = file.lastIndexOf("/");
    const dir = slash >= 0 ? file.slice(0, slash + 1) : "";
    const name = file.slice(slash + 1);
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    return dir + "thumbs/" + stem + ".jpg";
  }

  // Asettaa kuvaan esikatselukuvan ja vaihtaa alkuperäiseen, jos sitä ei löydy.
  // onFinalError kutsutaan vain, jos alkuperäinenkään ei lataudu.
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

  // Minuutit luettavaan muotoon: 22.5 -> "22 min 30 s", 135 -> "2 h 15 min"
  function formatMinutes(min) {
    const totalSec = Math.round(min * 60);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
    if (m > 0) return sec ? `${m} min ${sec} s` : `${m} min`;
    return `${sec} s`;
  }

  function esc(text) {
    return String(text).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function pctText(done, goal) {
    const pct = goal > 0 ? Math.min(100, (done / goal) * 100) : 0;
    if (pct > 0 && pct < 1) return "<1";
    return Math.round(pct);
  }

  // =========================
  // PROJEKTIT (projektit.html)
  // =========================
  const projectsList = document.getElementById("projects-list");

  if (projectsList) {
    fetch("projects.json")
      .then(res => res.json())
      .then(projects => {
        if (!projects.length) {
          projectsList.innerHTML =
            `<p class="empty-state">Ei vielä kuvausprojekteja. Lisätään pian.</p>`;
          return;
        }

        projects.forEach(p => {
          const article = document.createElement("article");
          article.className = "project";

          // Uusin merkintä ylimpänä; projects.json:iin lisätään aina loppuun
          const entriesHTML = (p.updates || []).slice().reverse().map(u => `
            <li class="entry${u.image ? " has-image" : ""}">
              ${u.image ? `
                <a class="entry-media" href="${u.image}" target="_blank" rel="noopener">
                  <img data-file="${u.image}" alt="${p.name || ""}" loading="lazy">
                </a>` : ""}
              <div class="entry-body">
                ${u.date ? `<time>${u.date}</time>` : ""}
                ${u.text ? `<p>${u.text}</p>` : ""}
              </div>
            </li>
          `).join("");

          const pills = [];
          if (p.category) pills.push(`<span class="meta-pill">${p.category}</span>`);
          if (p.integration) pills.push(`<span class="meta-pill">${p.integration}</span>`);

          // Edistyminen suodattimittain. Joko yksi palkki:
          //   "progress": { "done_min": 15, "goal_min": 1200 }
          // tai suodatinkohtaiset palkit:
          //   "progress": [ { "filter": "Ha", "done_min": 22.5, "goal_min": 900 }, ... ]
          let progressHTML = "";
          const prList = Array.isArray(p.progress) ? p.progress : (p.progress ? [p.progress] : []);
          const channels = prList.filter(c => c && c.goal_min > 0);
          if (channels.length) {
            const totalDone = channels.reduce((a, c) => a + Math.max(0, c.done_min || 0), 0);
            const totalGoal = channels.reduce((a, c) => a + c.goal_min, 0);

            const rowsHTML = channels.map(c => {
              const done = Math.max(0, c.done_min || 0);
              const pct = Math.min(100, (done / c.goal_min) * 100);
              const key = (c.filter || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              return `
                <div class="progress-row" data-filter="${key}">
                  <span class="progress-filter">${c.filter || ""}</span>
                  <div class="progress-track" role="progressbar" aria-label="${c.filter || ""}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}">
                    <div class="progress-fill${done > 0 ? "" : " empty"}" style="width: ${pct}%"></div>
                  </div>
                  <span class="progress-value">${formatMinutes(done)} / ${formatMinutes(c.goal_min)}</span>
                </div>`;
            }).join("");

            progressHTML = `
              <div class="progress">
                <div class="progress-labels">
                  <span data-fi="Integraatio" data-en="Integration">Integraatio</span>
                  <span class="progress-total">${formatMinutes(totalDone)} / ${formatMinutes(totalGoal)} · ${pctText(totalDone, totalGoal)} %</span>
                </div>
                ${rowsHTML}
              </div>`;
          }

          article.innerHTML = `
            <header class="project-head">
              <div class="project-head-main">
                <h2>${p.name || ""}</h2>
                ${p.desc ? `<p class="project-desc">${p.desc}</p>` : ""}
                ${pills.length ? `<div class="meta-bar">${pills.join("")}</div>` : ""}
                ${progressHTML}
              </div>
              <span class="status-pill">${p.status || "suunnitteilla"}</span>
            </header>
            ${entriesHTML ? `<ol class="timeline">${entriesHTML}</ol>` : ""}
          `;

          // Esikatselukuva -> alkuperäinen -> "Kuvaa ei löytynyt" -teksti
          article.querySelectorAll(".entry-media img").forEach(imgEl => {
            const file = imgEl.dataset.file;
            setThumbSrc(imgEl, file, () => {
              const link = imgEl.closest(".entry-media");
              const missing = document.createElement("div");
              missing.className = "entry-missing";
              missing.textContent = "Kuvaa ei löytynyt: " + file;
              link.replaceWith(missing);
            });
          });

          // Uusien elementtien tekstit valitulle kielelle
          const enLang = document.documentElement.lang === "en";
          article.querySelectorAll("[data-fi]").forEach(el => {
            el.textContent = enLang ? el.dataset.en : el.dataset.fi;
          });

          projectsList.appendChild(article);
        });
      })
      .catch(() => {
        projectsList.innerHTML =
          `<p class="empty-state">Ei vielä kuvausprojekteja. Lisätään pian.</p>`;
      });
  }

  // =========================
  // PROSESSOINTI (prosessointi.html): ennen/jälkeen-liukuri
  //
  // processing.json:
  // [
  //   {
  //     "title": "M31 - Andromeda Galaxy",
  //     "desc": "Lyhyt kuvaus (vapaaehtoinen)",
  //     "steps": [
  //       { "label": "Pinottu, lineaarinen", "image": "images/m31-p1.jpg", "text": "..." },
  //       { "label": "Venytetty",            "image": "images/m31-p2.jpg", "text": "..." },
  //       { "label": "Valmis",               "image": "images/kuva3.jpg" }
  //     ]
  //   }
  // ]
  // Vähintään kaksi vaihetta. Kuvien pitää olla samaa rajausta ja kokoa.
  // =========================
  const processList = document.getElementById("process-list");

  function largeVersion(file) {
    return thumbPath(file).replace(/(^|\/)thumbs\//, "$1large/");
  }

  // näyttöversio images/large/ -> alkuperäinen, jos sitä ei (vielä) ole
  function setLargeSrc(imgEl, file) {
    imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = file; };
    imgEl.src = largeVersion(file);
  }

  function translateNew(root) {
    const lang = document.documentElement.lang === "en" ? "en" : "fi";
    root.querySelectorAll("[data-fi]").forEach(el => {
      const t = el.dataset[lang];
      if (t !== undefined) el.textContent = t;
    });
  }

  function processEmpty() {
    processList.innerHTML = `
      <div class="hero-card">
        <h2 data-fi="Prosessikuvia tulossa pian" data-en="Processing images coming soon">Prosessikuvia tulossa pian</h2>
        <p data-fi="Täällä näkyy pian, miltä kuvat näyttävät eri prosessoinnin vaiheissa." data-en="Soon you'll see here what the images look like at different stages of processing.">Täällä näkyy pian, miltä kuvat näyttävät eri prosessoinnin vaiheissa.</p>
      </div>`;
    translateNew(processList);
  }

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

  if (processList) {
    fetch("processing.json")
      .then(res => res.ok ? res.json() : [])
      .then(items => {
        const valid = (Array.isArray(items) ? items : [])
          .filter(it => it && Array.isArray(it.steps) && it.steps.filter(s => s && s.image).length >= 2);
        if (!valid.length) { processEmpty(); return; }
        valid.forEach(it => processList.appendChild(buildCompare(it)));
      })
      .catch(processEmpty);
  }

  if (!gallery || !lightbox || !lightboxImg) return;

  const lbFrame = document.getElementById("lbFrame");
  const lbStage = document.getElementById("lbStage");
  const skyGrid = document.getElementById("skyGrid");
  const skyBtn = document.getElementById("skyLocationBtn");

  let currentImages = [];
  let currentIndex = -1;
  let currentData = null;

  // =========================
  // KATSELUTILASTOT
  // =========================
  // Kun tätä numeroa nostetaan, jokaisen kävijän selaimen vanhat
  // katselumäärät tyhjennetään kerran.
  const VIEW_RESET_VERSION = "2";
  try {
    if (localStorage.getItem("viewCountVersion") !== VIEW_RESET_VERSION) {
      Object.keys(localStorage)
        .filter(k => k.startsWith("viewCount:"))
        .forEach(k => localStorage.removeItem(k));
      localStorage.setItem("viewCountVersion", VIEW_RESET_VERSION);
    }
  } catch (e) { /* localStorage ei käytettävissä */ }

  function registerView(file) {
    const key = "viewCount:" + file;
    const views = parseInt(localStorage.getItem(key) || "0", 10) + 1;
    localStorage.setItem(key, views);

    gallery.querySelectorAll(".card").forEach(card => {
      if (card.dataset.file === file) {
        const value = card.querySelector(".view-pill");
        if (value) value.textContent = views;
      }
    });
  }

  function isEnglish() {
    return document.documentElement.lang === "en";
  }

  function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }

  function rebuildVisibleImages() {
    currentImages = Array.from(gallery.querySelectorAll(".card"))
      .filter(card => card.style.display !== "none")
      .map(card => card._data);
  }

  // =========================
  // KOORDINAATTIEN MUOTOILU
  // =========================
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

  // Sekunnit luettavaan muotoon: 1350 -> "22 min 30 s", 18000 -> "5 h"
  function formatSeconds(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
    if (m > 0) return s ? `${m} min ${s} s` : `${m} min`;
    return `${s} s`;
  }

  // Suodatinkohtaiset valotukset:
  //   "acquisition": [ { "filter": "Ha", "count": 20, "exposure": 300 }, ... ]
  // exposure on yhden valotuksen pituus sekunteina.
  function acquisitionRows(d) {
    return (d.acquisition || []).filter(a => a && a.count > 0 && a.exposure > 0);
  }

  // Kuvan tiedot lightboxin alla: tietolaatikko, suodatintaulukko ja
  // avattava "Mikä tämä on?" -kortti
  function buildCaptionHTML(d) {
    const en = isEnglish();
    const acq = acquisitionRows(d);
    const totalSec = acq.reduce((sum, a) => sum + a.count * a.exposure, 0);

    const rows = [];
    if (d.telescope) rows.push([en ? "Telescope" : "Kaukoputki", d.telescope]);
    if (d.camera) rows.push([en ? "Camera" : "Kamera", d.camera]);
    if (d.mount) rows.push([en ? "Mount" : "Jalusta", d.mount]);
    if (totalSec > 0) rows.push([en ? "Total integration" : "Kokonaisintegraatio", formatSeconds(totalSec)]);
    else if (d.integration) rows.push([en ? "Integration" : "Integraatio", d.integration]);
    if (d.filters && !acq.length) rows.push([en ? "Filters" : "Suodattimet", d.filters]);
    if (d.date) rows.push([en ? "Date" : "Päivämäärä", d.date]);
    if (d.ra !== undefined) rows.push(["RA", formatRa(d.ra)]);
    if (d.dec !== undefined) rows.push(["Dec", formatDec(d.dec)]);
    if (d.fov !== undefined) {
      rows.push([en ? "Field width" : "Kuvakentän leveys",
        d.fov >= 1 ? d.fov.toFixed(2).replace(".", en ? "." : ",") + "°"
                   : Math.round(d.fov * 60) + "′"]);
    }

    const dataHTML = rows.length
      ? `<dl class="data-box">${rows.map(([k, v]) =>
          `<div class="data-cell"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`
      : "";

    const acqHTML = acq.length ? `
      <table class="acq-table">
        <thead><tr>
          <th>${en ? "Filter" : "Suodatin"}</th>
          <th>${en ? "Exposures" : "Valotukset"}</th>
          <th>${en ? "Total" : "Yhteensä"}</th>
        </tr></thead>
        <tbody>${acq.map(a => `
          <tr>
            <td><span class="filter-dot" data-filter="${esc(String(a.filter || "").toLowerCase().replace(/[^a-z0-9]/g, ""))}"></span>${esc(a.filter || "")}</td>
            <td>${a.count} × ${formatSeconds(a.exposure)}</td>
            <td>${formatSeconds(a.count * a.exposure)}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : "";

    const about = d.about && (d.about[en ? "en" : "fi"] || d.about.fi || d.about.en);
    const aboutHTML = about ? `
      <details class="about-card"${aboutOpen ? " open" : ""}>
        <summary>${en ? "What is this?" : "Mikä tämä on?"}</summary>
        <p>${esc(about)}</p>
      </details>` : "";

    return `<h2>${esc(d.title || "")}</h2>${d.desc ? `<p>${esc(d.desc)}</p>` : ""}${dataHTML}${acqHTML}${aboutHTML}`;
  }

  // "Mikä tämä on?" -kortin auki/kiinni-tila säilyy kuvasta toiseen siirryttäessä
  let aboutOpen = false;
  if (lightboxText) {
    lightboxText.addEventListener("toggle", (e) => {
      if (e.target.classList && e.target.classList.contains("about-card")) aboutOpen = e.target.open;
    }, true);
  }

  // Kielen vaihto päivittää avoinna olevan kuvan tekstit
  document.addEventListener("langchange", () => {
    if (lightbox.style.display === "flex" && currentData && lightboxText) {
      lightboxText.innerHTML = buildCaptionHTML(currentData);
    }
  });

  // =========================
  // KUVAN LATAUS LIGHTBOXIIN
  //   1. esikatselukuva (images/thumbs/)
  //   2. näyttöversio  (images/large/, pisin sivu 3200 px)
  // Alkuperäistä (voi olla 45 Mpix) ei ladata puhelimella koskaan, koska
  // se kaataa mobiiliselaimen. Lataa-nappi antaa aina alkuperäisen.
  // =========================
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  let lightboxToken = 0;

  function largePath(file) {
    return thumbPath(file).replace("/thumbs/", "/large/").replace(/^thumbs\//, "large/");
  }

  function loadLightboxImage(file) {
    const token = ++lightboxToken;
    let shownStage = "thumb";

    lightboxImg.onerror = () => {
      if (token !== lightboxToken) return;
      if (shownStage === "thumb") { shownStage = "large"; lightboxImg.src = largePath(file); }
      else if (shownStage === "large") { shownStage = "original"; lightboxImg.onerror = null; lightboxImg.src = file; }
    };
    lightboxImg.src = thumbPath(file);

    const large = new Image();
    large.onload = () => {
      if (token !== lightboxToken) return;
      shownStage = "large";
      lightboxImg.onerror = null;
      lightboxImg.src = large.src;
    };
    large.onerror = () => {
      if (token !== lightboxToken || isTouchDevice) return;
      const full = new Image();
      full.onload = () => {
        if (token !== lightboxToken) return;
        lightboxImg.onerror = null;
        lightboxImg.src = file;
      };
      full.src = file;
    };
    large.src = largePath(file);
  }

  function updateDownloadLink(src) {
    const dl = document.getElementById("lightboxDownload");
    if (dl) {
      dl.href = src;
      dl.setAttribute("download", src.split("/").pop());
    }
  }

  function showData(d) {
    currentData = d;
    loadLightboxImage(d.file);
    if (lightboxText) lightboxText.innerHTML = buildCaptionHTML(d);
    resetZoom();
    updateDownloadLink(d.file);
    updateGridButton();
  }

  function openLightbox(d) {
    lightbox.style.display = "flex";
    document.body.classList.add("lightbox-open");
    // Selainhistoriaan merkintä: puhelimen paluu-ele/-painike sulkee kuvan
    // eikä poistu koko sivulta
    if (!(history.state && history.state.lightbox)) {
      history.pushState({ lightbox: true }, "");
    }
    showData(d);
  }

  function showImageAt(index) {
    if (!currentImages.length) return;
    currentIndex = (index + currentImages.length) % currentImages.length;
    const d = currentImages[currentIndex];
    registerView(d.file);
    showData(d);
  }

  function nextImage() { showImageAt(currentIndex + 1); }
  function prevImage() { showImageAt(currentIndex - 1); }

  function closeLightbox(fromHistory) {
    if (lightbox.style.display !== "flex") return;
    // suljettiin painikkeella: poistetaan avauksen historiamerkintä
    if (fromHistory !== true && history.state && history.state.lightbox) {
      history.back();
      return; // popstate kutsuu tämän uudelleen
    }
    lightbox.style.display = "none";
    document.body.classList.remove("lightbox-open");
    lightboxToken++;
    lightboxImg.onerror = null;
    lightboxImg.removeAttribute("src");
    setGrid(false);
    resetZoom();
  }

  window.closeLightbox = () => closeLightbox();

  window.addEventListener("popstate", () => {
    if (lightbox.style.display === "flex") closeLightbox(true);
  });

  const lightboxClose = document.getElementById("lightboxClose");
  if (lightboxClose) {
    lightboxClose.addEventListener("click", (e) => {
      e.stopPropagation();
      closeLightbox();
    });
  }

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
    if (lightbox.style.display !== "flex") return;
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

  // Tiedot-painike: vierittää kuvatiedot näkyviin ja avaa "Mikä tämä on?" -kortin
  const infoBtn = document.getElementById("infoBtn");
  if (infoBtn) {
    infoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!lightboxText) return;
      const card = lightboxText.querySelector(".about-card");
      if (card) { card.open = true; aboutOpen = true; }
      lightboxText.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // =========================
  // GALLERIA
  // =========================
  fetch("images.json")
    .then(res => res.json())
    .then(images => {
      const allData = [];
      images.forEach(img => {
        const data = {
          file: img.file,
          category: img.category || "deepsky",
          title: img.title || "",
          desc: img.desc || "",
          ra: num(img.ra),
          dec: num(img.dec),
          fov: num(img.fov),
          rotation: num(img.rotation) || 0,
          flipped: !!img.flipped,
          integration: img.integration,
          telescope: img.telescope,
          camera: img.camera,
          mount: img.mount,
          filters: img.filters,
          acquisition: Array.isArray(img.acquisition) ? img.acquisition : [],
          annotations: Array.isArray(img.annotations) ? img.annotations : [],
          about: img.about,
          date: img.date,
          featured: !!img.featured,
          focus: img.focus
        };
        allData.push(data);

        const card = document.createElement("div");
        card.className = "card";
        card._data = data;
        card.dataset.category = data.category;
        card.dataset.file = data.file;
        if (img.reveal) card.classList.add("revealed");

        const imageEl = document.createElement("img");
        imageEl.loading = "lazy";
        imageEl.alt = img.desc || img.title || "";
        setThumbSrc(imageEl, img.file);

        const info = document.createElement("div");
        info.className = "info";

        const viewKey = "viewCount:" + img.file;
        const initialViews = parseInt(localStorage.getItem(viewKey) || "0", 10);

        info.innerHTML = `
          <div class="info-text">
            <h3>${img.title || ""}</h3>
            ${img.desc ? `<p>${img.desc}</p>` : ""}
          </div>
          <dl class="card-stats">
            <div class="stat stat-wide">
              <dt data-fi="Kamera" data-en="Camera">Kamera</dt>
              <dd class="exif-pill">…</dd>
            </div>
            <div class="stat">
              <dt data-fi="Katselut" data-en="Views">Katselut</dt>
              <dd class="view-pill">${initialViews}</dd>
            </div>
          </dl>
        `;

        const en = document.documentElement.lang === "en";
        info.querySelectorAll("[data-fi]").forEach(el => {
          el.textContent = en ? el.dataset.en : el.dataset.fi;
        });

        card.appendChild(imageEl);
        card.appendChild(info);
        gallery.appendChild(card);

        // EXIF-tiedot (vain JPG:ssä). Luetaan kun esikatselukuva on ladattu.
        if (window.EXIF) {
          imageEl.addEventListener("load", () => EXIF.getData(imageEl, function () {
            const pill = card.querySelector(".exif-pill");
            if (!pill) return;

            const model = EXIF.getTag(this, "Model");
            const iso = EXIF.getTag(this, "ISOSpeedRatings");
            const exposure = EXIF.getTag(this, "ExposureTime");
            const fNumber = EXIF.getTag(this, "FNumber");

            const parts = [];
            if (model) parts.push(model);
            if (iso) parts.push("ISO " + iso);
            if (exposure) {
              const expText = (exposure && exposure.numerator !== undefined)
                ? exposure.numerator + "/" + exposure.denominator
                : exposure;
              parts.push(expText + "s");
            }
            if (fNumber) parts.push("f/" + fNumber);

            pill.textContent = parts.length ? parts.join(" · ") : "–";
          }), { once: true });
        } else {
          const pill = card.querySelector(".exif-pill");
          if (pill) pill.textContent = "–";
        }

        card.addEventListener("click", () => {
          rebuildVisibleImages();
          currentIndex = currentImages.findIndex(i => i.file === img.file);
          registerView(img.file);
          openLightbox(data);
        });
      });

      initFeatured(allData);
      initSkyMap(allData);
    })
    .catch(() => initFeatured([]));

  // Avaa kuvan koko kokoelmasta (etusivun iso kuva, taivaskartta).
  // Nuolilla selataan kaikkia kuvia riippumatta valitusta kategoriasta.
  function openFromList(list, index) {
    currentImages = list.slice();
    currentIndex = index;
    registerView(list[index].file);
    openLightbox(list[index]);
  }

  function displayTitle(d) {
    const t = (d.title || "").trim();
    return t && t !== "-" ? t : (d.desc || "");
  }

  const CATEGORY_NAMES = {
    deepsky: ["Deep sky", "Deep sky"],
    planeetta: ["Planeetta", "Planet"],
    kuu: ["Kuu", "Moon"],
    aurinko: ["Aurinko", "Sun"],
    revontuli: ["Revontulet", "Aurora"],
    widefield: ["Laajakulma", "Wide field"]
  };

  // =========================
  // ETUSIVUN ISO KUVA
  // Näytetään kuva, jolla on "featured": true, muuten images.json:n
  // viimeinen (uusin) kuva. "focus": "50% 30%" siirtää rajausta.
  // =========================
  function initFeatured(list) {
    const section = document.getElementById("featured");
    if (!section) return;
    const featuredImg = document.getElementById("featuredImg");
    const titleEl = document.getElementById("featuredTitle");
    const metaEl = document.getElementById("featuredMeta");
    const descEl = document.getElementById("featuredDesc");
    const openBtn = document.getElementById("featuredOpen");

    let idx = list.findIndex(d => d.featured);
    if (idx < 0) idx = list.length - 1;
    if (idx < 0) {
      // ei kuvia: pelkkä tekstiotsikko
      section.classList.remove("is-loading");
      section.classList.add("no-image");
      return;
    }
    const d = list[idx];

    titleEl.removeAttribute("data-fi");
    titleEl.removeAttribute("data-en");
    titleEl.textContent = displayTitle(d);
    const title = (d.title || "").trim();
    descEl.textContent = title && title !== "-" ? (d.desc || "") : "";
    descEl.hidden = !descEl.textContent;

    function renderMeta() {
      const en = isEnglish();
      const parts = [];
      const cat = CATEGORY_NAMES[d.category];
      if (cat) parts.push(cat[en ? 1 : 0]);
      const totalSec = acquisitionRows(d).reduce((sum, a) => sum + a.count * a.exposure, 0);
      if (totalSec > 0) parts.push(formatSeconds(totalSec));
      if (d.ra !== undefined && d.dec !== undefined) {
        parts.push(`RA ${formatRa(d.ra).replace(/ \d+s$/, "")} · Dec ${formatDec(d.dec).replace(/ \d+″$/, "")}`);
      }
      metaEl.textContent = parts.join(" · ");
      metaEl.hidden = !parts.length;
    }
    renderMeta();
    document.addEventListener("langchange", renderMeta);

    if (d.focus) featuredImg.style.objectPosition = d.focus;
    featuredImg.alt = displayTitle(d);
    // puhelimelle esikatselukuva (1600 px), isolle näytölle näyttöversio (3200 px)
    const small = thumbPath(d.file);
    const big = largePath(d.file);
    featuredImg.onload = () => section.classList.remove("is-loading");
    featuredImg.onerror = () => {
      if (featuredImg.dataset.fallback === "1") { section.classList.remove("is-loading"); return; }
      featuredImg.dataset.fallback = "1";
      featuredImg.removeAttribute("srcset");
      featuredImg.src = d.file;
    };
    featuredImg.sizes = "100vw";
    featuredImg.srcset = `${small} 1600w, ${big} 3200w`;
    featuredImg.src = small;

    const open = () => openFromList(list, idx);
    openBtn.addEventListener("click", open);
    section.querySelector(".featured-media").addEventListener("click", open);
  }

  // =========================
  // TAIVASKARTTA
  // Koko taivas Hammer-projektiolla. RA kasvaa vasemmalle (itä vasemmalla,
  // kuten taivasta katsottaessa), keskellä RA 0h.
  // =========================
  function initSkyMap(list) {
    const section = document.getElementById("skymap-section");
    const svg = document.getElementById("skyMap");
    if (!section || !svg) return;

    const items = list
      .map((d, i) => ({ d, i }))
      .filter(o => o.d.ra !== undefined && o.d.dec !== undefined);
    if (!items.length) return;
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

    svg.innerHTML = `
      <defs>
        <clipPath id="smClip"><path d="${outline}"/></clipPath>
        <filter id="smBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
      </defs>
      <path class="sm-sky" d="M${CX - 480} ${CY} A480 240 0 1 0 ${CX + 480} ${CY} A480 240 0 1 0 ${CX - 480} ${CY}Z"/>
      <g clip-path="url(#smClip)">
        <path class="sm-south" d="${south}"/>
        <path class="sm-mw-band" d="${milkyWay}" filter="url(#smBlur)"/>
        <path class="sm-mw" d="${milkyWay}"/>
        <path class="sm-grid" d="${meridians}${parallels}"/>
        <path class="sm-equator" d="${pathFrom(range(-179.9, 179.9, 3).map(l => hammerLP(l * D, 0)))}"/>
        <path class="sm-ecl" d="${ecliptic}"/>
      </g>
      <path class="sm-edge" d="M${CX - 480} ${CY} A480 240 0 1 0 ${CX + 480} ${CY} A480 240 0 1 0 ${CX - 480} ${CY}Z"/>
      ${raLabels}${decLabels}
      <text class="sm-label sm-pole" x="${CX}" y="${CY - 248}" text-anchor="middle">+90°</text>
      <text class="sm-label sm-pole" x="${CX}" y="${CY + 262}" text-anchor="middle">−90°</text>
      ${points}`;

    listEl.innerHTML = items.map(({ d, i }) => {
      const full = displayTitle(d);
      const sn = shortName(d);
      const rest = full.length > sn.length ? full.slice(sn.length).replace(/^\s*[-–—]\s*/, "") : "";
      return `<li><button class="sm-chip" type="button" data-i="${i}"><span class="sm-chip-dot"></span><b>${esc(sn)}</b>${rest ? `<span>${esc(rest)}</span>` : ""}</button></li>`;
    }).join("");

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

    svg.querySelectorAll(".sm-point").forEach(g => {
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
    listEl.querySelectorAll(".sm-chip").forEach(btn => {
      const i = +btn.dataset.i;
      btn.addEventListener("click", () => openFromList(list, i));
      btn.addEventListener("mouseenter", () => highlight(i, true));
      btn.addEventListener("mouseleave", () => highlight(i, false));
      btn.addEventListener("focus", () => highlight(i, true));
      btn.addEventListener("blur", () => highlight(i, false));
    });
  }

  // =========================
  // GALLERIAN KATEGORIAT
  // =========================
  const tabButtons = document.querySelectorAll(".gallery-tabs .tab-btn");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const category = btn.dataset.category;

      gallery.querySelectorAll(".card").forEach(card => {
        const show = category === "all" || card.dataset.category === category;
        card.style.display = show ? "" : "none";
      });
    });
  });

  // =========================
  // NÄKYMÄVALINTA (infojen kanssa / vain kuvat)
  // =========================
  const viewButtons = document.querySelectorAll(".view-btn");

  function applyView(view) {
    gallery.classList.toggle("compact-view", view === "compact");
    viewButtons.forEach(b => b.classList.toggle("active", b.dataset.view === view));
    localStorage.setItem("galleryView", view);
  }

  applyView(localStorage.getItem("galleryView") || "info");

  viewButtons.forEach(btn => {
    btn.addEventListener("click", () => applyView(btn.dataset.view));
  });

  // =========================
  // LIGHTBOXIN NAPIT JA NÄPPÄIMET
  // =========================
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");
  const lightboxDownload = document.getElementById("lightboxDownload");

  if (lightboxDownload) {
    lightboxDownload.addEventListener("click", (e) => e.stopPropagation());
  }
  if (lightboxPrev) {
    lightboxPrev.addEventListener("click", (e) => { e.stopPropagation(); prevImage(); });
  }
  if (lightboxNext) {
    lightboxNext.addEventListener("click", (e) => { e.stopPropagation(); nextImage(); });
  }
  if (lightboxText) {
    lightboxText.addEventListener("click", (e) => e.stopPropagation());
  }

  document.addEventListener("keydown", (e) => {
    if (lightbox.style.display !== "flex") return;
    if (e.key === "ArrowRight") nextImage();
    if (e.key === "ArrowLeft") prevImage();
    if (e.key === "Escape") closeLightbox();
  });

});
