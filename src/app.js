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
  importSkillFromMarkdown,
  exportSkillAsZip,
  exportAllSkillsAsZip,
  searchSkills,
  describeBackend,
} from "./skills.js";
import { handleMcpRequest } from "./mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const MCP_TOKEN = process.env.MCP_TOKEN || "";

export function buildApp() {
  const upload = multer({
    storage: multer.memoryStorage(),
    // Stay well under Vercel's serverless body limit so imports also work in production.
    limits: { fileSize: 4 * 1024 * 1024 },
  });

  const app = express();
  app.disable("x-powered-by");

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
    if (token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
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

  app.all("/mcp", requireMcp, handleMcpRequest);

  app.get("/api/whoami", (req, res) => {
    if (!ADMIN_TOKEN) return res.json({ admin: true, authRequired: false });
    const header = req.headers.authorization || "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
    const token = bearer || req.headers["x-admin-token"] || req.query.token;
    res.json({ admin: token === ADMIN_TOKEN, authRequired: true });
  });

  app.get("/api/skills", async (req, res, next) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      res.json(q ? await searchSkills(q) : await listSkills());
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/skills/export-all", async (_req, res, next) => {
    try {
      const buf = await exportAllSkillsAsZip();
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="skills.zip"');
      res.send(buf);
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
      const saved = await saveSkill(req.params.name, { description, body, metadata });
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
        const isMarkdown = req.file.originalname.toLowerCase().endsWith(".md");
        const saved = isMarkdown
          ? await importSkillFromMarkdown(req.file.buffer, { overwrite })
          : await importSkillFromZip(req.file.buffer, { overwrite });
        res.status(201).json(saved);
      } catch (e) {
        next(e);
      }
    }
  );

  app.get("/healthz", (_req, res) => res.json({ ok: true, storage: describeBackend() }));

  // Serve UI assets. On Vercel these are served as static files via vercel.json,
  // so this is primarily for local dev — but it's safe to leave on either way.
  app.use(express.static(path.join(ROOT, "public")));

  app.use((err, _req, res, _next) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Internal error" });
  });

  return app;
}

// Vercel's Node runtime validates every module in the import chain and
// requires the default export to be a function or HTTP server. Export the
// pre-built Express app so this module satisfies that check whether Vercel
// invokes it directly or only uses it as a dependency of api/index.js.
export default buildApp();
