import { uploadImport } from "../lib/api.js";
import { getState } from "../lib/state.js";
import { toast } from "../lib/toast.js";
import { go } from "../lib/router.js";
import { loadSkills } from "../app.js";

const mount = document.querySelector('[data-mount="overlay"]');

mount.innerHTML = `
  <div class="drag-overlay" data-overlay>
    <div class="drag-overlay__inner">
      <p class="font-display text-2xl m-0 mb-1">Drop to import</p>
      <span class="text-sm opacity-80">.skill, .md, or .zip</span>
    </div>
  </div>
`;

const overlay = mount.querySelector("[data-overlay]");
let dragDepth = 0;

document.addEventListener("dragenter", (e) => {
  if (!getState().admin) return;
  e.preventDefault();
  if (++dragDepth === 1) overlay.classList.add("drag-overlay--active");
});
document.addEventListener("dragleave", () => {
  if (!getState().admin) return;
  if (--dragDepth <= 0) {
    dragDepth = 0;
    overlay.classList.remove("drag-overlay--active");
  }
});
document.addEventListener("dragover", (e) => {
  if (!getState().admin) return;
  e.preventDefault();
});
document.addEventListener("drop", async (e) => {
  if (!getState().admin) return;
  e.preventDefault();
  dragDepth = 0;
  overlay.classList.remove("drag-overlay--active");
  const file = e.dataTransfer.files?.[0];
  if (!file) return;
  doImport(file);
});

export async function doImport(file) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".md") && !name.endsWith(".zip") && !name.endsWith(".skill")) {
    toast(`Unsupported file type: ${file.name}`, "negative");
    return;
  }
  try {
    const saved = await uploadImport(file);
    toast(`Imported '${saved.name}'`);
    await loadSkills();
    go(`skill/${encodeURIComponent(saved.name)}`);
  } catch (err) {
    toast(`Import failed: ${err.message}`, "negative");
  }
}
