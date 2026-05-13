import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import matter from "gray-matter";

const SKILLS_DIR = process.env.SKILLS_DIR
  ? path.resolve(process.env.SKILLS_DIR)
  : path.resolve(process.cwd(), "skills");

const NAME_RE = /^[a-z0-9][a-z0-9-_]{0,62}$/;

export function getSkillsDir() {
  return SKILLS_DIR;
}

export async function ensureSkillsDir() {
  await fs.mkdir(SKILLS_DIR, { recursive: true });
}

function assertSafeName(name) {
  if (typeof name !== "string" || !NAME_RE.test(name)) {
    const err = new Error(
      "Invalid skill name. Use lowercase letters, digits, '-' or '_' (max 63 chars)."
    );
    err.status = 400;
    throw err;
  }
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
  await ensureSkillsDir();
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
  await ensureSkillsDir();
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

export async function importSkillFromZip(buffer, { overwrite = false } = {}) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // Find SKILL.md to determine the skill name. Two layouts are accepted:
  //   1) zip contains <name>/SKILL.md at the top level
  //   2) zip contains SKILL.md at the top level (use frontmatter `name`)
  let skillRootPrefix = null;
  let frontmatterName = null;
  for (const e of entries) {
    if (e.isDirectory) continue;
    const parts = e.entryName.split("/").filter(Boolean);
    if (parts[parts.length - 1] === "SKILL.md") {
      if (parts.length === 1) {
        skillRootPrefix = "";
      } else if (parts.length === 2) {
        skillRootPrefix = parts[0] + "/";
      } else {
        continue;
      }
      const parsed = matter(e.getData().toString("utf8"));
      if (typeof parsed.data.name === "string") frontmatterName = parsed.data.name;
      break;
    }
  }

  if (skillRootPrefix === null) {
    const err = new Error("Zip is missing SKILL.md at the root or under <name>/");
    err.status = 400;
    throw err;
  }

  const name =
    (skillRootPrefix ? skillRootPrefix.replace(/\/$/, "") : frontmatterName) || "";
  assertSafeName(name);

  const dir = skillPath(name);
  if (await exists(dir)) {
    if (!overwrite) {
      const err = new Error(`Skill '${name}' already exists`);
      err.status = 409;
      throw err;
    }
    await fs.rm(dir, { recursive: true, force: true });
  }
  await fs.mkdir(dir, { recursive: true });

  for (const e of entries) {
    if (e.isDirectory) continue;
    if (skillRootPrefix && !e.entryName.startsWith(skillRootPrefix)) continue;
    const rel = e.entryName.slice(skillRootPrefix.length);
    if (!rel || rel.startsWith("..")) continue;
    const abs = path.resolve(dir, rel);
    if (!abs.startsWith(dir + path.sep)) continue;
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, e.getData());
  }

  return await readSkillMd(name);
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
