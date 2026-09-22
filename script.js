document.addEventListener("DOMContentLoaded", () => {
  const gallery = document.getElementById("gallery");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxText = document.getElementById("text");
  const starfield = document.getElementById("starfield");

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

  function openLightbox(src, title = "", desc = "") {
    lightbox.style.display = "flex";
    lightboxImg.src = src;

    if (lightboxText) {
      lightboxText.innerHTML = `<h2>${title}</h2><p>${desc}</p>`;
    }

    resetTransform();
  }

  function closeLightbox() {
    lightbox.style.display = "none";
    lightboxImg.src = "";
    resetTransform();
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

  // =========================
  // GALLERY
  // =========================
  fetch("images.json")
    .then(res => res.json())
    .then(images => {
      images.forEach(img => {
        const card = document.createElement("div");
        card.className = "card";

        const imageEl = document.createElement("img");
        imageEl.src = img.file;
        imageEl.loading = "lazy";

        const info = document.createElement("div");
        info.className = "info";

        info.innerHTML = `
          <h3>${img.title || ""}</h3>
          <p>${img.desc || ""}</p>
          <div class="meta-bar">
            <span class="meta-pill">loading...</span>
          </div>
        `;

        card.appendChild(imageEl);
        card.appendChild(info);
        gallery.appendChild(card);

        card.addEventListener("click", () => {
          openLightbox(img.file, img.title, img.desc);
        });
      });
    });

  // =========================
  // LIGHTBOX EVENTS
  // =========================
  window.closeLightbox = closeLightbox;

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

  // =========================
// ⭐ STARFIELD (FIXED)
// =========================
if (starfield) {
  const STAR_COUNT = 250;

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement("div");
    star.className = "star";

    const x = Math.random() * 100;
    const y = Math.random() * 100;

    // enemmän pieniä tähtiä, vähemmän isoja
    const size = Math.random() < 0.85 ? 1 : (1.5 + Math.random());

    // HITAAMPI twinkle
    const duration = 6 + Math.random() * 14; // 6–20s (selvästi rauhallisempi)

    // pidempi, hajautettu delay
    const delay = Math.random() * 20;

    star.style.left = x + "vw";
    star.style.top = y + "vh";

    star.style.width = size + "px";
    star.style.height = size + "px";

    star.style.animationDuration = duration + "s";
    star.style.animationDelay = delay + "s";

    // tasaisempi kirkkaus (vähemmän “välkyntä”)
    star.style.opacity = 0.25 + Math.random() * 0.5;

    starfield.appendChild(star);
  }
}
  });
