## ADDED Requirements

### Requirement: Agents tab presents AIService Agent workbench
The system SHALL present the Raven Client `/agents` route as an AIService Agent workbench with first-class entries for Log Analysis Agent and Project Expert Agent.

#### Scenario: Open Agents tab
- **WHEN** the user navigates to `/agents`
- **THEN** the system displays Agent choices for Log Analysis and Project Expert instead of only displaying prompt-template cards

#### Scenario: Access existing template agents
- **WHEN** the user needs the previous prompt-template Agent functionality
- **THEN** the system provides a secondary template-assistant entry that preserves add, import, manage, and create-assistant behavior for existing user Agents

### Requirement: Workbench uses local IP RavenAIService endpoint
The system SHALL connect to RavenAIService through the locally configured host and port during the testing phase, with no production service URL hard-coded in the Agent workbench.

#### Scenario: Build AIService base URL
- **WHEN** the workbench initializes its API client
- **THEN** the system builds the base URL from `ConfigManager.getRavenAIServiceHost()` and `ConfigManager.getRavenAIServicePort()`

#### Scenario: Use default local test endpoint
- **WHEN** no RavenAIService host has been explicitly configured
- **THEN** the system uses the existing local test default host and port returned by `ConfigManager`, currently `10.60.11.3:8085`

#### Scenario: Display connection target
- **WHEN** the workbench renders
- **THEN** the system displays the current RavenAIService base URL or connection identity so testers can verify they are targeting the local IP service

### Requirement: Workbench supports AIService authentication token
The system SHALL support an optional RavenAIService bearer token for Agent API requests.

#### Scenario: Token configured
- **WHEN** a RavenAIService token is configured
- **THEN** the system includes `Authorization: Bearer <token>` in project list, stream, cancel, result, and run-subscription requests where applicable

#### Scenario: Token missing or rejected
- **WHEN** RavenAIService returns 401 or 403 for an Agent request
- **THEN** the system shows a clear authentication error that instructs the tester to configure or refresh the local RavenAIService token

### Requirement: Workbench lists enabled project repositories
The system SHALL load project repository options from RavenAIService and use those options for project-bound Agent runs.

#### Scenario: Load project repository options
- **WHEN** the workbench starts or the user refreshes project choices
- **THEN** the system calls `GET /api/v1/project-repos` on the configured RavenAIService endpoint and displays enabled repositories with project name, project code, default branch, and description when available

#### Scenario: Project repository list unavailable
- **WHEN** the project repository list request fails
- **THEN** the system keeps the workbench usable for non-project-required operations and shows a retryable error near the project selector

### Requirement: Project Expert Agent requires a selected project repository
The system SHALL require a selected AIService project repository before starting a new Project Expert Agent run.

#### Scenario: Start Project Expert without project
- **WHEN** the user selects Project Expert and submits a question without selecting a project repository
- **THEN** the system blocks submission and prompts the user to select a project first

#### Scenario: Start Project Expert with project
- **WHEN** the user selects Project Expert, selects a project repository, and submits a question
- **THEN** the system sends a multipart `POST /api/v1/ai-chat/project-expert/stream` request with `message`, `session_id`, `remember`, optional `history`, and `project_repo_id`

### Requirement: Log Analysis Agent supports log file upload
The system SHALL allow the user to run Log Analysis Agent with a question and an optional log file attachment.

#### Scenario: Start Log Analysis with file
- **WHEN** the user selects Log Analysis, attaches a log file or archive, and submits a question
- **THEN** the system sends a multipart `POST /api/v1/ai-chat/log-analysis/stream` request with `message`, `session_id`, `remember`, optional `history`, optional `project_repo_id`, and the selected `file`

#### Scenario: Start Log Analysis without message but with file
- **WHEN** the user selects Log Analysis, attaches a log file, and submits with an empty message
- **THEN** the system sends the request using a default log-analysis question

#### Scenario: Preserve failed upload input
- **WHEN** the log-analysis request fails before the backend accepts the run
- **THEN** the system keeps the selected file available for retry

### Requirement: Workbench consumes AIService SSE runs
The system SHALL parse AIService `text/event-stream` responses from Agent stream endpoints and update the active run state incrementally.

#### Scenario: Receive session and run identifiers
- **WHEN** an SSE frame contains `session_id` or `run_id`
- **THEN** the system stores those identifiers and uses the stable `run_id` for later run subscription or cancellation when available

#### Scenario: Receive answer delta
- **WHEN** an SSE frame carries an Agent trace `answer_delta`
- **THEN** the system appends the text chunk to the visible assistant answer in order

#### Scenario: Receive terminal event
- **WHEN** an SSE frame carries `done`, `run_complete`, `cancelled`, or `error`
- **THEN** the system marks the run as succeeded, cancelled, or failed according to the event payload

### Requirement: Workbench displays Agent trace
The system SHALL render AIService Agent trace events so users can inspect the Agent loop.

#### Scenario: Tool step events arrive
- **WHEN** the stream emits `step_start`, `step_delta`, and `step_end` trace events
- **THEN** the system displays the tool name, status, input summary, output excerpt, and duration in the trace panel

#### Scenario: Thinking and system notices arrive
- **WHEN** the stream emits `thinking_*` or `system_notice` trace events
- **THEN** the system records and displays them in chronological order without blocking answer rendering

#### Scenario: Trace panel is optional
- **WHEN** the user collapses the trace panel
- **THEN** the system continues collecting trace events and keeps the answer stream visible

### Requirement: Workbench supports cancel and retry
The system SHALL let the user cancel a running Agent run and retry failed or cancelled submissions.

#### Scenario: Cancel after run_id is known
- **WHEN** the user cancels a running Agent run after `run_id` has been received
- **THEN** the system calls `POST /api/v1/ai-chat/chat/runs/{run_id}/cancel`

#### Scenario: Cancel before run_id is known
- **WHEN** the user cancels a running Log Analysis or Project Expert request before `run_id` has been received
- **THEN** the system calls the corresponding session cancel endpoint with `{ "session_id": "<current session id>" }`

#### Scenario: Retry failed run
- **WHEN** a run fails before completion
- **THEN** the system allows the user to retry with the same Agent type, message, selected project repository, and selected file when applicable

### Requirement: Workbench handles connection and backend errors
The system SHALL distinguish local AIService connection failures, authentication failures, validation failures, and Agent runtime failures.

#### Scenario: Local AIService unavailable
- **WHEN** the configured local IP RavenAIService cannot be reached
- **THEN** the system shows a connection error that includes the target base URL and offers a retry action

#### Scenario: Project Expert backend rejects missing project
- **WHEN** RavenAIService returns `project_repo_required`
- **THEN** the system shows a project-selection error and keeps the current question intact

#### Scenario: SSE closes without terminal event
- **WHEN** the SSE connection closes while the run is still non-terminal
- **THEN** the system keeps the run resumable or queryable using the stored `session_id` and `run_id` when available

### Requirement: Workbench authenticates against RavenAIService
The system SHALL let the user sign in to the local RavenAIService so the workbench can reuse the user's server-side chat history.

#### Scenario: Sign in with credentials
- **WHEN** the user submits a username and password in the workbench login form
- **THEN** the system calls `POST /api/v1/users/auth/login`, stores the returned bearer token via the RavenAIService config, and uses it for subsequent session, message, stream, cancel, and result requests

#### Scenario: Not signed in
- **WHEN** no RavenAIService token is available
- **THEN** the system shows a login prompt and keeps the conversation history empty until the user signs in

#### Scenario: Sign out
- **WHEN** the user signs out
- **THEN** the system clears the stored token and returns to the login prompt

### Requirement: Sidebar selects agent and lists its conversation history
The system SHALL present a left sidebar that lets the user pick an Agent and shows that Agent's past conversations.

#### Scenario: Switch agent
- **WHEN** the user selects an Agent in the sidebar (Log Analysis, Project Expert, or Package Search)
- **THEN** the system filters the conversation history list to sessions whose latest run used that Agent and targets new conversations at that Agent

#### Scenario: Open a past conversation
- **WHEN** the user selects a conversation from the history list
- **THEN** the system loads that session's messages from `GET /api/v1/users/chat-sessions/{id}/messages` and renders the full multi-turn thread

#### Scenario: Start a new conversation
- **WHEN** the user clicks new conversation
- **THEN** the system clears the chat panel, keeps the selected Agent, and starts a fresh session id on the next send

#### Scenario: Manage a conversation
- **WHEN** the user renames, pins, or deletes a conversation
- **THEN** the system calls the corresponding `chat-sessions` endpoint and refreshes the sidebar list

### Requirement: Workbench supports continuous multi-turn conversation
The system SHALL support multiple turns within a single conversation, mirroring the RavenAIService chat window.

#### Scenario: Send a follow-up turn
- **WHEN** the user sends another message in an existing conversation
- **THEN** the system reuses the same `session_id`, includes prior turns as `history`, appends the new user message and a streamed assistant answer to the thread

#### Scenario: Resume an in-flight run after switching back
- **WHEN** the user reopens a conversation whose run is still running
- **THEN** the system queries the active-run snapshot and re-subscribes to the run stream so the thread keeps updating

### Requirement: Package Search Agent runs as a project-bound conversation
The system SHALL support a Package Search Agent that shares the project-bound conversation contract.

#### Scenario: Start Package Search with project
- **WHEN** the user selects Package Search, selects a project repository, and submits a question
- **THEN** the system sends a multipart `POST /api/v1/ai-chat/package-search/stream` request with `message`, `session_id`, `remember`, optional `history`, and `project_repo_id`

#### Scenario: Start Package Search without project
- **WHEN** the user submits a Package Search question without selecting a project repository
- **THEN** the system blocks submission and prompts the user to select a project first
