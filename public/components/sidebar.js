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
    <li>
      <a href="#/skill/${encodeURIComponent(s.name)}"
         class="block no-underline rounded-edge px-3 py-2 my-0.5 ${cls}">
        <span class="block font-medium text-ink-primary text-sm" data-name></span>
        <span class="block text-ink-muted text-xs truncate" data-desc></span>
      </a>
    </li>
  `;
}

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
