import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  listSkills,
  getSkill,
  searchSkills,
  listSkillFiles,
  readSkillFile,
} from "./skills.js";

function buildServer() {
  const server = new McpServer({
    name: "skill-server",
    version: "0.1.0",
  });

  server.registerTool(
    "list_skills",
    {
      title: "List skills",
      description:
        "List every skill available on this server with name + short description. Call this first to discover what skills exist.",
      inputSchema: {},
    },
    async () => {
      const skills = await listSkills();
      return {
        content: [{ type: "text", text: JSON.stringify(skills, null, 2) }],
      };
    }
  );

  server.registerTool(
    "search_skills",
    {
      title: "Search skills",
      description:
        "Search skills by case-insensitive substring match against name and description.",
      inputSchema: { query: z.string().describe("Search term") },
    },
    async ({ query }) => {
      const results = await searchSkills(query);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get_skill",
    {
      title: "Get skill",
      description:
        "Fetch the full SKILL.md content for a skill by name (frontmatter + body).",
      inputSchema: { name: z.string().describe("Skill name") },
    },
    async ({ name }) => {
      const skill = await getSkill(name);
      if (!skill) {
        return {
          isError: true,
          content: [{ type: "text", text: `Skill '${name}' not found` }],
        };
      }
      return { content: [{ type: "text", text: skill.raw }] };
    }
  );

  server.registerTool(
    "list_skill_files",
    {
      title: "List files in a skill",
      description:
        "List supporting files bundled with a skill (scripts, references, assets).",
      inputSchema: { name: z.string().describe("Skill name") },
    },
    async ({ name }) => {
      const files = await listSkillFiles(name);
      return {
        content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
      };
    }
  );

  server.registerTool(
    "read_skill_file",
    {
      title: "Read a file from a skill",
      description:
        "Read a UTF-8 text file from a skill's directory by relative path.",
      inputSchema: {
        name: z.string().describe("Skill name"),
        path: z.string().describe("Relative file path inside the skill"),
      },
    },
    async ({ name, path: relPath }) => {
      try {
        const buf = await readSkillFile(name, relPath);
        return { content: [{ type: "text", text: buf.toString("utf8") }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: err.message || String(err) }],
        };
      }
    }
  );

  return server;
}

// Stateless handler: build a fresh server + transport per request. Works well
// for read-heavy MCP traffic and avoids per-client session state.
export async function handleMcpRequest(req, res) {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}
