# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Development Commands

### Environment Setup

- **Prerequisites**: Node.js v22.x.x or higher, Yarn 4.9.1
- **Setup Yarn**: `corepack enable && corepack prepare yarn@4.9.1 --activate`
- **Install Dependencies**: `yarn install`

### Development

- **Start Development**: `yarn dev` - Runs Electron app in development mode
- **Debug Mode**: `yarn debug` - Starts with debugging enabled, use chrome://inspect

### Testing & Quality

- **Run Tests**: `yarn test` - Runs all tests (Vitest)
- **Run E2E Tests**: `yarn test:e2e` - Playwright end-to-end tests
- **Type Check**: `yarn typecheck` - Checks TypeScript for both node and web
- **Lint**: `yarn lint` - ESLint with auto-fix
- **Format**: `yarn format` - Prettier formatting

### Build & Release

- **Build**: `yarn build` - Builds for production (includes typecheck)
- **Platform-specific builds**:
  - Windows: `yarn build:win`
  - macOS: `yarn build:mac`
  - Linux: `yarn build:linux`

## Architecture Overview

### Electron Multi-Process Architecture

- **Main Process** (`src/main/`): Node.js backend handling system integration, file operations, and services
- **Renderer Process** (`src/renderer/`): React-based UI running in Chromium
- **Preload Scripts** (`src/preload/`): Secure bridge between main and renderer processes

### Key Architectural Components

#### Main Process Services (`src/main/services/`)

- **MCPService**: Model Context Protocol server management
- **KnowledgeService**: Document processing and knowledge base management
- **FileStorage/S3Storage/WebDav**: Multiple storage backends
- **WindowService**: Multi-window management (main, mini, selection windows)
- **ProxyManager**: Network proxy handling
- **SearchService**: Full-text search capabilities
- **RavenLLMBridgeService**: LLM bridge exposing `raven:llm:*` IPC channels to trusted webview consumers (e.g. embedded Chaterm); manages sender allowlist and request lifecycle
- **ChatermProcessService**: Lifecycle management for the embedded Chaterm SSH terminal; validates resources at `resources/chaterm/`, registers the `raven-chaterm://` protocol, and gates the Terminal tab on asset availability

#### AI Core (`src/renderer/src/aiCore/`)

- **Middleware System**: Composable pipeline for AI request processing
- **Client Factory**: Supports multiple AI providers (OpenAI, Anthropic, Gemini, etc.)
- **Stream Processing**: Real-time response handling

#### State Management (`src/renderer/src/store/`)

- **Redux Toolkit**: Centralized state management
- **Persistent Storage**: Redux-persist for data persistence
- **Thunks**: Async actions for complex operations

#### Knowledge Management

- **Embeddings**: Vector search with multiple providers (OpenAI, Voyage, etc.)
- **OCR**: Document text extraction (system OCR, Doc2x, Mineru)
- **Preprocessing**: Document preparation pipeline
- **Loaders**: Support for various file formats (PDF, DOCX, EPUB, etc.)

### Build System

- **Electron-Vite**: Development and build tooling (v5.0.0); Electron pinned to 41.3.0 to match embedded Chaterm runtime
- **Rolldown-Vite**: Using experimental rolldown-vite instead of standard vite
- **Workspaces**: Monorepo structure with `packages/` directory
- **Multiple Entry Points**: Main app, mini window, selection toolbar
- **Styled Components**: CSS-in-JS styling with SWC optimization

### Testing Strategy

- **Vitest**: Unit and integration testing
- **Playwright**: End-to-end testing
- **Component Testing**: React Testing Library
- **Coverage**: Available via `yarn test:coverage`

#### Chaterm Embedding (`third_party/ChatermForRaven/`)

Chaterm is an AI-native SSH terminal (Vue 3 + Electron) embedded as a `<webview>` in Raven's Terminal tab (`/terminal`). Key design points:

- **IPC namespaces**: `raven:llm:*` / `raven:ui:*` (Raven → Chaterm bridge); `chaterm:*` (Chaterm internal — sender-validated)
- **LLM bridge**: Chaterm's AI calls are routed through `RavenLLMBridgeService` so Raven's AiProvider config (API keys, model selection) is reused — Chaterm never manages its own provider credentials in embedded mode
- **Resource path**: Chaterm build artifacts are placed in `resources/chaterm/` at package time; loaded via the `raven-chaterm://` custom protocol
- **Chaterm preload**: `resources/chaterm/preload.js` exposes `window.ravenLLM` and `window.ravenUI` to the Chaterm renderer

### Key Patterns

- **IPC Communication**: Secure main-renderer communication via preload scripts
- **Service Layer**: Clear separation between UI and business logic
- **Plugin Architecture**: Extensible via MCP servers and middleware
- **Multi-language Support**: i18n with dynamic loading
- **Theme System**: Light/dark themes with custom CSS variables

## Logging Standards

### Usage

```typescript
// Main process
import { loggerService } from '@logger'
const logger = loggerService.withContext('moduleName')

// Renderer process (set window source first)
loggerService.initWindowSource('windowName')
const logger = loggerService.withContext('moduleName')

// Logging
logger.info('message', CONTEXT)
logger.error('message', new Error('error'), CONTEXT)
```

### Log Levels (highest to lowest)

- `error` - Critical errors causing crash/unusable functionality
- `warn` - Potential issues that don't affect core functionality
- `info` - Application lifecycle and key user actions
- `verbose` - Detailed flow information for feature tracing
- `debug` - Development diagnostic info (not for production)
- `silly` - Extreme debugging, low-level information
