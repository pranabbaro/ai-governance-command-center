# v12.9.1 — Project Management Lifecycle Rename

Only the visible integrated application name was changed from **Project Command Center** to **Project Management Lifecycle**.

No existing application behavior, integration URL, Moveworks backend, Incident SLA Intelligence, DevOps Governance, RCA, robot, Command Center logic, or presentation functionality was changed.

---

# v12.9.0 — Project Command Center Integration

A separate Project Command Center card has been added under the AI Governance Command Center.

Integration model:
- The Project Command Center remains independently hosted in Azure App Service.
- Its existing Moveworks Agent backend remains unchanged.
- The AI Governance app provides an embedded view plus an "Open in new tab" fallback.
- Existing Incident SLA Intelligence, DevOps Governance, RCA, robot, and presentation functionality are unchanged.

Hosted application:
https://projectpilot-ai-mvp-bhf0apataxa5cphp.centralindia-01.azurewebsites.net/#dashboard

Note: embedded iframe display depends on the hosted Project Command Center allowing framing through its CSP / X-Frame-Options headers. The "Open in new tab" option works independently of iframe support.

---

# v12.8.1 — Command Center Cleanup

Removed the AI Governance Assistant card from Command Center.
The front-page AI Operations Agent and the dedicated Ask Governance AI experience remain available.
Incident SLA Intelligence and DevOps Governance changes are preserved.

---

# v12.8.0 — Incident SLA Intelligence + Unified Command Center AI

Changes:
- Renamed SLA Intelligence to Incident SLA Intelligence.
- Removed the Ageing Tickets navigation tab.
- Command Center AI Governance Assistant now uses the same local operational logic and Moveworks `/api/ai/query` path as the front-page AI Operations Agent.
- Command Center assistant can answer embedded incident RCA and DevOps/KPI questions without leaving Command Center.
- Added voice input and read-aloud controls to the Command Center assistant.
- Breached incident quick buttons now answer inside the Command Center assistant.

---

# v12.7.1 — DevOps Visual Hierarchy

DevOps Governance now defaults to a real hierarchy view:
EPIC → Feature → User Story → Task

A separate Governance List view preserves the filtering/compliance table.
Reassignment and Ask AI remain available on each hierarchy node.

---

# v12.7.0 — DevOps Mock MVP + Reassignment

Adds a realistic mock Azure DevOps hierarchy for demo use when no live DevOps items are returned:
- Epics, Features, User Stories, Tasks
- Compliance score and missing-field governance
- Type/compliance/search filters
- Mock owner reassignment
- Local robot answers for DevOps hygiene and non-compliant items

Mock reassignment updates the browser state for the demo only. It does not write to Azure DevOps.
A production implementation should use the Azure DevOps Work Item REST API through the governed backend.

---

# v12.6.0 — SLA Filters + Reassignment

SLA Intelligence now supports:
- Status filtering
- Assignment-group filtering
- Incident/group/assignee search
- Clear filters
- Reassign action on each incident card

Reassignment is sent to `/api/tickets/:id/assign` and then through `MOVEWORKS_ASSIGN_URL`.
The API accepts either `assignment_group`, `assignee`, or both, plus an optional `reason`.
ServiceNow remains the system of record.

---

# v12.5.1 — Robot Embedded RCA Fix

The robot now recognizes natural incident RCA questions such as:

- Give me RCA for INC5784096
- Why is INC5784096 breached?
- Why did INC5784096 breach SLA?
- Tell me why SLA is breached for INC5784096
- Explain INC5784096 SLA breach
- Analyze INC5784096

The preferred RCA source is the RCA already embedded in the latest SLA_Governance dashboard snapshot.
`MOVEWORKS_RCA_URL` is not required for this path.

---

# v12.5.0 — RCA embedded in breached incidents

The dashboard now supports compact RCA data returned inside each `breached_incidents` record.

Supported fields per incident:

```json
{
  "incident_number": "INC5784096",
  "rca_summary": "Delayed ownership after reassignment.",
  "likely_root_cause": "Incorrect resolver-group routing.",
  "contributing_factors": ["Multiple reassignments", "No update during critical SLA window"],
  "corrective_action": "Assign to the correct resolver group and escalate.",
  "preventive_action": "Escalate automatically at 75% and 90% SLA consumption.",
  "confidence": "Medium",
  "evidence": ["Assignment changed twice before breach"]
}
```

The SLA Intelligence page shows **View RCA** for incidents that contain RCA data. The robot can also answer
`Give me RCA for INC...` from the already-loaded dashboard snapshot, without starting a second RCA workflow.

The existing governance callback remains the system-of-record feed.

---

# v12.4.0 — Direct RCA Response

Incident-specific RCA no longer uses `/api/moveworks/result`, callback correlation, or frontend polling.

Configure Azure App Service:

```text
MOVEWORKS_RCA_URL=<synchronous Moveworks endpoint that executes SLA_Breach_AI_Analysis>
MOVEWORKS_RCA_TIMEOUT_MS=120000
```

The endpoint must accept `incident_number` and return the final analysis in a field such as `ai_analysis`.
Governance callbacks remain unchanged and continue to populate the management dashboard.

---

# AI Operations Agent V11

Pixel-matched enterprise landing page based on the approved visual.

## Included
- Full-screen 3D robot and digital globe visual
- Left navigation, connected status, command center access
- Dynamic response panel with Pause, Stop, Copy and Full Analysis
- Voice recognition and automatic spoken response
- Microphone interrupts current speech and starts the next question
- SLA, Incident, DevOps and Knowledge Base quick actions
- Existing Moveworks, ServiceNow, Azure DevOps and governance backend retained

## Deploy
1. Extract the package into the GitHub repository.
2. Commit and push to `main`.
3. Wait for Azure App Service deployment.
4. Hard refresh with Ctrl+Shift+R.
5. Verify `/health` reports version `11.4.0`.

Use Microsoft Edge or Google Chrome and allow microphone access.


## V11.1 visual fixes
- Removed the duplicate top-left sidebar logo.
- Expanded the robot/globe visual to the same width as the prompt bar.
- Kept the complete robot and globe visible without a portrait-shaped frame.


## V11.4 changes
- Removed the four bottom quick-action cards from the AI home page.
- Moved the voice/text prompt to the bottom to keep the robot legs visible.
- Increased the full-body robot presentation while preserving head-to-toe visibility.
- Added a CSS-rendered complete globe halo behind the clean robot image so the globe boundary stays visible on both left and right sides.


## V11.6
- Preserves V11.3 robot/globe position, size and scaling.
- Keeps V11.5 bottom cards removed.
- Moves only the desktop voice/text prompt down to 28px from the bottom so the robot legs and feet remain unobstructed.


## V11.6.1 deployment fix
- Fixed integration test version mismatch that caused the GitHub Actions build to fail at /health.
- Health endpoint, package version, and integration test now all expect 11.6.1.
- No homepage visual/layout changes from V11.6.


## V11.7
- Preserves the approved V11.6.1 homepage layout.
- Typed questions on the home prompt now automatically trigger spoken AI responses.
- Voice questions continue to receive automatic spoken responses.
- Quick prompt actions also speak the final answer automatically.
- Increased the speaking waveform from 29 to 43 animated bars and widened it across the response panel.
- No robot/globe positioning, prompt positioning, or navigation layout changes.


## V11.8 Mobile Responsive
- Desktop V11.7 layout and behavior are unchanged.
- Added a dedicated mobile layout at 900px and below.
- Full robot and full globe are centered and contained without horizontal cropping.
- Greeting is compact and centered above the robot on mobile.
- Desktop sidebar is hidden on phones.
- Open Command Center becomes a compact icon button on mobile.
- The AI response panel is hidden while idle and becomes a mobile bottom sheet when answering/speaking.
- Voice/text prompt is fixed above the mobile safe area.
- 16px prompt input prevents iOS Safari auto-zoom.
- Existing automatic voice response for typed and spoken prompts is preserved.


## V12.0 — AI Presentation Mode
- Keeps the approved V11.8 desktop/mobile AI Operations Agent experience.
- Adds dynamic PowerPoint (.pptx) Presentation Mode.
- PPTX content is parsed locally in the browser; deck content is not uploaded to the Node.js backend.
- A new PowerPoint can be selected at any time without code changes or redeployment.
- The agent presents each slide using browser text-to-speech.
- Speaker notes are used when available; otherwise narration is created from the slide title and key text.
- Auto Advance and Interactive modes are supported.
- Voice/typed presentation commands: start, pause, continue, next slide, previous slide, stop, explain this slide, summarize this slide, restart.
- Existing Moveworks, ServiceNow, governance dashboards, automatic voice response, and mobile behavior are retained.
- MVP limitation: the browser reconstructs slide content from PowerPoint text and the first referenced image; it does not reproduce every PowerPoint shape/animation with pixel-perfect fidelity.


## V12.1 — Agent Personality / Self-Introduction
- Keeps V12.0 Presentation Mode, V11.8 mobile layout, voice behavior, Moveworks and governance integrations.
- Adds a local identity/personality intent layer before Moveworks routing.
- “Introduce yourself” / “Tell me about yourself” returns the full management-ready introduction.
- “Who are you?” returns a concise identity response.
- “Who created/built/invented you?” returns the July 22, 2026 Moveworks hackathon origin story.
- “What can you do?” / “What are your capabilities?” returns the technical capability response.
- “What is your purpose?” returns the product-purpose response.
- Identity responses display in the existing AI response panel and are spoken automatically using the existing text-to-speech and 43-bar waveform.
- These identity requests are answered locally and do not call Moveworks, which keeps the wording consistent and the response immediate.


## V12.2 — Preserve Original PowerPoint Formatting
- Upload PPTX for narration, slide text and speaker notes.
- Attach a PDF export of the same deck for the original visual formatting.
- When PDF is attached, the presenter displays the PDF page for each slide while narration continues from the PPTX.
- Next, Previous and Auto Advance keep PPTX slide number and PDF page number aligned.
- New PPTX/PDF pairs can be loaded without redeploying the application.
- Without a PDF, the existing reconstructed HTML preview remains available.


## V12.3 — SLA breached incident details
- Preserves the V12.2 robot, layout, presentation mode, voice and Moveworks integration.
- Maps Moveworks `breached_incidents` callback records into the existing SLA dashboard/result model.
- Supports incident number, incident name, assignment group, assignee, priority, state, SLA percentage and SLA name.
- Explicit list requests now take precedence over count-only answers.
- The robot speaks the total plus a short preview; **View Full Analysis** displays every returned incident record.


## v12.3.4 RCA async callback fix
- Incident RCA prompts always use asynchronous callback mode.
- The browser continues polling until the matching request_id callback arrives.
- Existing governance dashboard snapshot/counts remain isolated from RCA results.
- Sends both request_id/requestId and incident_number/incidentNumber for listener-mapping compatibility.


## v12.3.6 RCA correlation hardening
- Frontend accepts both `requestId` and `request_id` from `/api/ai/query`.
- Frontend accepts both `startedAt` and `started_at`.
- Backend returns both snake_case and camelCase correlation aliases for compatibility.
- Static asset cache keys were bumped to `12.3.6` so browsers load the corrected JavaScript after deployment.
- Existing governance dashboard and RCA callback separation remain unchanged.
