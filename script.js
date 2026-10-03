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

  if (!gallery || !lightbox || !lightboxImg) return;

  // =========================
  // LIGHTBOX STATE
  // =========================
  let scale = 1;
  let posX = 0;
  let posY = 0;

  let currentImages = [];
  let currentIndex = -1;

  // Katselutilastojen nollaus: kun tätä numeroa nostetaan, jokaisen
  // kävijän selaimen vanhat katselumäärät tyhjennetään kerran.
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

  function rebuildVisibleImages() {
    currentImages = Array.from(gallery.querySelectorAll(".card"))
      .filter(card => card.style.display !== "none")
      .map(card => ({
        file: card.dataset.file,
        category: card.dataset.category,
        title: card.dataset.title,
        desc: card.dataset.desc,
        ra: card.dataset.ra !== undefined ? parseFloat(card.dataset.ra) : undefined,
        dec: card.dataset.dec !== undefined ? parseFloat(card.dataset.dec) : undefined,
        fov: card.dataset.fov !== undefined ? parseFloat(card.dataset.fov) : undefined,
        integration: card.dataset.integration,
        telescope: card.dataset.telescope,
        filters: card.dataset.filters,
        date: card.dataset.date
      }));
  }

  function formatRa(deg) {
    const h = deg / 15;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    const ss = Math.round(((h - hh) * 60 - mm) * 60);
    return `${hh}h ${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
  }

  function formatDec(deg) {
    const sign = deg < 0 ? "−" : "+";
    const a = Math.abs(deg);
    const dd = Math.floor(a);
    const mm = Math.floor((a - dd) * 60);
    const ss = Math.round(((a - dd) * 60 - mm) * 60);
    return `${sign}${dd}° ${String(mm).padStart(2, "0")}′ ${String(ss).padStart(2, "0")}″`;
  }

  // Kuvan tekniset tiedot omana laatikkonaan lightboxin alla
  function buildCaptionHTML(imgData) {
    const en = isEnglish();
    const rows = [];
    if (imgData.integration) rows.push([en ? "Integration" : "Integraatio", imgData.integration]);
    if (imgData.telescope) rows.push([en ? "Telescope" : "Kaukoputki", imgData.telescope]);
    if (imgData.filters) rows.push([en ? "Filters" : "Suodattimet", imgData.filters]);
    if (imgData.date) rows.push([en ? "Date" : "Päivämäärä", imgData.date]);
    if (!isNaN(imgData.ra) && imgData.ra !== undefined && imgData.ra !== null) {
      rows.push(["RA", formatRa(parseFloat(imgData.ra))]);
    }
    if (!isNaN(imgData.dec) && imgData.dec !== undefined && imgData.dec !== null) {
      rows.push(["Dec", formatDec(parseFloat(imgData.dec))]);
    }

    const dataHTML = rows.length
      ? `<dl class="data-box">${rows.map(([k, v]) =>
          `<div class="data-cell"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`
      : "";

    return `<h2>${imgData.title || ""}</h2>${imgData.desc ? `<p>${imgData.desc}</p>` : ""}${dataHTML}`;
  }

  // Lightbox näyttää ensin kevyen esikatselukuvan (yleensä jo selaimen
  // välimuistissa) ja vaihtaa täysikokoiseen heti kun se on ladattu.
  let lightboxToken = 0;

  function loadLightboxImage(file) {
    const token = ++lightboxToken;
    let usingThumb = true;

    lightboxImg.onerror = () => {
      // esikatselukuvaa ei ole -> suoraan alkuperäinen
      if (token === lightboxToken && usingThumb) {
        usingThumb = false;
        lightboxImg.src = file;
      }
    };
    lightboxImg.src = thumbPath(file);

    const full = new Image();
    full.onload = () => {
      if (token !== lightboxToken) return; // käyttäjä vaihtoi jo kuvaa
      usingThumb = false;
      lightboxImg.onerror = null;
      lightboxImg.src = file;
    };
    full.src = file;
  }

  function showImageAt(index) {
    if (!currentImages.length) return;
    currentIndex = (index + currentImages.length) % currentImages.length;

    const img = currentImages[currentIndex];
    loadLightboxImage(img.file);

    if (lightboxText) {
      lightboxText.innerHTML = buildCaptionHTML(img);
    }

    resetTransform();
    registerView(img.file);
    updateSkyButton(img);
    updateDownloadLink(img.file);
  }

  function nextImage() {
    showImageAt(currentIndex + 1);
  }

  function prevImage() {
    showImageAt(currentIndex - 1);
  }

  function closeSkyPanel() {
    const panel = document.getElementById("skyPanel");
    if (panel) panel.classList.remove("open");
    document.body.classList.remove("sky-open");
  }

  function openLightbox(imgData) {
    lightbox.style.display = "flex";
    document.body.classList.add("lightbox-open");
    loadLightboxImage(imgData.file);

    if (lightboxText) {
      lightboxText.innerHTML = buildCaptionHTML(imgData);
    }

    resetTransform();
    updateSkyButton(imgData);
    updateDownloadLink(imgData.file);
  }

  function updateDownloadLink(src) {
    const dl = document.getElementById("lightboxDownload");
    if (dl) {
      dl.href = src;
      dl.setAttribute("download", src.split("/").pop());
    }
  }

  function closeLightbox() {
    lightbox.style.display = "none";
    document.body.classList.remove("lightbox-open");
    closeSkyPanel();
    lightboxToken++;
    lightboxImg.onerror = null;
    lightboxImg.removeAttribute("src");
    resetTransform();
    const panel = document.getElementById("skyPanel");
    if (panel) panel.classList.remove("open");
  }

  function resetTransform() {
    scale = 1;
    posX = 0;
    posY = 0;
    updateTransform();
  }

  function updateTransform() {
    lightboxImg.style.transform =
      `translate(${posX}px, ${posY}px) scale(${scale})`;
  }

  let currentSky = { ra: undefined, dec: undefined, fov: undefined };

  // Kiinteä paikka taivaalla on vain näillä kategorioilla. Revontulilla,
  // Kuulla, Auringolla ja planeetoilla koordinaatit eivät ole järkeviä.
  const SKY_CATEGORIES = ["deepsky", "widefield"];

  function updateSkyButton(img) {
    const category = (img && img.category) || "deepsky";
    currentSky = {
      ra: img && img.ra !== undefined ? parseFloat(img.ra) : undefined,
      dec: img && img.dec !== undefined ? parseFloat(img.dec) : undefined,
      fov: img && img.fov !== undefined ? parseFloat(img.fov) : undefined
    };

    const btn = document.getElementById("skyLocationBtn");
    const panel = document.getElementById("skyPanel");
    const hasCoords = SKY_CATEGORIES.includes(category) &&
      !isNaN(currentSky.ra) && !isNaN(currentSky.dec);

    if (btn) btn.classList.toggle("visible", hasCoords);
    if (!hasCoords) closeSkyPanel();

    if (hasCoords && panel && panel.classList.contains("open")) {
      goToSkyPosition();
    }
  }

  // =========================
  // GALLERY
  // =========================
  fetch("images.json")
    .then(res => res.json())
    .then(images => {
      images.forEach(img => {
        const card = document.createElement("div");
        card.className = "card";
        card.dataset.category = img.category || "deepsky";
        card.dataset.file = img.file;
        card.dataset.title = img.title || "";
        card.dataset.desc = img.desc || "";
        if (img.ra !== undefined) card.dataset.ra = img.ra;
        if (img.dec !== undefined) card.dataset.dec = img.dec;
        if (img.fov !== undefined) card.dataset.fov = img.fov;
        if (img.integration) card.dataset.integration = img.integration;
        if (img.telescope) card.dataset.telescope = img.telescope;
        if (img.filters) card.dataset.filters = img.filters;
        if (img.date) card.dataset.date = img.date;
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

        // Uusien korttien otsikot kielivalinnan mukaan
        const en = document.documentElement.lang === "en";
        info.querySelectorAll("[data-fi]").forEach(el => {
          el.textContent = en ? el.dataset.en : el.dataset.fi;
        });

        card.appendChild(imageEl);
        card.appendChild(info);
        gallery.appendChild(card);

        // EXIF-tiedot (toimii JPG:lle, ei PNG:lle koska PNG ei kanna EXIF-dataa)
        // Luetaan vasta kun kuva on ladattu (esikatselukuva säilyttää EXIFin)
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
          openLightbox(img);
        });
      });
    });

  // =========================
  // GALLERIA-TABIT (Deepsky / Aurinko / Wide field)
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
  // LIGHTBOX EVENTS
  // =========================
  window.closeLightbox = closeLightbox;

  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");
  const lightboxDownload = document.getElementById("lightboxDownload");

  // Klikkaus itse kuvaan ei saa sulkea lightboxia (vain tausta sulkee).
  // Muuten jokainen normaali klikkaus kuvaan (esim. raahauksen jälkeinen
  // nosto) sulki koko lightboxin heti.
  lightboxImg.addEventListener("click", (e) => e.stopPropagation());

  if (lightboxDownload) {
    lightboxDownload.addEventListener("click", (e) => e.stopPropagation());
    lightboxDownload.addEventListener("mousedown", (e) => e.stopPropagation());
  }

  if (lightboxPrev) {
    lightboxPrev.addEventListener("click", (e) => {
      e.stopPropagation();
      prevImage();
    });
    lightboxPrev.addEventListener("mousedown", (e) => e.stopPropagation());
  }

  if (lightboxNext) {
    lightboxNext.addEventListener("click", (e) => {
      e.stopPropagation();
      nextImage();
    });
    lightboxNext.addEventListener("mousedown", (e) => e.stopPropagation());
  }

  // =========================
  // KOSKETUSTUKI (mobiili): nipistys-zoomaus, raahaus zoomattuna,
  // swipe vaihtaa kuvaa kun ei olla zoomattu
  // =========================
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartPosX = 0;
  let touchStartPosY = 0;
  let lastTouchDistance = null;
  let isPinching = false;

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  lightboxImg.addEventListener("touchstart", (e) => {
    if (lightbox.style.display !== "flex") return;

    if (e.touches.length === 2) {
      isPinching = true;
      lastTouchDistance = getTouchDistance(e.touches);
    } else if (e.touches.length === 1) {
      isPinching = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartPosX = posX;
      touchStartPosY = posY;
    }
  }, { passive: true });

  lightboxImg.addEventListener("touchmove", (e) => {
    if (lightbox.style.display !== "flex") return;

    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      if (lastTouchDistance) {
        scale += (dist - lastTouchDistance) * 0.01;
        scale = Math.min(Math.max(1, scale), 4);
        updateTransform();
      }
      lastTouchDistance = dist;
    } else if (e.touches.length === 1 && scale > 1.02) {
      // panoroidaan vain kun kuva on zoomattu sisään
      e.preventDefault();
      posX = touchStartPosX + (e.touches[0].clientX - touchStartX);
      posY = touchStartPosY + (e.touches[0].clientY - touchStartY);
      updateTransform();
    }
  }, { passive: false });

  lightboxImg.addEventListener("touchend", (e) => {
    if (isPinching) {
      isPinching = false;
      lastTouchDistance = null;
      return;
    }

    if (scale > 1.02) return; // zoomattuna ei swipetä kuvien välillä

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) nextImage(); else prevImage();
    }
  }, { passive: true });

  // =========================
  // SIJAINTI TAIVAALLA (Aladin Lite, ladataan vain pyydettäessä)
  // =========================
  let aladinScriptLoaded = false;
  let aladinInstance = null;

  function loadAladinScript(callback) {
    if (aladinScriptLoaded) { callback(); return; }
    const script = document.createElement("script");
    script.src = "https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js";
    script.charset = "utf-8";
    script.onload = () => {
      aladinScriptLoaded = true;
      callback();
    };
    document.head.appendChild(script);
  }

  function goToSkyPosition() {
    if (isNaN(currentSky.ra) || isNaN(currentSky.dec)) return;

    loadAladinScript(() => {
      A.init.then(() => {
        if (!aladinInstance) {
          aladinInstance = A.aladin("#aladin-div", {
            survey: "P/DSS2/color",
            fov: currentSky.fov || 1,
            showCooGrid: true,
            showSimbadPointerControl: true
          });
        }
        aladinInstance.gotoRaDec(currentSky.ra, currentSky.dec);
        aladinInstance.setFov(currentSky.fov || 1);
      });
    });
  }

  const skyLocationBtn = document.getElementById("skyLocationBtn");
  const skyPanel = document.getElementById("skyPanel");

  if (skyLocationBtn && skyPanel) {
    skyLocationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = skyPanel.classList.toggle("open");
      document.body.classList.toggle("sky-open", isOpen);
      if (isOpen) goToSkyPosition();
    });
    skyLocationBtn.addEventListener("mousedown", (e) => e.stopPropagation());

    skyPanel.addEventListener("click", (e) => e.stopPropagation());
    skyPanel.addEventListener("mousedown", (e) => e.stopPropagation());
    skyPanel.addEventListener("wheel", (e) => e.stopPropagation());
    ["touchstart", "touchmove", "touchend"].forEach(type =>
      skyPanel.addEventListener(type, (e) => e.stopPropagation(), { passive: true }));

    const skyClose = document.getElementById("skyClose");
    if (skyClose) {
      skyClose.addEventListener("click", (e) => {
        e.stopPropagation();
        closeSkyPanel();
      });
    }
  }

  document.addEventListener("keydown", (e) => {
    if (lightbox.style.display !== "flex") return;

    if (e.key === "ArrowRight") nextImage();
    if (e.key === "ArrowLeft") prevImage();
    if (e.key === "Escape") {
      const panel = document.getElementById("skyPanel");
      if (panel && panel.classList.contains("open")) closeSkyPanel();
      else closeLightbox();
    }
  });

  document.addEventListener("wheel", (e) => {
    if (lightbox.style.display !== "flex") return;

    e.preventDefault();

    scale += e.deltaY * -0.001;
    scale = Math.min(Math.max(1, scale), 4);

    updateTransform();
  }, { passive: false });

});
