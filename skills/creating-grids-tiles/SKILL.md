---
name: creating-grids-tiles
description: How to build a new drag-and-drop tile for the Grids (Trustybits/grids) Vue app — the contract type, registry definition, Vue content component, capabilities/actions schema, and state rules. Use when adding or editing a tile, including embed/utility tiles like a Skill Embed widget.
---

# Creating a new tile in Grids

Grids (`Trustybits/grids`) is a Vue 3 + Vite "link-in-bio / digital garden / portfolio /
microsite" builder made of drag-and-drop **tiles**. A tile is four coordinated pieces:

1. a **content type** + data interface in `packages/contracts`,
2. a **TileDefinition** in `apps/web/src/registries/tiles/`,
3. a **Vue content component** in `apps/web/src/components/tilecontent/`,
4. a one-line **registration** in the tiles registry index.

Follow the steps in order. Do not mutate props directly — all writes go through the grid
store so the layout can rebuild from copied objects.

## Architecture / render flow

```
Grid renders tiles[] → Tile.vue shell → getContentComponent() (TileUtils)
   → registry lookup by ContentType → async-load component
   → component gets `content` prop + injected context (tileId, size, position)
   → user edits → gridStore.patchTileContent(tileId, patch) → canonical update → re-render
```

## Step 1 — Content type + data interface

`packages/contracts/src/types/TileContent.ts`

```ts
export enum ContentType {
  // ...existing
  MY_NEW_TILE = "my_new_tile",
}

export interface MyNewTileContent extends TileContent {
  type: ContentType.MY_NEW_TILE;
  someValue: string;
  someNumber: number;
}

// add to the union
export type AnyTileContent =
  | TextContent
  | MyNewTileContent;
```

Rebuild the package so the web app sees the new types:

```bash
npm --workspace @grids/contracts run build
```

## Step 2 — TileDefinition

`apps/web/src/registries/tiles/myNewTile.ts`

```ts
export const myNewTileDefinition: TileDefinition<MyNewTileContent> = {
  type: ContentType.MY_NEW_TILE,
  label: "My New Tile",
  category: "utility",                 // media | text | social | embed | utility | game
  component: () => import("@/components/tilecontent/MyNewTileContent.vue"),
  defaultContent: (data) => ({
    type: ContentType.MY_NEW_TILE,
    someValue: data?.someValue || "",
    someNumber: data?.someNumber ?? 0,
  }),
  validate: (content) => content.someValue.trim().length > 0,
  capabilities: {
    caption: true,
    border: true,
    tileLink: false,
    duplicate: true,
    resizable: true,
  },
  defaultSize: { w: 2, h: 2 },         // grid cells, optional (default 2×2)
  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE],
};
```

### TileDefinition schema

| Field | Required | Type | Purpose |
| --- | --- | --- | --- |
| `type` | yes | `ContentType` | Enum identifier |
| `label` | yes | `string` | UI display name |
| `component` | yes | async import | Vue component loader |
| `defaultContent` | yes | `(data?) => Content` | Factory for initial state |
| `validate` | yes | `(content) => boolean` | Renderable check |
| `capabilities` | yes | object | `caption`, `border`, `tileLink`, `duplicate`, `resizable` |
| `category` | no | string | `media` `text` `social` `embed` `utility` `game` |
| `defaultSize` | no | `{ w, h }` | Default 2×2 |
| `editMode` | no | string | `richtext` `fields` `settings` `none` |
| `toolbar` | no | `ToolbarButton[]` | Selected-tile toolbar |
| `colorTheming` | no | object | `backgroundColor`, `textColor` flags |
| `actions` | no | object | `copyContent`, `downloadUrl`, `externalUrl` callbacks |
| `featureFlag` | no | string | PostHog gate |
| `maxPerGrid` | no | number | Instance limit per grid |

## Step 3 — Vue content component

`apps/web/src/components/tilecontent/MyNewTileContent.vue`

```vue
<template>
  <div class="my-tile-container">
    <input v-if="gridStore.canEdit" :value="content.someValue" @input="onInput" />
    <span v-else>{{ content.someValue }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject } from "vue";
import type { MyNewTileContent } from "@grids/contracts/types";
import { useGridStore } from "@/stores/grid";

export default defineComponent({
  props: {
    content: { type: Object as () => MyNewTileContent, required: true },
  },
  setup() {
    const gridStore = useGridStore();
    const tileId = inject<string | null>("tileId", null);

    const onInput = (e: Event) => {
      if (!tileId) return;
      gridStore.patchTileContent(tileId, {
        someValue: (e.target as HTMLInputElement).value,
      });
    };

    return { gridStore, onInput };
  },
});
</script>
```

### Props & injected context

- Prop `content: AnyTileContent` — the persisted tile data (treat as read-only).
- Optional `extraProps` from the definition factory.
- `inject`: `tileId: string`, `gridTileW`/`gridTileH` (cells), `tileX`/`tileY` (position).

### State rules

- Persist with `gridStore.patchTileContent(tileId, { field: value })`.
- **Never** mutate props directly — rebuilds use copied objects.
- Read canonical data when you must:

```ts
const storeContent = computed(() =>
  gridStore.currentGrid?.tiles.find((t) => t.i === tileId)?.content
);
```

## Step 4 — Register

`apps/web/src/registries/tiles/index.ts`

```ts
import { myNewTileDefinition } from "./myNewTile";

export function registerAllTiles(): void {
  registerTile(myNewTileDefinition);
}

export { myNewTileDefinition };
```

## Worked example — a "Skill Embed" tile

A tile that embeds one skill from a skill-server: it shows the skill **name + description**
and exposes three actions — **Copy** the skill markdown, **Open** the skill's page, and
**MCP** (copy the `claude mcp add` command / endpoint). Use the definition's `actions`
block for Copy/Open so they also surface in the host toolbar.

`packages/contracts` — content type:

```ts
export enum ContentType { SKILL_EMBED = "skill_embed" }

export type SkillEmbedVariant = "card" | "compact" | "row";

export interface SkillEmbedContent extends TileContent {
  type: ContentType.SKILL_EMBED;
  serverUrl: string;          // e.g. https://skills.example.com
  skillName: string;          // e.g. copywriting-eos
  variant: SkillEmbedVariant; // visual layout, see mockups/skill-embed-widget.html
  cachedName?: string;        // cached for instant render; refreshed on mount
  cachedDescription?: string;
  cachedCategory?: string;
  lastSyncedAt?: number;
  backgroundColor?: string;
}
```

`apps/web/src/registries/tiles/skillEmbed.ts` — definition:

```ts
export const skillEmbedDefinition: TileDefinition<SkillEmbedContent> = {
  type: ContentType.SKILL_EMBED,
  label: "Skill Embed",
  category: "embed",
  component: () => import("@/components/tilecontent/SkillEmbedContent.vue"),
  defaultContent: (d) => ({
    type: ContentType.SKILL_EMBED,
    serverUrl: d?.serverUrl || "",
    skillName: d?.skillName || "",
    description: d?.description || "",
    variant: d?.variant || "card",
  }),
  validate: (c) => c.skillName.trim().length > 0 && c.serverUrl.trim().length > 0,
  capabilities: { caption: false, border: true, duplicate: true, resizable: true },
  defaultSize: { w: 2, h: 2 },
  actions: {
    // copyContent is SYNCHRONOUS in the grids contract — it cannot fetch.
    // The component fetches the raw SKILL.md and stashes it in a module-level
    // cache; copyContent reads that cache back (null until first load).
    copyContent: (c) => rawCache.get(`${c.serverUrl}::${c.skillName}`) || null,
    externalUrl: (c) => `${c.serverUrl}/#/skill/${encodeURIComponent(c.skillName)}`,
  },
};
```

> Gotcha: `actions.copyContent: (content) => string | null` is **synchronous**.
> Any remote data must be fetched in the component, cached (e.g. a module `Map`),
> and read back here — don't make `copyContent` async.

The Vue component renders one of the visual variants and wires the three buttons:

- **Copy** → fetch `GET {serverUrl}/api/skills/{skillName}` once, cache the `raw`,
  `navigator.clipboard.writeText(raw)` (with an `execCommand` fallback for
  cross-origin frames).
- **Open** → `window.open(actions.externalUrl(content), "_blank", "noopener")`.
- **MCP** → copy `claude mcp add --transport http skills ${serverUrl}/mcp`, then toast.

A complete, working implementation of this tile (definition + Vue component +
install steps) lives in [`grids-tile/`](../../grids-tile/). Ten visual concepts
for the same tile live in `mockups/skill-embed-widget.html` (open in a browser).

## Checklist

- [ ] `ContentType` value + `*Content` interface added, included in `AnyTileContent`.
- [ ] `npm --workspace @grids/contracts run build` run.
- [ ] `TileDefinition` created with `validate`, `capabilities`, sensible `defaultSize`.
- [ ] Vue component reads `content` (read-only) and writes via `patchTileContent`.
- [ ] Definition registered in `registries/tiles/index.ts`.
- [ ] Edit vs. view states both handled (`gridStore.canEdit`).
