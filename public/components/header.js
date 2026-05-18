import { getState, setState, subscribe } from "../lib/state.js";
import { go } from "../lib/router.js";
import { showTokenDialog } from "./token-dialog.js";

const mount = document.querySelector('[data-mount="header"]');

function html({ admin, search, theme }) {
  return `
    <div class="flex items-center justify-between gap-4 px-6 py-3 max-w-[120rem] mx-auto">
      <a href="#/" data-action="home"
         class="flex items-baseline gap-3 no-underline text-ink-primary">
        <h1 class="font-display text-xl m-0">Skill Server</h1>
        <span class="text-ink-muted text-xs">A reading library for agent skills</span>
      </a>

      <div class="flex items-center gap-2">
        <input data-action="search"
               type="search" placeholder="Search skills…"
               value="${escapeAttr(search)}"
               class="bg-surface-sunken border border-surface-edge rounded-edge px-3 py-1.5 text-sm w-56 outline-none focus:border-accent-link" />

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

        <button data-action="theme"
                title="Toggle theme"
                class="bg-transparent border border-surface-edge rounded-edge px-3 py-1.5 text-sm">
          ${theme === "dark" ? "Light" : "Dark"}
        </button>

        <button data-action="token"
                class="bg-transparent border border-surface-edge rounded-edge px-3 py-1.5 text-sm">
          ${admin ? "Sign out" : "Sign in"}
        </button>
      </div>
    </div>
  `;
}

function escapeAttr(s) { return String(s ?? "").replace(/"/g, "&quot;"); }

let searchTimer;

function bind() {
  mount.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "home") return; // anchor handles it
    if (action === "new") { e.preventDefault(); go("new"); }
    if (action === "token") { e.preventDefault(); showTokenDialog(); }
    if (action === "theme") { e.preventDefault(); toggleTheme(); }
  });
  mount.addEventListener("input", (e) => {
    const t = e.target.closest('[data-action="search"]');
    if (!t) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setState({ search: t.value.trim() }), 150);
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

function toggleTheme() {
  const { theme } = getState();
  const next = theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  setState({ theme: next });
}

export function mountHeader() {
  bind();
  render();
  subscribe(render);
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
