const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const port = Number(process.env.PORT || 8080);
const publicDir = path.join(__dirname, 'public');
const requestTimeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS || 25000);
const rcaRequestTimeoutMs = Number(process.env.MOVEWORKS_RCA_TIMEOUT_MS || 120000);
const resultStorePath = process.env.RESULT_STORE_PATH || (process.env.WEBSITE_SITE_NAME ? '/home/data/ai-governance-latest-result.json' : '/tmp/ai-governance-latest-result.json');
const rcaStorePath = process.env.RCA_STORE_PATH || (process.env.WEBSITE_SITE_NAME ? '/home/data/ai-governance-latest-rca.json' : '/tmp/ai-governance-latest-rca.json');
const pendingRcaStorePath = process.env.PENDING_RCA_STORE_PATH || (process.env.WEBSITE_SITE_NAME ? '/home/data/ai-governance-pending-rca.json' : '/tmp/ai-governance-pending-rca.json');
let latestMoveworksResult = null;
let latestRcaResult = null;
const resultsByRequest = new Map();
const pendingRcaByIncident = new Map();

function loadLatestResult() {
  try {
    if (fs.existsSync(resultStorePath)) latestMoveworksResult = JSON.parse(fs.readFileSync(resultStorePath, 'utf8'));
  } catch (err) {
    console.warn('Unable to load previous Moveworks result:', err.message);
  }
}

function loadRcaState() {
  try {
    if (fs.existsSync(rcaStorePath)) {
      latestRcaResult = JSON.parse(fs.readFileSync(rcaStorePath, 'utf8'));
      const reqId = latestRcaResult?.request_id || latestRcaResult?.requestId;
      if (reqId) resultsByRequest.set(String(reqId), latestRcaResult);
    }
  } catch (err) {
    console.warn('Unable to load previous RCA result:', err.message);
  }
  try {
    if (fs.existsSync(pendingRcaStorePath)) {
      const pending = JSON.parse(fs.readFileSync(pendingRcaStorePath, 'utf8'));
      if (pending && typeof pending === 'object') {
        for (const [incident, value] of Object.entries(pending)) {
          if (incident && value?.request_id) pendingRcaByIncident.set(String(incident).toUpperCase(), value);
        }
      }
    }
  } catch (err) {
    console.warn('Unable to load pending RCA requests:', err.message);
  }
}

function persistPendingRca() {
  try {
    fs.mkdirSync(path.dirname(pendingRcaStorePath), { recursive: true });
    const obj = Object.fromEntries(pendingRcaByIncident.entries());
    fs.writeFileSync(pendingRcaStorePath, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.warn('Unable to persist pending RCA requests:', err.message);
  }
}

function registerPendingRca(incidentNumber, reqId, startedAt) {
  if (!incidentNumber || !reqId) return;
  pendingRcaByIncident.set(String(incidentNumber).toUpperCase(), {
    incident_number: String(incidentNumber).toUpperCase(),
    request_id: String(reqId),
    startedAt: startedAt || new Date().toISOString()
  });
  persistPendingRca();
}

function resolvePendingRequestId(incidentNumber) {
  if (!incidentNumber) return null;
  return pendingRcaByIncident.get(String(incidentNumber).toUpperCase())?.request_id || null;
}

function clearPendingRca(incidentNumber, reqId) {
  const incident = incidentNumber ? String(incidentNumber).toUpperCase() : '';
  if (incident) {
    const pending = pendingRcaByIncident.get(incident);
    if (!reqId || !pending || String(pending.request_id) === String(reqId)) pendingRcaByIncident.delete(incident);
  }
  persistPendingRca();
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

function isIncidentRcaPayload(value = {}) {
  const p = unwrap(value);
  const type = String(p.type || p.result_type || p.intent || '').toLowerCase();
  const incident = String(p.incident_number || p.incidentNumber || '').trim();
  const analysis = p.ai_analysis || p.analysis || p.generated_output || p.generatedOutput;
  return type === 'incident_rca' || Boolean(incident && analysis);
}

function saveRcaResult(value) {
  latestRcaResult = value;
  const reqId = value?.request_id || value?.requestId || null;
  if (reqId) {
    resultsByRequest.set(String(reqId), value);
    // Keep bounded memory in long-running App Service instances.
    if (resultsByRequest.size > 200) {
      const oldest = resultsByRequest.keys().next().value;
      if (oldest) resultsByRequest.delete(oldest);
    }
  }
  try {
    fs.mkdirSync(path.dirname(rcaStorePath), { recursive: true });
    fs.writeFileSync(rcaStorePath, JSON.stringify(value, null, 2));
  } catch (err) {
    console.warn('Unable to persist RCA result:', err.message);
  }
}

function extractIncidentNumber(prompt) {
  const match = String(prompt || '').toUpperCase().match(/\bINC\d+\b/);
  return match ? match[0] : null;
}

function isRcaPrompt(prompt) {
  const q = String(prompt || '').toLowerCase();
  const incident = extractIncidentNumber(prompt);
  if (!incident) return false;
  return /\b(rca|root cause|why|reason|breach|breached|analy[sz]e|analysis|cause|corrective|preventive)\b/.test(q);
}

loadLatestResult();
loadRcaState();

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
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(data);
  });
}

function immediateGovernanceAnswer(prompt) {
  const q = String(prompt || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9% ]/g, ' ').replace(/\s+/g, ' ').trim();
  const asksNumber = /\b(how many|number|count|total|quantity)\b/.test(q)
    || /\bwhat(?:s| is)\b.*\b(number|count|total)\b/.test(q)
    || /\bgive me\b.*\b(number|count|total)\b/.test(q);
  const asksCurrent = asksNumber || /\b(current|currently|today|right now|live|latest)\b/.test(q);
  if (!asksCurrent || !latestMoveworksResult) return null;

  const d = normalizeDashboardPayload(latestMoveworksResult);
  const breached = Number(d.sla?.breached || 0);
  const atRisk = Number(d.sla?.atRisk || 0);
  const critical = Number(d.sla?.critical || 0);
  const totalAttention = Number(d.sla?.totalAttention ?? (atRisk + breached));
  const ageing = Number(d.ageing?.total || 0);
  const mentionsSla = /\bsla\b/.test(q);
  const mentionsBreach = /\b(breach|breached|breaches|breaching)\b/.test(q);
  const mentionsIncident = /\b(incident|incidents|inc)\b/.test(q);

  if ((mentionsSla || mentionsIncident) && mentionsBreach) {
    if (mentionsIncident && Array.isArray(d.slaBreaches) && d.slaBreaches.length) {
      const uniqueIncidents = new Set(d.slaBreaches.map(x => String(x.incident_number || x.id || x.number || '').trim()).filter(Boolean)).size;
      if (uniqueIncidents) return `**${uniqueIncidents} unique breached incidents** are currently available in the latest live ServiceNow SLA governance result. The underlying SLA record count is **${breached}**.`;
    }
    return `**${breached} breached SLA records** are currently reported in the latest live ServiceNow governance data.`;
  }
  if (mentionsSla && /\bcritical\b/.test(q)) return `**${critical} critical SLA records** are currently reported in the latest live ServiceNow governance data.`;
  if (mentionsSla && /\b(at risk|risk)\b/.test(q)) return `**${atRisk} SLA records are at risk** in the latest live ServiceNow governance data.`;
  if (mentionsSla && /\b(attention|total)\b/.test(q)) return `**${totalAttention} SLA records require attention** (${atRisk} at risk + ${breached} breached).`;
  if (/\b(ageing|aging)\b/.test(q) && /\b(ticket|tickets|backlog|incident|incidents|ritm|task|tasks)\b/.test(q)) return `**${ageing} ageing tickets** are currently reported in the latest live governance data.`;
  return null;
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

async function callMoveworks(url, { method = 'GET', body, timeoutMs = requestTimeoutMs } = {}) {
  if (!url) throw new Error('Moveworks endpoint is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

function normalizeSlaBreach(b = {}) {
  const display = value => {
    if (value && typeof value === 'object') return value.display_value ?? value.value ?? '';
    return value ?? '';
  };
  const rca = (b.rca && typeof b.rca === 'object') ? b.rca : {};
  const rcaSummary = display(b.rca_summary || b.rcaSummary || rca.summary || rca.rca_summary || b.ai_rca_summary);
  const rootCause = display(b.likely_root_cause || b.root_cause || b.rootCause || rca.likely_root_cause || rca.root_cause || rca.rootCause);
  const contributingFactors = b.contributing_factors || b.contributingFactors || rca.contributing_factors || rca.contributingFactors || [];
  const correctiveAction = display(b.corrective_action || b.correctiveAction || rca.corrective_action || rca.correctiveAction || b.recommended_action);
  const preventiveAction = display(b.preventive_action || b.preventiveAction || rca.preventive_action || rca.preventiveAction);
  const confidence = display(b.confidence || rca.confidence || b.rca_confidence);
  const evidence = b.evidence || rca.evidence || [];
  const incidentNumber = display(b.incident_number || b.number || b.id || b['task.number'] || b.task);
  const incidentName = display(b.incident_name || b.summary || b.short_description || b.description || b['task.short_description']);
  const team = display(b.assignment_group || b.team || b['task.assignment_group']);
  const assignee = display(b.assigned_to || b.assignee || b['task.assigned_to']);
  const priority = display(b.priority || b['task.priority']);
  const state = display(b.state || b.status || b['task.state']);
  const percentage = display(b.percentage || b.breach);
  const slaName = display(b.sla);
  const plannedEndTime = display(b.planned_end_time || b.plannedEndTime);
  return {
    ...b,
    id: incidentNumber || 'SLA',
    number: incidentNumber || '',
    summary: incidentName || 'Breached SLA record',
    description: incidentName || '',
    team,
    assignee,
    priority,
    state,
    status: state || 'Breached',
    percentage,
    breach: percentage,
    sla: slaName,
    plannedEndTime,
    rca_summary: rcaSummary,
    likely_root_cause: rootCause,
    contributing_factors: Array.isArray(contributingFactors) ? contributingFactors : (contributingFactors ? [String(contributingFactors)] : []),
    corrective_action: correctiveAction,
    preventive_action: preventiveAction,
    confidence,
    evidence: Array.isArray(evidence) ? evidence : (evidence ? [String(evidence)] : []),
    hasRca: Boolean(rcaSummary || rootCause || correctiveAction || preventiveAction)
  };
}

function normalizeDashboardPayload(payload) {
  const p = unwrap(payload);
  const ageing = unwrap(p.ageing || p.ageing_result || p.morning || {});
  const sla = unwrap(p.sla || p.sla_result || {});
  const daily = unwrap(p.daily || p.effectiveness || {});
  const devops = unwrap(p.devops || p.devops_result || {});
  const ticketsRaw = p.tickets || ageing.tickets || p.ageing_tickets || [];
  const slaBreachesRaw = p.slaBreaches || p.sla_breaches || p.breached_incidents || sla.breaches || sla.breached_incidents || [];
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
    sla: { atRisk: slaAtRisk, critical: slaCritical, breached: slaBreached, totalAttention: num(sla.total_sla_attention ?? sla.totalAttention ?? p.total_sla_attention, slaAtRisk + slaBreached), compliance: p.sla_compliance ?? sla.compliance ?? null },
    daily: {
      morning: num(daily.morning ?? daily.morning_count, ageingTotal),
      updated: num(daily.updated ?? daily.updated_count),
      closed: num(daily.closed ?? daily.closed_count),
      pending: num(daily.pending ?? daily.pending_count),
      actionRate: daily.actionRate ?? daily.action_rate ?? null,
      backlogReduction: daily.backlogReduction ?? daily.backlog_reduction ?? null
    },
    tickets: Array.isArray(ticketsRaw) ? ticketsRaw.map(normalizeTicket) : [],
    slaBreaches: Array.isArray(slaBreachesRaw) ? slaBreachesRaw.map(normalizeSlaBreach) : [],
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

  if (!callback.sla && (p.at_risk_count !== undefined || p.critical_count !== undefined || p.breached_count !== undefined || p.total_sla_attention !== undefined || Array.isArray(p.breached_incidents))) {
    callback.sla = {
      at_risk_count: p.at_risk_count,
      critical_count: p.critical_count,
      breached_count: p.breached_count,
      total_sla_attention: p.total_sla_attention,
      breached_incidents: Array.isArray(p.breached_incidents) ? p.breached_incidents : []
    };
  } else if (callback.sla && Array.isArray(p.breached_incidents) && !Array.isArray(callback.sla.breached_incidents)) {
    callback.sla.breached_incidents = p.breached_incidents;
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
  return p.ai_analysis
    || p.aiAnalysis
    || p.answer
    || p.analysis
    || p.generated_output
    || p.generatedOutput
    || p.text
    || p.message
    || p.response
    || p.ai_sla_analysis?.generated_output
    || JSON.stringify(p);
}

function pickIncidentNumber(payload, fallback = null) {
  const p = unwrap(payload);
  return p.incident_number || p.incidentNumber || fallback;
}

function embeddedRcaAnswer(row = {}) {
  const number = row.incident_number || row.number || row.id || 'Incident';
  const factors = Array.isArray(row.contributing_factors) ? row.contributing_factors.filter(Boolean) : [];
  const evidence = Array.isArray(row.evidence) ? row.evidence.filter(Boolean) : [];
  const parts = [`${number} — SLA Breach RCA`];
  if (row.rca_summary) parts.push(`RCA Summary\n${row.rca_summary}`);
  if (row.likely_root_cause) parts.push(`Likely Root Cause\n${row.likely_root_cause}`);
  if (factors.length) parts.push(`Contributing Factors\n${factors.map(x => `• ${x}`).join('\n')}`);
  if (evidence.length) parts.push(`Evidence\n${evidence.map(x => `• ${x}`).join('\n')}`);
  if (row.corrective_action) parts.push(`Corrective Action\n${row.corrective_action}`);
  if (row.preventive_action) parts.push(`Preventive Action\n${row.preventive_action}`);
  if (row.confidence) parts.push(`Confidence\n${row.confidence}`);
  return parts.join('\n\n');
}

function findEmbeddedRca(incidentNumber) {
  if (!incidentNumber || !latestMoveworksResult) return null;
  const dashboard = normalizeDashboardPayload(latestMoveworksResult);
  const key = String(incidentNumber).trim().toUpperCase();
  return (dashboard.slaBreaches || []).find(row => {
    const n = String(row.incident_number || row.number || row.id || '').trim().toUpperCase();
    return n === key;
  }) || null;
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
      version: '12.9.5',
      moveworksConfigured: Boolean(process.env.MOVEWORKS_DASHBOARD_URL || process.env.MOVEWORKS_AGEING_URL || process.env.MOVEWORKS_SLA_URL || process.env.MOVEWORKS_TRIGGER_URL),
      aiConfigured: Boolean(process.env.MOVEWORKS_AI_URL || process.env.MOVEWORKS_TRIGGER_URL || process.env.MOVEWORKS_RCA_URL),
      rcaDirectConfigured: Boolean(process.env.MOVEWORKS_RCA_URL || process.env.MOVEWORKS_AI_URL),
      triggerConfigured: Boolean(process.env.MOVEWORKS_TRIGGER_URL),
      callbackReady: Boolean(latestMoveworksResult),
      callbackEndpoint: '/api/moveworks/result'
    });
  }

  try {
    if (url.pathname === '/api/config' && req.method === 'GET') {
      return sendJson(res, 200, {
        appName: 'AI Operations Agent + Governance Command Center',
        eventName: 'Moveworks Hackathon',
        refreshSeconds: 300,
        integrations: {
          dashboard: Boolean(process.env.MOVEWORKS_DASHBOARD_URL || process.env.MOVEWORKS_AGEING_URL || process.env.MOVEWORKS_SLA_URL || process.env.MOVEWORKS_TRIGGER_URL),
          ai: Boolean(process.env.MOVEWORKS_AI_URL || process.env.MOVEWORKS_TRIGGER_URL || process.env.MOVEWORKS_RCA_URL),
          rcaDirect: Boolean(process.env.MOVEWORKS_RCA_URL || process.env.MOVEWORKS_AI_URL),
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
      const incidentFromCallback = body.incident_number || body.incidentNumber || normalizedInput.incident_number || normalizedInput.incidentNumber || null;
      // Prefer the request_id supplied by Moveworks. If the listener/compound action
      // dropped it, recover it from the pending incident request registered when
      // /api/ai/query started the RCA. This makes the flow resilient to mapping gaps.
      const reqId = body.request_id || body.requestId || normalizedInput.request_id || normalizedInput.requestId || resolvePendingRequestId(incidentFromCallback) || null;

      // Incident RCA callbacks are request-scoped. Keep them separate from the
      // dashboard governance snapshot so an RCA response never resets KPI counts.
      if (isIncidentRcaPayload(normalizedInput)) {
        const rcaStored = {
          ...normalizedInput,
          request_id: reqId,
          incident_number: incidentFromCallback,
          ai_analysis: body.ai_analysis || normalizedInput.ai_analysis || normalizedInput.analysis || null,
          type: body.type || normalizedInput.type || 'incident_rca',
          prompt: body.prompt || null,
          receivedAt
        };
        saveRcaResult(rcaStored);
        clearPendingRca(rcaStored.incident_number, rcaStored.request_id);
        return sendJson(res, 200, {
          status: 'ok',
          message: 'Moveworks RCA result received',
          receivedAt,
          request_id: rcaStored.request_id,
          incident_number: rcaStored.incident_number
        });
      }

      const dashboard = normalizeDashboardPayload(normalizedInput);
      const stored = {
        ...normalizedInput,
        ...dashboard,
        request_id: reqId,
        prompt: body.prompt || null,
        receivedAt
      };
      saveLatestResult(stored);
      if (stored.request_id) resultsByRequest.set(String(stored.request_id), stored);
      return sendJson(res, 200, { status: 'ok', message: 'Moveworks governance result received', receivedAt, request_id: stored.request_id });
    }

    if (url.pathname === '/api/moveworks/result' && req.method === 'GET') {
      const requestedId = url.searchParams.get('request_id');
      const since = url.searchParams.get('since');

      // A request_id means the browser is waiting for one specific async AI/RCA
      // response. Never satisfy it with an unrelated governance snapshot.
      if (requestedId) {
        let exact = resultsByRequest.get(requestedId)
          || (latestRcaResult && String(latestRcaResult.request_id || '') === requestedId ? latestRcaResult : null);
        if (!exact) {
          try {
            if (fs.existsSync(rcaStorePath)) {
              const diskRca = JSON.parse(fs.readFileSync(rcaStorePath, 'utf8'));
              if (String(diskRca?.request_id || diskRca?.requestId || '') === requestedId) {
                exact = diskRca;
                latestRcaResult = diskRca;
                resultsByRequest.set(requestedId, diskRca);
              }
            }
          } catch (err) {
            console.warn('Unable to read persisted RCA result:', err.message);
          }
        }
        if (!exact) return sendJson(res, 200, { status: 'waiting', message: 'Waiting for matching Moveworks RCA result', request_id: requestedId });
        if (since) {
          const resultTime = Date.parse(exact.receivedAt || exact.generatedAt || 0);
          const sinceTime = Date.parse(since);
          if (Number.isFinite(sinceTime) && (!Number.isFinite(resultTime) || resultTime <= sinceTime)) {
            return sendJson(res, 200, { status: 'waiting', message: 'Waiting for a newer matching Moveworks RCA result', request_id: requestedId });
          }
        }
        return sendJson(res, 200, { status: 'ready', result: exact });
      }

      if (!latestMoveworksResult) return sendJson(res, 200, { status: 'waiting', message: 'No Moveworks governance result received yet' });
      if (since) {
        const resultTime = Date.parse(latestMoveworksResult.receivedAt || latestMoveworksResult.generatedAt || 0);
        const sinceTime = Date.parse(since);
        if (Number.isFinite(sinceTime) && (!Number.isFinite(resultTime) || resultTime <= sinceTime)) {
          return sendJson(res, 200, { status: 'waiting', message: 'Waiting for a newer Moveworks governance result' });
        }
      }
      return sendJson(res, 200, { status: 'ready', result: latestMoveworksResult });
    }

    if (url.pathname === '/api/rca/debug' && req.method === 'GET') {
      const requestedId = url.searchParams.get('request_id');
      const incident = String(url.searchParams.get('incident_number') || '').toUpperCase();
      const byRequest = requestedId ? resultsByRequest.get(requestedId) : null;
      const pending = incident ? pendingRcaByIncident.get(incident) : null;
      return sendJson(res, 200, {
        requestedId: requestedId || null,
        incidentNumber: incident || null,
        inMemoryMatch: Boolean(byRequest),
        latestRcaRequestId: latestRcaResult?.request_id || latestRcaResult?.requestId || null,
        latestRcaIncident: latestRcaResult?.incident_number || latestRcaResult?.incidentNumber || null,
        pending: pending || null,
        resultStorePath,
        rcaStorePath,
        pendingRcaStorePath
      });
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
      const immediate = immediateGovernanceAnswer(prompt);
      if (immediate) return sendJson(res, 200, { answer: immediate, mode: 'instant-kpi' });

      const startedAt = new Date().toISOString();
      const reqId = requestId();
      const incidentNumber = extractIncidentNumber(prompt);
      const rcaIntent = isRcaPrompt(prompt);

      // Incident RCA first reads the RCA already embedded in the latest
      // SLA_Governance dashboard snapshot. This is the preferred path and
      // requires no second Moveworks workflow, callback or polling.
      if (rcaIntent) {
        const embedded = findEmbeddedRca(incidentNumber);
        if (embedded && embedded.hasRca) {
          return sendJson(res, 200, {
            answer: embeddedRcaAnswer(embedded),
            mode: 'embedded-dashboard-rca',
            incident_number: incidentNumber,
            incidentNumber,
            request_id: reqId,
            requestId: reqId,
            started_at: startedAt,
            startedAt
          });
        }

        // Optional fallback only when a direct synchronous RCA URL is configured.
        // In the embedded-RCA design this setting is not required.
        const rcaUrl = process.env.MOVEWORKS_RCA_URL || process.env.MOVEWORKS_AI_URL;
        if (!rcaUrl) {
          const message = embedded
            ? `I found ${incidentNumber} in the latest SLA governance snapshot, but RCA details are not available in that record. Run SLA_Governance again to refresh the embedded RCA data.`
            : `I could not find ${incidentNumber} in the latest breached-incident governance snapshot. Run SLA_Governance again and refresh the dashboard.`;
          return sendJson(res, 200, {
            answer: message,
            mode: 'embedded-dashboard-rca-unavailable',
            incident_number: incidentNumber,
            incidentNumber,
            request_id: reqId,
            requestId: reqId,
            started_at: startedAt,
            startedAt
          });
        }

        const payload = await callMoveworks(rcaUrl, {
          method: 'POST',
          timeoutMs: rcaRequestTimeoutMs,
          body: {
            prompt,
            incident_number: incidentNumber,
            incidentNumber: incidentNumber,
            intent: 'incident_rca',
            user_email: body.user_email || process.env.DEFAULT_NOTIFICATION_EMAIL || undefined,
            context: body.context || 'dashboard',
            source: 'azure_app_service_dashboard',
            requested_at: startedAt
          }
        });

        const answer = pickAiAnswer(payload);
        const returnedIncident = pickIncidentNumber(payload, incidentNumber);

        if (!answer || answer === '{}' || answer === 'null') {
          return sendJson(res, 502, {
            error: `Moveworks returned no RCA analysis for ${incidentNumber}. The RCA endpoint must return ai_analysis, analysis, generated_output, answer, text or response.`
          });
        }

        return sendJson(res, 200, {
          answer,
          mode: 'synchronous-rca',
          incident_number: returnedIncident,
          incidentNumber: returnedIncident,
          request_id: reqId,
          requestId: reqId,
          started_at: startedAt,
          startedAt,
          raw: process.env.EXPOSE_UPSTREAM_RAW === 'true' ? payload : undefined
        });
      }

      // Non-RCA AI prompts can keep using the existing synchronous AI endpoint.
      if (process.env.MOVEWORKS_AI_URL) {
        const payload = await callMoveworks(process.env.MOVEWORKS_AI_URL, {
          method: 'POST',
          body: {
            prompt,
            request_id: reqId,
            intent: 'governance_ai',
            user_email: body.user_email || process.env.DEFAULT_NOTIFICATION_EMAIL || undefined,
            context: body.context || 'dashboard'
          }
        });
        return sendJson(res, 200, { answer: pickAiAnswer(payload), mode: 'synchronous-ai', requestId: reqId, raw: process.env.EXPOSE_UPSTREAM_RAW === 'true' ? payload : undefined });
      }

      if (!process.env.MOVEWORKS_TRIGGER_URL) return sendJson(res, 503, { error: 'MOVEWORKS_AI_URL or MOVEWORKS_TRIGGER_URL is not configured' });
      const payload = await callMoveworks(process.env.MOVEWORKS_TRIGGER_URL, {
        method: 'POST',
        body: {
          event_type: 'ticket_governance.ai_prompt',
          prompt,
          request_id: reqId,
          intent: 'governance_ai',
          user_email: body.user_email || process.env.DEFAULT_NOTIFICATION_EMAIL || undefined,
          context: body.context || 'dashboard',
          source: 'azure_app_service_dashboard',
          requested_at: startedAt,
          callback_url: `${externalBaseUrl(req)}/api/moveworks/result`
        }
      });
      return sendJson(res, 202, {
        answer: 'Moveworks accepted the governance request. Waiting for the live governance callback…',
        mode: 'webhook-trigger',
        requestId: reqId,
        request_id: reqId,
        startedAt,
        started_at: startedAt,
        callbackUrl: `${externalBaseUrl(req)}/api/moveworks/result`,
        moveworks: payload
      });
    }

    const assignMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/assign$/);
    if (assignMatch && req.method === 'POST') {
      const body = await readJsonBody(req);
      const assignee = String(body.assignee || '').trim();
      const assignmentGroup = String(body.assignment_group || body.assignmentGroup || '').trim();
      const reason = String(body.reason || '').trim();
      if (!assignee && !assignmentGroup) return sendJson(res, 400, { error: 'assignment_group or assignee is required' });
      if (!process.env.MOVEWORKS_ASSIGN_URL) return sendJson(res, 503, { error: 'MOVEWORKS_ASSIGN_URL is not configured' });
      const payload = await callMoveworks(process.env.MOVEWORKS_ASSIGN_URL, {
        method: 'POST',
        body: {
          ticket_id: decodeURIComponent(assignMatch[1]),
          assignment_group: assignmentGroup || undefined,
          assignee: assignee || undefined,
          reason: reason || undefined,
          source: body.source || 'dashboard'
        }
      });
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
