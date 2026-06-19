import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import matter from "gray-matter";
import { randomUUID } from "node:crypto";
import { assertSafeName, NAME_RE } from "./shared.js";

const SKILLS_DIR = process.env.SKILLS_DIR
  ? path.resolve(process.env.SKILLS_DIR)
  : path.resolve(process.cwd(), "skills");

const ASSETS_DIR = process.env.ASSETS_DIR
  ? path.resolve(process.env.ASSETS_DIR)
  : path.resolve(SKILLS_DIR, "..", "assets");

export function describe() {
  return `fs:${SKILLS_DIR}`;
}

export async function ensureReady() {
  await fs.mkdir(SKILLS_DIR, { recursive: true });
}

function skillPath(name) {
  assertSafeName(name);
  return path.join(SKILLS_DIR, name);
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const ASSET_RE = /^[A-Za-z0-9._-]+$/;

export async function saveAsset(buffer, ext) {
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  const name = `${randomUUID()}${ext}`;
  await fs.writeFile(path.join(ASSETS_DIR, name), buffer);
  return `/api/assets/${name}`;
}

export async function getAsset(name) {
  if (!ASSET_RE.test(name) || name.includes("..")) {
    const err = new Error("Bad asset name");
    err.status = 400;
    throw err;
  }
  try {
    return await fs.readFile(path.join(ASSETS_DIR, name));
  } catch {
    const err = new Error("Asset not found");
    err.status = 404;
    throw err;
  }
}

async function readSkillMd(name) {
  const file = path.join(skillPath(name), "SKILL.md");
  if (!(await exists(file))) return null;
  const raw = await fs.readFile(file, "utf8");
  const parsed = matter(raw);
  return {
    name,
    description:
      typeof parsed.data.description === "string" ? parsed.data.description : "",
    metadata: parsed.data,
    body: parsed.content,
    raw,
  };
}

export async function listSkills() {
  await ensureReady();
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  const skills = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (!NAME_RE.test(e.name)) continue;
    const s = await readSkillMd(e.name);
    if (s) {
      skills.push({
        name: s.name,
        description: s.description,
        metadata: s.metadata,
      });
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

export async function getSkill(name) {
  return await readSkillMd(name);
}

export async function listSkillFiles(name) {
  const dir = skillPath(name);
  if (!(await exists(dir))) return [];
  const out = [];
  async function walk(rel) {
    const abs = path.join(dir, rel);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const e of entries) {
      const r = path.posix.join(rel, e.name);
      if (e.isDirectory()) await walk(r);
      else if (e.isFile()) {
        const stat = await fs.stat(path.join(abs, e.name));
        out.push({ path: r.replace(/^\/+/, ""), size: stat.size });
      }
    }
  }
  await walk("");
  return out;
}

export async function readSkillFile(name, relPath) {
  const dir = skillPath(name);
  const abs = path.resolve(dir, relPath);
  if (!abs.startsWith(dir + path.sep) && abs !== dir) {
    const err = new Error("Path traversal blocked");
    err.status = 400;
    throw err;
  }
  return await fs.readFile(abs);
}

export async function saveSkill(name, { description, body, metadata }) {
  assertSafeName(name);
  await ensureReady();
  const dir = skillPath(name);
  await fs.mkdir(dir, { recursive: true });
  const data = {
    name,
    ...(metadata && typeof metadata === "object" ? metadata : {}),
  };
  if (typeof description === "string") data.description = description;
  const content = matter.stringify(body ?? "", data);
  await fs.writeFile(path.join(dir, "SKILL.md"), content, "utf8");
  return await readSkillMd(name);
}

export async function deleteSkill(name) {
  const dir = skillPath(name);
  if (!(await exists(dir))) return false;
  await fs.rm(dir, { recursive: true, force: true });
  return true;
}

export async function writeSkillFiles(name, files) {
  assertSafeName(name);
  const dir = skillPath(name);
  await fs.mkdir(dir, { recursive: true });
  for (const f of files) {
    const abs = path.resolve(dir, f.path);
    if (!abs.startsWith(dir + path.sep)) continue;
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, f.data);
  }
}

export async function exportSkillAsZip(name) {
  const dir = skillPath(name);
  if (!(await exists(dir))) return null;
  const zip = new AdmZip();
  async function add(rel) {
    const abs = path.join(dir, rel);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const e of entries) {
      const r = path.posix.join(rel, e.name);
      if (e.isDirectory()) await add(r);
      else if (e.isFile()) {
        const data = await fs.readFile(path.join(abs, e.name));
        zip.addFile(path.posix.join(name, r), data);
      }
    }
  }
  await add("");
  return zip.toBuffer();
}
