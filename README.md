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

Skills persist in `./skills` on disk. The `fs` backend is auto-selected when no Blob token is present.

### Docker

```bash
docker compose up -d
```

Skills persist in `./skills` on the host.

### Vercel

The repo is configured for Vercel out of the box. Skills are stored in **Vercel Blob** so they persist across cold starts and serverless instances.

1. **Push this repo to GitHub** (or use the Vercel CLI from a local checkout).
2. **Create the project on Vercel.** Import the repo — Vercel auto-detects the `api/` directory and `vercel.json`. No build command, no framework preset.
3. **Add a Blob store.** Project → *Storage* → *Create Database* → *Blob*. Pick **Private** access (recommended — skills shouldn't be world-readable by URL). Vercel automatically injects `BLOB_READ_WRITE_TOKEN` into the project, which is all the server needs to switch into Blob mode. If you instead picked **Public**, also set `BLOB_ACCESS=public` in env vars.
4. **Set tokens** (Project → *Settings* → *Environment Variables*):
   - `ADMIN_TOKEN` — required to write skills from the UI / REST API.
   - `MCP_TOKEN` — required to call `/mcp`.
5. **Deploy.** Once it's live:
   - UI at `https://<your-deployment>.vercel.app/`
   - MCP endpoint at `https://<your-deployment>.vercel.app/mcp`

Or from the command line:

```bash
npm i -g vercel
vercel link
vercel env add BLOB_READ_WRITE_TOKEN   # or attach a Blob store in the dashboard
vercel env add ADMIN_TOKEN
vercel env add MCP_TOKEN
vercel deploy --prod
```

#### How the storage swap works

`src/skills.js` picks a backend at startup:

| Condition | Backend |
| --- | --- |
| `STORAGE=blob`, or `BLOB_READ_WRITE_TOKEN` is set (Vercel default) | Vercel Blob (`src/storage/blob.js`) |
| Otherwise | Local filesystem (`src/storage/fs.js`) |

Both backends implement the same interface, so the REST API, MCP tools, and UI behave identically.

#### Vercel-specific limits to know

- Serverless request bodies are capped at **4.5 MB**. Skill zip imports through the UI use this limit, so keep imported skills small (the file count itself is unconstrained — only the upload payload matters). To import larger skills, run the server locally and use the REST API directly, or upload files into Blob out-of-band.
- The function has a 30-second `maxDuration`. Listing skills involves one HTTP fetch per `SKILL.md` to read frontmatter — fine for tens or hundreds of skills, slow for thousands. Add a KV index if you get there.

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
api/
  index.js          # Vercel serverless entry (wraps the Express app)
src/
  server.js         # Local-dev entry (calls app.listen)
  app.js            # Express app builder — routes, MCP, UI, auth
  mcp.js            # MCP server + tool registrations + HTTP transport
  skills.js         # backend selector + zip import/search
  storage/
    fs.js           # filesystem backend
    blob.js         # Vercel Blob backend
    shared.js       # name/path validators
public/             # UI (vanilla HTML/CSS/JS)
skills/             # local fs data (gitignored by default)
vercel.json         # rewrites /mcp, /healthz, /api/skills/* → api/index
Dockerfile          # for Fly.io / Railway / Render / self-host
```
