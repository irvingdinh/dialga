## User Flow

### Setup Flow

- User login with seeded account (no self-registration in MVP)
- User create “machine”, copy the API token and following the installing instruction
- User install the “machine agent” into their machine
- The machine connect to the server, doing the health check, ensure the AI agent is installed and ready to be used (Claude Code, Codex CLI)

### Generic Flow: Communicate via new thread

- User selects the machine, navigate to the thread list
- User type a message into the input area, then submit
- The agent got the message, put it into the task queue, then reply the thread with a new message (if no workspace is selected, the agent creates a temporary folder as the working dir)
    - The agent instruct the AI agent to read all the messages in the thread before working/answering
    - The agent keep the thread up-to-date by streaming the realtime JSONL from the AI agent

### Generic Flow: Workspace

- When creating a new thread, the user can select the “workspace” for that new thread.
- A workspace is an entity that has 2 important things
    - Working directory: the directory on the user machine, which can include the claude.md (or similar), skills, ongoing works, etc. to have the AI has its context already
    - Custom instruction: Just custom instruction
- If the user selects no workspace, the agent automatically creates an empty folder in `{tempdir}/dialga/workspaces/{thread_id}/` as the working dir. This is a one-off thread — nothing is persisted.

## Architecture Decisions

### Communication: Agent ↔ API

- Agent-initiated WebSocket connection to the API server
- Firewall-friendly: agent connects outbound, no port-forwarding needed
- Bidirectional & real-time: API pushes new tasks, agent streams JSONL responses back, over the same connection
- Agent authenticates with API token on connection
- Server maintains a registry of connected machines
- Nest.js has first-class WebSocket gateway support on both sides
- Raw WebSocket (`ws` library) — no socket.io. Standard RFC 6455, minimal overhead, easy to debug. API uses `@nestjs/platform-ws`, agent uses `ws` client.

### Concurrency Model

- Serial per workspace: threads targeting the same workspace are queued and processed one at a time to prevent file conflicts
- Parallel across workspaces: threads on different workspaces (or using temp folders) can run in parallel since they are isolated by directory
- Configurable global concurrency limit (default: 2-3) to prevent machine resource exhaustion
- UI shows clear "queued" / "running" status per message

### AI Agent Support

- Starting with two agents: **Claude Code** and **Codex CLI**
- Per-machine default, with per-workspace override
- Health check detects available agents, machine stores the list
- Adapter pattern internally: common interface (`startTask`, `streamOutput`, `cancel`) with per-tool implementations
- Early phase: run with permissive flags, to be tuned later

#### Claude Code

- Health check: `claude --version`
- Invocation: `claude --dangerously-skip-permissions --model {model} --output-format stream-json --verbose --print '{prompt}'`
- Output: stream-json (JSONL)

#### Codex CLI

- Health check: `codex --version`
- Invocation: `codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check --model {model} --config model_verbosity=high -C {working_directory} --json '{prompt}'`
- Output: JSONL

### Thread Context for Multi-Turn Conversations

- AI agents are invoked in stateless, one-shot mode (`--print` / `exec`), so the agent must provide conversation context externally
- Before each invocation, the agent writes/overrides the full thread history to a temp file:
  - Path: `{tempdir}/dialga/threads/{thread_id}.jsonl`
  - Format: JSONL (consistent with streaming output format)
- The prompt instructs the AI agent to read this file for prior conversation context
- Keeps the workspace clean — no meta files polluting the working directory
- OS handles temp file cleanup automatically
- Works identically across both Claude Code and Codex CLI (tool-agnostic)

#### Prompt Construction

Metadata and instructions live in the prompt itself. The context file is purely message history.

**Context file** (`{tempdir}/dialga/threads/{thread_id}.jsonl`) — fetched from API by agent via REST before each invocation:
```jsonl
{"role":"user","content":"first user message","timestamp":"..."}
{"role":"assistant","content":"AI response summary","timestamp":"..."}
{"role":"user","content":"second user message","timestamp":"..."}
```

- Agent fetches thread messages from API via `GET /api/threads/:threadId/messages.jsonl`
- Writes the response to the context file as-is
- One message per line, pure JSONL, easy to parse and debug

**Prompt template** (metadata, instruction, and structure all in the prompt):
```
You got a new message, read the message history then answer.

```plaintext
{latest_user_message}
```

The context is:

```json
{
  "custom_instruction": "workspace custom instruction here",
  "message_history": "{tempdir}/dialga/threads/{thread_id}.jsonl",
  "working_directory": "/path/to/workspace"
}
```

Your response construction is:

```plaintext
Respond directly to the user's message. Use the message history for context of the ongoing conversation.
```
```

- Prompt carries all metadata and instructions — self-contained
- Context file is just messages — simple JSONL, one message per line
- Clean separation: prompt = what to do, context file = conversation history
- Agent fetches messages via REST, not included in WebSocket `task:start` payload

### Data Model & Storage

#### API Server
- **MySQL** with **TypeORM** (Nest.js integration)
- **Redis** for ephemeral/real-time state (machine online status, WebSocket session mapping, task queue via BullMQ, pub/sub for streaming fan-out)
- Core entities:
  - User → has many Machines
  - Machine → has many Workspaces, has connection status
  - Workspace → has working_directory, custom_instruction, default_agent
  - Thread → belongs to Machine, optionally to Workspace
  - Message → belongs to Thread, has role (user/assistant), has content

#### Machine Agent
- **SQLite** for local persistence (task history, cached state, offline resilience)

### Real-Time Streaming Pipeline

#### Data flow
```
AI agent (stdout JSONL) → Machine agent (child process) → WebSocket → API server → SSE → UI browser
```

#### API → UI: Server-Sent Events (SSE)
- Dedicated SSE endpoints per resource type — UI only subscribes to what the current page needs
- REST for user actions (send message, create thread, manage workspaces, etc.)
- Nest.js native `@Sse()` support
- Redis-backed EventEmitter for broadcasting across multiple API instances

**SSE Endpoints:**
| Endpoint | Used on page | Events |
|---|---|---|
| `GET /api/machines/stream` | `/machines` | `machine:status` (online/offline changes) |
| `GET /api/machines/:machineId/threads/stream` | `/machines/:id/threads` | `thread:update` (new messages, status changes) |
| `GET /api/threads/:threadId/stream` | `/threads/:id` | `message:status`, `message:delta`, `message:complete` |

#### Persistence: Store meaningful events only
- **Persist to MySQL**: text content, tool calls, tool results, errors, final result
- **Skip**: progress ticks, token counting, heartbeats, noise
- Enables thread replay in the UI while keeping storage manageable
- **Write once on `task:complete`**: during streaming, events only flow through Redis Pub/Sub for SSE fan-out (ephemeral). On `task:complete`, API writes one Message row with assembled `content` and `metadata` JSON of all meaningful events
- If API crashes mid-stream: message stays in `running` status. Agent reports final result on reconnect via crash recovery
- Agent's SQLite serves as safety net for full task history

#### Fan-out
- Redis Pub/Sub to fan out live events from API to multiple UI connections viewing the same thread

### File & Code Access

- **Phase 1 (MVP):** Focus on thread messaging only. The streaming output renders tool calls, file diffs, and code blocks in the UI. Users access actual files via their existing tools (IDE, SSH, VS Code Remote, etc.)
- **Phase 2 (future):** Expand the file browser into a full lightweight file viewer alongside the thread
- **Phase 3 (future):** Optional git integration per workspace — show uncommitted changes, trigger commits via thread messages

### Remote Folder Picker

- UI provides a remote folder picker for selecting/creating workspace working directories
- Mechanism: UI → REST API → WebSocket → Agent reads filesystem → returns directory listing back through the chain
- Agent can also create new directories on request
- Eliminates directory validation problem — paths are always valid since they're picked from the real filesystem
- Machine must be online for workspace creation/editing (folder picker requires agent connection)

#### Additional WebSocket Events

**`fs:list`** (API → Agent)
```json
{
  "event": "fs:list",
  "data": { "request_id": "uuid", "path": "/home/user/projects" }
}
```

**`fs:list:result`** (Agent → API)
```json
{
  "event": "fs:list:result",
  "data": {
    "request_id": "uuid",
    "path": "/home/user/projects",
    "entries": [
      { "name": "myapp", "type": "directory" },
      { "name": "notes.md", "type": "file" }
    ]
  }
}
```

**`fs:mkdir`** (API → Agent)
```json
{
  "event": "fs:mkdir",
  "data": { "request_id": "uuid", "path": "/home/user/projects/new-project" }
}
```

**`fs:mkdir:result`** (Agent → API)
```json
{
  "event": "fs:mkdir:result",
  "data": { "request_id": "uuid", "success": true }
}
```

### WebSocket Request/Response Pattern

- Folder picker and other sync operations use a **request ID correlation with timeout** pattern
- API generates a `request_id` (UUID), sends event to agent, stores a pending Promise keyed by `request_id`
- Agent responds with result including the same `request_id`
- API resolves the matching Promise, returns result to UI via REST response
- 5-second timeout: if agent doesn't respond, reject with "machine not responding"
- Pattern is reusable for any future sync operations

### Authentication

#### User Authentication (UI → API)
- In-house email + password login (no registration, must be seeded)
- API verifies bcrypt hash, issues JWT access tokens (15min expiry) + refresh tokens (365 days), stored in HTTP-only cookies
- Auto-renewal: if access token expires but refresh token is valid, new access token is auto-generated
- OptionalAuthGuard + @CurrentUser() decorator pattern
- Stack: @nestjs/jwt + bcrypt + cookie-parser (no Firebase)
- No registration endpoint — users are seeded in the database
- Test account: john.doe@example.com / password
- Future: add external_id + external_provider columns for OAuth (Google, GitHub, etc.)

#### Machine Authentication (Agent → API)
- Static API token, generated server-side, shown once on creation, stored hashed (SHA256) in MySQL
- One token, two transports:
  - WebSocket: sent in the handshake query param (`wss://{server}/ws?token=xxx`)
  - REST: sent via `Authorization: Bearer <token>` header (for fetching thread messages, etc.)
- API reuses the same token validation logic (SHA256 hash lookup) for both WebSocket and REST
- API scopes queries: machine can only access threads/messages that belong to it (thread → machine_id must match)
- Support token regeneration (invalidates old token immediately)
- One token per machine

### Resilience & Disconnection Handling

#### Heartbeat
- Agent sends ping every 30s over WebSocket
- API marks machine "offline" after 3 missed pings (90s)
- UI reflects machine status change immediately

#### Reconnection
- Agent auto-reconnects with exponential backoff (1s → 2s → 4s → ... → 60s cap)
- On reconnect: re-authenticates and reports current state (idle / running task X)

#### Task Timeout
- Configurable per-thread timeout (default: 30 minutes)
- Agent kills AI child process if exceeded
- API marks task as "timed out" if agent goes offline mid-task without reporting completion

#### Cancellation
- User sends cancel via REST → API pushes cancel event over WebSocket → Agent sends SIGTERM to AI child process → streams final output → marks task cancelled

#### Crash Recovery
- Agent on startup checks SQLite for any "running" tasks from before crash
- Marks them as "interrupted"
- Reports status to API on reconnect

### AI Service API Keys

- Assume CLI tools (Claude Code, Codex CLI) are already configured with their respective API keys on the machine (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
- Health check validates that the CLI is functional (e.g., the PONG test)
- If the CLI is not properly configured, the agent reports an error and does not process the message
- No secret storage, proxy billing, or key transmission through the platform

### Model Selection

- Workspace config includes a `model` field as default (free text input, e.g., `haiku`, `sonnet`, `o3-mini`)
- User can override the model per-thread message (also free text input)
- Resolution chain: thread message → workspace default → machine default
- Agent substitutes the model into CLI invocation: `claude --model {model}` / `codex --model {model}`
- Free text entry — no hardcoded model list, so new models are supported immediately without platform updates

### Agent Distribution

- MVP: `npx @dialga/agent@latest --token xxx`
- Zero install, always runs latest version, single command
- Requires Node.js pre-installed (expected for target developer audience)
- CLI arguments:
  - `--token xxx` (required) — machine API token
  - `--server <url>` (optional) — API server URL
    - Default: `https://dialga.sh`
    - Development: `http://localhost:48310`

### Streaming Output & UI Rendering

- Display **everything** from the AI agent output: thinking/reasoning, text, tool calls, tool results, system events, errors
- Adapters normalize Claude Code and Codex CLI output into unified event types:

#### Claude Code Adapter Mapping

Real output format: JSONL with top-level `type` field (`system`, `assistant`, `user`, `rate_limit_event`, `result`). Content nested in `message.content[]` array.

| Raw event | Unified type | Key data to extract |
|---|---|---|
| `type: system, subtype: init` | skip | session_id, model (for logging) |
| `assistant → content[].type: thinking` | `thinking` | `thinking` text (strip signature) |
| `assistant → content[].type: text` | `text` | `text` value |
| `assistant → content[].type: tool_use` | `tool_call` | `name` (Write/Read/Bash/etc), `input` (file_path, content, command), `id` (for correlation) |
| `user → content[].type: tool_result` | `tool_result` | `content` text + `tool_use_result` structured data (file diffs, command output) |
| `rate_limit_event` | skip | |
| `type: result` | `result` | `total_cost_usd`, usage, `duration_ms` |

#### Codex CLI Adapter Mapping

Real output format: JSONL with `type` field (`thread.started`, `turn.started`, `item.completed`, `item.started`, `turn.completed`). Content in `item` object.

| Raw event | Unified type | Key data to extract |
|---|---|---|
| `thread.started` | skip | |
| `turn.started` | skip | |
| `item.completed, item.type: agent_message` | `text` or `thinking` | `text` value (see buffer logic below) |
| `item.completed, item.type: file_change` | `tool_call` | `changes[]` with path + kind (add/modify/delete) |
| `item.started, item.type: command_execution` | `tool_call` | `command` string, status in_progress |
| `item.completed, item.type: command_execution` | `tool_result` | `command`, `aggregated_output`, `exit_code` |
| `turn.completed` | `result` | `usage` tokens |

#### Codex Thinking Detection (One-Behind Buffer)

Codex has no explicit thinking blocks. Instead, `agent_message` items that precede tool actions are implicitly "thinking" (planning text), while the last `agent_message` before `turn.completed` is the actual response.

The adapter uses a **one-behind buffer** to classify in real-time:

```
let buffer: AgentMessage | null = null;

onEvent(event) {
  if (event is agent_message) {
    if (buffer) emit(buffer, 'text');    // flush previous as text
    buffer = event;                       // hold new one
  } else if (event is tool_action) {
    if (buffer) emit(buffer, 'thinking'); // followed by tool = thinking
    buffer = null;
    emit(event, 'tool_call' or 'tool_result');
  } else if (event is turn.completed) {
    if (buffer) emit(buffer, 'text');    // last message = final response
    buffer = null;
    emit(event, 'result');
  }
}
```

Delay is one event behind — barely noticeable since tool actions follow within milliseconds.

#### Unified Event Types

| Type | Description | UI Rendering |
|---|---|---|
| `thinking` | AI reasoning/thinking blocks | Collapsible block, muted/dimmed style |
| `text` | Text content (streaming) | Markdown-rendered, streams word by word |
| `tool_call` | AI initiates a tool (file edit, bash, etc.) | Card with tool name + file path + content (syntax-highlighted) |
| `tool_result` | Output of the tool execution | Nested under its tool_call, monospace for shell output |
| `system` | System messages, status updates | Small muted text |
| `error` | Errors from the AI agent | Red-highlighted block |
| `result` | Final summary, token usage, duration | Footer bar on the message |

#### SSE Event Format

All streaming events use a single `message:delta` event with a `type` discriminator:

```
event: message:delta
data: { "message_id": "...", "type": "thinking", "content": "Let me analyze this..." }

event: message:delta
data: { "message_id": "...", "type": "text", "content": "Here's how I'll fix..." }

event: message:delta
data: { "message_id": "...", "type": "tool_call", "tool": "edit_file", "file": "src/main.ts", "content": "diff content..." }

event: message:delta
data: { "message_id": "...", "type": "tool_result", "tool": "edit_file", "content": "File edited successfully" }

event: message:delta
data: { "message_id": "...", "type": "error", "content": "Command failed with exit code 1" }

event: message:delta
data: { "message_id": "...", "type": "result", "content": "Done", "metadata": { "tokens_used": 1234, "duration_ms": 5000 } }
```

- Show everything in phase 1 — evaluate noise level in real usage, selectively collapse/hide in future iterations
- Each adapter is responsible for mapping its CLI's native output format to these unified types
- `metadata` JSON column on Message entity stores all events for replay capability

### Deployment

- SaaS-first: hosted API + UI as a single service, users sign up and connect
- Likely deploying on Railway (API + MySQL + Redis)
- Multi-tenant from day one: all queries scoped by user ID
- Docker Compose as future self-hosting option
- No hard SaaS vendor lock-in in the API code — keep it portable

### In-Thread Message Queuing

- While a task is running, the user can still send new messages — they are queued
- UI shows the running task with a cancel button, and queued messages with a "waiting" indicator
- If the user cancels the running task, the next queued message processes (with full thread context including partial output from the cancelled task)
- Reuses the existing cancellation mechanism (REST → WebSocket → SIGTERM)

### Message Lifecycle

When a user sends a message in a thread:

1. API creates a **User Message** (role: `user`, status: `completed`, content: user's text)
2. API creates an **Assistant Message** (role: `assistant`, status: `queued`, content: empty)
3. API sends `task:start` to agent with the **assistant message's** `message_id`
4. Agent streams `task:output` events referencing that `message_id`
5. On `task:complete`: API updates the assistant Message with assembled `content`, `metadata`, and final `status`

- The `message_id` in all WebSocket/SSE events refers to the **assistant** message
- The user message is stored immediately and considered done
- Cancellation/timeout updates the **assistant** message status
- The UI tracks the assistant message_id from creation through streaming to completion

### Offline Machine Handling

- Messages are accepted and stored as `queued` regardless of machine status
- If machine is offline, UI shows a banner on the thread: "Machine is offline. Message will be processed when it reconnects."
- When machine reconnects, API checks for any `queued` messages on that machine's threads and dispatches them via `task:start`
- User can cancel queued messages at any time
- Machine list and thread header always show real-time online/offline status

### Local Development Workflow

- `make dev` (terminal 1): starts API (port 48310) + UI in parallel
- `make dev:agent` (terminal 2): starts agent with dev token and local server
  ```
  cd agent && bun run start -- --token dev-test-token --server http://localhost:48310
  ```
- Agent is kept separate from `make dev` to mirror the real topology (agent = remote machine)
- **Database seed**: on API startup in dev mode, auto-create:
  - Test user: john.doe@example.com / password (bcrypt hashed)
  - Test machine with known token `dev-test-token` (SHA256 hashed)
- This eliminates the chicken-and-egg problem — no manual setup needed for local development
- **Testing strategy**:
  - Use real AI agents (Claude Code, Codex CLI) for end-to-end testing — no mocked agents
  - API testing: `curl` for REST endpoints, `curl --no-buffer` for SSE streams
  - UI testing: `bun run build` for compile checks + Playwright headless for E2E smoke tests
  - Thorough testing is prioritized — time spent on careful testing is acceptable
- **Cleanup TODO**: remove Firebase from existing codebase:
  - API: remove `firebase-admin` dependency, remove `core/services/external/firebase.service.ts`
  - UI: remove `firebase` dependency, remove `lib/firebase.ts`

### Edge Cases

| Scenario | Behavior |
|---|---|
| User deletes a machine that has active threads | Soft delete machine. Threads become read-only. Queued messages are cancelled. |
| User deletes a workspace while a thread using it is running | Soft delete workspace. Running thread continues (it already has the cwd). New threads can't use it. |
| Agent receives `task:start` for a directory that no longer exists | Agent returns `task:complete` with status `error` and message "Directory not found". UI shows error in thread. |
| AI CLI exits with non-zero code (crash/error) | Agent captures stderr, sends `task:complete` with status `error`, includes stderr in metadata. |
| User sends an empty message | UI-side validation — block send if message is empty. |
| Two browser tabs open on the same thread | Both connect to the same SSE endpoint. Both receive streaming updates. No conflict. |
| Token regeneration while agent is connected | API closes existing WebSocket connection. Agent detects disconnect, tries reconnect with old token, fails auth. User must restart agent with new token. |
| Very long AI response (>100KB of output) | No artificial limit. Stream it all. Use MEDIUMTEXT/LONGTEXT for `content` and `metadata` columns. |

---

## MVP Specification

### Database Entities (API Server — MySQL + TypeORM)

#### User
| Column | Type | Notes |
|---|---|---|
| id | varchar(36) PK | UUIDv7 |
| email | varchar(255) UNIQUE | Login email |
| password_hash | varchar(255) | bcrypt hash |
| name | varchar(255) | Display name |
| external_id | varchar(255) NULL | Future: OAuth provider UID |
| external_provider | varchar(50) NULL | Future: `google`, `github`, etc. |
| created_at | datetime | |
| updated_at | datetime | |
| deleted_at | datetime NULL | Soft delete |

#### Machine
| Column | Type | Notes |
|---|---|---|
| id | varchar(36) PK | UUIDv7 |
| user_id | varchar(36) FK → User | Owner |
| name | varchar(255) | User-given name (e.g., "MacBook Pro", "Dev Server") |
| token_hash | varchar(255) | SHA256 hash of API token |
| default_agent | varchar(50) | `claude` or `codex` |
| default_model | varchar(100) NULL | Free text (e.g., `haiku`, `sonnet`) |
| status | enum | `online`, `offline` |
| last_seen_at | datetime NULL | Last heartbeat |
| created_at | datetime | |
| updated_at | datetime | |
| deleted_at | datetime NULL | Soft delete |

#### Workspace
| Column | Type | Notes |
|---|---|---|
| id | varchar(36) PK | UUIDv7 |
| machine_id | varchar(36) FK → Machine | |
| name | varchar(255) | User-given name |
| working_directory | varchar(1024) | Absolute path on the machine |
| custom_instruction | text NULL | Prepended to every prompt |
| agent | varchar(50) NULL | Override: `claude` or `codex` |
| model | varchar(100) NULL | Override: free text |
| created_at | datetime | |
| updated_at | datetime | |
| deleted_at | datetime NULL | Soft delete |

#### Thread
| Column | Type | Notes |
|---|---|---|
| id | varchar(36) PK | UUIDv7 |
| machine_id | varchar(36) FK → Machine | |
| workspace_id | varchar(36) FK → Workspace NULL | NULL = temp folder |
| title | text NULL | Full first user message, displayed as thread preview in list. User can rename. |
| status | enum | `active`, `archived` |
| created_at | datetime | |
| updated_at | datetime | |

#### Message
| Column | Type | Notes |
|---|---|---|
| id | varchar(36) PK | UUIDv7 |
| thread_id | varchar(36) FK → Thread | |
| role | enum | `user`, `assistant`, `system` |
| content | mediumtext | The message text |
| model | varchar(100) NULL | Model used for this message |
| status | enum | `queued`, `running`, `completed`, `cancelled`, `error`, `timed_out` |
| metadata | json NULL (LONGTEXT storage) | Raw AI output events, tool calls, token usage, etc. |
| started_at | datetime NULL | When the agent started processing |
| completed_at | datetime NULL | When the agent finished |
| created_at | datetime | |

#### RefreshToken
| Column | Type | Notes |
|---|---|---|
| id | varchar(36) PK | UUIDv7 |
| user_id | varchar(36) FK → User | |
| token_hash | varchar(255) | SHA256 of raw token |
| expires_at | datetime | |
| created_at | datetime | |

---

### API Endpoints (REST)

#### Utils
| Method | Path | Description |
|---|---|---|
| GET | /api/health | Health check (no auth) — returns 200 when API is ready |

#### Auth
| Method | Path | Description |
|---|---|---|
| POST | /api/auth/login | Email + password → JWT + refresh token (cookies) |
| GET | /api/auth | Get current session / user info |
| POST | /api/auth/logout | Clear cookies, invalidate refresh token |

#### Machines
| Method | Path | Description |
|---|---|---|
| GET | /api/machines | List user's machines |
| POST | /api/machines | Create machine → returns `{ id, token }` (token shown once) |
| GET | /api/machines/:id | Get machine details + status |
| PATCH | /api/machines/:id | Update name, default_agent, default_model |
| DELETE | /api/machines/:id | Soft delete machine |
| POST | /api/machines/:id/regenerate-token | Generate new token, invalidate old |
| GET | /api/machines/:machineId/fs?path= | List directory contents on machine (folder picker) |
| POST | /api/machines/:machineId/fs/mkdir | Create directory on machine |

#### Workspaces
| Method | Path | Description |
|---|---|---|
| GET | /api/machines/:machineId/workspaces | List workspaces for a machine |
| POST | /api/machines/:machineId/workspaces | Create workspace |
| PATCH | /api/workspaces/:id | Update workspace config |
| DELETE | /api/workspaces/:id | Soft delete workspace |

#### Threads
| Method | Path | Description |
|---|---|---|
| GET | /api/machines/:machineId/threads | List threads (optionally filter by workspace) |
| POST | /api/machines/:machineId/threads | Create thread (with optional workspace_id) |
| GET | /api/threads/:id | Get thread details |
| DELETE | /api/threads/:id | Delete thread |

#### Messages
| Method | Path | Description |
|---|---|---|
| GET | /api/threads/:threadId/messages | List messages in thread |
| POST | /api/threads/:threadId/messages | Send new user message → queues task |
| POST | /api/messages/:id/cancel | Cancel a running/queued message |
| GET | /api/threads/:threadId/messages.jsonl | Get thread messages as JSONL (used by agent for context file) |

#### Streaming
| Method | Path | Description |
|---|---|---|
| GET | /api/machines/stream | SSE — machine status changes (online/offline) |
| GET | /api/machines/:machineId/threads/stream | SSE — thread updates for a machine |
| GET | /api/threads/:threadId/stream | SSE — message streaming for a thread |

---

### WebSocket Protocol (Agent ↔ API)

#### Connection
- Endpoint: `wss://{server}/ws?token=<machine_api_token>` (default: `wss://dialga.sh/ws`, dev: `ws://localhost:48310/ws`)
- On connect: API validates token, marks machine `online`, registers socket

#### Events: API → Agent

**`task:start`** — New message to process
```json
{
  "event": "task:start",
  "data": {
    "message_id": "uuid",
    "thread_id": "uuid",
    "prompt": "user's message text",
    "agent": "claude",
    "model": "haiku",
    "working_directory": "/path/to/workspace",
    "custom_instruction": "optional instruction text"
  }
}
```

**`task:cancel`** — Cancel a running task
```json
{
  "event": "task:cancel",
  "data": {
    "message_id": "uuid"
  }
}
```

#### Events: Agent → API

**`task:output`** — Streaming output event
```json
{
  "event": "task:output",
  "data": {
    "message_id": "uuid",
    "type": "thinking | text | tool_call | tool_result | system | error",
    "content": "..."
  }
}
```

**`task:complete`** — Task finished
```json
{
  "event": "task:complete",
  "data": {
    "message_id": "uuid",
    "status": "completed | error | cancelled | timed_out",
    "summary": "final text content",
    "metadata": { "tokens_used": 1234, "duration_ms": 5000 }
  }
}
```

**`health:report`** — On connect and periodically
```json
{
  "event": "health:report",
  "data": {
    "agents": {
      "claude": { "available": true, "version": "1.0.0" },
      "codex": { "available": false, "error": "not installed" }
    },
    "running_tasks": ["message_id_1"],
    "os": "darwin",
    "node_version": "v22.0.0"
  }
}
```

**`heartbeat`** — Every 30s
```json
{
  "event": "heartbeat"
}
```

---

### SSE Events (API → UI)

#### `GET /api/machines/stream` (used on `/machines` page)
| Event | Data | Description |
|---|---|---|
| `machine:status` | `{ machine_id, status, last_seen_at }` | Machine online/offline change |

#### `GET /api/machines/:machineId/threads/stream` (used on `/machines/:id/threads` page)
| Event | Data | Description |
|---|---|---|
| `thread:update` | `{ thread_id, latest_message_preview, status, updated_at }` | Thread has new activity |

#### `GET /api/threads/:threadId/stream` (used on `/threads/:id` page)
| Event | Data | Description |
|---|---|---|
| `message:status` | `{ message_id, status }` | Status change (queued→running→completed) |
| `message:delta` | `{ message_id, type, content }` | Streaming text/tool/thinking output |
| `message:complete` | `{ message_id, status, summary, metadata }` | Task finished |

---

### UI Pages (Vite + React)

#### Strategy
- **Mobile-first**: optimize for mobile usage
- **Desktop**: centered narrow content column to match mobile layout (no wide desktop layouts)
- **Screen-based navigation**: every view is a full screen, linear drill-down flow
- Navigation: Machines → Threads → Messages (each a full screen)

#### `/login`
- Simple email + password form
- On success: POST /api/auth/login with email + password → receives JWT cookies

#### `/machines`
- Full screen: list of user's machines
- Each item shows: name, online/offline status indicator, default agent
- "Create Machine" button → modal with name + agent selection
- On create: show token + install command (`npx @dialga/agent@latest --token xxx`) with copy button
- Tap machine → navigate to `/machines/:id/threads`

#### `/machines/:id/settings`
- Machine details: name, default agent, default model, last seen
- "Regenerate Token" button
- Workspace management: list, create, edit, delete
- Workspace form: name, working directory (remote folder picker), custom instruction, agent override, model override

#### `/machines/:id/threads`
- Full screen: list of threads sorted by updated_at DESC
- Each item shows: title (or first message preview), workspace name, status badge, timestamp
- Filter by workspace (dropdown)
- "New Thread" button → select workspace (optional) → creates thread → navigate to thread
- If machine is offline, show status banner at top

#### `/threads/:id`
- Full screen: chat interface
- Messages list sorted DESC (newest at top), streaming output rendered with unified event types (thinking, text, tool calls, tool results, errors, result)
- Each message shows: role badge (user/assistant), content (markdown rendered, syntax-highlighted code), status badge, timestamp
- Running message: cancel button + streaming indicator
- Queued messages: "waiting" badge
- If machine is offline: banner "Machine is offline. Message will be processed when it reconnects."
- Input area at bottom: text input + model override field (optional) + send button
- Input remains enabled while AI is working (messages get queued)

---

### Agent Modules (Nest.js)

#### CLI Entry Point (`bin/dialga-agent`)
- Parse `--token` and `--server` arguments
- Bootstrap Nest.js app (HTTP server kept for future local control pane)
- Store token in memory, connect WebSocket to `{server}`

#### WebSocketService
- Connect to `wss://{server}/ws?token=xxx`
- Handle reconnection with exponential backoff
- Send heartbeat every 30s
- Route incoming events to TaskService

#### HealthCheckService
- On startup and on-demand: run `claude --version`, `codex --version`
- Run PONG test for each available agent
- Report results via `health:report` event

#### TaskService
- Receive `task:start` → queue task
- Manage concurrency: serial per working_directory, parallel across directories
- Spawn AI CLI as child process with correct working directory, `model`, and prompt (Claude uses `cwd`, Codex uses `-C` flag)
- Fetch thread messages via REST (`GET /api/threads/:threadId/messages.jsonl`), write to `{tempdir}/dialga/threads/{thread_id}.jsonl`
- Parse stdout JSONL and emit `task:output` events via adapters
- Handle `task:cancel` → SIGTERM child process
- Handle timeout → kill child process after configured duration
- On completion → emit `task:complete`

#### AdapterInterface
- `startTask(config): ChildProcess` — spawn the CLI
- `parseOutput(line: string): OutputEvent` — parse a line of stdout
- `cancel(process: ChildProcess): void` — send SIGTERM

#### ClaudeAdapter
- Implements AdapterInterface
- Command: `claude --dangerously-skip-permissions --model {model} --output-format stream-json --verbose --print '{prompt}'`
- Parses stream-json JSONL lines

#### CodexAdapter
- Implements AdapterInterface
- Command: `codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check --model {model} --config model_verbosity=high -C {working_directory} --json '{prompt}'`
- Parses JSONL output
- One-behind buffer for thinking detection

#### SQLite (local)
- Task history: message_id, status, started_at, completed_at
- Used for crash recovery: detect "running" tasks on startup → mark interrupted

---

### Build Order

#### Phase 1: API Foundation
0. Cleanup: remove Firebase from API (`firebase-admin`, `firebase.service.ts`) and UI (`firebase`, `lib/firebase.ts`)
1. Project setup: Nest.js, TypeORM, MySQL connection
2. Utils module: health check endpoint (`GET /api/health`)
3. Entity definitions (User, Machine, Workspace, Thread, Message, RefreshToken)
4. Auth module (email/password + bcrypt + JWT + refresh tokens)
5. Machine CRUD endpoints
6. Workspace CRUD endpoints

#### Phase 2: Agent Foundation
1. Project setup: Nest.js, CLI entry point with `--token` and `--server`
2. WebSocket client service (connect, heartbeat, reconnection)
3. Health check service (claude/codex version + PONG test)
4. Adapter interface + Claude adapter + Codex adapter

#### Phase 3: Core Loop
1. API: Thread + Message CRUD endpoints
2. API: WebSocket gateway for agents (accept connections, route task:start/cancel)
3. Agent: TaskService (receive tasks, spawn CLI, stream output, manage concurrency)
4. Agent: Thread context file writing
5. API: Message status management (queued → running → completed)

#### Phase 4: Real-Time Streaming
1. API: Redis Pub/Sub setup for streaming events
2. API: SSE endpoint for threads
3. Agent → API: stream task:output events over WebSocket
4. API: fan out events via Redis → SSE to UI

#### Phase 5: UI
1. Project setup: Vite + React
2. Auth flow (email/password form + login endpoint)
3. Machine list + create machine flow (show token)
4. Workspace management
5. Thread list + create thread
6. Thread chat view: message list + send message
7. SSE integration: streaming output, status updates
8. Cancel button + queued message indicators

#### Phase 6: Polish
1. Error handling across all layers
2. Machine online/offline status in UI
3. Thread title: full first user message, user can rename
4. Loading states, empty states, error states in UI
5. Basic responsive design
