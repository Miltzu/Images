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
  const translatable = document.querySelectorAll("[data-fi]");
  const navLinks = document.querySelectorAll(".site-nav a");

  function applyLanguage(lang) {
    translatable.forEach(el => {
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
          const card = document.createElement("div");
          card.className = "project-card";

          card.innerHTML = `
            <div class="project-header">
              <h3>${p.name || ""}</h3>
              <span class="status-pill">${p.status || "suunnitteilla"}</span>
            </div>
            <p>${p.desc || ""}</p>
            <div class="meta-bar">
              ${p.integration ? `<span class="meta-pill">${p.integration}</span>` : ""}
              ${p.category ? `<span class="meta-pill">${p.category}</span>` : ""}
            </div>
          `;

          projectsList.appendChild(card);
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

  function registerView(file) {
    const key = "viewCount:" + file;
    const views = parseInt(localStorage.getItem(key) || "0", 10) + 1;
    localStorage.setItem(key, views);

    gallery.querySelectorAll(".card").forEach(card => {
      if (card.dataset.file === file) {
        const pill = card.querySelector(".view-pill");
        if (pill) pill.textContent = views + " katselua";
      }
    });
  }

  function rebuildVisibleImages() {
    currentImages = Array.from(gallery.querySelectorAll(".card"))
      .filter(card => card.style.display !== "none")
      .map(card => ({
        file: card.dataset.file,
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

  function buildCaptionHTML(imgData) {
    const pills = [];
    if (imgData.integration) pills.push(`<span class="meta-pill">${imgData.integration}</span>`);
    if (imgData.telescope) pills.push(`<span class="meta-pill">${imgData.telescope}</span>`);
    if (imgData.filters) pills.push(`<span class="meta-pill">${imgData.filters}</span>`);
    if (imgData.date) pills.push(`<span class="meta-pill">${imgData.date}</span>`);

    const metaHTML = pills.length ? `<div class="meta-bar">${pills.join("")}</div>` : "";
    return `<h2>${imgData.title || ""}</h2><p>${imgData.desc || ""}</p>${metaHTML}`;
  }

  function showImageAt(index) {
    if (!currentImages.length) return;
    currentIndex = (index + currentImages.length) % currentImages.length;

    const img = currentImages[currentIndex];
    lightboxImg.src = img.file;

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

  function openLightbox(imgData) {
    lightbox.style.display = "flex";
    lightboxImg.src = imgData.file;

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
    lightboxImg.src = "";
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

  function updateSkyButton(img) {
    currentSky = {
      ra: img && img.ra !== undefined ? parseFloat(img.ra) : undefined,
      dec: img && img.dec !== undefined ? parseFloat(img.dec) : undefined,
      fov: img && img.fov !== undefined ? parseFloat(img.fov) : undefined
    };

    const btn = document.getElementById("skyLocationBtn");
    const panel = document.getElementById("skyPanel");
    const hasCoords = !isNaN(currentSky.ra) && !isNaN(currentSky.dec);

    if (btn) btn.classList.toggle("visible", hasCoords);
    if (!hasCoords && panel) panel.classList.remove("open");

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
        imageEl.src = img.file;
        imageEl.loading = "lazy";

        const info = document.createElement("div");
        info.className = "info";

        const viewKey = "viewCount:" + img.file;
        const initialViews = parseInt(localStorage.getItem(viewKey) || "0", 10);

        info.innerHTML = `
          <h3>${img.title || ""}</h3>
          <p>${img.desc || ""}</p>
          <div class="meta-bar">
            <span class="meta-pill exif-pill">EXIF...</span>
            <span class="meta-pill view-pill">${initialViews} katselua</span>
          </div>
        `;

        card.appendChild(imageEl);
        card.appendChild(info);
        gallery.appendChild(card);

        // EXIF-tiedot (toimii JPG:lle, ei PNG:lle koska PNG ei kanna EXIF-dataa)
        if (window.EXIF) {
          EXIF.getData(imageEl, function () {
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

            pill.textContent = parts.length ? parts.join(" · ") : "Ei EXIF-tietoa";
          });
        } else {
          const pill = card.querySelector(".exif-pill");
          if (pill) pill.textContent = "Ei EXIF-tietoa";
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
      if (isOpen) goToSkyPosition();
    });
    skyLocationBtn.addEventListener("mousedown", (e) => e.stopPropagation());

    skyPanel.addEventListener("click", (e) => e.stopPropagation());
    skyPanel.addEventListener("mousedown", (e) => e.stopPropagation());
    skyPanel.addEventListener("wheel", (e) => e.stopPropagation());
  }

  document.addEventListener("keydown", (e) => {
    if (lightbox.style.display !== "flex") return;

    if (e.key === "ArrowRight") nextImage();
    if (e.key === "ArrowLeft") prevImage();
    if (e.key === "Escape") closeLightbox();
  });

  document.addEventListener("wheel", (e) => {
    if (lightbox.style.display !== "flex") return;

    e.preventDefault();

    scale += e.deltaY * -0.001;
    scale = Math.min(Math.max(1, scale), 4);

    updateTransform();
  }, { passive: false });

});
