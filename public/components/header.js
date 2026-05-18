import { getState, setState, subscribe } from "../lib/state.js";
import { go } from "../lib/router.js";
import { showTokenDialog } from "./token-dialog.js";

const mount = document.querySelector('[data-mount="header"]');

function html({ admin, search, theme }) {
  return `
    <div class="flex items-center justify-between gap-4 px-6 py-3 max-w-[120rem] mx-auto">
      <a href="#/" data-action="home"
         class="flex items-baseline gap-3 no-underline text-ink-primary">
        <h1 class="font-display text-xl m-0">Skills Server</h1>
        <span class="text-ink-muted text-xs">These skills are abstracted to work with most workflows — it's encouraged you add specific context relating to your workflow directly into the skill files.</span>
      </a>

      <div class="flex items-center gap-2">
        ${admin ? `
          <button data-action="new"
                  class="bg-accent-mark text-ink-inverse border border-accent-mark rounded-edge px-3 py-1.5 text-sm">
            New
          </button>
          <label class="cursor-pointer bg-surface-sunken border border-surface-edge rounded-edge px-3 py-1.5 text-sm">
            Import
            <input data-action="import" type="file" accept=".zip,.md,.skill" hidden />
          </label>
        ` : ""}

        <div class="theme-toggle" role="group" aria-label="Theme">
          <button data-action="theme" data-value="light"
                  class="theme-toggle__opt ${theme === 'light' ? 'theme-toggle__opt--on' : ''}">
            Light
          </button>
          <button data-action="theme" data-value="dark"
                  class="theme-toggle__opt ${theme === 'dark' ? 'theme-toggle__opt--on' : ''}">
            Dark
          </button>
        </div>

        <button data-action="token" hidden></button>
      </div>
    </div>
  `;
}

function escapeAttr(s) { return String(s ?? "").replace(/"/g, "&quot;"); }

function bind() {
  mount.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "home") return; // anchor handles it
    if (action === "new") { e.preventDefault(); go("new"); }
    if (action === "token") { e.preventDefault(); showTokenDialog(); }
    if (action === "theme") { e.preventDefault(); toggleTheme(e.target.closest("[data-value]")?.dataset.value); }
  });
mount.addEventListener("change", async (e) => {
    const t = e.target.closest('[data-action="import"]');
    if (!t || !t.files?.[0]) return;
    const file = t.files[0];
    t.value = "";
    const { doImport } = await import("./drag-overlay.js");
    doImport(file);
  });
}

function toggleTheme(value) {
  const { theme } = getState();
  const next = value || (theme === "dark" ? "light" : "dark");
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  setState({ theme: next });
}

export function mountHeader() {
  bind();
  render();
  subscribe(render);
  document.addEventListener("keydown", (e) => {
    if (e.key === "`" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      e.preventDefault();
      showTokenDialog();
    }
  });
}

function render() {
  const s = getState();
  // Preserve focus + caret on the search input across re-renders
  const active = document.activeElement;
  const wasSearch = active?.dataset?.action === "search";
  const caret = wasSearch ? active.selectionStart : null;

  mount.innerHTML = html(s);

  if (wasSearch) {
    const next = mount.querySelector('[data-action="search"]');
    next?.focus();
    if (caret != null) next?.setSelectionRange(caret, caret);
  }
}
