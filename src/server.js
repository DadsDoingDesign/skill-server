import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listSkills,
  getSkill,
  saveSkill,
  deleteSkill,
  importSkillFromZip,
  exportSkillAsZip,
  searchSkills,
  ensureSkillsDir,
} from "./skills.js";
import { handleMcpRequest } from "./mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ""; // if set, required for write APIs and UI
const MCP_TOKEN = process.env.MCP_TOKEN || ""; // optional bearer for /mcp

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

await ensureSkillsDir();

const app = express();
app.disable("x-powered-by");

// JSON body parser, scoped so multipart routes are unaffected.
app.use("/mcp", express.json({ limit: "4mb" }));
app.use("/api", (req, res, next) => {
  if (req.is("multipart/form-data")) return next();
  return express.json({ limit: "4mb" })(req, res, next);
});

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return next();
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer || req.headers["x-admin-token"] || req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function requireMcp(req, res, next) {
  if (!MCP_TOKEN) return next();
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (bearer !== MCP_TOKEN) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Unauthorized" },
      id: null,
    });
  }
  next();
}

// ---- MCP endpoint ----------------------------------------------------------
app.all("/mcp", requireMcp, handleMcpRequest);

// ---- Public read API (for non-MCP clients) ---------------------------------
app.get("/api/skills", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    res.json(q ? await searchSkills(q) : await listSkills());
  } catch (e) {
    next(e);
  }
});

app.get("/api/skills/:name", async (req, res, next) => {
  try {
    const s = await getSkill(req.params.name);
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json(s);
  } catch (e) {
    next(e);
  }
});

app.get("/api/skills/:name/export", async (req, res, next) => {
  try {
    const buf = await exportSkillAsZip(req.params.name);
    if (!buf) return res.status(404).json({ error: "Not found" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${req.params.name}.zip"`
    );
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

// ---- Admin write API -------------------------------------------------------
app.post("/api/skills", requireAdmin, async (req, res, next) => {
  try {
    const { name, description, body, metadata } = req.body || {};
    const saved = await saveSkill(name, { description, body, metadata });
    res.status(201).json(saved);
  } catch (e) {
    next(e);
  }
});

app.put("/api/skills/:name", requireAdmin, async (req, res, next) => {
  try {
    const { description, body, metadata } = req.body || {};
    const saved = await saveSkill(req.params.name, {
      description,
      body,
      metadata,
    });
    res.json(saved);
  } catch (e) {
    next(e);
  }
});

app.delete("/api/skills/:name", requireAdmin, async (req, res, next) => {
  try {
    const ok = await deleteSkill(req.params.name);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

app.post(
  "/api/skills/import",
  requireAdmin,
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const overwrite = req.query.overwrite === "1" || req.body?.overwrite === "1";
      const saved = await importSkillFromZip(req.file.buffer, { overwrite });
      res.status(201).json(saved);
    } catch (e) {
      next(e);
    }
  }
);

// ---- UI --------------------------------------------------------------------
app.use(express.static(path.join(ROOT, "public")));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---- Error handler ---------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal error" });
});

app.listen(PORT, () => {
  console.log(`Skill server listening on http://localhost:${PORT}`);
  console.log(`  - UI:  http://localhost:${PORT}/`);
  console.log(`  - MCP: http://localhost:${PORT}/mcp`);
  if (ADMIN_TOKEN) console.log("  - Admin token required for write operations");
  if (MCP_TOKEN) console.log("  - MCP token required (Authorization: Bearer ...)");
});
