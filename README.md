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
7. Verify `/health` returns version `5.0.0`.

## Tests

Run:

```bash
npm test
```

The tests verify App Service startup, trigger-only state, secured webhook proxying, top-level `user_email`/`prompt` payload mapping, AI webhook fallback, assignment/notification/EOD proxy routes, and Moveworks Hackathon branding.
