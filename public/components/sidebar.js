import { getState, subscribe } from "../lib/state.js";
import { parseHash } from "../lib/router.js";

const mount = document.querySelector('[data-mount="sidebar"]');

function html(skills, currentName) {
  const items = skills.length
    ? skills.map(s => itemHtml(s, s.name === currentName)).join("")
    : `<li class="px-4 py-6 text-center text-ink-muted text-sm">No skills yet.</li>`;

  return `
    <div class="p-2 border-b border-surface-edge">
      <a href="/api/skills/export-all" download="skills.zip"
         class="block text-center no-underline rounded-edge px-3 py-1.5 text-sm border border-surface-edge bg-surface-sunken hover:border-accent-link text-ink-secondary">
        Download all
      </a>
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
      <p class="m-0 text-xs text-ink-muted">Connect any agent over MCP Streamable HTTP.</p>
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
         class="block no-underline rounded-edge px-3 py-2 my-0.5 pr-8 ${cls}">
        <span class="block font-medium text-ink-primary text-sm" data-name></span>
        <span class="block text-ink-muted text-xs truncate" data-desc></span>
      </a>
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
    </li>
  `;
}

function escapeAttr(s) { return String(s ?? "").replace(/"/g, "&quot;"); }

export function mountSidebar() {
  render();
  subscribe(render);
  window.addEventListener("hashchange", render);
}

function render() {
  const { skills } = getState();
  const route = parseHash();
  const currentName = route.skill || null;

  mount.classList.add("flex", "flex-col");
  mount.innerHTML = html(skills, currentName);

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
