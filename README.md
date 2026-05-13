# skill-server

A shared **MCP server** for hosting and serving [Anthropic-style skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) (SKILL.md files). It exposes skills over the **Model Context Protocol (Streamable HTTP)** so any agent — Claude Code, an IDE, a custom SDK app — can ping it from anywhere and pull in skills on demand.

It also ships with a small web UI to upload, edit, and manage skills.

## Why

You write a skill once and every agent — across machines, across teammates — picks it up automatically from a single source of truth.

## What's in the box

- **`/mcp`** — MCP endpoint over Streamable HTTP. Stateless, so it works behind any load balancer.
- **`/`** — web UI: create, edit, search, delete, import (`.zip`), export.
- **`/api/*`** — REST endpoints for non-MCP clients.
- Filesystem storage — skills are plain folders with `SKILL.md` files. Easy to back up, version, mount.

### MCP tools exposed

| Tool | Description |
| --- | --- |
| `list_skills` | All skills, with name + description. |
| `search_skills` | Substring search over name/description. |
| `get_skill` | Full SKILL.md content (frontmatter + body). |
| `list_skill_files` | Files bundled with a skill. |
| `read_skill_file` | Read a single file inside a skill. |

## Run it

### Locally

```bash
npm install
npm start
# → http://localhost:3000
```

### Docker

```bash
docker compose up -d
```

Skills persist in `./skills` on the host.

## Auth

Both tokens are optional. If unset, the endpoints are open — fine for a private network, not for the public internet.

| Variable | Effect |
| --- | --- |
| `ADMIN_TOKEN` | Required for `POST/PUT/DELETE /api/*` and import. Send as `Authorization: Bearer <token>` or `X-Admin-Token: <token>`. The UI prompts for it via the **Token** button. |
| `MCP_TOKEN` | Required for `/mcp`. Send as `Authorization: Bearer <token>`. |
| `PORT` | Listen port (default `3000`). |
| `SKILLS_DIR` | Where skills live on disk (default `./skills`). |

## Connecting an agent

### Claude Code

Add an MCP server entry:

```bash
claude mcp add --transport http skills https://your-host.example.com/mcp \
  --header "Authorization: Bearer $MCP_TOKEN"
```

### Any MCP-aware client

Point it at `https://your-host.example.com/mcp`, transport = **Streamable HTTP**.

## Skill format

Every skill is a folder under `skills/` containing a `SKILL.md` file:

```
skills/
  my-skill/
    SKILL.md
    references/
      cheatsheet.md
    scripts/
      run.sh
```

`SKILL.md` uses YAML frontmatter:

```markdown
---
name: my-skill
description: One-line summary. Agents see this first when deciding whether to load the skill.
---

# Instructions for the agent
...
```

You can also import a skill as a `.zip` (either `<name>/SKILL.md` at the root, or `SKILL.md` at the root with `name` in frontmatter).

## REST API quick reference

```
GET    /api/skills              # list, optional ?q=search
GET    /api/skills/:name        # full skill JSON
GET    /api/skills/:name/export # download .zip
POST   /api/skills              # { name, description, body, metadata? }  [admin]
PUT    /api/skills/:name        # { description, body, metadata? }       [admin]
DELETE /api/skills/:name                                                  [admin]
POST   /api/skills/import       # multipart .zip, ?overwrite=1            [admin]
```

## Layout

```
src/
  server.js   # Express app, REST API, static UI
  mcp.js      # MCP server + tool registrations + HTTP transport
  skills.js   # filesystem storage / import / export
public/       # UI (vanilla HTML/CSS/JS)
skills/       # data (gitignored by default)
```
