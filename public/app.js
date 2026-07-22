'use strict';

const state = {
  page: 'command',
  search: '',
  selectedTicket: null,
  morning: 10,
  updated: 6,
  closed: 2,
  pending: 2,
  lastRefresh: new Date(),
  tickets: [
    { id:'INC001234', type:'INC', title:'VPN users unable to connect', age:19, stale:7, sla:'Breached', team:'Network Ops', assignee:'Ravi', priority:'P2', risk:92 },
    { id:'INC001457', type:'INC', title:'Azure VM intermittent connectivity', age:25, stale:9, sla:'At Risk', team:'Cloud Ops', assignee:'Sarah', priority:'P2', risk:86 },
    { id:'RITM004342', type:'RITM', title:'New application access request', age:17, stale:6, sla:'N/A', team:'Identity', assignee:'John', priority:'P3', risk:61 },
    { id:'TASK009812', type:'TASK', title:'Validate firewall rule implementation', age:21, stale:8, sla:'N/A', team:'Security Ops', assignee:'Meera', priority:'P3', risk:72 },
    { id:'INC001611', type:'INC', title:'Database performance degradation', age:18, stale:6, sla:'Breached', team:'Database', assignee:'Anil', priority:'P1', risk:95 }
  ],
  slaBreaches: [
    { id:'INC001234', team:'Network Ops', breach:'4h 31m', cause:'Incorrect Routing', confidence:'High', summary:'The incident was reassigned twice before reaching the correct resolver group.' },
    { id:'INC001611', team:'Database', breach:'2h 18m', cause:'Technical Complexity', confidence:'Medium', summary:'Extended diagnostics and dependency validation delayed restoration.' },
    { id:'INC001702', team:'Cloud Ops', breach:'1h 47m', cause:'Delayed Assignment', confidence:'High', summary:'Initial ownership was not established within the expected response window.' }
  ],
  devopsItems: [
    { id:'US-3251', type:'User Story', title:'Manager approval workflow', owner:'Amit', score:60, missing:['Acceptance Criteria','Iteration Path'] },
    { id:'US-3261', type:'User Story', title:'Employee notification experience', owner:'Priya', score:80, missing:['Iteration Path'] },
    { id:'TASK-1142', type:'Task', title:'Build approval screen', owner:'Dev', score:75, missing:['Description'] },
    { id:'FEATURE-410', type:'Feature', title:'Manager approvals', owner:'Karan', score:90, missing:['Tags'] }
  ],
  trend: [65,72,78,82,80]
};

const nav = [
  ['command','Command Center','⌂'],
  ['ageing','Ageing Tickets','◷'],
  ['sla','SLA Intelligence','✓'],
  ['devops','DevOps Governance','▣'],
  ['ai','Ask Governance AI','✦']
];

const app = document.getElementById('app');
const escapeHtml = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const actionRate = () => Math.round(((state.updated + state.closed) / state.morning) * 100);
const backlogReduction = () => Math.round((state.closed / state.morning) * 100);

function badge(text, tone='info') { return `<span class="badge ${tone}">${escapeHtml(text)}</span>`; }
function progress(value) { return `<div class="progress"><span style="width:${Math.max(0, Math.min(100, Number(value)||0))}%"></span></div>`; }
function button(label, action, arg='', primary=false) { return `<button class="btn${primary?' primary':''}" data-action="${action}" data-arg="${escapeHtml(arg)}">${escapeHtml(label)}</button>`; }
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function metric(label, value, sub, tone='blue') {
  return `<div class="metric tone-${tone}"><div><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-sub">${escapeHtml(sub)}</div></div></div>`;
}

function layout(content) {
  const title = nav.find(x => x[0] === state.page)?.[1] || 'Command Center';
  const refresh = state.lastRefresh.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  return `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="brandmark">✦</div><div><strong>AI Governance</strong><span>Command Center</span></div></div>
      <nav>${nav.map(([key,label,icon]) => `<button class="navbtn ${state.page===key?'active':''}" data-nav="${key}"><span>${icon}</span>${label}</button>`).join('')}</nav>
      <div class="demo-note">${badge('Demo Mode','success')}<p>Mock data now. Integration-ready for ServiceNow, Azure DevOps and Moveworks.</p></div>
    </aside>
    <main class="main">
      <header class="topbar"><div><h1>${escapeHtml(title)}</h1><p>ServiceNow + Azure DevOps + Moveworks Agent Studio</p></div><div class="refresh">● Auto refresh: 5 min · ${refresh}</div></header>
      ${content}
    </main>
  </div>`;
}

function ticketTable(rows) {
  if (!rows.length) return '<div class="empty">No tickets match your search.</div>';
  return `<div class="tablewrap"><table><thead><tr><th>Ticket</th><th>Age</th><th>Last update</th><th>SLA</th><th>Team / Assignee</th><th>Risk</th><th>Actions</th></tr></thead><tbody>${rows.map(t => `<tr>
    <td><strong>${t.id}</strong><div class="muted">${t.type} · ${t.priority} · ${escapeHtml(t.title)}</div></td>
    <td><strong>${t.age}d</strong></td><td>${t.stale}d ago</td>
    <td>${badge(t.sla, t.sla==='Breached'?'danger':t.sla==='At Risk'?'warning':'info')}</td>
    <td><strong>${escapeHtml(t.team)}</strong><div class="muted">${escapeHtml(t.assignee)}</div></td>
    <td><strong>${t.risk}%</strong>${progress(t.risk)}</td>
    <td class="actions">${button('Assign','assign',t.id)}${button('Notify','notifyTicket',t.id)}${button('Ask AI','aiTicket',t.id,true)}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function renderCommand() {
  const highest = [...state.tickets].sort((a,b)=>b.risk-a.risk).slice(0,3);
  return layout(`
    <section class="metrics four">
      ${metric('Ageing Tickets','10','>15 days and stale >5 days','orange')}
      ${metric('SLA Breaches','12','INC breaches this period','red')}
      ${metric('DevOps Hygiene','83%','+7 pts vs last week','purple')}
      ${metric('Action Rate',actionRate()+'%','8 of 10 actioned today','green')}
    </section>
    <section class="twocol">
      <div class="card"><div class="cardhead"><div><h2>Today's Governance Effectiveness</h2><p>Morning ageing backlog versus end-of-day outcome</p></div>${badge(actionRate()+'% Actioned','success')}</div>
        <div class="effect"><div><span>Morning</span><strong>${state.morning}</strong></div><div><span>Updated</span><strong>${state.updated}</strong></div><div><span>Closed</span><strong>${state.closed}</strong></div><div><span>Pending</span><strong>${state.pending}</strong></div></div>
        <div class="rate"><span>Action Rate</span><strong>${actionRate()}%</strong></div>${progress(actionRate())}
        <div class="rate secondary"><span>Backlog Reduction</span><strong>${backlogReduction()}%</strong></div>
        <div class="trend"><span>Mon 65%</span><span>Tue 72%</span><span>Wed 78%</span><span>Thu 82%</span><span>Fri 80%</span></div>
        ${button('Send EOD Report','sendEod','',true)}
      </div>
      <div class="card"><h2>AI Daily Briefing</h2><div class="brief">⚠ <span><strong>2 tickets</strong> still have no action at EOD.</span></div><div class="brief">↗ <span><strong>Network Ops</strong> is the top SLA risk area.</span></div><div class="brief">▣ <span><strong>Acceptance Criteria</strong> is the largest DevOps gap.</span></div>${button('Ask AI for priorities','aiPrompt','management',true)}</div>
    </section>
    <section class="card"><div class="cardhead"><div><h2>Highest Risk Ageing Tickets</h2><p>Prioritized by governance risk score</p></div>${button('View all','nav','ageing')}</div>${ticketTable(highest)}</section>
  `);
}

function renderAgeing() {
  const q = state.search.trim().toLowerCase();
  const rows = q ? state.tickets.filter(t => [t.id,t.type,t.title,t.team,t.assignee].join(' ').toLowerCase().includes(q)) : state.tickets;
  return layout(`<section class="card"><div class="cardhead"><div><h2>Ageing Ticket Governance</h2><p>Open INC, RITM and TASK records requiring attention</p></div><input id="ticketSearch" class="search" placeholder="Search ticket, team or owner" value="${escapeHtml(state.search)}"></div>${ticketTable(rows)}</section>`);
}

function renderSla() {
  return layout(`<section class="metrics three">${metric('SLA Compliance','93.4%','Current month','green')}${metric('Breached INCs','12','Requires RCA tracking','red')}${metric('Top Cause','Routing','31% of reviewed breaches','orange')}</section>
  <section class="card"><h2>SLA Breach Intelligence</h2><div class="slagrid">${state.slaBreaches.map(x => `<div class="slacard"><div class="cardhead"><strong>${x.id}</strong>${badge(x.team)}</div><p>${escapeHtml(x.summary)}</p><div class="slameta"><span>Breach <strong>${x.breach}</strong></span><span>AI RCA <strong>${x.cause}</strong></span><span>Confidence <strong>${x.confidence}</strong></span></div><div class="actions">${button('Accept RCA','acceptRca',x.id,true)}${button('Investigate with AI','aiPrompt','sla')}</div></div>`).join('')}</div></section>`);
}

function renderDevops() {
  return layout(`<section class="metrics three">${metric('Overall Hygiene','83%','+7 pts week over week','green')}${metric('Non-Compliant','18','Open work items','orange')}${metric('Largest Gap','Acceptance Criteria','11 stories affected','purple')}</section>
  <section class="card"><div class="cardhead"><div><h2>Azure DevOps Governance</h2><p>Epic, Feature, User Story and Task metadata hygiene</p></div>${button('Notify owners','notifyDevops','',true)}</div><div class="tablewrap"><table><thead><tr><th>Work Item</th><th>Type</th><th>Owner</th><th>Missing</th><th>Score</th><th>Action</th></tr></thead><tbody>${state.devopsItems.map(x => `<tr><td><strong>${x.id}</strong><div class="muted">${escapeHtml(x.title)}</div></td><td>${x.type}</td><td>${escapeHtml(x.owner)}</td><td>${x.missing.map(m=>badge(m,'danger')).join(' ')}</td><td><strong>${x.score}%</strong>${progress(x.score)}</td><td class="actions">${button('Notify','notifyWork',x.id)}${button('Ask AI','aiPrompt','devops',true)}</td></tr>`).join('')}</tbody></table></div></section>`);
}

function aiAnswer(kind) {
  if (kind === 'sla') return 'The current breach sample shows recurring causes in incorrect routing, delayed assignment, and technical complexity. INC001234 is the clearest routing example because it was reassigned twice before reaching the correct resolver group.';
  if (kind === 'devops') return 'US-3251 requires the most attention: Acceptance Criteria and Iteration Path are missing, giving it a 60% hygiene score. Notify the story owner first and escalate to the Feature owner if still non-compliant next week.';
  if (kind === 'tickets') return 'INC001611 has the highest governance risk at 95%, followed by INC001234 at 92%. Prioritize these before lower-risk RITM and TASK items.';
  return '1. Escalate the 2 ageing tickets still pending at EOD. 2. Review Network Ops routing, which is the leading SLA breach pattern. 3. Focus DevOps hygiene on missing Acceptance Criteria and Iteration Path.';
}

function renderAi(answer='') {
  return layout(`<section class="ailayout"><div class="card"><div class="aihead"><div class="orb">✦</div><div><h2>Governance AI Assistant</h2><p>Ask questions across ticket governance, SLA and DevOps hygiene.</p></div></div><div class="chips"><button data-action="aiPrompt" data-arg="management">What should management focus on today?</button><button data-action="aiPrompt" data-arg="sla">Why are SLA breaches happening?</button><button data-action="aiPrompt" data-arg="devops">Which user stories need attention?</button><button data-action="aiPrompt" data-arg="tickets">Which ageing tickets are highest risk?</button></div><textarea id="aiInput" placeholder="Ask Governance AI...">What should management focus on today?</textarea>${button('Analyze','analyzeText','',true)}${answer?`<div class="aianswer"><strong>✦ AI response</strong><p>${escapeHtml(answer)}</p><small>Demo response. Live version will call Moveworks Agent Studio.</small></div>`:''}</div><div class="card"><h2>Connected Intelligence</h2><div class="source"><strong>ServiceNow</strong><span>INC, RITM, TASK, SLA history</span></div><div class="source"><strong>Azure DevOps</strong><span>Epic, Feature, Story, Task metadata</span></div><div class="source"><strong>Moveworks</strong><span>Agent reasoning, actions and notifications</span></div></div></section>`);
}

function render() {
  if (state.page === 'ageing') app.innerHTML = renderAgeing();
  else if (state.page === 'sla') app.innerHTML = renderSla();
  else if (state.page === 'devops') app.innerHTML = renderDevops();
  else if (state.page === 'ai') app.innerHTML = renderAi(window.__aiAnswer || '');
  else app.innerHTML = renderCommand();
}

function openAssign(ticketId) {
  const t = state.tickets.find(x=>x.id===ticketId); if (!t) return;
  state.selectedTicket = t;
  const choices = ['Ravi','Sarah','John','Meera','Anil','Cloud Ops Queue','Network Ops Queue'];
  const overlay = document.createElement('div');
  overlay.className = 'modalback'; overlay.id = 'assignModal';
  overlay.innerHTML = `<div class="modal"><h2>Assign ${t.id}</h2><p>Current assignee: <strong>${escapeHtml(t.assignee)}</strong></p><select id="assigneeSelect">${choices.map(x=>`<option ${x===t.assignee?'selected':''}>${escapeHtml(x)}</option>`).join('')}</select><div class="modalactions">${button('Cancel','closeModal')}${button('Confirm assignment','confirmAssign','',true)}</div></div>`;
  document.body.appendChild(overlay);
}

function handleAction(action, arg) {
  if (action === 'nav') { state.page = arg; render(); return; }
  if (action === 'assign') return openAssign(arg);
  if (action === 'closeModal') { document.getElementById('assignModal')?.remove(); return; }
  if (action === 'confirmAssign') {
    const select = document.getElementById('assigneeSelect');
    if (state.selectedTicket && select) { state.selectedTicket.assignee = select.value; toast(`${state.selectedTicket.id} assigned to ${select.value}`); }
    document.getElementById('assignModal')?.remove(); render(); return;
  }
  if (action === 'notifyTicket') return toast(`Moveworks notification queued for ${arg}`);
  if (action === 'notifyDevops') return toast('Weekly DevOps hygiene notifications queued');
  if (action === 'notifyWork') return toast(`Owner notification queued for ${arg}`);
  if (action === 'acceptRca') return toast(`RCA accepted for ${arg}`);
  if (action === 'sendEod') return toast('EOD Governance Effectiveness Report queued for Team Leads and Process Owners');
  if (action === 'aiTicket') { window.__aiAnswer = aiAnswer('tickets'); state.page='ai'; render(); return; }
  if (action === 'aiPrompt') { window.__aiAnswer = aiAnswer(arg); state.page='ai'; render(); return; }
  if (action === 'analyzeText') {
    const text = (document.getElementById('aiInput')?.value || '').toLowerCase();
    const kind = text.includes('sla') || text.includes('breach') ? 'sla' : text.includes('devops') || text.includes('story') || text.includes('acceptance') ? 'devops' : text.includes('ageing') || text.includes('ticket') ? 'tickets' : 'management';
    window.__aiAnswer = aiAnswer(kind); render(); return;
  }
}

document.addEventListener('click', e => {
  const navEl = e.target.closest('[data-nav]'); if (navEl) { state.page = navEl.dataset.nav; render(); return; }
  const actionEl = e.target.closest('[data-action]'); if (actionEl) handleAction(actionEl.dataset.action, actionEl.dataset.arg || '');
});
document.addEventListener('input', e => {
  if (e.target.id === 'ticketSearch') { state.search = e.target.value; render(); const el=document.getElementById('ticketSearch'); if(el){el.focus(); el.setSelectionRange(state.search.length,state.search.length);} }
});

// Dashboard refresh cadence. In live mode, replace this with fetch('/api/dashboard').
setInterval(() => { state.lastRefresh = new Date(); render(); }, 5 * 60 * 1000);
render();
