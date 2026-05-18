import { getToken, setToken } from "../lib/api.js";
import { refreshAuth } from "../app.js";
import { toast } from "../lib/toast.js";
import { getState } from "../lib/state.js";

const mount = document.querySelector('[data-mount="dialog"]');

export function showTokenDialog() {
  const { admin } = getState();
  mount.innerHTML = `
    <div class="dialog-backdrop" data-action="close">
      <div class="dialog-panel" data-stop>
        <h2 class="font-display text-xl m-0 mb-2">${admin ? "Sign out" : "Sign in as admin"}</h2>
        <p class="text-ink-secondary text-sm m-0 mb-4">
          ${admin
            ? "You're currently signed in. Sign out to return to the read-only view."
            : "Enter the admin token to enable editing. The token is stored locally in this browser."}
        </p>
        ${!admin ? `
          <input data-field="token" type="password" placeholder="Admin token"
                 value="${escapeAttr(getToken())}"
                 class="w-full bg-surface-sunken border border-surface-edge rounded-edge px-3 py-2 text-sm font-mono outline-none focus:border-accent-link mb-4" />
        ` : ""}
        <div class="flex justify-end gap-2">
          <button data-action="cancel"
                  class="bg-transparent border border-surface-edge rounded-edge px-3 py-1.5 text-sm">
            Cancel
          </button>
          ${admin
            ? `<button data-action="signout"
                       class="bg-transparent border rounded-edge px-3 py-1.5 text-sm text-feedback-negative border-feedback-negative">
                 Sign out
               </button>`
            : `<button data-action="save"
                       class="bg-accent-mark text-ink-inverse border border-accent-mark rounded-edge px-3 py-1.5 text-sm">
                 Sign in
               </button>`}
        </div>
      </div>
    </div>
  `;

  mount.addEventListener("click", handle, { once: true });
  setTimeout(() => mount.querySelector('[data-field="token"]')?.focus(), 0);
}

async function handle(e) {
  const action = e.target.closest("[data-action]")?.dataset.action;
  const stop = e.target.closest("[data-stop]");
  if (stop && !action) { mount.addEventListener("click", handle, { once: true }); return; }

  if (action === "close" || action === "cancel") return close();

  if (action === "save") {
    const t = mount.querySelector('[data-field="token"]').value;
    setToken(t);
    close();
    const ok = await refreshAuth();
    toast(ok ? "Signed in" : "Token rejected", ok ? "positive" : "negative");
    return;
  }

  if (action === "signout") {
    setToken("");
    close();
    await refreshAuth();
    toast("Signed out");
    return;
  }
}

function close() { mount.innerHTML = ""; }
function escapeAttr(s) { return String(s ?? "").replace(/"/g, "&quot;"); }
