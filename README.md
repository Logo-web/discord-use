# discord-use

OpenCode plugin: Discord user-account research + Jev triage via Vercel AI Gateway.

## Tools

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
cp .env.example .env  # fill DISCORD_TOKEN + AI_GATEWAY_API_KEY
```

## Env

- `DISCORD_TOKEN` — user account token (NOT a bot token)
- `AI_GATEWAY_API_KEY` — Vercel gateway key (`vck_...`); Jev is called through `https://ai-gateway.vercel.sh/typesafe`

## opencode

```json
{ "plugin": ["file://./src/index.ts"] }
```

## Notes

User tokens + automation sit against Discord ToS. Read-only, low volume, private research is the safe lane.
