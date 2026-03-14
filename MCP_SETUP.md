# Using Reporium as an MCP Server

Add to your Claude Desktop config (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "reporium": {
      "command": "npx",
      "args": ["tsx", "/path/to/reporium/src/mcp/index.ts"],
      "env": {
        "LIBRARY_PATH": "/path/to/reporium/public/data/library.json"
      }
    }
  }
}
```

Then ask Claude:
- "What repos do I have for building RAG systems?"
- "Which of my forks are most outdated?"
- "What's the most starred repo in my robotics collection?"
- "Find repos related to agent memory"
