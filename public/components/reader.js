import { api } from "../lib/api.js";
import { getState } from "../lib/state.js";
import { render as renderMd } from "../lib/markdown.js";
import { go } from "../lib/router.js";
import { toast } from "../lib/toast.js";

export async function renderReader(mount, skillName) {
  mount.innerHTML = `<div class="px-10 py-12 text-ink-muted">Loading…</div>`;
  let skill;
  try {
    skill = await api(`/api/skills/${encodeURIComponent(skillName)}`);
  } catch (e) {
    mount.innerHTML = `
      <div class="px-10 py-12">
        <h2 class="font-display text-2xl m-0 mb-2">Not found</h2>
        <p class="text-ink-secondary">No skill named "${escapeHtml(skillName)}".</p>
        <a href="#/" class="text-accent-link">← Back to library</a>
      </div>
    `;
    return;
  }

  const { admin } = getState();
  const bodyHtml = renderMd(skill.body || "");

  mount.innerHTML = `
    <article class="px-10 py-10 max-w-measure mx-auto">
      <header class="mb-8 pb-6 border-b border-surface-edge">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="font-display text-3xl m-0 leading-tight">${escapeHtml(skill.name)}</h1>
            ${skill.description
              ? `<p class="text-ink-secondary text-base mt-2 mb-0">${escapeHtml(skill.description)}</p>`
              : ""}
          </div>
          ${admin ? `
            <div class="flex gap-2 shrink-0">
              <a href="#/skill/${encodeURIComponent(skill.name)}/edit"
                 class="bg-surface-sunken border border-surface-edge rounded-edge px-3 py-1.5 text-sm no-underline text-ink-primary">
                Edit
              </a>
              <button data-action="export"
                      class="bg-transparent border border-surface-edge rounded-edge px-3 py-1.5 text-sm">
                Export
              </button>
            </div>
          ` : ""}
        </div>
      </header>

      <div class="prose-paper">
        ${bodyHtml}
      </div>
    </article>
  `;

  if (admin) {
    mount.querySelector('[data-action="export"]')?.addEventListener("click", () => {
      window.open(`/api/skills/${encodeURIComponent(skill.name)}/export`, "_blank");
    });
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
