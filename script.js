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

    // HITAAMPI twinkle
    const duration = 6 + rand() * 14; // 6–20s (selvästi rauhallisempi)

    // pidempi, hajautettu delay
    const delay = rand() * 20;

    star.style.left = x + "vw";
    star.style.top = y + "vh";

    star.style.width = size + "px";
    star.style.height = size + "px";

    star.style.animationDuration = duration + "s";
    star.style.animationDelay = delay + "s";

    // tasaisempi kirkkaus (vähemmän “välkyntä”)
    star.style.opacity = 0.25 + rand() * 0.5;

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
  let isDragging = false;
  let startX = 0;
  let startY = 0;

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
        fov: card.dataset.fov !== undefined ? parseFloat(card.dataset.fov) : undefined
      }));
  }

  function showImageAt(index) {
    if (!currentImages.length) return;
    currentIndex = (index + currentImages.length) % currentImages.length;

    const img = currentImages[currentIndex];
    lightboxImg.src = img.file;

    if (lightboxText) {
      lightboxText.innerHTML = `<h2>${img.title}</h2><p>${img.desc}</p>`;
    }

    resetTransform();
    registerView(img.file);
    updateSkyButton(img);
  }

  function nextImage() {
    showImageAt(currentIndex + 1);
  }

  function prevImage() {
    showImageAt(currentIndex - 1);
  }

  function openLightbox(src, title = "", desc = "", ra, dec, fov) {
    lightbox.style.display = "flex";
    lightboxImg.src = src;

    if (lightboxText) {
      lightboxText.innerHTML = `<h2>${title}</h2><p>${desc}</p>`;
    }

    resetTransform();
    updateSkyButton({ ra, dec, fov });
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
            <span class="meta-pill">loading...</span>
            <span class="meta-pill view-pill">${initialViews} katselua</span>
          </div>
        `;

        card.appendChild(imageEl);
        card.appendChild(info);
        gallery.appendChild(card);

        card.addEventListener("click", () => {
          rebuildVisibleImages();
          currentIndex = currentImages.findIndex(i => i.file === img.file);

          registerView(img.file);
          openLightbox(img.file, img.title, img.desc, img.ra, img.dec, img.fov);
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

  if (lightboxPrev) {
    lightboxPrev.addEventListener("click", (e) => {
      e.stopPropagation();
      prevImage();
    });
  }

  if (lightboxNext) {
    lightboxNext.addEventListener("click", (e) => {
      e.stopPropagation();
      nextImage();
    });
  }

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

  document.addEventListener("mousedown", (e) => {
    if (lightbox.style.display !== "flex") return;

    isDragging = true;
    startX = e.clientX - posX;
    startY = e.clientY - posY;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    posX = e.clientX - startX;
    posY = e.clientY - startY;

    updateTransform();
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

});
