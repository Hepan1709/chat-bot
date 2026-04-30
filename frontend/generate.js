// ============================================================
//  generate.js — AI Image Generator
//  Calls your own backend at /generate-image
//  Backend talks to Cloudflare AI (FLUX model)
// ============================================================

// ── Grab elements from the page ───────────────────────────
const promptEl = document.getElementById("prompt");
const countEl = document.getElementById("count");
const countLabel = document.getElementById("count-label");
const genBtn = document.getElementById("generate-btn");
const clearBtn = document.getElementById("clear-btn");
const regenBtn = document.getElementById("regen-btn");
const results = document.getElementById("results");
const imageGrid = document.getElementById("image-grid");
const errorBox = document.getElementById("error-box");

// ── Track selected style + last prompt ───────────────────
let selectedStyle = "photorealistic";
let lastPrompt = "";

// ── Style chips — click to select ────────────────────────
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document
      .querySelectorAll(".chip")
      .forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    selectedStyle = chip.dataset.value;
  });
});

// ── Slider — update the number label ─────────────────────
countEl.addEventListener("input", () => {
  countLabel.textContent = countEl.value;
});

// ── Build a better prompt ─────────────────────────────────
// Adds style words so the AI knows what look you want
function buildPrompt(text, style) {
  const styleWords = {
    photorealistic: "photorealistic, DSLR photo, natural lighting, sharp",
    "digital art": "digital art, vibrant colors, concept art",
    anime: "anime style, Studio Ghibli, clean lines",
    "oil painting": "oil painting, brushstrokes, classic art",
    "3D render": "3D render, Octane render, ray tracing",
    sketch: "pencil sketch, line art, detailed drawing",
  };
  return `${text}, ${styleWords[style]}, high quality`;
}

// ── Show / hide helpers ───────────────────────────────────
function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

// ── Show skeleton cards while loading ────────────────────
function showSkeletons(count) {
  imageGrid.innerHTML = "";
  show(results);
  for (let i = 0; i < count; i++) {
    imageGrid.innerHTML += `
      <div class="img-card">
        <div class="skeleton"></div>
      </div>`;
  }
}

// showImage — tries to detect correct format
function showImage(index, base64) {
  const cards = imageGrid.querySelectorAll(".img-card");
  const card = cards[index];
  if (!card) return;

  // Try png first, if broken try jpeg
  const srcPng = `data:image/png;base64,${base64}`;
  const srcJpg = `data:image/jpeg;base64,${base64}`;

  const img = new Image();
  img.onload = () => {
    card.innerHTML = `
      <img src="${img.src}" alt="Generated image ${index + 1}">
      <div class="img-card-footer">
        <span>variation ${index + 1}</span>
        <a class="btn-save" href="${img.src}" download="ai-image-${index + 1}.png">↓ Save</a>
      </div>`;
  };
  img.onerror = () => {
    // png failed — try jpeg
    img.src = srcJpg;
  };
  img.src = srcPng;
}
// ── Main generate function ────────────────────────────────
async function generate() {
  const userText = promptEl.value.trim();

  // Simple validation
  if (!userText) {
    errorBox.textContent = "Please enter a prompt first. ❗";
    show(errorBox);
    return;
  }
  if (userText.length < 5) {
    errorBox.textContent = "Prompt is too short. Add more detail. ❗";
    show(errorBox);
    return;
  }

  hide(errorBox);
  lastPrompt = userText;
  const count = parseInt(countEl.value);
  const prompt = buildPrompt(userText, selectedStyle);

  // Disable button + show skeletons
  genBtn.disabled = true;
  genBtn.textContent = "Generating...";
  showSkeletons(count);

  // Generate each variation one by one
  for (let i = 0; i < count; i++) {
    try {
      // Small change in prompt so each variation looks different
      const variantPrompt = i === 0 ? prompt : `${prompt}, variation ${i + 1}`;

      // Call YOUR backend — not Cloudflare directly
      const res = await fetch("http://localhost:3000/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: variantPrompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      // Show the image in the correct card
      showImage(i, data.image);
    } catch (err) {
      // Show error inside that specific card
      const cards = imageGrid.querySelectorAll(".img-card");
      if (cards[i]) {
        cards[i].innerHTML = `
          <div style="padding:16px;text-align:center;color:#dc2626;font-size:13px;">
            Failed ⚠️<br><small>${err.message}</small>
          </div>`;
      }
    }
  }

  // Re-enable button
  genBtn.disabled = false;
  genBtn.textContent = "Generate";
}

// ── Regenerate — same prompt again ───────────────────────
function regenerate() {
  if (!lastPrompt) return;
  promptEl.value = lastPrompt;
  generate();
}

// ── Clear everything ──────────────────────────────────────
function clearAll() {
  promptEl.value = "";
  lastPrompt = "";
  hide(results);
  hide(errorBox);
  promptEl.focus();
}

// ── Listen for button clicks ──────────────────────────────
genBtn.addEventListener("click", generate);
regenBtn.addEventListener("click", regenerate);
clearBtn.addEventListener("click", clearAll);
