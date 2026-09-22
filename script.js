document.addEventListener("DOMContentLoaded", () => {

  const gallery = document.getElementById("gallery");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxText = document.getElementById("text");

  let scale = 1;
  let posX = 0;
  let posY = 0;
  let isDragging = false;
  let startX, startY;

  // ----------------------------
  // GALLERY LOAD
  // ----------------------------
  fetch("images.json")
    .then(res => res.json())
    .then(images => {

      images.forEach(img => {

        const card = document.createElement("div");
        card.className = "card";

        const imageEl = document.createElement("img");
        imageEl.src = img.file;

        const info = document.createElement("div");
        info.className = "info";

        info.innerHTML = `
          <h3>${img.title}</h3>
          <p>${img.desc}</p>
          <div class="meta-bar">
            <span class="meta-pill">loading...</span>
          </div>
        `;

        card.appendChild(imageEl);
        card.appendChild(info);
        gallery.appendChild(card);

        // ----------------------------
        // EXIF (SAFE CHECK)
        // ----------------------------
        imageEl.onload = function () {

          if (typeof EXIF === "undefined") {
            info.querySelector(".meta-bar").innerHTML =
              `<span class="meta-pill">no exif lib</span>`;
            return;
          }

          EXIF.getData(imageEl, function () {

            const camera = EXIF.getTag(this, "Model") || "Unknown";
            const iso = EXIF.getTag(this, "ISOSpeedRatings") || "?";
            const shutter = EXIF.getTag(this, "ExposureTime") || "?";
            const date = EXIF.getTag(this, "DateTimeOriginal") || "?";

            const dateClean = date !== "?" ? date.split(" ")[0] : "?";

            info.querySelector(".meta-bar").innerHTML = `
              <span class="meta-pill">${camera}</span>
              <span class="meta-pill">ISO ${iso}</span>
              <span class="meta-pill">${shutter}</span>
              <span class="meta-pill">${dateClean}</span>
            `;
          });
        };

        // LIGHTBOX OPEN
        card.addEventListener("click", () => {
          openLightbox(img.file, img.title, img.desc);
        });

      });
    })
    .catch(err => {
      console.error("Gallery load failed:", err);
    });

  // ----------------------------
  // LIGHTBOX
  // ----------------------------
  window.openLightbox = function (src, title, desc) {

    if (!lightbox || !lightboxImg) return;

    lightbox.style.display = "flex";
    lightboxImg.src = src;

    if (lightboxText) {
      lightboxText.innerHTML = `<h2>${title}</h2><p>${desc}</p>`;
    }

    scale = 1;
    posX = 0;
    posY = 0;

    lightboxImg.style.transform = `translate(0px,0px) scale(1)`;
  };

  window.closeLightbox = function () {
    if (lightbox) lightbox.style.display = "none";
  };

  // ----------------------------
  // ZOOM (SAFE)
  // ----------------------------
  document.addEventListener("wheel", (e) => {

    if (!lightbox || lightbox.style.display !== "flex") return;
    if (!lightboxImg) return;

    e.preventDefault();

    scale += e.deltaY * -0.001;
    scale = Math.min(Math.max(1, scale), 4);

    updateTransform();
  }, { passive: false });

  // ----------------------------
  // PAN
  // ----------------------------
  document.addEventListener("mousedown", (e) => {

    if (!lightbox || lightbox.style.display !== "flex") return;

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

  function updateTransform() {
    if (!lightboxImg) return;
    lightboxImg.style.transform =
      `translate(${posX}px, ${posY}px) scale(${scale})`;
  }

});



const gallery = document.getElementById("gallery");
const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");

let images = JSON.parse(localStorage.getItem("images") || "[]");

function renderImage(img) {
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <img src="${img.src}">
    <div class="info">
      <h3>${img.name}</h3>
      <p>${img.desc}</p>
    </div>
  `;

  card.onclick = () => openLightbox(img.src, img.name, img.desc);
  gallery.appendChild(card);
}

function renderAll() {
  gallery.innerHTML = "";
  images.forEach(renderImage);
}

function addFiles(files) {
  for (let file of files) {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = {
        src: e.target.result,
        name: file.name.split(".")[0],
        desc: "Uploaded image"
      };

      images.push(img);
      localStorage.setItem("images", JSON.stringify(images));
      renderImage(img);
    };

    reader.readAsDataURL(file);
  }
}

/* CLICK upload */
fileInput.addEventListener("change", (e) => {
  addFiles(e.target.files);
});

/* DROP upload */
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  addFiles(e.dataTransfer.files);
});

/* click opens file picker */
dropzone.addEventListener("click", () => {
  fileInput.click();
});

/* initial load */
renderAll();
