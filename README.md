# AI Governance Command Center — Moveworks Hackathon V4

Azure App Service–ready management dashboard that keeps the original UI but replaces mock logic with a live integration layer for Moveworks Agent Studio.

## Runtime
- Node.js 20+ (Linux App Service)
- No npm dependencies
- Startup command: `npm start`
- Health endpoint: `/health`

## Live integration model
The browser never stores ServiceNow, Azure DevOps, or Moveworks credentials. The App Service backend proxies requests to Moveworks, and Moveworks remains the orchestration/AI layer.

### Required App Service environment variables
For the secured listener you just created:
- `MOVEWORKS_TRIGGER_URL` — your Moveworks Listener webhook URL
- `MOVEWORKS_API_KEY` — Moveworks API key secret; backend sends it as `Authorization: Bearer <key>`
- `DEFAULT_NOTIFICATION_EMAIL` — optional default recipient for demo runs

The dashboard now includes **Test Moveworks Connection**, which calls `/api/moveworks/test` from the browser through the App Service backend. The API key never reaches browser JavaScript.

### Optional synchronous data/AI endpoints
Use **one** dashboard aggregation endpoint:
- `MOVEWORKS_DASHBOARD_URL` — GET endpoint returning ageing/SLA/DevOps/effectiveness snapshot

Or use split read-only endpoints:
- `MOVEWORKS_AGEING_URL`
- `MOVEWORKS_SLA_URL`
- `MOVEWORKS_DEVOPS_URL` (optional until DevOps governance is ready)

For AI prompt integration:
- `MOVEWORKS_AI_URL` — POST endpoint accepting `{ "prompt": "...", "user_email": "...", "context": "dashboard" }`

Optional action endpoints:
- `MOVEWORKS_ASSIGN_URL` — POST ticket assignment action
- `MOVEWORKS_NOTIFY_URL` — POST owner notification action
- `MOVEWORKS_EOD_URL` — POST EOD report action

Authentication, depending on your Moveworks tenant/API gateway:
- `MOVEWORKS_AUTH_TOKEN` — sent as `Authorization: Bearer ...`
- `MOVEWORKS_API_KEY` — sent as `X-API-Key`
- `MOVEWORKS_TENANT_ID` — optional tenant header
- `DEFAULT_NOTIFICATION_EMAIL` — optional default user email

## Expected dashboard response
The backend accepts multiple common shapes. A recommended payload is:

```json
{
  "ageing": {
    "incident_count": 12,
    "ritm_count": 7,
    "task_count": 9,
    "total_ageing_count": 28,
    "tickets": []
  },
  "sla": {
    "at_risk_count": 8,
    "critical_count": 3,
    "breached_count": 5,
    "compliance": 93.4,
    "breaches": []
  },
  "daily": {
    "morning": 28,
    "updated": 14,
    "closed": 6,
    "pending": 8
  },
  "devops": {
    "hygiene": 83,
    "non_compliant": 18,
    "largest_gap": "Acceptance Criteria",
    "items": []
  },
  "trend": [65, 72, 78, 82, 80]
}
```

## Dashboard API routes
- `POST /api/moveworks/test` — real browser → App Service → secured Moveworks Listener connectivity test
- `GET /api/dashboard` — live Moveworks governance snapshot
- `POST /api/ai/query` — real Moveworks AI prompt
- `POST /api/tickets/:id/assign` — assignment through Moveworks
- `POST /api/tickets/:id/notify` — notification through Moveworks
- `POST /api/reports/eod` — EOD reporting through Moveworks
- `GET /health`

## Azure App Service deployment
1. Create Linux Web App with Node.js 20+.
2. Deploy the contents of this ZIP.
3. Set startup command to `npm start` if your deployment flow does not honor `package.json` automatically.
4. Add the Moveworks environment variables under **Settings → Environment variables**.
5. Configure Health Check path as `/health`.

## Important
The code and HTTP contract are tested locally against a mock Moveworks service. Live tenant execution still requires the actual Moveworks API/listener URLs and approved authentication values from your environment. Do not place ServiceNow or Azure DevOps credentials in browser JavaScript.


## Listener vs synchronous AI
A webhook listener returns an event receipt (`RECEIVED`) and is asynchronous. V4 can use it to trigger the governance workflow from the existing Ask AI box. To display the actual generated AI answer immediately in the dashboard, configure `MOVEWORKS_AI_URL` to a synchronous Moveworks Conversations API integration (or equivalent).
