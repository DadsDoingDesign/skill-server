import { getState } from "../lib/state.js";

export function renderHome(mount) {
  const { skills, admin, authRequired } = getState();
  mount.innerHTML = `
    <div class="px-10 py-16 max-w-measure mx-auto">
      <h2 class="font-display text-3xl m-0 mb-3">A reading library for agent skills.</h2>
      <p class="text-ink-secondary text-base m-0 mb-6">
        Pick a skill from the left to read it. Skills follow the SKILL.md format:
        YAML frontmatter (name, description) plus a markdown body.
      </p>

      <div class="border-t border-surface-edge pt-6 mt-6">
        <h3 class="font-display text-xl m-0 mb-2">For agents</h3>
        <p class="text-ink-secondary m-0 mb-2">
          Point any MCP-compatible client at the endpoint below.
        </p>
        <code class="block bg-surface-sunken border border-surface-edge rounded-edge p-3 font-mono text-sm break-all">${location.origin}/mcp</code>
      </div>

      ${!skills.length ? `
        <div class="border-t border-surface-edge pt-6 mt-6 text-ink-muted text-sm">
          ${admin
            ? `No skills yet. Click <strong class="text-ink-primary">New</strong> or <strong class="text-ink-primary">Import</strong> in the header.`
            : authRequired
              ? `No skills published yet. The admin can sign in to add some.`
              : `No skills published yet.`}
        </div>
      ` : ""}
    </div>
  `;
}
