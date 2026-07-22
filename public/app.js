'use strict';

const state = {
  page: 'command', search: '', selectedTicket: null, loading: true, live: false, error: '', aiBusy: false,
  lastRefresh: new Date(), morning: 0, updated: 0, closed: 0, pending: 0,
  ageingTotal: 0, incidentCount: 0, ritmCount: 0, taskCount: 0,
  slaAtRisk: 0, slaCritical: 0, slaBreached: 0, slaCompliance: null,
  devopsHygiene: 0, devopsNonCompliant: 0, devopsLargestGap: '',
  tickets: [], slaBreaches: [], devopsItems: [], trend: [], aiBriefing: null
};

const nav = [
  ['command','Command Center','⌂'], ['ageing','Ageing Tickets','◷'], ['sla','SLA Intelligence','✓'],
  ['devops','DevOps Governance','▣'], ['ai','Ask Governance AI','✦']
];

const app = document.getElementById('app');
const escapeHtml = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const actionRate = () => state.morning > 0 ? Math.round(((state.updated + state.closed) / state.morning) * 100) : 0;
const backlogReduction = () => state.morning > 0 ? Math.round((state.closed / state.morning) * 100) : 0;

function badge(text, tone='info') { return `<span class="badge ${tone}">${escapeHtml(text)}</span>`; }
function progress(value) { return `<div class="progress"><span style="width:${Math.max(0,Math.min(100,Number(value)||0))}%"></span></div>`; }
function button(label, action, arg='', primary=false) { return `<button class="btn${primary?' primary':''}" data-action="${action}" data-arg="${escapeHtml(arg)}">${escapeHtml(label)}</button>`; }
function toast(message) { const el=document.getElementById('toast'); el.textContent=message; el.hidden=false; clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>{el.hidden=true;},3000); }
function metric(label, value, sub, tone='blue') { return `<div class="metric tone-${tone}"><div><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-sub">${escapeHtml(sub)}</div></div></div>`; }
function liveBanner() {
  if (state.loading) return `<div class="statusbar loading">Connecting to Moveworks…</div>`;
  if (state.live) return `<div class="statusbar live">● Live data from Moveworks · refreshed ${state.lastRefresh.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>`;
  return `<div class="statusbar error">⚠ ${escapeHtml(state.error || 'Moveworks integration is not configured')}</div>`;
}

function layout(content) {
  const title = nav.find(x => x[0] === state.page)?.[1] || 'Command Center';
  return `<div class="shell"><aside class="sidebar">
    <div class="brand"><div class="brandmark">✦</div><div><strong>AI Governance</strong><span>Command Center</span></div></div>
    <div class="hackathon-badge">Moveworks Hackathon</div>
    <nav>${nav.map(([key,label,icon])=>`<button class="navbtn ${state.page===key?'active':''}" data-nav="${key}"><span>${icon}</span>${label}</button>`).join('')}</nav>
    <div class="demo-note">${badge(state.live?'Live':'Integration','success')}<p>Moveworks is the AI and orchestration layer. ServiceNow and Azure DevOps remain systems of record.</p></div>
  </aside><main class="main">
    <header class="topbar"><div><h1>${escapeHtml(title)}</h1><p>ServiceNow + Azure DevOps + Moveworks Agent Studio</p></div><div class="refresh">Auto refresh: 5 min</div></header>
    ${liveBanner()}${content}
  </main></div>`;
}

function ticketTable(rows) {
  if (!rows.length) return `<div class="empty">${state.live?'No matching ageing tickets returned by Moveworks.':'Waiting for live ticket data.'}</div>`;
  return `<div class="tablewrap"><table><thead><tr><th>Ticket</th><th>Age</th><th>Last update</th><th>SLA</th><th>Team / Assignee</th><th>Risk</th><th>Actions</th></tr></thead><tbody>${rows.map(t=>`<tr>
    <td><strong>${escapeHtml(t.id)}</strong><div class="muted">${escapeHtml(t.type)} · ${escapeHtml(t.priority)} · ${escapeHtml(t.title)}</div></td>
    <td><strong>${Number(t.age)||0}d</strong></td><td>${Number(t.stale)||0}d ago</td>
    <td>${badge(t.sla||'N/A',t.sla==='Breached'?'danger':t.sla==='At Risk'?'warning':'info')}</td>
    <td><strong>${escapeHtml(t.team||'')}</strong><div class="muted">${escapeHtml(t.assignee||'Unassigned')}</div></td>
    <td><strong>${Number(t.risk)||0}%</strong>${progress(t.risk)}</td>
    <td class="actions">${button('Assign','assign',t.id)}${button('Notify','notifyTicket',t.id)}${button('Ask AI','aiTicket',t.id,true)}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function renderCommand() {
  const highest=[...state.tickets].sort((a,b)=>(b.risk||0)-(a.risk||0)).slice(0,3);
  const trend = state.trend.length ? state.trend.map((x,i)=>`<span>${['Mon','Tue','Wed','Thu','Fri'][i]||`W${i+1}`} ${x}%</span>`).join('') : '<span>No trend snapshot yet</span>';
  return layout(`<section class="metrics four">
    ${metric('Ageing Tickets',state.ageingTotal,'>15 days and stale >5 days','orange')}
    ${metric('SLA Breaches',state.slaBreached,'Live breached SLA records','red')}
    ${metric('DevOps Hygiene',state.devopsHygiene?state.devopsHygiene+'%':'—',state.devopsHygiene?'Live governance score':'DevOps endpoint not yet connected','purple')}
    ${metric('Action Rate',actionRate()+'%',state.morning?`${state.updated+state.closed} of ${state.morning} actioned today`:'Awaiting morning/EOD snapshot','green')}
  </section>
  <section class="twocol"><div class="card"><div class="cardhead"><div><h2>Today's Governance Effectiveness</h2><p>Morning ageing backlog versus end-of-day outcome</p></div>${badge(actionRate()+'% Actioned','success')}</div>
    <div class="effect"><div><span>Morning</span><strong>${state.morning}</strong></div><div><span>Updated</span><strong>${state.updated}</strong></div><div><span>Closed</span><strong>${state.closed}</strong></div><div><span>Pending</span><strong>${state.pending}</strong></div></div>
    <div class="rate"><span>Action Rate</span><strong>${actionRate()}%</strong></div>${progress(actionRate())}
    <div class="rate secondary"><span>Backlog Reduction</span><strong>${backlogReduction()}%</strong></div><div class="trend">${trend}</div>${button('Send EOD Report','sendEod','',true)}</div>
    <div class="card"><h2>AI Governance Assistant</h2><p>Ask Moveworks about ageing tickets, SLA risk, RCA or DevOps hygiene.</p>
      <div class="mini-ai"><input id="quickAiInput" placeholder="Why are our SLAs breaching?">${button('Ask AI','quickAi','',true)}</div>
      <div class="brief">⚠ <span><strong>${state.slaCritical}</strong> critical SLA items need attention.</span></div>
      <div class="brief">◷ <span><strong>${state.pending}</strong> ageing tickets remain pending at EOD.</span></div>
    </div></section>
    <section class="card"><div class="cardhead"><div><h2>Highest Risk Ageing Tickets</h2><p>Prioritized from live governance data</p></div>${button('View all','nav','ageing')}</div>${ticketTable(highest)}</section>`);
}

function renderAgeing() {
  const q=state.search.trim().toLowerCase();
  const rows=q?state.tickets.filter(t=>[t.id,t.type,t.title,t.team,t.assignee].join(' ').toLowerCase().includes(q)):state.tickets;
  return layout(`<section class="metrics four">${metric('Incidents',state.incidentCount,'Ageing INCs','orange')}${metric('RITMs',state.ritmCount,'Ageing requests','blue')}${metric('Tasks',state.taskCount,'Ageing tasks','purple')}${metric('Total',state.ageingTotal,'Governance backlog','red')}</section><section class="card"><div class="cardhead"><div><h2>Ageing Ticket Governance</h2><p>Open INC, RITM and TASK records requiring attention</p></div><input id="ticketSearch" class="search" placeholder="Search ticket, team or owner" value="${escapeHtml(state.search)}"></div>${ticketTable(rows)}</section>`);
}

function renderSla() {
  const cards = state.slaBreaches.length ? state.slaBreaches.map(x=>`<div class="slacard"><div class="cardhead"><strong>${escapeHtml(x.id||x.number||'SLA')}</strong>${badge(x.team||'ServiceNow')}</div><p>${escapeHtml(x.summary||x.description||'Breached SLA record')}</p><div class="slameta"><span>Breach <strong>${escapeHtml(x.breach||x.percentage||'')}</strong></span><span>AI RCA <strong>${escapeHtml(x.cause||'Available via Ask AI')}</strong></span><span>Confidence <strong>${escapeHtml(x.confidence||'')}</strong></span></div>${button('Investigate with AI','aiPrompt',`Analyze SLA breach ${x.id||x.number||''}`,true)}</div>`).join('') : '<div class="empty">No detailed breach records returned by the dashboard endpoint.</div>';
  return layout(`<section class="metrics four">${metric('SLA At Risk',state.slaAtRisk,'≥75% consumed','orange')}${metric('Critical SLA',state.slaCritical,'≥90% consumed','red')}${metric('SLA Breached',state.slaBreached,'Requires investigation','red')}${metric('SLA Compliance',state.slaCompliance?state.slaCompliance+'%':'—','Current period','green')}</section><section class="card"><h2>SLA Breach Intelligence</h2><div class="slagrid">${cards}</div></section>`);
}

function renderDevops() {
  const rows=state.devopsItems.length?`<div class="tablewrap"><table><thead><tr><th>Work Item</th><th>Type</th><th>Owner</th><th>Missing</th><th>Score</th><th>Action</th></tr></thead><tbody>${state.devopsItems.map(x=>`<tr><td><strong>${escapeHtml(x.id||x.number)}</strong><div class="muted">${escapeHtml(x.title||'')}</div></td><td>${escapeHtml(x.type||'')}</td><td>${escapeHtml(x.owner||'')}</td><td>${(x.missing||[]).map(m=>badge(m,'danger')).join(' ')}</td><td><strong>${Number(x.score)||0}%</strong>${progress(x.score)}</td><td>${button('Ask AI','aiPrompt',`Analyze DevOps work item ${x.id||x.number}`,true)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Connect MOVEWORKS_DEVOPS_URL to replace this with real Azure DevOps governance data.</div>';
  return layout(`<section class="metrics three">${metric('Overall Hygiene',state.devopsHygiene?state.devopsHygiene+'%':'—','Live DevOps governance','green')}${metric('Non-Compliant',state.devopsNonCompliant,'Open work items','orange')}${metric('Largest Gap',state.devopsLargestGap||'—','Metadata hygiene','purple')}</section><section class="card"><h2>Azure DevOps Governance</h2>${rows}</section>`);
}

function renderAi(answer='') {
  return layout(`<section class="ailayout"><div class="card"><div class="aihead"><div class="orb">✦</div><div><h2>Moveworks Governance AI</h2><p>Real AI prompt integrated into the management dashboard.</p></div></div>
    <div class="chips"><button data-action="aiPrompt" data-arg="What should management focus on today?">What should management focus on today?</button><button data-action="aiPrompt" data-arg="Why are SLA breaches happening?">Why are SLA breaches happening?</button><button data-action="aiPrompt" data-arg="Which ageing tickets are highest risk?">Highest-risk ageing tickets</button><button data-action="aiPrompt" data-arg="Summarize current governance risks and corrective actions">Summarize governance risks</button></div>
    <textarea id="aiInput" placeholder="Ask Moveworks AI about tickets, SLA, RCA or DevOps hygiene..."></textarea>${button(state.aiBusy?'Analyzing…':'Analyze','analyzeText','',true)}
    ${answer?`<div class="aianswer"><strong>✦ Moveworks AI response</strong><p>${escapeHtml(answer).replace(/\n/g,'<br>')}</p><small>Generated from the configured Moveworks AI workflow.</small></div>`:''}
  </div><div class="card"><h2>Connected Intelligence</h2><div class="source"><strong>ServiceNow</strong><span>INC, RITM, TASK and SLA</span></div><div class="source"><strong>Azure DevOps</strong><span>Epic, Feature, Story and Task hygiene</span></div><div class="source"><strong>Moveworks Agent Studio</strong><span>Reasoning, governance actions and notifications</span></div></div></section>`);
}

function render() {
  if(state.page==='ageing') app.innerHTML=renderAgeing(); else if(state.page==='sla') app.innerHTML=renderSla(); else if(state.page==='devops') app.innerHTML=renderDevops(); else if(state.page==='ai') app.innerHTML=renderAi(window.__aiAnswer||''); else app.innerHTML=renderCommand();
}

async function api(path, options={}) {
  const response=await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||`Request failed (${response.status})`);
  return data;
}

async function refreshDashboard(showToast=false) {
  state.loading=true; state.error=''; render();
  try {
    const data=await api('/api/dashboard');
    state.live=true; state.ageingTotal=data.ageing?.total||0; state.incidentCount=data.ageing?.incidentCount||0; state.ritmCount=data.ageing?.ritmCount||0; state.taskCount=data.ageing?.taskCount||0;
    state.slaAtRisk=data.sla?.atRisk||0; state.slaCritical=data.sla?.critical||0; state.slaBreached=data.sla?.breached||0; state.slaCompliance=data.sla?.compliance??null;
    state.morning=data.daily?.morning||0; state.updated=data.daily?.updated||0; state.closed=data.daily?.closed||0; state.pending=data.daily?.pending||0;
    state.tickets=Array.isArray(data.tickets)?data.tickets:[]; state.slaBreaches=Array.isArray(data.slaBreaches)?data.slaBreaches:[];
    state.devopsHygiene=data.devops?.hygiene||0; state.devopsNonCompliant=data.devops?.nonCompliant||0; state.devopsLargestGap=data.devops?.largestGap||''; state.devopsItems=Array.isArray(data.devops?.items)?data.devops.items:[];
    state.trend=Array.isArray(data.trend)?data.trend:[]; state.aiBriefing=data.aiBriefing||null; state.lastRefresh=new Date(data.generatedAt||Date.now());
    if(showToast) toast('Live Moveworks data refreshed');
  } catch(err) { state.live=false; state.error=err.message; }
  finally { state.loading=false; render(); }
}

async function askAi(prompt) {
  const clean=String(prompt||'').trim(); if(!clean) return toast('Enter a question first.');
  state.aiBusy=true; state.page='ai'; window.__aiAnswer=''; render();
  try { const result=await api('/api/ai/query',{method:'POST',body:JSON.stringify({prompt:clean})}); window.__aiAnswer=result.answer||'No AI response returned.'; }
  catch(err) { window.__aiAnswer=`Unable to contact Moveworks AI: ${err.message}`; }
  finally { state.aiBusy=false; render(); }
}

function openAssign(ticketId) {
  const t=state.tickets.find(x=>x.id===ticketId); if(!t) return; state.selectedTicket=t;
  const overlay=document.createElement('div'); overlay.className='modalback'; overlay.id='assignModal';
  overlay.innerHTML=`<div class="modal"><h2>Assign ${escapeHtml(t.id)}</h2><p>Current assignee: <strong>${escapeHtml(t.assignee)}</strong></p><input id="assigneeSelect" class="search" placeholder="New assignee or queue"><div class="modalactions">${button('Cancel','closeModal')}${button('Confirm assignment','confirmAssign','',true)}</div></div>`;
  document.body.appendChild(overlay);
}

async function handleAction(action,arg) {
  if(action==='nav'){state.page=arg;render();return;} if(action==='assign')return openAssign(arg); if(action==='closeModal'){document.getElementById('assignModal')?.remove();return;}
  if(action==='confirmAssign') { const input=document.getElementById('assigneeSelect'); if(!state.selectedTicket||!input?.value.trim()) return toast('Enter an assignee.'); try { await api(`/api/tickets/${encodeURIComponent(state.selectedTicket.id)}/assign`,{method:'POST',body:JSON.stringify({assignee:input.value.trim()})}); toast(`${state.selectedTicket.id} assignment requested through Moveworks`); document.getElementById('assignModal')?.remove(); await refreshDashboard(); } catch(err){toast(err.message);} return; }
  if(action==='notifyTicket'){try{await api(`/api/tickets/${encodeURIComponent(arg)}/notify`,{method:'POST',body:'{}'});toast(`Moveworks notification triggered for ${arg}`);}catch(err){toast(err.message);}return;}
  if(action==='sendEod'){try{await api('/api/reports/eod',{method:'POST',body:JSON.stringify({morning:state.morning,updated:state.updated,closed:state.closed,pending:state.pending,action_rate:actionRate(),backlog_reduction:backlogReduction()})});toast('EOD report triggered through Moveworks');}catch(err){toast(err.message);}return;}
  if(action==='aiTicket') return askAi(`Analyze ticket ${arg}. Explain the risk, likely blockers, SLA impact, and recommended next actions.`);
  if(action==='aiPrompt') return askAi(arg);
  if(action==='quickAi') return askAi(document.getElementById('quickAiInput')?.value||'');
  if(action==='analyzeText') return askAi(document.getElementById('aiInput')?.value||'');
}

document.addEventListener('click',e=>{const navEl=e.target.closest('[data-nav]');if(navEl){state.page=navEl.dataset.nav;render();return;}const actionEl=e.target.closest('[data-action]');if(actionEl)handleAction(actionEl.dataset.action,actionEl.dataset.arg||'');});
document.addEventListener('input',e=>{if(e.target.id==='ticketSearch'){state.search=e.target.value;render();const el=document.getElementById('ticketSearch');if(el){el.focus();el.setSelectionRange(state.search.length,state.search.length);}}});

setInterval(()=>refreshDashboard(false),5*60*1000);
render(); refreshDashboard(false);
