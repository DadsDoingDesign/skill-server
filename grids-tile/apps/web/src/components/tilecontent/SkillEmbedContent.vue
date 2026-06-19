<template>
  <div class="se">
    <!-- Config form: when editable and unconfigured, or explicitly editing -->
    <form
      v-if="canEdit && (editing || !isConfigured)"
      class="se-form"
      @submit.prevent="saveConfig"
    >
      <label class="se-field">
        <span>Server URL</span>
        <input v-model="draft.serverUrl" type="text" placeholder="https://skills.example.com" />
      </label>
      <label class="se-field">
        <span>Skill name</span>
        <input v-model="draft.skillName" type="text" placeholder="copywriting-eos" />
      </label>
      <label class="se-field">
        <span>Layout</span>
        <select v-model="draft.variant">
          <option value="auto">Auto (responsive)</option>
          <option value="card">Card</option>
          <option value="compact">Compact</option>
          <option value="row">Row</option>
        </select>
      </label>
      <div class="se-form__actions">
        <button type="submit" class="se-btn se-btn--accent">Save</button>
        <button v-if="isConfigured" type="button" class="se-btn" @click="editing = false">Cancel</button>
      </div>
    </form>

    <!-- Not configured, not editable -->
    <div v-else-if="!isConfigured" class="se-msg">Skill not configured.</div>

    <!-- Error / not found -->
    <div v-else-if="state === 'notfound'" class="se-msg se-msg--err">Skill “{{ content.skillName }}” not found.</div>
    <div v-else-if="state === 'error'" class="se-msg se-msg--err">Couldn’t reach the skill server.</div>

    <!-- Loading with nothing cached yet -->
    <div v-else-if="state === 'loading' && !name" class="se-skel">
      <i class="w1"></i><i class="w2"></i><i class="w3"></i><i class="bar"></i>
    </div>

    <!-- Card -->
    <div v-else-if="layout === 'card'" class="se-card">
      <svg class="se-bg" viewBox="0 0 120 140" fill="none" aria-hidden="true">
        <path class="se-bg-stroke" d="M30 12 H76 L98 34 V122 a6 6 0 0 1 -6 6 H30 a6 6 0 0 1 -6 -6 V18 a6 6 0 0 1 6 -6 Z" />
        <path class="se-bg-accent" d="M76 12 V34 H98" />
        <path class="se-bg-stroke" d="M42 64 H80 M42 80 H80 M42 96 H68" />
      </svg>
      <div class="se-card__head">
        <span class="se-name se-clamp1">{{ name }}</span>
        <span v-if="category" class="se-badge">{{ category }}</span>
        <button v-if="canEdit" class="se-edit" title="Configure" @click="openEditor">✎</button>
      </div>
      <div class="se-desc se-clamp3" :style="{ WebkitLineClamp: descLines }">{{ description }}</div>
      <div class="se-actions">
        <button class="se-btn" @click="onCopy"><span v-html="ic.copy"></span>Copy</button>
        <button class="se-btn" @click="onOpen"><span v-html="ic.open"></span>Open</button>
        <button class="se-btn se-btn--accent" @click="onMcp"><span v-html="ic.mcp"></span>MCP</button>
      </div>
    </div>

    <!-- Compact (column) -->
    <div v-else-if="layout === 'compact'" class="se-compact">
      <div class="se-compact__txt">
        <div class="se-name se-clamp1">{{ name }}</div>
        <div class="se-desc se-clamp2">{{ description }}</div>
      </div>
      <div class="se-actions se-actions--icons">
        <button class="se-icon" title="Copy skill text" @click="onCopy"><span v-html="ic.copy"></span></button>
        <button class="se-icon" title="Open skill" @click="onOpen"><span v-html="ic.open"></span></button>
        <button class="se-icon se-icon--accent" title="Copy MCP command" @click="onMcp"><span v-html="ic.mcp"></span></button>
        <button v-if="canEdit" class="se-icon" title="Configure" @click="openEditor">✎</button>
      </div>
    </div>

    <!-- Row (compact horizontal) -->
    <div v-else class="se-row">
      <div class="se-row__txt">
        <div class="se-name se-clamp1">{{ name }}</div>
        <div class="se-desc se-clamp2">{{ description }}</div>
      </div>
      <div class="se-actions se-actions--icons">
        <button class="se-icon" title="Copy skill text" @click="onCopy"><span v-html="ic.copy"></span></button>
        <button class="se-icon" title="Open skill" @click="onOpen"><span v-html="ic.open"></span></button>
        <button class="se-icon se-icon--accent" title="Copy MCP command" @click="onMcp"><span v-html="ic.mcp"></span></button>
      </div>
    </div>

    <transition name="se-fade">
      <div v-if="toastMsg" class="se-toast">{{ toastMsg }}</div>
    </transition>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, ref, computed, onMounted, watch, type ComputedRef } from "vue";
import type { SkillEmbedContent } from "@grids/contracts/types";
import { useGridStore } from "@/stores/grid";
import { cacheSkillRaw } from "@/registries/tiles/skillEmbed";

type LoadState = "idle" | "loading" | "ready" | "notfound" | "error" | "unconfigured";

const trimUrl = (u: string) => (u || "").trim().replace(/\/+$/, "");

const ic = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  mcp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
};

export default defineComponent({
  name: "SkillEmbedContent",
  props: {
    content: { type: Object as () => SkillEmbedContent, required: true },
  },
  setup(props) {
    const gridStore = useGridStore();
    const tileId = inject<string>("tileId", "");

    const fetched = ref<{ name: string; description: string; category: string } | null>(null);
    const raw = ref("");
    const state = ref<LoadState>("idle");
    const editing = ref(false);
    const toastMsg = ref("");

    const draft = ref({
      serverUrl: props.content.serverUrl || "",
      skillName: props.content.skillName || "",
      variant: props.content.variant || "auto",
    });

    const canEdit = computed(() => gridStore.canEdit);
    const isConfigured = computed(() => !!props.content.serverUrl && !!props.content.skillName);
    const base = computed(() => trimUrl(props.content.serverUrl));

    // Grid footprint in cells (provided by the tile shell) — drives the
    // responsive layout when variant is "auto".
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);

    const variantSetting = computed(() => props.content.variant || "auto");
    const layout = computed(() => {
      if (variantSetting.value !== "auto") return variantSetting.value;
      const w = gridTileW?.value ?? 2;
      const h = gridTileH?.value ?? 2;
      if (w <= 1 && h <= 1) return "compact"; // 1×1
      if (h <= 1) return "row";               // wide & short (e.g. 3×1)
      if (w <= 1) return "compact";           // narrow & tall (e.g. 1×2)
      return "card";                          // 2×2, 4×4, …
    });
    // Card description grows with tile height.
    const descLines = computed(() => {
      const h = gridTileH?.value ?? 2;
      return h <= 2 ? 3 : h <= 4 ? 6 : 10;
    });

    const name = computed(
      () => fetched.value?.name ?? props.content.cachedName ?? props.content.skillName ?? "",
    );
    const description = computed(
      () => fetched.value?.description ?? props.content.cachedDescription ?? "",
    );
    const category = computed(
      () => fetched.value?.category ?? props.content.cachedCategory ?? "",
    );

    const openUrl = computed(() =>
      base.value && props.content.skillName
        ? `${base.value}/#/skill/${encodeURIComponent(props.content.skillName)}`
        : "",
    );
    const mcpCmd = computed(() => `claude mcp add --transport http skills ${base.value}/mcp`);

    async function load() {
      if (!isConfigured.value) {
        state.value = "unconfigured";
        return;
      }
      state.value = "loading";
      try {
        const res = await fetch(
          `${base.value}/api/skills/${encodeURIComponent(props.content.skillName)}`,
          { headers: { Accept: "application/json" } },
        );
        if (res.status === 404) {
          state.value = "notfound";
          return;
        }
        if (!res.ok) {
          state.value = "error";
          return;
        }
        const s = await res.json();
        raw.value = s.raw || s.body || "";
        cacheSkillRaw(base.value, props.content.skillName, raw.value);

        const next = {
          name: s.name || props.content.skillName,
          description: s.description || s.metadata?.description || "",
          category: s.metadata?.category || "",
        };
        fetched.value = next;
        state.value = "ready";

        // Persist a small cache so the next render (and viewers) show content
        // instantly. Owners only — viewers can't mutate the grid.
        if (canEdit.value && tileId) {
          gridStore.patchTileContent(tileId, {
            cachedName: next.name,
            cachedDescription: next.description,
            cachedCategory: next.category,
            lastSyncedAt: Date.now(),
          });
        }
      } catch {
        state.value = "error";
      }
    }

    onMounted(load);
    watch(() => [props.content.serverUrl, props.content.skillName], load);

    function toast(m: string) {
      toastMsg.value = m;
      window.setTimeout(() => (toastMsg.value = ""), 1800);
    }

    async function copyText(text: string): Promise<boolean> {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        return true;
      } catch {
        return false;
      }
    }

    async function onCopy() {
      let text = raw.value;
      if (!text) {
        await load();
        text = raw.value;
      }
      toast((await copyText(text)) ? "Skill copied" : "Copy blocked");
    }
    function onOpen() {
      if (openUrl.value) window.open(openUrl.value, "_blank", "noopener");
    }
    async function onMcp() {
      toast((await copyText(mcpCmd.value)) ? "MCP command copied" : "Copy blocked");
    }

    function openEditor() {
      draft.value = {
        serverUrl: props.content.serverUrl || "",
        skillName: props.content.skillName || "",
        variant: props.content.variant || "auto",
      };
      editing.value = true;
    }
    function saveConfig() {
      if (!tileId) return;
      gridStore.patchTileContent(tileId, {
        serverUrl: trimUrl(draft.value.serverUrl),
        skillName: draft.value.skillName.trim(),
        variant: draft.value.variant,
      });
      editing.value = false;
      // `watch` on serverUrl/skillName re-runs load() when they change.
    }

    return {
      ic,
      canEdit,
      isConfigured,
      state,
      editing,
      draft,
      toastMsg,
      name,
      description,
      category,
      layout,
      descLines,
      onCopy,
      onOpen,
      onMcp,
      openEditor,
      saveConfig,
    };
  },
});
</script>

<style scoped>
/* Inherits the host grid's design tokens; the tile shell draws the outer
   surface/border and sets --tile-text-color. Fallbacks keep it usable
   outside grids too. */
.se {
  --se-ink: var(--tile-text-color, var(--color-text-primary, currentColor));
  --se-muted: color-mix(in srgb, var(--se-ink) 60%, transparent);
  --se-faint: color-mix(in srgb, var(--se-ink) 18%, transparent);
  --se-accent: var(--primary-color, #009688);
  --se-radius: var(--radius-sm, 8px);
  position: relative;
  height: 100%;
  font-family: var(--font-family-base, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--se-ink);
}

.se-name {
  font-family: var(--font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--se-ink);
}
.se-desc { font-size: 0.82rem; color: var(--se-muted); line-height: 1.45; }
.se-badge {
  display: inline-block;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--se-accent);
  border: 1px solid color-mix(in srgb, var(--se-accent) 55%, transparent);
  border-radius: var(--radius-full, 9999px);
  padding: 0.15em 0.55em;
}
.se-clamp1, .se-clamp2, .se-clamp3 { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
.se-clamp1 { -webkit-line-clamp: 1; }
.se-clamp2 { -webkit-line-clamp: 2; }
.se-clamp3 { -webkit-line-clamp: 3; }

/* Buttons */
.se-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45em;
  font: inherit;
  font-size: 0.76rem;
  line-height: 1;
  padding: 0.55em 0.72em;
  border-radius: var(--se-radius);
  cursor: pointer;
  border: 1px solid var(--se-faint);
  background: transparent;
  color: var(--se-muted);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.se-btn:hover { border-color: var(--se-accent); color: var(--se-accent); }
.se-btn--accent { border-color: var(--se-accent); color: var(--se-accent); }
.se-btn--accent:hover { background: var(--se-accent); color: #fff; }
.se-btn :deep(svg) { width: 14px; height: 14px; }

.se-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5em;
  border: 1px solid transparent;
  border-radius: var(--se-radius);
  background: transparent;
  color: var(--se-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.se-icon:hover { color: var(--se-accent); background: var(--color-editable-hover, rgba(0, 0, 0, 0.05)); }
.se-icon--accent { color: var(--se-accent); }
.se-icon :deep(svg) { width: 14px; height: 14px; }

.se-edit {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--se-muted);
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
  padding: 2px 4px;
}
.se-edit:hover { color: var(--se-accent); }

/* Layouts — the outer surface/border come from the tile shell */
.se-card { position: relative; overflow: hidden; height: 100%; padding: var(--spacing-md, 16px); display: flex; flex-direction: column; }
.se-card > *:not(.se-bg) { position: relative; z-index: 1; }

/* Decorative document graphic — themed to the grid (text color + accent fold) */
.se-bg {
  position: absolute;
  right: -6%;
  bottom: -12%;
  width: 62%;
  max-width: 170px;
  opacity: 0.18;
  pointer-events: none;
  z-index: 0;
}
.se-bg-stroke { stroke: var(--se-ink); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
.se-bg-accent { stroke: var(--se-accent); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
.se-card__head { display: flex; align-items: center; gap: var(--spacing-sm, 8px); }
.se-card .se-desc { margin-top: 7px; }
.se-card .se-actions { display: flex; gap: 6px; margin-top: auto; padding-top: var(--spacing-sm, 8px); }
.se-card .se-actions .se-btn { flex: 1; }

.se-compact {
  height: 100%;
  padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--spacing-sm, 8px);
  overflow: hidden;
}
.se-compact .se-name { font-size: 0.8rem; }
.se-compact .se-desc { font-size: 0.72rem; margin-top: 2px; }
.se-actions--icons { display: flex; gap: 2px; margin-left: -6px; }

.se-row {
  height: 100%;
  padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 16px);
  overflow: hidden;
}
.se-row__txt { min-width: 0; flex: 1; }
.se-row__txt .se-name { font-size: 0.82rem; }
.se-row__txt .se-desc { font-size: 0.74rem; margin-top: 2px; }
.se-row .se-actions--icons { margin-left: 0; flex: none; }

/* Config form */
.se-form {
  height: 100%;
  padding: var(--spacing-md, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
  overflow: auto;
}
.se-field { display: flex; flex-direction: column; gap: 3px; }
.se-field > span {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--se-muted);
  font-weight: 600;
}
.se-field input, .se-field select {
  font: inherit;
  font-size: 0.8rem;
  padding: 0.4em 0.5em;
  border: 1px solid var(--color-stroke, var(--se-faint));
  border-radius: var(--se-radius);
  background: var(--color-editable-hover, transparent);
  color: inherit;
  outline: none;
}
.se-field input:focus, .se-field select:focus { border-color: var(--se-accent); }
.se-form__actions { display: flex; gap: 6px; margin-top: auto; }

/* States */
.se-msg {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--spacing-md, 16px);
  color: var(--se-muted);
  font-size: 0.8rem;
}
.se-msg--err { color: var(--destructive-color, #e91e63); }
.se-skel {
  height: 100%;
  padding: var(--spacing-md, 16px);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.se-skel i { display: block; background: var(--se-faint); border-radius: 4px; height: 12px; animation: se-pulse 1.2s ease-in-out infinite; }
.se-skel i.w1 { width: 55%; height: 14px; }
.se-skel i.w2 { width: 90%; }
.se-skel i.w3 { width: 70%; }
.se-skel i.bar { margin-top: auto; height: 30px; }
@keyframes se-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* Toast */
.se-toast {
  position: absolute;
  left: var(--spacing-sm, 8px);
  right: var(--spacing-sm, 8px);
  bottom: var(--spacing-sm, 8px);
  padding: 0.45rem 0.7rem;
  background: var(--color-tile-background, var(--color-content-background, #fff));
  border: 1px solid var(--color-stroke, var(--se-faint));
  border-left: 3px solid var(--se-accent);
  border-radius: var(--se-radius);
  color: var(--se-ink);
  font-size: 0.74rem;
  text-align: center;
}
.se-fade-enter-active, .se-fade-leave-active { transition: opacity 0.18s; }
.se-fade-enter-from, .se-fade-leave-to { opacity: 0; }
</style>
