# Skill Embed — a real Grids tile

A drop-in [Grids](https://github.com/Trustybits/grids) tile that embeds one skill
from a skill-server: **name + description** with working **Copy** (full `SKILL.md`),
**Open** (skill page), and **MCP** (copies the `claude mcp add` command) actions.
Three layouts — `card`, `compact`, `row` — selectable per tile.

It fetches `GET {serverUrl}/api/skills/{skillName}` on mount, renders, and caches
name/description on the tile so it shows instantly on reload (owners persist the
cache; viewers read it). The full markdown is cached in-memory so the host
toolbar's synchronous `copyContent` works too.

This folder mirrors the grids repo layout, so the two files drop straight in.
Two small edits to shared files are also needed (below).

## 1. Copy the files

```
apps/web/src/registries/tiles/skillEmbed.ts          → apps/web/src/registries/tiles/
apps/web/src/components/tilecontent/SkillEmbedContent.vue → apps/web/src/components/tilecontent/
```

## 2. Add the content type — `packages/contracts/src/types/TileContent.ts`

Add the enum value:

```ts
export enum ContentType {
  // …existing values
  SKILL_EMBED = "skill_embed",
}
```

Add the interface (anywhere among the other `*Content` interfaces):

```ts
// "auto" picks the layout from the tile's grid size; the others force one.
export type SkillEmbedVariant = "auto" | "card" | "compact" | "row";

export interface SkillEmbedContent extends TileContent {
  type: ContentType.SKILL_EMBED;
  serverUrl: string;        // e.g. https://skills.example.com
  skillName: string;        // e.g. copywriting-eos
  variant: SkillEmbedVariant;
  // cached for instant render; refreshed from the server on mount
  cachedName?: string;
  cachedDescription?: string;
  cachedCategory?: string;
  lastSyncedAt?: number;
  backgroundColor?: string;
}
```

Add it to the union:

```ts
export type AnyTileContent =
  | TextContent
  // …existing members
  | SkillEmbedContent;
```

Then rebuild contracts so the web app sees the new types:

```bash
npm --workspace @grids/contracts run build
```

## 3. Register the tile — `apps/web/src/registries/tiles/index.ts`

```ts
import { skillEmbedDefinition } from "./skillEmbed";

export function registerAllTiles(): void {
  // …existing registerTile calls
  registerTile(skillEmbedDefinition);
}

export { skillEmbedDefinition };
```

## Notes / decisions

- **Responsive layout.** With `variant: "auto"` (the default) the tile reads its
  grid footprint (`gridTileW`/`gridTileH`) and picks the layout to match the resize
  presets: **1×1 → compact**, **3×1 (wide/short) → row**, **2×2 / 4×4 → card** (the
  card's description grows with height). Setting `variant` to `card`/`compact`/`row`
  forces one. Category `embed`, default size **2×2**; color theming
  (`backgroundColor`) is enabled.
- **Paste-to-create**: `matchUrl`/`parseUrl` recognise a skill page URL
  (`https://host/#/skill/<name>`) so pasting one spawns a configured tile.
- **`copyContent` is synchronous** in the grids contract, so the component caches
  the fetched markdown in a module-level `Map` (`skillEmbed.ts`) that the
  definition reads back. The in-tile Copy button works regardless.
- **Cross-origin reads**: the skill-server's `GET /api/skills/*` is public. If the
  grids app runs on a different origin than the skill-server, that server must send
  permissive CORS headers for these GET routes (the skill-server's own
  `/embed/` widget avoids this by being same-origin).
- **Styling inherits the host grid's tokens.** The component draws no outer
  surface/border (the tile shell provides those) and reads grids' own variables —
  `--tile-text-color` / `--color-text-primary` for text, `--primary-color` for the
  accent, `--spacing-*`, `--radius-*`, `--font-family-base` / `--font-family-mono`,
  with `color-mix` for muted tones (the same pattern `TextContent.vue` uses). It
  follows light/dark automatically and falls back gracefully outside grids.
- **Decorative background.** The card layout shows a faint line-art document
  graphic (text color + accent fold) bleeding off the bottom-right, like other
  grid tiles. It uses the grid's tokens, so it themes with everything else.
- Authoring guidance for any grids tile lives in the `creating-grids-tiles` skill
  on the skill-server.
```
