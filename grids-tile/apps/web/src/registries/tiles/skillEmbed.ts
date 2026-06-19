import { ContentType, type SkillEmbedContent } from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";
import {
  RESIZE_PRESETS,
  BORDER_TOGGLE,
  COLOR_BUTTON,
} from "@/registries/tileToolbar/baseButtons";

const trimUrl = (u: string) => (u || "").trim().replace(/\/+$/, "");

/**
 * Module-level cache of fetched SKILL.md text, keyed by server + skill name.
 * The host toolbar's `copyContent` must be synchronous, so the content
 * component (which fetches asynchronously) writes the raw markdown here and
 * the definition reads it back. Falls back to null until the first load.
 */
const rawCache = new Map<string, string>();
export const skillCacheKey = (serverUrl: string, skillName: string) =>
  `${trimUrl(serverUrl)}::${skillName}`;
export const cacheSkillRaw = (
  serverUrl: string,
  skillName: string,
  raw: string,
) => rawCache.set(skillCacheKey(serverUrl, skillName), raw);

export const skillEmbedDefinition: TileDefinition<SkillEmbedContent> = {
  type: ContentType.SKILL_EMBED,
  label: "Skill Embed",
  category: "embed",

  component: () => import("@/components/tilecontent/SkillEmbedContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.SKILL_EMBED,
    serverUrl: trimUrl(data?.serverUrl || ""),
    skillName: (data?.skillName || "").trim(),
    variant: data?.variant || "auto",
    cachedName: data?.cachedName,
    cachedDescription: data?.cachedDescription,
    cachedCategory: data?.cachedCategory,
    lastSyncedAt: data?.lastSyncedAt,
    backgroundColor: data?.backgroundColor,
  }),

  validate: (content) => !!content.serverUrl && !!content.skillName,

  capabilities: {
    caption: false,
    border: true,
    resizable: true,
    duplicate: true,
  },

  colorTheming: {
    backgroundColor: true,
  },

  defaultSize: { w: 2, h: 2 },

  editMode: "fields",

  actions: {
    // Synchronous: returns the cached raw SKILL.md once the component has fetched it.
    copyContent: (content) =>
      rawCache.get(skillCacheKey(content.serverUrl, content.skillName)) || null,
    // Deep-link to the skill's page on the skill-server UI.
    externalUrl: (content) =>
      content.serverUrl && content.skillName
        ? `${trimUrl(content.serverUrl)}/#/skill/${encodeURIComponent(content.skillName)}`
        : null,
  },

  // Paste-to-create: dropping a skill page URL spawns a configured tile.
  // e.g. https://skills.example.com/#/skill/copywriting-eos
  matchUrl: (url) => /\/#\/skill\/[^/?#]+/.test(url),
  parseUrl: (url) => {
    const m = url.match(/^(https?:\/\/[^/]+)(?:\/[^#]*)?#\/skill\/([^/?#]+)/i);
    if (!m) return {};
    return {
      serverUrl: trimUrl(m[1]),
      skillName: decodeURIComponent(m[2]),
      variant: "card",
    };
  },

  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON],
};
