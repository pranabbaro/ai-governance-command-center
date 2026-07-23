const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const port = Number(process.env.PORT || 8080);
const publicDir = path.join(__dirname, 'public');
const requestTimeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS || 25000);
const resultStorePath = process.env.RESULT_STORE_PATH || (process.env.WEBSITE_SITE_NAME ? '/home/data/ai-governance-latest-result.json' : '/tmp/ai-governance-latest-result.json');
let latestMoveworksResult = null;

function loadLatestResult() {
  try {
    if (fs.existsSync(resultStorePath)) latestMoveworksResult = JSON.parse(fs.readFileSync(resultStorePath, 'utf8'));
  } catch (err) {
    console.warn('Unable to load previous Moveworks result:', err.message);
  }
}

function saveLatestResult(value) {
  latestMoveworksResult = value;
  try {
    fs.mkdirSync(path.dirname(resultStorePath), { recursive: true });
    fs.writeFileSync(resultStorePath, JSON.stringify(value, null, 2));
  } catch (err) {
    console.warn('Unable to persist Moveworks result:', err.message);
  }
}

loadLatestResult();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end(JSON.stringify(body));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, err.code === 'ENOENT' ? 404 : 500, { error: err.code === 'ENOENT' ? 'Not found' : 'Server error' });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    res.end(data);
  });
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error('Request body too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function upstreamHeaders() {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (process.env.MOVEWORKS_AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.MOVEWORKS_AUTH_TOKEN}`;
  else if (process.env.MOVEWORKS_API_KEY) headers.Authorization = `Bearer ${process.env.MOVEWORKS_API_KEY}`;
  if (process.env.MOVEWORKS_TENANT_ID) headers['X-Moveworks-Tenant-Id'] = process.env.MOVEWORKS_TENANT_ID;
  return headers;
}

async function callMoveworks(url, { method = 'GET', body } = {}) {
  if (!url) throw new Error('Moveworks endpoint is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: upstreamHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { text }; }
    if (!response.ok) {
      const message = payload?.message || payload?.error || `Moveworks returned HTTP ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.details = payload;
      throw err;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function unwrap(payload) {
  if (payload == null) return {};
  if (payload.data && typeof payload.data === 'object') return payload.data;
  if (payload.result && !Array.isArray(payload.result) && typeof payload.result === 'object') return payload.result;
  if (payload.output && typeof payload.output === 'object') return payload.output;
  return payload;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTicket(t = {}) {
  return {
    id: t.id || t.number || t.ticket || t.task_number || 'Unknown',
    type: t.type || t.sys_class_name || (String(t.number || '').startsWith('RITM') ? 'RITM' : String(t.number || '').startsWith('TASK') || String(t.number || '').startsWith('SCTASK') ? 'TASK' : 'INC'),
    title: t.title || t.short_description || t.description || '',
    age: num(t.age ?? t.age_days),
    stale: num(t.stale ?? t.stale_days ?? t.days_since_update),
    sla: t.sla || t.sla_status || 'N/A',
    team: t.team || t.assignment_group?.display_value || t.assignment_group || '',
    assignee: t.assignee || t.assigned_to?.display_value || t.assigned_to || 'Unassigned',
    priority: t.priority || '',
    risk: num(t.risk ?? t.risk_score)
  };
}

function normalizeDashboardPayload(payload) {
  const p = unwrap(payload);
  const ageing = unwrap(p.ageing || p.ageing_result || p.morning || {});
  const sla = unwrap(p.sla || p.sla_result || {});
  const daily = unwrap(p.daily || p.effectiveness || {});
  const devops = unwrap(p.devops || p.devops_result || {});
  const ticketsRaw = p.tickets || ageing.tickets || p.ageing_tickets || [];
  const slaBreachesRaw = p.slaBreaches || p.sla_breaches || sla.breaches || [];
  const devopsItemsRaw = p.devopsItems || p.devops_items || devops.items || [];

  const incidentCount = num(ageing.incident_count ?? ageing.incidents ?? p.incident_count);
  const ritmCount = num(ageing.ritm_count ?? ageing.ritms ?? p.ritm_count);
  const taskCount = num(ageing.task_count ?? ageing.tasks ?? p.task_count);
  const ageingTotal = num(ageing.total_ageing_count ?? ageing.total ?? p.ageing_total, incidentCount + ritmCount + taskCount);
  const slaAtRisk = num(sla.at_risk_count ?? sla.atRisk ?? p.sla_at_risk);
  const slaCritical = num(sla.critical_count ?? sla.critical ?? p.sla_critical);
  const slaBreached = num(sla.breached_count ?? sla.breached ?? p.sla_breached);

  return {
    source: p.source || 'moveworks',
    mode: p.mode || 'live',
    generatedAt: p.generatedAt || p.generated_at || p.receivedAt || p.received_at || new Date().toISOString(),
    ageing: { incidentCount, ritmCount, taskCount, total: ageingTotal },
    sla: { atRisk: slaAtRisk, critical: slaCritical, breached: slaBreached, compliance: p.sla_compliance ?? sla.compliance ?? null },
    daily: {
      morning: num(daily.morning ?? daily.morning_count, ageingTotal),
      updated: num(daily.updated ?? daily.updated_count),
      closed: num(daily.closed ?? daily.closed_count),
      pending: num(daily.pending ?? daily.pending_count),
      actionRate: daily.actionRate ?? daily.action_rate ?? null,
      backlogReduction: daily.backlogReduction ?? daily.backlog_reduction ?? null
    },
    tickets: Array.isArray(ticketsRaw) ? ticketsRaw.map(normalizeTicket) : [],
    slaBreaches: Array.isArray(slaBreachesRaw) ? slaBreachesRaw : [],
    devops: {
      hygiene: num(devops.hygiene ?? devops.overall_hygiene ?? p.devops_hygiene),
      nonCompliant: num(devops.non_compliant ?? devops.nonCompliant),
      largestGap: devops.largest_gap || devops.largestGap || '',
      items: Array.isArray(devopsItemsRaw) ? devopsItemsRaw : []
    },
    aiBriefing: p.aiBriefing || p.ai_briefing || p.ai_analysis || p.analysis || p.recommendation || p.recommendations || null,
    trend: Array.isArray(p.trend) ? p.trend : []
  };
}

function normalizeCallbackPayload(payload) {
  const p = unwrap(payload);
  const callback = {
    ...p,
    source: 'moveworks-callback',
    mode: 'live-callback',
    generatedAt: p.generatedAt || p.generated_at || p.receivedAt || p.received_at || new Date().toISOString()
  };

  if (!callback.sla && (p.at_risk_count !== undefined || p.critical_count !== undefined || p.breached_count !== undefined || p.total_sla_attention !== undefined)) {
    callback.sla = {
      at_risk_count: p.at_risk_count,
      critical_count: p.critical_count,
      breached_count: p.breached_count,
      total_sla_attention: p.total_sla_attention
    };
  }
  if (!callback.ageing && (p.incident_count !== undefined || p.ritm_count !== undefined || p.task_count !== undefined || p.total_ageing_count !== undefined)) {
    callback.ageing = {
      incident_count: p.incident_count,
      ritm_count: p.ritm_count,
      task_count: p.task_count,
      total_ageing_count: p.total_ageing_count
    };
  }
  return callback;
}

async function buildDashboard() {
  if (process.env.MOVEWORKS_DASHBOARD_URL) {
    return normalizeDashboardPayload(await callMoveworks(process.env.MOVEWORKS_DASHBOARD_URL));
  }

  if (latestMoveworksResult) {
    return normalizeDashboardPayload(latestMoveworksResult);
  }

  // Optional split endpoints: useful when Moveworks exposes ageing/SLA/DevOps as separate published APIs.
  const configured = [process.env.MOVEWORKS_AGEING_URL, process.env.MOVEWORKS_SLA_URL, process.env.MOVEWORKS_DEVOPS_URL].some(Boolean);
  if (!configured) {
    if (process.env.MOVEWORKS_TRIGGER_URL) {
      return {
        source: 'moveworks-trigger',
        mode: 'trigger-only',
        generatedAt: new Date().toISOString(),
        message: 'Moveworks webhook trigger is connected. Live KPI return endpoint is not configured yet.',
        ageing: { incidentCount: 0, ritmCount: 0, taskCount: 0, total: 0 },
        sla: { atRisk: 0, critical: 0, breached: 0, compliance: null },
        daily: { morning: 0, updated: 0, closed: 0, pending: 0, actionRate: null, backlogReduction: null },
        tickets: [],
        slaBreaches: [],
        devops: { hygiene: 0, nonCompliant: 0, largestGap: '', items: [] },
        aiBriefing: null,
        trend: []
      };
    }
    throw new Error('No Moveworks integration endpoint configured');
  }

  const [ageing, sla, devops] = await Promise.all([
    process.env.MOVEWORKS_AGEING_URL ? callMoveworks(process.env.MOVEWORKS_AGEING_URL) : {},
    process.env.MOVEWORKS_SLA_URL ? callMoveworks(process.env.MOVEWORKS_SLA_URL) : {},
    process.env.MOVEWORKS_DEVOPS_URL ? callMoveworks(process.env.MOVEWORKS_DEVOPS_URL) : {}
  ]);
  return normalizeDashboardPayload({ ageing: unwrap(ageing), sla: unwrap(sla), devops: unwrap(devops) });
}

function pickAiAnswer(payload) {
  const p = unwrap(payload);
  return p.answer || p.analysis || p.generated_output || p.generatedOutput || p.text || p.message || p.response || p.ai_sla_analysis?.generated_output || JSON.stringify(p);
}

function externalBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  return `${proto}://${host}`;
}

function requestId() {
  return `gov-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'ai-governance-command-center',
      version: '6.0.0',
      moveworksConfigured: Boolean(process.env.MOVEWORKS_DASHBOARD_URL || process.env.MOVEWORKS_AGEING_URL || process.env.MOVEWORKS_SLA_URL || process.env.MOVEWORKS_TRIGGER_URL),
      aiConfigured: Boolean(process.env.MOVEWORKS_AI_URL || process.env.MOVEWORKS_TRIGGER_URL),
      triggerConfigured: Boolean(process.env.MOVEWORKS_TRIGGER_URL),
      callbackReady: Boolean(latestMoveworksResult),
      callbackEndpoint: '/api/moveworks/result'
    });
  }

  try {
    if (url.pathname === '/api/config' && req.method === 'GET') {
      return sendJson(res, 200, {
        appName: 'AI Governance Command Center',
        eventName: 'Moveworks Hackathon',
        refreshSeconds: 300,
        integrations: {
          dashboard: Boolean(process.env.MOVEWORKS_DASHBOARD_URL || process.env.MOVEWORKS_AGEING_URL || process.env.MOVEWORKS_SLA_URL || process.env.MOVEWORKS_TRIGGER_URL),
          ai: Boolean(process.env.MOVEWORKS_AI_URL || process.env.MOVEWORKS_TRIGGER_URL),
          trigger: Boolean(process.env.MOVEWORKS_TRIGGER_URL),
          assign: Boolean(process.env.MOVEWORKS_ASSIGN_URL),
          notify: Boolean(process.env.MOVEWORKS_NOTIFY_URL),
          eod: Boolean(process.env.MOVEWORKS_EOD_URL),
          callback: true
        }
      });
    }

    if (url.pathname === '/api/moveworks/result' && req.method === 'POST') {
      if (process.env.MOVEWORKS_CALLBACK_SECRET) {
        const provided = req.headers['x-dashboard-callback-secret'];
        if (provided !== process.env.MOVEWORKS_CALLBACK_SECRET) return sendJson(res, 401, { error: 'Invalid callback secret' });
      }
      const body = await readJsonBody(req);
      const receivedAt = new Date().toISOString();
      const normalizedInput = normalizeCallbackPayload({ ...body, receivedAt });
      const dashboard = normalizeDashboardPayload(normalizedInput);
      const stored = {
        ...normalizedInput,
        ...dashboard,
        request_id: body.request_id || body.requestId || null,
        prompt: body.prompt || null,
        receivedAt
      };
      saveLatestResult(stored);
      return sendJson(res, 200, { status: 'ok', message: 'Moveworks governance result received', receivedAt, request_id: stored.request_id });
    }

    if (url.pathname === '/api/moveworks/result' && req.method === 'GET') {
      if (!latestMoveworksResult) return sendJson(res, 200, { status: 'waiting', message: 'No Moveworks governance result received yet' });
      const since = url.searchParams.get('since');
      if (since) {
        const resultTime = Date.parse(latestMoveworksResult.receivedAt || latestMoveworksResult.generatedAt || 0);
        const sinceTime = Date.parse(since);
        if (Number.isFinite(sinceTime) && (!Number.isFinite(resultTime) || resultTime <= sinceTime)) {
          return sendJson(res, 200, { status: 'waiting', message: 'Waiting for a newer Moveworks governance result' });
        }
      }
      const requestId = url.searchParams.get('request_id');
      if (requestId && latestMoveworksResult.request_id && latestMoveworksResult.request_id !== requestId) {
        return sendJson(res, 200, { status: 'waiting', message: 'Waiting for matching Moveworks governance result' });
      }
      return sendJson(res, 200, { status: 'ready', result: latestMoveworksResult });
    }

    if (url.pathname === '/api/dashboard' && req.method === 'GET') {
      const dashboard = await buildDashboard();
      return sendJson(res, 200, dashboard);
    }


    if (url.pathname === '/api/moveworks/test' && req.method === 'POST') {
      if (!process.env.MOVEWORKS_TRIGGER_URL) return sendJson(res, 503, { error: 'MOVEWORKS_TRIGGER_URL is not configured' });
      const body = await readJsonBody(req);
      const startedAt = new Date().toISOString();
      const reqId = requestId();
      const payload = await callMoveworks(process.env.MOVEWORKS_TRIGGER_URL, {
        method: 'POST',
        body: {
          event_type: 'ticket_governance.dashboard_test',
          prompt: body.prompt || 'Run AI Ticket Governance',
          user_email: body.user_email || process.env.DEFAULT_NOTIFICATION_EMAIL || undefined,
          source: 'azure_app_service_dashboard',
          requested_at: startedAt,
          request_id: reqId,
          callback_url: `${externalBaseUrl(req)}/api/moveworks/result`
        }
      });
      return sendJson(res, 200, { success: true, moveworks: payload, requestId: reqId, startedAt });
    }

    if (url.pathname === '/api/ai/query' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const prompt = String(body.prompt || '').trim();
      if (!prompt) return sendJson(res, 400, { error: 'prompt is required' });
      if (process.env.MOVEWORKS_AI_URL) {
        const payload = await callMoveworks(process.env.MOVEWORKS_AI_URL, {
          method: 'POST',
          body: { prompt, user_email: body.user_email || process.env.DEFAULT_NOTIFICATION_EMAIL || undefined, context: body.context || 'dashboard' }
        });
        return sendJson(res, 200, { answer: pickAiAnswer(payload), mode: 'synchronous-ai', raw: process.env.EXPOSE_UPSTREAM_RAW === 'true' ? payload : undefined });
      }
      if (!process.env.MOVEWORKS_TRIGGER_URL) return sendJson(res, 503, { error: 'MOVEWORKS_AI_URL or MOVEWORKS_TRIGGER_URL is not configured' });
      const startedAt = new Date().toISOString();
      const reqId = requestId();
      const payload = await callMoveworks(process.env.MOVEWORKS_TRIGGER_URL, {
        method: 'POST',
        body: {
          event_type: 'ticket_governance.ai_prompt',
          prompt,
          user_email: body.user_email || process.env.DEFAULT_NOTIFICATION_EMAIL || undefined,
          context: body.context || 'dashboard',
          source: 'azure_app_service_dashboard',
          requested_at: startedAt,
          request_id: reqId,
          callback_url: `${externalBaseUrl(req)}/api/moveworks/result`
        }
      });
      return sendJson(res, 202, {
        answer: 'Moveworks accepted the governance request. Waiting for the live governance callback…',
        mode: 'webhook-trigger',
        requestId: reqId,
        startedAt,
        callbackUrl: `${externalBaseUrl(req)}/api/moveworks/result`,
        moveworks: payload
      });
    }

    const assignMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/assign$/);
    if (assignMatch && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.assignee) return sendJson(res, 400, { error: 'assignee is required' });
      if (!process.env.MOVEWORKS_ASSIGN_URL) return sendJson(res, 503, { error: 'MOVEWORKS_ASSIGN_URL is not configured' });
      const payload = await callMoveworks(process.env.MOVEWORKS_ASSIGN_URL, { method: 'POST', body: { ticket_id: decodeURIComponent(assignMatch[1]), assignee: body.assignee } });
      return sendJson(res, 200, { success: true, result: unwrap(payload) });
    }

    const notifyMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/notify$/);
    if (notifyMatch && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!process.env.MOVEWORKS_NOTIFY_URL) return sendJson(res, 503, { error: 'MOVEWORKS_NOTIFY_URL is not configured' });
      const payload = await callMoveworks(process.env.MOVEWORKS_NOTIFY_URL, { method: 'POST', body: { ticket_id: decodeURIComponent(notifyMatch[1]), user_email: body.user_email || process.env.DEFAULT_NOTIFICATION_EMAIL || undefined } });
      return sendJson(res, 200, { success: true, result: unwrap(payload) });
    }

    if (url.pathname === '/api/reports/eod' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!process.env.MOVEWORKS_EOD_URL) return sendJson(res, 503, { error: 'MOVEWORKS_EOD_URL is not configured' });
      const payload = await callMoveworks(process.env.MOVEWORKS_EOD_URL, { method: 'POST', body });
      return sendJson(res, 200, { success: true, result: unwrap(payload) });
    }

    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'API route not found' });
  } catch (err) {
    console.error('API error:', err.message);
    const status = err.name === 'AbortError' ? 504 : (err.status >= 400 && err.status < 600 ? err.status : 502);
    return sendJson(res, status, { error: err.message, upstream: err.details || undefined });
  }

  let requested = decodeURIComponent(url.pathname);
  if (requested === '/') requested = '/index.html';
  const safePath = path.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) return sendJson(res, 403, { error: 'Forbidden' });

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) return serveFile(res, filePath);
    serveFile(res, path.join(publicDir, 'index.html'));
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`AI Governance Command Center - Moveworks Hackathon listening on http://0.0.0.0:${port}`);
});
