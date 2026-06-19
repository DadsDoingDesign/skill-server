import { getState, setState, subscribe } from "../lib/state.js";
import { parseHash } from "../lib/router.js";

const mount = document.querySelector('[data-mount="sidebar"]');

function html(skills, currentName, search) {
  const items = skills.length
    ? skills.map(s => itemHtml(s, s.name === currentName)).join("")
    : `<li class="px-4 py-6 text-center text-ink-muted text-sm">No skills yet.</li>`;

  return `
    <div class="p-2 border-b border-surface-edge">
      <a href="/api/skills/export-all" download="skills.zip" class="download-all-btn">
        Download all
      </a>
    </div>
    <div class="p-2">
      <input data-action="search"
             type="search" placeholder="Search skills…"
             value="${escapeAttr(search)}"
             class="bg-surface-sunken border border-surface-edge rounded-edge px-3 py-1.5 text-sm w-full outline-none focus:border-accent-link" />
    </div>
    <nav>
      <ul class="list-none m-0 p-2" data-list>
        ${items}
      </ul>
    </nav>
    <div class="mt-auto border-t border-surface-edge p-4 bg-surface-sunken">
      <h3 class="m-0 mb-1.5 text-[11px] uppercase tracking-wider text-ink-muted">MCP endpoint</h3>
      <code data-mcp-url
            class="block bg-surface-page border border-surface-edge rounded-edge p-2 font-mono text-xs break-all mb-2 text-ink-secondary"></code>
      <p class="m-0 mb-4 text-xs text-ink-muted">Point any MCP-compatible agent (Claude Code, Cursor, custom) at this URL to access all skills.</p>
      <div class="sidebar-socials">
        <a href="https://www.linkedin.com/in/denisdukhvalov/" target="_blank" rel="noopener" title="LinkedIn" class="sidebar-social-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </a>
        <a href="https://www.denisdukhvalov.com" target="_blank" rel="noopener" title="Portfolio" class="sidebar-social-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </a>
      </div>
    </div>
  `;
}

function itemHtml(s, active) {
  const cls = active
    ? "bg-surface-sunken border border-surface-edge"
    : "hover:bg-surface-sunken border border-transparent";
  return `
    <li class="skill-item${active ? " skill-item--active" : ""}">
      <a href="#/skill/${encodeURIComponent(s.name)}"
         class="block no-underline rounded-edge px-3 py-2 my-0.5 pr-24 ${cls}">
        <span class="block font-medium text-ink-primary text-sm" data-name></span>
        <span class="block text-ink-muted text-xs truncate" data-desc></span>
      </a>
      <div class="skill-actions">
        <a href="/embed/?skill=${encodeURIComponent(s.name)}"
           target="_blank" rel="noopener"
           title="Embed ${escapeAttr(s.name)}"
           class="skill-copy"
           onclick="event.stopPropagation()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
        </a>
        <button class="skill-copy" title="Copy skill contents" data-skill="${escapeAttr(s.name)}" onclick="event.stopPropagation(); event.preventDefault(); copySkill(this)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-copy">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-check">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
        <a href="/api/skills/${encodeURIComponent(s.name)}/export"
           download="${escapeAttr(s.name)}.zip"
           title="Download ${escapeAttr(s.name)}"
           class="skill-download"
           onclick="event.stopPropagation()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 13 7 8"/>
            <line x1="12" y1="3" x2="12" y2="13"/>
          </svg>
        </a>
      </div>
    </li>
  `;
}

function escapeAttr(s) { return String(s ?? "").replace(/"/g, "&quot;"); }

async function copySkill(btn) {
  const name = btn.dataset.skill;
  try {
    const res = await fetch(`/api/skills/${encodeURIComponent(name)}`);
    const skill = await res.json();
    await navigator.clipboard.writeText(skill.raw || skill.body || "");
    btn.dataset.copied = "1";
    setTimeout(() => delete btn.dataset.copied, 1500);
  } catch {}
}
window.copySkill = copySkill;

let searchTimer;

export function mountSidebar() {
  render();
  subscribe(render);
  window.addEventListener("hashchange", render);
  mount.addEventListener("input", (e) => {
    const t = e.target.closest('[data-action="search"]');
    if (!t) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setState({ search: t.value.trim() }), 150);
  });
}

function render() {
  const { skills, search } = getState();
  const route = parseHash();
  const currentName = route.skill || null;

  const active = document.activeElement;
  const wasSearch = active?.dataset?.action === "search";
  const caret = wasSearch ? active.selectionStart : null;

  mount.classList.add("flex", "flex-col");
  mount.innerHTML = html(skills, currentName, search);

  if (wasSearch) {
    const next = mount.querySelector('[data-action="search"]');
    next?.focus();
    if (caret != null) next?.setSelectionRange(caret, caret);
  }

  const items = mount.querySelectorAll("[data-list] > li");
  items.forEach((li, i) => {
    const s = skills[i];
    if (!s) return;
    li.querySelector("[data-name]").textContent = s.name;
    li.querySelector("[data-desc]").textContent = s.description || "";
  });

  const code = mount.querySelector("[data-mcp-url]");
  if (code) code.textContent = `${location.origin}/mcp`;
}
