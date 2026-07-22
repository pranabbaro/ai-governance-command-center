# AI Operations Governance Command Center — Azure App Service Edition

Hackathon-ready dashboard for ServiceNow ageing-ticket governance, SLA breach intelligence, Azure DevOps hygiene, EOD effectiveness reporting and Governance AI.

## Why this package is App Service friendly

- Zero third-party runtime dependencies.
- Uses Node.js built-in HTTP server.
- Listens on `process.env.PORT` (required by Azure App Service) and defaults to 8080 locally.
- `/health` endpoint included.
- Static SPA fallback included.
- No secrets or credentials are stored in browser code.

## Run locally / Codespaces

```bash
npm start
```

Open port 8080.

Test:

```bash
npm test
curl http://localhost:8080/health
```

## Deploy to Azure App Service

Recommended runtime: Node.js 20 LTS or newer supported Node runtime.

For code deployment, deploy the entire project directory. App Service should run:

```bash
npm start
```

No build step and no `npm install` dependency download are required.

## Current demo behavior

Working locally in the browser:
- Command Center navigation
- Morning / Updated / Closed / Pending metrics
- Governance Action Rate and Backlog Reduction
- EOD Report action
- Ticket search
- Assign/reassign modal
- Notify actions
- SLA RCA Accept action
- SLA AI investigation demo
- DevOps hygiene table and notifications
- Governance AI prompt demo
- 5-minute refresh timer
- Responsive layout

## Live integration points

The `/api/*` namespace is reserved for the next phase. Never expose ServiceNow, Azure DevOps PATs, or Moveworks credentials in `public/app.js`.

Recommended future backend routes:
- `GET /api/dashboard`
- `GET /api/tickets/ageing`
- `PATCH /api/tickets/:id/assign`
- `POST /api/tickets/:id/notify`
- `GET /api/sla/breaches`
- `POST /api/sla/:id/analyze`
- `GET /api/devops/hygiene`
- `POST /api/ai/query`
- `POST /api/reports/eod`
