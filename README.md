# discord-use

Discord user-account research + Jev triage via Vercel AI Gateway.
Works three ways: **OpenCode plugin**, **MCP server** (any agent host), **CLI** (humans + scripts).

## Tools (all three surfaces)

| Tool | What |
|---|---|
| `discord_list_guilds` | List servers visible to the account |
| `discord_list_channels` | List text channels in a guild |
| `discord_read_history` | Read channel history (paginate with `before`) |
| `discord_search` | Full-text search within a guild |
| `discord_research` | Pull history → Jev ranks relevance → top hits + done-check |
| `discord_route` | Jev picks which channel to dig next |

## Setup

```bash
npm install
npm run build
cp .env.example .env  # fill DISCORD_TOKEN + AI_GATEWAY_API_KEY
```

## Env

- `DISCORD_TOKEN` — user account token (NOT a bot token). Never commit.
- `AI_GATEWAY_API_KEY` — Vercel gateway key; Jev is called through `https://ai-gateway.vercel.sh/typesafe`

## Use 1 — OpenCode plugin

```json
{ "plugin": ["file://./src/index.ts"] }
```

## Use 2 — MCP server (Claude Code, Cursor, Windsurf, Cline, ...)

```bash
node dist/mcp.js   # stdio
```

```json
{ "mcpServers": { "discord-use": { "command": "node", "args": ["/abs/path/dist/mcp.js"] } } }
```

## Use 3 — CLI

```bash
node dist/cli.js guilds
node dist/cli.js channels <guildId>
node dist/cli.js history <channelId> [--limit N] [--before ID]
node dist/cli.js search <guildId> <query...>
node dist/cli.js research <channelId> <query...> [--limit N] [--topK N]
node dist/cli.js route <goal> <candidatesJson>
# or: npm link && discord-use guilds
```

## Notes

User tokens + automation sit against Discord ToS. Read-only, low volume, private research is the safe lane.
