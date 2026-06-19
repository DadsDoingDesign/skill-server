# Skill Embed Widget — mockups

`skill-embed-widget.html` is a self-contained gallery of **10 UI concepts** for a
widget that embeds a single skill from this skill-server. Open it directly in a
browser — no build step.

Every concept carries the same four parts:

- **Name + description** (the skill identity)
- **Copy** — writes the full `SKILL.md` text to the clipboard
- **Open** — link to the skill page (`{serverUrl}/#/skill/{name}`)
- **MCP** — copies `claude mcp add --transport http skills {serverUrl}/mcp`

The buttons are wired and functional in the demo (with a local clipboard fallback
for `file://`), and a Light/Dark toggle previews both themes. Styling uses the
skill-server "paper/ink" design tokens from `public/styles.css`.

## Picked direction

A **"Your picks — refined"** section at the top of the file shows the chosen
direction at real grid footprints (dashed outline = the grid cell):

- **Card (#1)** as the default tile — `2×1`, scaling up to `2×2`.
- **Compact (#2)** stripped to name + description + icon actions, **no avatar** —
  `1×1`, scaling out to `2×1`.

The full 10-concept gallery remains below for reference.

## The 10 concepts

| # | Name | Grid | Feel |
|---|------|------|------|
| 01 | Card | 2×2 | Classic vertical card, category badge, equal action row |
| 02 | Compact row | 4×1 | Link-in-bio pill, initial avatar, icon-only actions |
| 03 | Terminal | 2×2 | Monospace config-style block, developer-native |
| 04 | Ticket | 3×1 | Perforated stub, MCP as a wax stamp |
| 05 | Index card | 2×2 | Ruled lines + red margin, serif name |
| 06 | Minimal | 2×1 | Borderless and quiet |
| 07 | Header bar | 2×2 | Bold accent header, footer actions |
| 08 | Split metadata | 3×2 | Content left, action rail + metadata right |
| 09 | App tile | 2×2 | Icon-forward, rounded glyph + initials |
| 10 | Preview | 2×3 | Faded `SKILL.md` preview, pinned footer |

## Turning a concept into a real Grids tile

Use the **`creating-grids-tiles`** skill (in `skills/creating-grids-tiles/`). The
short version: add a `SKILL_EMBED` content type to `packages/contracts`, a
`TileDefinition` (category `embed`, `actions.copyContent` + `actions.externalUrl`)
under `apps/web/src/registries/tiles/`, and a Vue component that renders the chosen
variant under `apps/web/src/components/tilecontent/`.
