import AdmZip from "adm-zip";
import matter from "gray-matter";
import {
  put as blobPut,
  list as blobList,
  del as blobDel,
  get as blobGet,
} from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { assertSafeName, assertSafeRelPath, NAME_RE } from "./shared.js";

// Vercel Blob layout:
//   skills/<name>/SKILL.md
//   skills/<name>/<rel-path>      (optional supporting files)
//
// The skill "name" is whatever segment appears between `skills/` and the next slash.
// Pathnames are case-sensitive and globally unique within the store.

const PREFIX = "skills/";
const ASSET_PREFIX = "assets/";

const token = process.env.BLOB_READ_WRITE_TOKEN;

// Match the access type of the Vercel Blob store you connected.
// Set BLOB_ACCESS=public if you created a public store; otherwise private (the default & recommended).
const ACCESS = process.env.BLOB_ACCESS === "public" ? "public" : "private";

function opts(extra = {}) {
  // `addRandomSuffix: false` keeps the pathname stable so we can address it by name.
  return {
    access: ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    ...(token ? { token } : {}),
    ...extra,
  };
}

function listOpts(extra = {}) {
  return { ...(token ? { token } : {}), ...extra };
}

function delOpts() {
  return token ? { token } : {};
}

export function describe() {
  return "vercel-blob";
}

export async function ensureReady() {
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Connect a Vercel Blob store to this project."
    );
  }
}

// ---- helpers ---------------------------------------------------------------

async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const res = await blobList(listOpts({ prefix, cursor }));
    out.push(...res.blobs);
    cursor = res.cursor;
  } while (cursor);
  return out;
}

async function fetchBlobByUrl(url) {
  // Pass the URL returned by list() so the SDK doesn't have to reconstruct it
  // from `access` + storeId. That reconstruction breaks whenever BLOB_ACCESS
  // doesn't match the store's actual access type (e.g. private code talking
  // to a public store), which 404s and surfaces here as a 500.
  const res = await blobGet(url, {
    access: ACCESS,
    ...(token ? { token } : {}),
  });
  if (!res || res.statusCode !== 200 || !res.stream) {
    const err = new Error("Blob not found");
    err.status = 404;
    throw err;
  }
  const reader = res.stream.getReader();
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function findSkillMdBlob(name) {
  // We can't predict the exact URL ahead of time, so look it up.
  const key = `${PREFIX}${name}/SKILL.md`;
  const blobs = await listAll(key);
  return blobs.find((b) => b.pathname === key) || null;
}

async function parseSkillMd(blob) {
  const buf = await fetchBlobByUrl(blob.url);
  const raw = buf.toString("utf8");
  const parsed = matter(raw);
  const name = blob.pathname.slice(PREFIX.length).split("/")[0];
  return {
    name,
    description:
      typeof parsed.data.description === "string" ? parsed.data.description : "",
    metadata: parsed.data,
    body: parsed.content,
    raw,
  };
}

// ---- public API ------------------------------------------------------------

export async function listSkills() {
  await ensureReady();
  const blobs = await listAll(PREFIX);
  const byName = new Map();
  for (const b of blobs) {
    const rel = b.pathname.slice(PREFIX.length);
    const slash = rel.indexOf("/");
    if (slash <= 0) continue;
    const name = rel.slice(0, slash);
    if (!NAME_RE.test(name)) continue;
    if (rel.slice(slash + 1) === "SKILL.md") byName.set(name, b);
  }
  const out = [];
  for (const [, blob] of byName) {
    const s = await parseSkillMd(blob);
    out.push({ name: s.name, description: s.description, metadata: s.metadata });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function getSkill(name) {
  await ensureReady();
  assertSafeName(name);
  const blob = await findSkillMdBlob(name);
  if (!blob) return null;
  return await parseSkillMd(blob);
}

export async function listSkillFiles(name) {
  await ensureReady();
  assertSafeName(name);
  const blobs = await listAll(`${PREFIX}${name}/`);
  return blobs.map((b) => ({
    path: b.pathname.slice(PREFIX.length + name.length + 1),
    size: b.size,
  }));
}

export async function readSkillFile(name, relPath) {
  await ensureReady();
  assertSafeName(name);
  assertSafeRelPath(relPath);
  const key = `${PREFIX}${name}/${relPath}`;
  const blobs = await listAll(key);
  const blob = blobs.find((b) => b.pathname === key);
  if (!blob) {
    const err = new Error("File not found");
    err.status = 404;
    throw err;
  }
  return await fetchBlobByUrl(blob.url);
}

export async function saveSkill(name, { description, body, metadata }) {
  await ensureReady();
  assertSafeName(name);
  const data = {
    name,
    ...(metadata && typeof metadata === "object" ? metadata : {}),
  };
  if (typeof description === "string") data.description = description;
  const content = matter.stringify(body ?? "", data);
  await blobPut(`${PREFIX}${name}/SKILL.md`, content, opts({ contentType: "text/markdown" }));
  return await getSkill(name);
}

export async function deleteSkill(name) {
  await ensureReady();
  assertSafeName(name);
  const blobs = await listAll(`${PREFIX}${name}/`);
  if (blobs.length === 0) return false;
  await blobDel(
    blobs.map((b) => b.url),
    delOpts()
  );
  return true;
}

export async function writeSkillFiles(name, files) {
  await ensureReady();
  assertSafeName(name);
  for (const f of files) {
    assertSafeRelPath(f.path);
    await blobPut(`${PREFIX}${name}/${f.path}`, f.data, opts());
  }
}

export async function exportSkillAsZip(name) {
  await ensureReady();
  assertSafeName(name);
  const blobs = await listAll(`${PREFIX}${name}/`);
  if (blobs.length === 0) return null;
  const zip = new AdmZip();
  for (const b of blobs) {
    const rel = b.pathname.slice(PREFIX.length + name.length + 1);
    const data = await fetchBlobByUrl(b.url);
    zip.addFile(`${name}/${rel}`, data);
  }
  return zip.toBuffer();
}

const ASSET_RE = /^[A-Za-z0-9._-]+$/;

export async function saveAsset(buffer, ext, contentType) {
  await ensureReady();
  const name = `${randomUUID()}${ext}`;
  await blobPut(`${ASSET_PREFIX}${name}`, buffer, opts({ contentType }));
  return `/api/assets/${name}`;
}

export async function getAsset(name) {
  await ensureReady();
  if (!ASSET_RE.test(name) || name.includes("..")) {
    const err = new Error("Bad asset name");
    err.status = 400;
    throw err;
  }
  const key = `${ASSET_PREFIX}${name}`;
  const blobs = await listAll(key);
  const blob = blobs.find((b) => b.pathname === key);
  if (!blob) {
    const err = new Error("Asset not found");
    err.status = 404;
    throw err;
  }
  return await fetchBlobByUrl(blob.url);
}
