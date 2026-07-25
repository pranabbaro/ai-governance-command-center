# AI Operations Agent MVP + AI Governance Command Center

**Version 9.0.0**

This package preserves the working Moveworks/ServiceNow governance integration from V8.2 and adds an attractive voice + chat MVP experience on top.

## New in MVP V9

- New **AI Operations Agent** landing page (default home page).
- Browser voice input using Web Speech Recognition (Chrome/Edge recommended).
- Voice transcript is submitted to the same existing governance prompt flow.
- Dedicated **AI Operations Result** page for all responses.
- Immediate live answers for SLA/ageing KPI questions without waiting for the long AI workflow.
- Immediate breached/at-risk/ageing list views when detailed records are present in the callback.
- Existing Moveworks AI RCA workflow remains available for analytical questions such as “Why are our SLAs breaching?”.
- **Read aloud** using browser text-to-speech.
- Existing Command Center, Ageing, SLA Intelligence, DevOps Governance, Ask Governance AI, callback APIs, assignment/notify hooks and EOD workflow are retained.

## Demo prompts

- “How many SLA breaches do we have?”
- “Show me all breached SLA tickets.”
- “Show me SLA records at risk.”
- “Why are our SLA tickets breaching?”
- “Show me ageing tickets.”

> Ticket-number lists appear automatically when the Moveworks callback includes detailed ticket/SLA records. The current count-only callback remains supported.

## Voice support

The MVP uses the browser Web Speech API. Chrome and Edge are recommended. No speech key is stored in the app. If the browser does not expose SpeechRecognition, chat remains fully functional.

---

## V8.2.0
- Immediate KPI answers for SLA count/number questions.
- No long AI workflow for factual SLA counts.
- Browser cache-busting for app.js/styles.css.
- Static assets served no-cache to avoid stale deployments.

# AI Governance Command Center — Moveworks Hackathon V5

Azure App Service–ready management dashboard that preserves the existing UI and uses Moveworks Agent Studio as the orchestration layer.

## What V5 fixes

- Uses `MOVEWORKS_TRIGGER_URL` automatically when `MOVEWORKS_AI_URL` is not configured.
- Sends webhook fields at the top level so a Moveworks System Plugin can map `user_email: parsed_body.user_email`.
- Uses the App Service backend to keep the Moveworks API key out of browser JavaScript.
- Recognizes a configured Moveworks webhook as a valid integration instead of showing `MOVEWORKS_AI_URL is not configured`.
- Shows an accurate "webhook connected / live KPI return not configured" state when only the asynchronous listener is available.
- Keeps the existing Moveworks Hackathon dashboard design.

## Required App Service environment variables

For the secured listener:

- `MOVEWORKS_TRIGGER_URL` — published Moveworks Listener webhook URL.
- `MOVEWORKS_API_KEY` — API key secret. The backend sends it as `Authorization: Bearer <key>`.
- `DEFAULT_NOTIFICATION_EMAIL` — recommended for the hackathon so the System Plugin always receives `user_email`.

## Current real execution path

Dashboard → Azure App Service backend → secured Moveworks Listener → System Plugin → `sla_governance` → ServiceNow / notification.

The browser sends an AI/governance request to `/api/ai/query`. If `MOVEWORKS_AI_URL` is absent, V5 sends the request to `MOVEWORKS_TRIGGER_URL` with this webhook body:

```json
{
  "event_type": "ticket_governance.ai_prompt",
  "prompt": "Why are our SLAs breaching?",
  "user_email": "demo.user@example.com",
  "context": "dashboard",
  "source": "azure_app_service_dashboard"
}
```

In the Moveworks System Plugin, map the SLA Governance input as:

```yaml
user_email: parsed_body.user_email
```

## Important asynchronous-listener behavior

A webhook listener accepts/triggers the workflow but does not synchronously return the final AI analysis or KPI data to the browser. Therefore:

- `MOVEWORKS_TRIGGER_URL` is sufficient to trigger real governance execution from the web app.
- To populate live KPI cards, configure a synchronous read/aggregation endpoint using `MOVEWORKS_DASHBOARD_URL` (or split ageing/SLA endpoints).
- To display the final AI-generated answer immediately in the web dashboard, configure `MOVEWORKS_AI_URL` to a synchronous Moveworks conversation/AI endpoint.

V5 never invents KPI data while those synchronous return paths are unavailable.

## Optional endpoints

- `MOVEWORKS_DASHBOARD_URL` — synchronous GET governance snapshot.
- `MOVEWORKS_AGEING_URL` — synchronous ageing data endpoint.
- `MOVEWORKS_SLA_URL` — synchronous SLA data endpoint.
- `MOVEWORKS_DEVOPS_URL` — synchronous DevOps governance endpoint.
- `MOVEWORKS_AI_URL` — synchronous AI endpoint for immediate dashboard answers.
- `MOVEWORKS_ASSIGN_URL` — ticket assignment action.
- `MOVEWORKS_NOTIFY_URL` — ticket notification action.
- `MOVEWORKS_EOD_URL` — EOD report action.

## Routes

- `GET /health`
- `GET /api/config`
- `GET /api/dashboard`
- `POST /api/moveworks/test`
- `POST /api/ai/query`
- `POST /api/tickets/:id/assign`
- `POST /api/tickets/:id/notify`
- `POST /api/reports/eod`

## Deployment

1. Deploy the contents of this package to Azure App Service.
2. Use Node.js 20+.
3. Startup command: `npm start`.
4. Set `MOVEWORKS_TRIGGER_URL`, `MOVEWORKS_API_KEY`, and `DEFAULT_NOTIFICATION_EMAIL` under App Service → Environment variables.
5. Save settings and restart App Service.
6. Hard refresh the browser (`Ctrl+F5`).
7. Verify `/health` returns version `8.0.0`.

## Tests

Run:

```bash
npm test
```

The tests verify App Service startup, trigger-only state, secured webhook proxying, top-level `user_email`/`prompt` payload mapping, AI webhook fallback, assignment/notification/EOD proxy routes, and Moveworks Hackathon branding.

## V6 - Moveworks callback integration

V6 adds a real callback path so an asynchronous Moveworks webhook workflow can send completed governance results back to the Azure App Service dashboard.

### App Service callback endpoint

Moveworks should POST completed governance results to:

```text
https://<your-app>.azurewebsites.net/api/moveworks/result
```

The dashboard automatically reads the latest callback through `GET /api/moveworks/result` and `/api/dashboard`.

A callback can be partial. For SLA-only governance this is valid:

```json
{
  "at_risk_count": 5,
  "critical_count": 2,
  "breached_count": 3,
  "total_sla_attention": 10,
  "ai_analysis": "The main contributing pattern is ..."
}
```

A richer callback can use nested objects:

```json
{
  "request_id": "optional-request-id",
  "sla": {
    "at_risk_count": 5,
    "critical_count": 2,
    "breached_count": 3
  },
  "ageing": {
    "incident_count": 4,
    "ritm_count": 3,
    "task_count": 2,
    "total_ageing_count": 9
  },
  "ai_analysis": "AI-generated governance analysis"
}
```

When the dashboard sends a webhook request to Moveworks, V6 also includes `callback_url` and `request_id` in the webhook body. The AI page polls the callback endpoint for up to 30 seconds and automatically refreshes KPI cards when a new callback arrives.

### Recommended Azure environment variables

```text
MOVEWORKS_TRIGGER_URL=<published secured Moveworks listener URL>
MOVEWORKS_API_KEY=<Moveworks API key secret>
DEFAULT_NOTIFICATION_EMAIL=<demo notification email>
PUBLIC_BASE_URL=https://<your-app>.azurewebsites.net
```

`MOVEWORKS_CALLBACK_SECRET` is optional. Leave it unset for the hackathon demo. If set, Moveworks must send the same value in the `X-Dashboard-Callback-Secret` header.

### Moveworks callback action

Create an HTTP Action in Agent Studio that POSTs the final governance output to the callback endpoint. Add that HTTP Action at the end of the dashboard-triggered Compound Action/plugin workflow. Map the live SLA/ageing/AI values into the JSON body; do not hard-code demo values.


## Version 7 additions
- Displays live Moveworks AI SLA analysis directly on Command Center and SLA Intelligence pages.
- Shows Total SLA Attention from the callback payload.
- Ask Governance AI reuses the latest live AI briefing and waits longer for asynchronous callbacks.
- Adds manual Refresh live data control.
- Preserves the V6 callback, webhook trigger, EOD, notification and assignment integrations.


## V8 query behavior
Quantitative questions such as "How many SLA breaches are there?" are answered directly from the latest live Moveworks/ServiceNow KPI snapshot. Analytical questions such as "Why are our SLAs breaching?" continue through the Moveworks AI workflow and display the generated RCA narrative.

## Version 10.1.0

- Minimal AI-first landing page
- 3D AI visual occupies 80% of the desktop home page
- Voice recognition automatically submits the spoken question
- Responses to voice-originated questions are spoken automatically using browser text-to-speech
- Typed questions remain text-only unless the user selects **Read aloud**
- Existing Command Center, SLA, ageing, DevOps, Moveworks callback and governance actions are retained

For voice recognition and automatic voice responses, use the current version of Microsoft Edge or Google Chrome and allow microphone access.
