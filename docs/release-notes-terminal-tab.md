# Release Notes — Terminal Tab (Chaterm Integration)

## New Features

### Terminal Tab

A new **Terminal** tab has been added to Raven's main sidebar, providing an integrated SSH terminal experience powered by [Chaterm](https://github.com/visiontrail/ChatermForRaven).

**What's new:**

- **SSH connections** — Connect to remote servers using password or key-based authentication directly from within Raven
- **SFTP / file transfers** — Upload and download files over SFTP without leaving the app
- **Bastion host support** — Multi-hop SSH via jump servers
- **Kubernetes exec** — Attach to running pods with `kubectl exec`
- **AI in the terminal** — Use Chaterm's AI assistant to generate commands, explain errors, and automate tasks. No separate AI configuration needed — the terminal uses your existing Raven model settings

### AI Model Reuse (`terminal.enabled`)

The Terminal tab's AI features automatically use the LLM provider and model you have configured in **Raven Settings → Models**. Token usage from terminal AI interactions appears in Raven's usage statistics labelled `source: chaterm`.

**Settings:**

| Setting | Description |
|---------|-------------|
| `terminal.enabled` | Show or hide the Terminal tab (default: `true`). Disabling the tab disconnects active SSH sessions. |

## Configuration

No configuration is required. Open the Terminal tab from the sidebar and begin connecting to remote hosts.

To manage sidebar visibility: **Settings → Display → Sidebar icons**.

## Known Limitations

- The Terminal tab requires Chaterm build artifacts shipped with Raven. Development builds without a Chaterm build show a "Coming soon" placeholder.
- Models without tool-calling capability cannot run Chaterm's agent loop. A notice is displayed in the terminal if your current model does not support tool use.
- Raven's MCP server configurations are not shared with the terminal in this release.
- Theme and language in the terminal follow Raven's global settings; the terminal's own theme/language controls are hidden.
