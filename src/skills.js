import AdmZip from "adm-zip";
import matter from "gray-matter";
import * as fsBackend from "./storage/fs.js";
import * as blobBackend from "./storage/blob.js";
import { assertSafeName } from "./storage/shared.js";

// Backend selection:
//   STORAGE=blob (or BLOB_READ_WRITE_TOKEN set, i.e. running on Vercel) -> Vercel Blob
//   otherwise                                                          -> local filesystem
function pickBackend() {
  const explicit = (process.env.STORAGE || "").toLowerCase();
  if (explicit === "blob") return blobBackend;
  if (explicit === "fs") return fsBackend;
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobBackend;
  return fsBackend;
}

const backend = pickBackend();

export const describeBackend = () => backend.describe();
export const ensureReady = () => backend.ensureReady();
export const listSkills = () => backend.listSkills();
export const getSkill = (name) => backend.getSkill(name);
export const listSkillFiles = (name) => backend.listSkillFiles(name);
export const readSkillFile = (name, relPath) => backend.readSkillFile(name, relPath);
export const saveSkill = (name, payload) => backend.saveSkill(name, payload);
export const deleteSkill = (name) => backend.deleteSkill(name);
export const exportSkillAsZip = (name) => backend.exportSkillAsZip(name);

export async function searchSkills(query) {
  const all = await listSkills();
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
  );
}

export async function importSkillFromMarkdown(buffer, { overwrite = false, filename = "" } = {}) {
  const raw = buffer.toString("utf8");
  const parsed = matter(raw);
  const frontmatterName = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";
  const fileBaseName = filename ? filename.replace(/\.[^.]+$/, "") : "";
  const name = frontmatterName || fileBaseName;
  if (!name) {
    const err = new Error("Skill must have a `name` field in its frontmatter (or a descriptive filename)");
    err.status = 400;
    throw err;
  }
  assertSafeName(name);
  const existing = await getSkill(name);
  if (existing && !overwrite) {
    const err = new Error(`Skill '${name}' already exists`);
    err.status = 409;
    throw err;
  }
  if (existing) await deleteSkill(name);
  return await saveSkill(name, {
    description: typeof parsed.data.description === "string" ? parsed.data.description : undefined,
    body: parsed.content,
    metadata: parsed.data,
  });
}

export async function importSkillFromZip(buffer, { overwrite = false } = {}) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // Two accepted layouts:
  //   <name>/SKILL.md at root, with arbitrary supporting files under <name>/
  //   SKILL.md at root, name taken from frontmatter
  let rootPrefix = null;
  let frontmatterName = null;
  for (const e of entries) {
    if (e.isDirectory) continue;
    const parts = e.entryName.split("/").filter(Boolean);
    if (parts[parts.length - 1] !== "SKILL.md") continue;
    if (parts.length === 1) rootPrefix = "";
    else if (parts.length === 2) rootPrefix = parts[0] + "/";
    else continue;
    const parsed = matter(e.getData().toString("utf8"));
    if (typeof parsed.data.name === "string") frontmatterName = parsed.data.name;
    break;
  }
  if (rootPrefix === null) {
    const err = new Error("Zip is missing SKILL.md at the root or under <name>/");
    err.status = 400;
    throw err;
  }
  const name = (rootPrefix ? rootPrefix.replace(/\/$/, "") : frontmatterName) || "";
  assertSafeName(name);

  const existing = await getSkill(name);
  if (existing && !overwrite) {
    const err = new Error(`Skill '${name}' already exists`);
    err.status = 409;
    throw err;
  }
  if (existing) await deleteSkill(name);

  // Collect files from the zip (skipping anything outside rootPrefix or with bad paths).
  const files = [];
  for (const e of entries) {
    if (e.isDirectory) continue;
    if (rootPrefix && !e.entryName.startsWith(rootPrefix)) continue;
    const rel = e.entryName.slice(rootPrefix.length);
    if (!rel || rel.startsWith("..") || rel.split("/").includes("..")) continue;
    files.push({ path: rel, data: e.getData() });
  }
  await backend.writeSkillFiles(name, files);

  return await getSkill(name);
}
