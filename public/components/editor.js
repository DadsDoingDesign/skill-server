import { api } from "../lib/api.js";
import { getState, setState } from "../lib/state.js";
import { go } from "../lib/router.js";
import { toast } from "../lib/toast.js";
import { loadSkills } from "../app.js";

export async function renderEditor(mount, skillName, opts = { creating: false }) {
  const creating = opts.creating === true;
  let skill = { name: "", description: "", body: "# New skill\n\nDescribe what this skill does and when an agent should use it.\n" };

  if (!creating && skillName) {
    try {
      skill = await api(`/api/skills/${encodeURIComponent(skillName)}`);
    } catch (e) {
      toast(`Load failed: ${e.message}`, "negative");
      go("home");
      return;
    }
  }

  mount.innerHTML = `
    <form data-form class="px-10 py-10 max-w-[60rem] mx-auto grid gap-4">
      <div class="flex gap-3 items-end">
        <label class="grid gap-1.5 text-xs text-ink-secondary w-64">
          Name
          <input data-field="name" required pattern="[a-z0-9][a-z0-9-_]{0,62}"
                 ${creating ? "" : "disabled"}
                 value="${escapeAttr(skill.name)}"
                 class="bg-surface-sunken border border-surface-edge rounded-edge px-3 py-2 text-sm font-mono outline-none focus:border-accent-link disabled:opacity-60" />
        </label>
        <label class="grid gap-1.5 text-xs text-ink-secondary flex-1">
          Description
          <input data-field="description" placeholder="One-line summary the agent sees first"
                 value="${escapeAttr(skill.description || "")}"
                 class="bg-surface-sunken border border-surface-edge rounded-edge px-3 py-2 text-sm outline-none focus:border-accent-link" />
        </label>
      </div>
      <label class="grid gap-1.5 text-xs text-ink-secondary">
        Body (markdown)
        <textarea data-field="body" rows="22"
                  class="bg-surface-sunken border border-surface-edge rounded-edge px-3 py-2 text-sm font-mono outline-none focus:border-accent-link resize-y">${escapeHtml(skill.body || "")}</textarea>
      </label>
      <div class="flex justify-end gap-2">
        <button type="button" data-action="cancel"
                class="bg-transparent border border-surface-edge rounded-edge px-3 py-1.5 text-sm">
          ${creating ? "Cancel" : "Back"}
        </button>
        ${!creating ? `
          <button type="button" data-action="delete"
                  class="bg-transparent border rounded-edge px-3 py-1.5 text-sm text-feedback-negative border-feedback-negative">
            Delete
          </button>
        ` : ""}
        <button type="submit"
                class="bg-accent-mark text-ink-inverse border border-accent-mark rounded-edge px-3 py-1.5 text-sm">
          Save
        </button>
      </div>
    </form>
  `;

  const form = mount.querySelector("[data-form]");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.querySelector('[data-field="name"]').value.trim();
    const description = form.querySelector('[data-field="description"]').value.trim();
    const body = form.querySelector('[data-field="body"]').value;
    try {
      if (creating) {
        await api("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, body }),
        });
        toast("Skill created");
      } else {
        await api(`/api/skills/${encodeURIComponent(name)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description, body }),
        });
        toast("Saved");
      }
      await loadSkills();
      go(`skill/${encodeURIComponent(name)}`);
    } catch (err) {
      toast(`Save failed: ${err.message}`, "negative");
    }
  });

  form.querySelector('[data-action="cancel"]').addEventListener("click", () => {
    if (creating) go("home");
    else go(`skill/${encodeURIComponent(skill.name)}`);
  });

  form.querySelector('[data-action="delete"]')?.addEventListener("click", async () => {
    if (!confirm(`Delete skill '${skill.name}'? This cannot be undone.`)) return;
    try {
      await api(`/api/skills/${encodeURIComponent(skill.name)}`, { method: "DELETE" });
      toast("Deleted");
      await loadSkills();
      go("home");
    } catch (err) {
      toast(`Delete failed: ${err.message}`, "negative");
    }
  });
}

function escapeAttr(s) { return String(s ?? "").replace(/"/g, "&quot;"); }
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
