import { buildApp } from "./app.js";
import { ensureReady, describeBackend } from "./skills.js";

const PORT = Number(process.env.PORT || 3000);

await ensureReady();

const app = buildApp();
app.listen(PORT, () => {
  console.log(`Skill server listening on http://localhost:${PORT}`);
  console.log(`  - UI:      http://localhost:${PORT}/`);
  console.log(`  - MCP:     http://localhost:${PORT}/mcp`);
  console.log(`  - Storage: ${describeBackend()}`);
  if (process.env.ADMIN_TOKEN) console.log("  - ADMIN_TOKEN required for write operations");
  if (process.env.MCP_TOKEN) console.log("  - MCP_TOKEN required (Authorization: Bearer ...)");
});
