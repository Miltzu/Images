document.addEventListener("DOMContentLoaded", () => {
  const gallery = document.getElementById("gallery");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxText = document.getElementById("text");

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

  // =========================
  // OPEN LIGHTBOX
  // =========================
  function openLightbox(src, title = "", desc = "") {
    lightbox.style.display = "flex";
    lightboxImg.src = src;

    if (lightboxText) {
      lightboxText.innerHTML = `
        <h2>${title}</h2>
        <p>${desc}</p>
      `;
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
  // LOAD GALLERY
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

        // EXIF SAFE
        imageEl.onload = function () {
          if (typeof EXIF === "undefined") {
            info.querySelector(".meta-bar").innerHTML =
              `<span class="meta-pill">no exif</span>`;
            return;
          }

          EXIF.getData(imageEl, function () {
            const camera = EXIF.getTag(this, "Model") || "Unknown";
            const iso = EXIF.getTag(this, "ISOSpeedRatings") || "?";
            const shutter = EXIF.getTag(this, "ExposureTime") || "?";
            const date = EXIF.getTag(this, "DateTimeOriginal") || "?";

            const cleanDate = date !== "?" ? date.split(" ")[0] : "?";

            info.querySelector(".meta-bar").innerHTML = `
              <span class="meta-pill">${camera}</span>
              <span class="meta-pill">ISO ${iso}</span>
              <span class="meta-pill">${shutter}</span>
              <span class="meta-pill">${cleanDate}</span>
            `;
          });
        };

        card.addEventListener("click", () => {
          openLightbox(img.file, img.title, img.desc);
        });
      });
    })
    .catch(err => console.error("Gallery load failed:", err));

  // =========================
  // LIGHTBOX EVENTS
  // =========================
  window.closeLightbox = closeLightbox;

  // ZOOM
  document.addEventListener("wheel", (e) => {
    if (lightbox.style.display !== "flex") return;

    e.preventDefault();

    scale += e.deltaY * -0.001;
    scale = Math.min(Math.max(1, scale), 4);

    updateTransform();
  }, { passive: false });

  // DRAG START
  document.addEventListener("mousedown", (e) => {
    if (lightbox.style.display !== "flex") return;

    isDragging = true;
    startX = e.clientX - posX;
    startY = e.clientY - posY;
  });

  // DRAG MOVE
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
