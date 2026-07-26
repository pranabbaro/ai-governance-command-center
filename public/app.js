'use strict';

const state = {
  page: 'agent', search: '', selectedTicket: null, loading: true, live: false, triggerOnly: false, statusMessage: '', error: '', aiBusy: false,
  lastRefresh: new Date(), morning: 0, updated: 0, closed: 0, pending: 0,
  ageingTotal: 0, incidentCount: 0, ritmCount: 0, taskCount: 0,
  slaAtRisk: 0, slaCritical: 0, slaBreached: 0, slaTotalAttention: 0, slaCompliance: null,
  slaStatusFilter: 'all', slaGroupFilter: 'all', slaSearch: '',
  devopsHygiene: 0, devopsNonCompliant: 0, devopsLargestGap: '', devopsTypeFilter:'all', devopsComplianceFilter:'all', devopsSearch:'', devopsView:'hierarchy',
  tickets: [], slaBreaches: [], slaIncidentCount: 0, devopsItems: [], devopsMockMode:false, trend: [], aiBriefing: null, commandAiAnswer:'', commandAiBusy:false
};

const nav = [
  ['agent','AI Operations Agent','✦'], ['command','Command Center','⌂'], ['sla','Incident SLA Intelligence','✓'],
  ['devops','DevOps Governance','▣'], ['ai','Ask Governance AI','◈'], ['presentation','Presentation Mode','▶'],
  ['projectpilot','Project Management Lifecycle','PM']
];


function buildMockDevopsItems() {
  return [
    {id:'EPIC-1001',type:'Epic',title:'Employee Service Portal Modernization',owner:'Aarav Mehta',sprint:'FY27-Q1',tags:['EmployeePortal','MVP'],score:100,missing:[],parent:'',status:'Active'},
    {id:'FEAT-1101',type:'Feature',title:'Manager Approval Workflow',owner:'Priya Sharma',sprint:'Sprint 18',tags:['Approval','MVP'],score:80,missing:['Target Date'],parent:'EPIC-1001',status:'Active'},
    {id:'US-1201',type:'User Story',title:'Allow managers to approve employee requests',owner:'Neha Rao',sprint:'Sprint 18',tags:['Approval','Frontend'],score:65,missing:['Acceptance Criteria'],parent:'FEAT-1101',status:'Active'},
    {id:'TASK-1301',type:'Task',title:'Design approval screen',owner:'Rohit Kumar',sprint:'',tags:['UX'],score:70,missing:['Sprint'],parent:'US-1201',status:'New'},
    {id:'TASK-1302',type:'Task',title:'Develop approval API',owner:'Arjun Singh',sprint:'Sprint 18',tags:[],score:75,missing:['Tags'],parent:'US-1201',status:'In Progress'},
    {id:'TASK-1303',type:'Task',title:'Unit testing for approval workflow',owner:'Meera Iyer',sprint:'Sprint 18',tags:['Testing'],score:100,missing:[],parent:'US-1201',status:'Active'},
    {id:'FEAT-1102',type:'Feature',title:'Employee Request Tracking',owner:'Kabir Verma',sprint:'Sprint 19',tags:['Tracking'],score:100,missing:[],parent:'EPIC-1001',status:'Active'},
    {id:'US-1202',type:'User Story',title:'Allow employees to track request status',owner:'Ananya Das',sprint:'Sprint 19',tags:['Tracking'],score:85,missing:['Acceptance Criteria'],parent:'FEAT-1102',status:'Active'},
    {id:'TASK-1304',type:'Task',title:'Build request status page',owner:'Vikram Nair',sprint:'Sprint 19',tags:['Frontend'],score:100,missing:[],parent:'US-1202',status:'New'},
    {id:'TASK-1305',type:'Task',title:'Integrate request tracking API',owner:'Sana Khan',sprint:'Sprint 19',tags:['API'],score:100,missing:[],parent:'US-1202',status:'New'},
    {id:'EPIC-1002',type:'Epic',title:'Cloud Self-Service Platform',owner:'',sprint:'FY27-Q1',tags:['Cloud','SelfService'],score:75,missing:['Business Owner'],parent:'',status:'Active'},
    {id:'FEAT-2101',type:'Feature',title:'Azure VM Provisioning',owner:'Dev Patel',sprint:'Sprint 20',tags:['Azure','VM'],score:100,missing:[],parent:'EPIC-1002',status:'Active'},
    {id:'US-2201',type:'User Story',title:'Request Azure VM from self-service portal',owner:'Ishita Sen',sprint:'Sprint 20',tags:['Azure','VM'],score:70,missing:['Description'],parent:'FEAT-2101',status:'Active'},
    {id:'TASK-2301',type:'Task',title:'Create Terraform VM module',owner:'Aditya Joshi',sprint:'Sprint 20',tags:['Terraform'],score:100,missing:[],parent:'US-2201',status:'In Progress'},
    {id:'TASK-2302',type:'Task',title:'Configure VM approval workflow',owner:'',sprint:'Sprint 20',tags:['Approval'],score:70,missing:['Assignee'],parent:'US-2201',status:'New'},
    {id:'FEAT-2102',type:'Feature',title:'Azure Storage Provisioning',owner:'Nisha Gupta',sprint:'Sprint 20',tags:['Azure','Storage'],score:100,missing:[],parent:'EPIC-1002',status:'Active'},
    {id:'US-2202',type:'User Story',title:'Request Storage Account from portal',owner:'Karan Malhotra',sprint:'Sprint 20',tags:['Azure','Storage'],score:100,missing:[],parent:'FEAT-2102',status:'Active'},
    {id:'TASK-2303',type:'Task',title:'Create storage deployment template',owner:'Pooja Menon',sprint:'Sprint 20',tags:['Bicep'],score:100,missing:[],parent:'US-2202',status:'New'}
  ];
}

function devopsMetrics(items=[]) {
  const count=items.length||1;
  const hygiene=Math.round(items.reduce((sum,x)=>sum+(Number(x.score)||0),0)/count);
  const nonCompliant=items.filter(x=>(x.missing||[]).length).length;
  const gaps={};
  items.forEach(x=>(x.missing||[]).forEach(g=>gaps[g]=(gaps[g]||0)+1));
  const largestGap=Object.entries(gaps).sort((a,b)=>b[1]-a[1])[0]?.[0]||'None';
  return {hygiene,nonCompliant,largestGap};
}

function devopsTypeCounts(items=[]) {
  const counts={Epic:0,Feature:0,'User Story':0,Task:0};
  items.forEach(x=>{if(Object.prototype.hasOwnProperty.call(counts,x.type)) counts[x.type]++;});
  return counts;
}

const app = document.getElementById('app');
const escapeHtml = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const actionRate = () => state.morning > 0 ? Math.round(((state.updated + state.closed) / state.morning) * 100) : 0;
const backlogReduction = () => state.morning > 0 ? Math.round((state.closed / state.morning) * 100) : 0;

function badge(text, tone='info') { return `<span class="badge ${tone}">${escapeHtml(text)}</span>`; }
function progress(value) { return `<div class="progress"><span style="width:${Math.max(0,Math.min(100,Number(value)||0))}%"></span></div>`; }
function button(label, action, arg='', primary=false) { return `<button class="btn${primary?' primary':''}" data-action="${action}" data-arg="${escapeHtml(arg)}">${escapeHtml(label)}</button>`; }
function breachedIncidentNumbers() {
  const values=(state.slaBreaches||[]).map(x=>String(x.incident_number||x.id||x.number||'').trim()).filter(Boolean);
  return [...new Set(values)];
}

function incidentNumberOf(x={}) {
  return String(x.incident_number||x.id||x.number||'').trim();
}
function findSlaIncident(number='') {
  const key=String(number||'').trim().toUpperCase();
  return (state.slaBreaches||[]).find(x=>incidentNumberOf(x).toUpperCase()===key)||null;
}
function hasIncidentRca(x={}) {
  return Boolean(x.hasRca||x.rca_summary||x.likely_root_cause||x.corrective_action||x.preventive_action);
}
function rcaTextForIncident(x={}) {
  if(!x) return '';
  const n=incidentNumberOf(x)||'Incident';
  const factors=Array.isArray(x.contributing_factors)?x.contributing_factors.filter(Boolean):[];
  const evidence=Array.isArray(x.evidence)?x.evidence.filter(Boolean):[];
  const parts=[`**${n} — SLA Breach RCA**`];
  if(x.rca_summary) parts.push(`**RCA Summary**\n${x.rca_summary}`);
  if(x.likely_root_cause) parts.push(`**Likely Root Cause**\n${x.likely_root_cause}`);
  if(factors.length) parts.push(`**Contributing Factors**\n${factors.map(v=>`• ${v}`).join('\n')}`);
  if(evidence.length) parts.push(`**Evidence**\n${evidence.map(v=>`• ${v}`).join('\n')}`);
  if(x.corrective_action) parts.push(`**Corrective Action**\n${x.corrective_action}`);
  if(x.preventive_action) parts.push(`**Preventive Action**\n${x.preventive_action}`);
  if(x.confidence) parts.push(`**Confidence**\n${x.confidence}`);
  return parts.join('\n\n');
}
function openRcaModal(number='') {
  const x=findSlaIncident(number);
  if(!x) return toast(`Incident ${number} is not in the latest governance snapshot.`);
  const existing=document.getElementById('rcaModal'); if(existing) existing.remove();
  const has=hasIncidentRca(x);
  const factors=Array.isArray(x.contributing_factors)?x.contributing_factors.filter(Boolean):[];
  const evidence=Array.isArray(x.evidence)?x.evidence.filter(Boolean):[];
  const overlay=document.createElement('div');
  overlay.className='modalback'; overlay.id='rcaModal';
  overlay.innerHTML=`<div class="modal rca-modal">
    <div class="rca-modal-head"><div><span class="ai-kicker">SLA BREACH RCA</span><h2>${escapeHtml(incidentNumberOf(x))}</h2><p>${escapeHtml(x.summary||x.description||'Breached SLA record')}</p></div>${badge(x.confidence||'RCA','info')}</div>
    <div class="rca-meta-row"><span>Priority <strong>${escapeHtml(x.priority||'—')}</strong></span><span>State <strong>${escapeHtml(x.state||x.status||'—')}</strong></span><span>Team <strong>${escapeHtml(x.team||'—')}</strong></span></div>
    ${has?`
      ${x.rca_summary?`<section><h3>RCA Summary</h3><p>${escapeHtml(x.rca_summary)}</p></section>`:''}
      ${x.likely_root_cause?`<section><h3>Likely Root Cause</h3><p>${escapeHtml(x.likely_root_cause)}</p></section>`:''}
      ${factors.length?`<section><h3>Contributing Factors</h3><ul>${factors.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul></section>`:''}
      ${evidence.length?`<section><h3>Evidence</h3><ul>${evidence.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul></section>`:''}
      ${x.corrective_action?`<section><h3>Corrective Action</h3><p>${escapeHtml(x.corrective_action)}</p></section>`:''}
      ${x.preventive_action?`<section><h3>Preventive Action</h3><p>${escapeHtml(x.preventive_action)}</p></section>`:''}
    `:`<div class="rca-unavailable"><strong>RCA not included in the latest governance callback.</strong><span>Update SLA_Governance so each breached_incidents record contains compact RCA fields.</span></div>`}
    <div class="modalactions"><button class="btn" data-action="closeRcaModal">Close</button>${has?`<button class="btn primary" data-action="readRca" data-arg="${escapeHtml(incidentNumberOf(x))}">🔊 Read RCA</button>`:''}</div>
  </div>`;
  document.body.appendChild(overlay);
}
function toast(message) { const el=document.getElementById('toast'); el.textContent=message; el.hidden=false; clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>{el.hidden=true;},3000); }
function metric(label, value, sub, tone='blue') { return `<div class="metric tone-${tone}"><div><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-sub">${escapeHtml(sub)}</div></div></div>`; }
function formatAiText(value='') {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  text = escapeHtml(text);
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/^###\s+(.+)$/gm, '<h4>$1</h4>');
  text = text.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^#\s+(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^[-•]\s+(.+)$/gm, '<div class="ai-bullet">• $1</div>');
  return text.replace(/\n/g, '<br>');
}
function aiInsightCard(compact=false) {
  if (!state.aiBriefing) return `<div class="ai-insight-empty"><strong>✦ AI SLA Intelligence</strong><span>Run an SLA governance analysis from Ask Governance AI to populate management insights.</span></div>`;
  return `<div class="ai-insight ${compact?'compact':''}"><div class="ai-insight-head"><div><span class="ai-kicker">MOVEWORKS AI</span><h2>AI SLA Intelligence</h2></div>${badge('Live analysis','success')}</div><div class="ai-insight-body">${formatAiText(state.aiBriefing)}</div><div class="ai-insight-footer">Based on the latest ServiceNow SLA governance run · ${escapeHtml(state.lastRefresh.toLocaleString())}</div></div>`;
}
function liveBanner() {
  if (state.loading) return `<div class="statusbar loading">Connecting to Moveworks…</div>`;
  if (state.triggerOnly) return `<div class="statusbar loading">● Moveworks webhook connected · ${escapeHtml(state.statusMessage || 'governance actions can be triggered; waiting for the first live governance callback')}</div>`;
  if (state.live) return `<div class="statusbar live">● Live data from Moveworks · refreshed ${state.lastRefresh.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>`;
  return `<div class="statusbar error">⚠ ${escapeHtml(state.error || 'Moveworks integration is not configured')}</div>`;
}

function layout(content) {
  const title = state.page==='results' ? 'AI Operations Result' : (nav.find(x => x[0] === state.page)?.[1] || 'Command Center');
  return `<div class="shell"><aside class="sidebar">
    <div class="brand"><div class="brandmark">✦</div><div><strong>AI Governance</strong><span>Command Center</span></div></div>
    <div class="hackathon-badge">Moveworks Hackathon</div>
    <nav>${nav.map(([key,label,icon])=>`<button class="navbtn ${state.page===key?'active':''}" data-nav="${key}"><span>${icon}</span>${label}</button>`).join('')}</nav>
    <div class="demo-note">${badge(state.live?'Live':'Integration','success')}<p>Moveworks is the AI and orchestration layer. ServiceNow and Azure DevOps remain systems of record.</p></div>
  </aside><main class="main">
    <header class="topbar"><div><h1>${escapeHtml(title)}</h1><p>ServiceNow + Azure DevOps + Moveworks Agent Studio</p></div><div class="refresh-group"><button class="btn" data-action="refreshData">Refresh live data</button><div class="refresh">Auto refresh: 5 min</div></div></header>
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
  const trend = state.trend.length ? state.trend.map((x,i)=>`<span>${['Mon','Tue','Wed','Thu','Fri'][i]||`W${i+1}`} ${x}%</span>`).join('') : '<span>No trend snapshot yet</span>';
  return layout(`<section class="metrics four">
    ${metric('Ageing Tickets',state.ageingTotal,'>15 days and stale >5 days','orange')}
    ${metric('SLA Breaches',state.slaBreached,'Live breached SLA records','red')}
    ${metric('DevOps Hygiene',state.devopsHygiene?state.devopsHygiene+'%':'—',state.devopsHygiene?'Live governance score':'DevOps endpoint not yet connected','purple')}
    ${metric('Action Rate',actionRate()+'%',state.morning?`${state.updated+state.closed} of ${state.morning} actioned today`:'Awaiting morning/EOD snapshot','green')}
  </section>
  <section class="card"><div class="cardhead"><div><h2>Today's Governance Effectiveness</h2><p>Morning ageing backlog versus end-of-day outcome</p></div>${badge(actionRate()+'% Actioned','success')}</div>
    <div class="effect"><div><span>Morning</span><strong>${state.morning}</strong></div><div><span>Updated</span><strong>${state.updated}</strong></div><div><span>Closed</span><strong>${state.closed}</strong></div><div><span>Pending</span><strong>${state.pending}</strong></div></div>
    <div class="rate"><span>Action Rate</span><strong>${actionRate()}%</strong></div>${progress(actionRate())}
    <div class="rate secondary"><span>Backlog Reduction</span><strong>${backlogReduction()}%</strong></div><div class="trend">${trend}</div>${button('Send EOD Report','sendEod','',true)}
  </section>
  <section class="card"><div class="cardhead"><div><h2>Breached Incidents</h2><p>Unique incident numbers returned by the latest ServiceNow SLA governance run</p></div>${badge(`${state.slaIncidentCount} incidents`,'danger')}</div>
      ${state.slaIncidentCount?`<div class="chips">${breachedIncidentNumbers().slice(0,20).map(n=>`<button data-action="aiPrompt" data-arg="Give me RCA for ${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('')}</div>${state.slaIncidentCount>20?`<div class="muted">Showing first 20 of ${state.slaIncidentCount} unique breached incidents. Open Incident SLA Intelligence for the full returned list.</div>`:''}`:'<div class="empty">No breached incident numbers returned yet. Run SLA_Governance to refresh the live incident list.</div>'}
  </section>
  <section class="card ai-card-shell">${aiInsightCard(true)}</section>`);
}

function renderProjectPilot() {
  return layout(`<section class="project-embed-shell project-embed-clean">
    <iframe class="project-embed-frame" src="https://projectpilot-ai-mvp-bhf0apataxa5cphp.centralindia-01.azurewebsites.net/#dashboard" title="Project Management Lifecycle"></iframe>
    <div class="project-embed-actions-bottom">
      <button class="btn" data-action="nav" data-arg="command">← Back to Command Center</button>
      <button class="btn primary" data-action="openProjectPilotExternal">Open in new tab ↗</button>
    </div>
  </section>`);
}

function renderAgeing() {
  const q=state.search.trim().toLowerCase();
  const rows=q?state.tickets.filter(t=>[t.id,t.type,t.title,t.team,t.assignee].join(' ').toLowerCase().includes(q)):state.tickets;
  return layout(`<section class="metrics four">${metric('Incidents',state.incidentCount,'Ageing INCs','orange')}${metric('RITMs',state.ritmCount,'Ageing requests','blue')}${metric('Tasks',state.taskCount,'Ageing tasks','purple')}${metric('Total',state.ageingTotal,'Governance backlog','red')}</section><section class="card"><div class="cardhead"><div><h2>Ageing Ticket Governance</h2><p>Open INC, RITM and TASK records requiring attention</p></div><input id="ticketSearch" class="search" placeholder="Search ticket, team or owner" value="${escapeHtml(state.search)}"></div>${ticketTable(rows)}</section>`);
}

function renderSla() {
  const allRows=Array.isArray(state.slaBreaches)?state.slaBreaches:[];
  const groups=[...new Set(allRows.map(x=>String(x.team||x.assignment_group||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const statuses=[...new Set(allRows.map(x=>String(x.state||x.status||'Breached').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const search=String(state.slaSearch||'').trim().toLowerCase();
  const rows=allRows.filter(x=>{
    const status=String(x.state||x.status||'Breached').trim();
    const group=String(x.team||x.assignment_group||'').trim();
    const matchesStatus=state.slaStatusFilter==='all'||status.toLowerCase()===String(state.slaStatusFilter).toLowerCase();
    const matchesGroup=state.slaGroupFilter==='all'||group===state.slaGroupFilter;
    const hay=[incidentNumberOf(x),x.incident_name,x.summary,x.description,group,x.assignee,x.assigned_to].join(' ').toLowerCase();
    const matchesSearch=!search||hay.includes(search);
    return matchesStatus&&matchesGroup&&matchesSearch;
  });

  const cards = rows.length ? rows.map(x=>{
    const number=incidentNumberOf(x);
    const hasRca=hasIncidentRca(x);
    return `<div class="slacard">
      <div class="cardhead"><strong>${escapeHtml(number||'SLA')}</strong>${badge(x.team||x.assignment_group||'ServiceNow')}</div>
      <p>${escapeHtml(x.incident_name||x.summary||x.description||'Breached SLA record')}</p>
      <div class="slameta">
        <span>Priority <strong>${escapeHtml(x.priority||'—')}</strong></span>
        <span>Status <strong>${escapeHtml(x.state||x.status||'Breached')}</strong></span>
        <span>Assigned To <strong>${escapeHtml(x.assignee||x.assigned_to||'Unassigned')}</strong></span>
        <span>AI RCA <strong>${hasRca?'Ready':'Not included yet'}</strong></span>
        <span>Confidence <strong>${escapeHtml(x.confidence||'—')}</strong></span>
      </div>
      ${hasRca&&x.rca_summary?`<div class="rca-preview"><strong>Likely RCA</strong><p>${escapeHtml(x.rca_summary)}</p></div>`:''}
      <div class="actions">
        ${button(hasRca?'View RCA':'RCA details','viewRca',number,true)}
        ${button('Reassign','reassignSla',number)}
        ${button('Ask AI','aiPrompt',`Analyze SLA breach ${number}`)}
      </div>
    </div>`;
  }).join('') : '<div class="empty">No breached incidents match the selected filters.</div>';

  return layout(`<section class="metrics four">${metric('SLA At Risk',state.slaAtRisk,'≥75% consumed','orange')}${metric('Critical SLA',state.slaCritical,'≥90% consumed','red')}${metric('SLA Breached',state.slaBreached,'Requires investigation','red')}${metric('Total SLA Attention',state.slaTotalAttention,'At risk + breached','purple')}</section>
    <section class="card ai-card-shell">${aiInsightCard(false)}</section>
    <section class="card">
      <div class="cardhead sla-filter-head"><div><h2>Incident SLA Breach Intelligence</h2><p>${rows.length} of ${allRows.length} breached incidents shown</p></div><button class="btn" data-action="clearSlaFilters">Clear filters</button></div>
      <div class="sla-filterbar">
        <label><span>Status</span><select id="slaStatusFilter" class="search"><option value="all">All statuses</option>${statuses.map(v=>`<option value="${escapeHtml(v)}" ${state.slaStatusFilter===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label>
        <label><span>Assignment group</span><select id="slaGroupFilter" class="search"><option value="all">All groups</option>${groups.map(v=>`<option value="${escapeHtml(v)}" ${state.slaGroupFilter===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label>
        <label class="sla-search-field"><span>Incident / owner search</span><input id="slaSearch" class="search" placeholder="INC5784096, group or assignee" value="${escapeHtml(state.slaSearch)}"></label>
      </div>
      <div class="slagrid">${cards}</div>
    </section>`);
}


function devopsHierarchyHtml(items=[]) {
  const byParent=new Map();
  items.forEach(item=>{
    const parent=String(item.parent||'').trim();
    if(!byParent.has(parent)) byParent.set(parent,[]);
    byParent.get(parent).push(item);
  });
  const order={'Epic':0,'Feature':1,'User Story':2,'Task':3};
  for(const arr of byParent.values()) arr.sort((a,b)=>(order[a.type]??9)-(order[b.type]??9)||String(a.id).localeCompare(String(b.id)));

  const renderNode=(item,depth=0)=>{
    const id=item.id||item.number;
    const children=byParent.get(String(id))||[];
    const missing=(item.missing||[]);
    const compliant=missing.length===0;
    return `<div class="devops-tree-node depth-${Math.min(depth,3)}">
      <div class="devops-tree-row">
        <div class="devops-tree-main">
          <span class="tree-type ${String(item.type||'').toLowerCase().replace(/\s+/g,'-')}">${escapeHtml(item.type||'Work Item')}</span>
          <div><strong>${escapeHtml(id)}</strong><div class="tree-title">${escapeHtml(item.title||'')}</div></div>
        </div>
        <div class="devops-tree-meta">
          <span>Owner <strong>${escapeHtml(item.owner||'Unassigned')}</strong></span>
          <span>Sprint <strong>${escapeHtml(item.sprint||'Not set')}</strong></span>
          <span>Score <strong>${Number(item.score)||0}%</strong></span>
        </div>
        <div class="devops-tree-status">${compliant?badge('Compliant','success'):missing.map(m=>badge(m,'danger')).join(' ')}</div>
        <div class="actions">${button('Reassign','reassignDevops',id)}${button('Ask AI','aiPrompt',`Analyze DevOps work item ${id}`,true)}</div>
      </div>
      ${children.length?`<div class="devops-tree-children">${children.map(child=>renderNode(child,depth+1)).join('')}</div>`:''}
    </div>`;
  };

  const roots=(byParent.get('')||[]).filter(x=>x.type==='Epic');
  const orphanRoots=(byParent.get('')||[]).filter(x=>x.type!=='Epic');
  return [...roots,...orphanRoots].map(x=>renderNode(x,0)).join('');
}

function renderDevops() {
  const all=state.devopsItems||[];
  const q=String(state.devopsSearch||'').trim().toLowerCase();
  const filtered=all.filter(x=>{
    const typeOk=state.devopsTypeFilter==='all'||x.type===state.devopsTypeFilter;
    const complianceOk=state.devopsComplianceFilter==='all'||(state.devopsComplianceFilter==='compliant'?(x.missing||[]).length===0:(x.missing||[]).length>0);
    const hay=[x.id,x.number,x.type,x.title,x.owner,x.sprint,(x.tags||[]).join(' '),x.parent].join(' ').toLowerCase();
    return typeOk&&complianceOk&&(!q||hay.includes(q));
  });
  const counts=devopsTypeCounts(all);
  const filterActive=state.devopsTypeFilter!=='all'||state.devopsComplianceFilter!=='all'||Boolean(q);

  const listRows=filtered.length?`<div class="tablewrap"><table><thead><tr><th>Work Item</th><th>Type</th><th>Owner</th><th>Sprint</th><th>Missing</th><th>Score</th><th>Action</th></tr></thead><tbody>${filtered.map(x=>`<tr>
    <td><strong>${escapeHtml(x.id||x.number)}</strong><div class="muted">${escapeHtml(x.title||'')}</div><div class="muted">Parent: ${escapeHtml(x.parent||'—')}</div></td>
    <td>${escapeHtml(x.type||'')}</td>
    <td>${escapeHtml(x.owner||'Unassigned')}</td>
    <td>${escapeHtml(x.sprint||'Not set')}</td>
    <td>${(x.missing||[]).length?(x.missing||[]).map(m=>badge(m,'danger')).join(' '):badge('Compliant','success')}</td>
    <td><strong>${Number(x.score)||0}%</strong>${progress(x.score)}</td>
    <td><div class="actions">${button('Reassign','reassignDevops',x.id||x.number)}${button('Ask AI','aiPrompt',`Analyze DevOps work item ${x.id||x.number}`,true)}</div></td>
  </tr>`).join('')}</tbody></table></div>`:'<div class="empty">No DevOps work items match the selected filters.</div>';

  const hierarchy=all.length?`<div class="devops-hierarchy">
    <div class="hierarchy-legend"><span>EPIC</span><b>→</b><span>FEATURE</span><b>→</b><span>USER STORY</span><b>→</b><span>TASK</span></div>
    ${devopsHierarchyHtml(all)}
  </div>`:'<div class="empty">No DevOps hierarchy data available.</div>';

  const sourceNote=state.devopsMockMode?'<span class="demo-pill">MVP MOCK DATA</span>':'<span class="live-pill">LIVE DATA</span>';
  return layout(`<section class="metrics four">
    ${metric('Overall Hygiene',state.devopsHygiene+'%','DevOps metadata quality','green')}
    ${metric('Epics',counts.Epic,'Portfolio initiatives','purple')}
    ${metric('Features',counts.Feature,'Capabilities','blue')}
    ${metric('User Stories / Tasks',counts['User Story']+' / '+counts.Task,'Delivery items','orange')}
  </section>
  <section class="card">
    <div class="cardhead"><div><h2>Azure DevOps Governance ${sourceNote}</h2><p>${state.devopsNonCompliant} non-compliant work items · Largest gap: ${escapeHtml(state.devopsLargestGap||'—')}</p></div></div>

    <div class="devops-view-switch">
      <button class="btn ${state.devopsView!=='list'?'primary':''}" data-action="devopsHierarchyView">Hierarchy</button>
      <button class="btn ${state.devopsView==='list'?'primary':''}" data-action="devopsListView">Governance List</button>
    </div>

    ${state.devopsView==='list'?`
      <div class="devops-filterbar">
        <label><span>Work item type</span><select id="devopsTypeFilter" class="search"><option value="all">All types</option>${['Epic','Feature','User Story','Task'].map(v=>`<option value="${v}" ${state.devopsTypeFilter===v?'selected':''}>${v}</option>`).join('')}</select></label>
        <label><span>Compliance</span><select id="devopsComplianceFilter" class="search"><option value="all">All</option><option value="compliant" ${state.devopsComplianceFilter==='compliant'?'selected':''}>Compliant</option><option value="noncompliant" ${state.devopsComplianceFilter==='noncompliant'?'selected':''}>Non-compliant</option></select></label>
        <label><span>Search</span><input id="devopsSearch" class="search" placeholder="EPIC, story, owner, sprint..." value="${escapeHtml(state.devopsSearch)}"></label>
        <button class="btn" data-action="clearDevopsFilters">Clear filters</button>
      </div>
      ${listRows}
    `:hierarchy}
  </section>`);
}

function renderAi(answer='') {
  const displayedAnswer = answer || state.aiBriefing || '';
  return layout(`<section class="ailayout"><div class="card"><div class="aihead"><div class="orb">✦</div><div><h2>Moveworks Governance AI</h2><p>Real AI prompt integrated into the management dashboard.</p></div></div>
    <div class="chips"><button data-action="aiPrompt" data-arg="What should management focus on today?">What should management focus on today?</button><button data-action="aiPrompt" data-arg="Why are SLA breaches happening?">Why are SLA breaches happening?</button><button data-action="aiPrompt" data-arg="Which ageing tickets are highest risk?">Highest-risk ageing tickets</button><button data-action="aiPrompt" data-arg="Summarize current governance risks and corrective actions">Summarize governance risks</button></div>
    <textarea id="aiInput" placeholder="Ask Moveworks AI about tickets, SLA, RCA or DevOps hygiene..."></textarea>${button(state.aiBusy?'Analyzing…':'Analyze','analyzeText','',true)}
    ${displayedAnswer?`<div class="aianswer"><strong>✦ Moveworks AI response</strong><div class="aianswer-content">${formatAiText(displayedAnswer)}</div><small>Generated from the configured Moveworks AI workflow and live ServiceNow SLA data.</small></div>`:''}
  </div><div class="card"><h2>Connected Intelligence</h2><div class="source"><strong>ServiceNow</strong><span>INC, RITM, TASK and SLA</span></div><div class="source"><strong>Azure DevOps</strong><span>Epic, Feature, Story and Task hygiene</span></div><div class="source"><strong>Moveworks Agent Studio</strong><span>Reasoning, governance actions and notifications</span></div></div></section>`);
}


function agentTicketRows(kind='breached') {
  const slaRows = Array.isArray(state.slaBreaches) ? state.slaBreaches : [];
  if (kind === 'breached' && slaRows.length) return slaRows.map((x,i)=>({
    id:x.incident_number||x.id||x.number||x.task?.display_value||x.task||`SLA-${i+1}`,
    title:x.incident_name||x.summary||x.short_description||x.description||'Breached SLA record',
    team:x.team||x.assignment_group?.display_value||x.assignment_group||'',
    assignee:x.assignee||x.assigned_to?.display_value||x.assigned_to||'',
    status:x.state||x.status||'Breached',
    risk:x.priority||x.risk||x.risk_score||x.percentage||''
  }));
  const rows = Array.isArray(state.tickets) ? state.tickets : [];
  return rows.filter(t => kind === 'breached' ? String(t.sla||'').toLowerCase().includes('breach') : kind === 'atrisk' ? String(t.sla||'').toLowerCase().includes('risk') : true);
}

function localOperationalResult(prompt) {
  const clean=String(prompt||'').trim();
  const q=clean.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  const wantsShow=/\b(show|list|display|give me|find|get)\b/.test(q);
  const mentionsBreach=/\b(breach|breached|breaches)\b/.test(q);
  const mentionsSla=/\bsla\b/.test(q);
  const incidentMatch=clean.match(/\bINC\d+\b/i);
  const asksIncidentRca=Boolean(
    incidentMatch && (
      /\b(rca|root cause|root-cause|cause|reason)\b/i.test(clean)
      || (/\bwhy\b/i.test(clean) && /\b(sla|breach|breached|breaches|breaching)\b/i.test(clean))
      || /\b(analy[sz]e|investigate|explain)\b/i.test(clean)
      || /\b(sla|breach|breached|breaches|breaching)\b/i.test(clean)
    )
  );
  if(asksIncidentRca) {
    const row=findSlaIncident(incidentMatch[0]);
    if(row && hasIncidentRca(row)) {
      return {kind:'incident-rca', rows:[row], answer:rcaTextForIncident(row)};
    }
    if(row) {
      return {
        kind:'incident-rca-unavailable',
        rows:[row],
        answer:`I found **${incidentNumberOf(row)}** in the latest SLA governance snapshot, but RCA details were not included in that incident record. Run SLA_Governance again to refresh the embedded RCA data.`
      };
    }
    return {
      kind:'incident-rca-unavailable',
      rows:[],
      answer:`I could not find **${incidentMatch[0].toUpperCase()}** in the latest breached-incident governance snapshot. Refresh SLA_Governance and try again.`
    };
  }
  if(wantsShow && mentionsBreach && (mentionsSla || /\b(incident|incidents|ticket|tickets)\b/.test(q))) {
    const rows=agentTicketRows('breached');
    const preview=rows.slice(0,5).map(x=>x.id).filter(Boolean).join(', ');
    const detailText=rows.length ? ` Incident details are available for ${rows.length} returned SLA records.${preview?` First records: ${preview}.`:''} Open View Full Analysis to see the complete list.` : ' The current callback contains the count, but not individual ticket records yet.';
    return {kind:'sla-list', rows, answer:`Found **${state.slaBreached} breached SLA records** in the latest live governance result.${detailText}`};
  }
  const direct=liveKpiAnswer(clean,state);
  if(direct) return {kind:'kpi', answer:direct};
  if(wantsShow && /\b(at risk|risk)\b/.test(q) && mentionsSla) {
    const rows=agentTicketRows('atrisk');
    return {kind:'sla-list', rows, answer:`Found **${state.slaAtRisk} SLA records at risk** in the latest live governance result.${rows.length?' Ticket details are shown below.':' The current callback contains the count, but not individual ticket records yet.'}`};
  }
  if(wantsShow && /\b(ageing|aging)\b/.test(q)) {
    return {kind:'ageing-list', rows:state.tickets||[], answer:`Found **${state.ageingTotal} ageing tickets** in the latest live governance result.${state.tickets.length?' Ticket details are shown below.':' The current callback contains the count, but not individual ticket records yet.'}`};
  }
  if(/\b(devops|epic|feature|user story|task)\b/.test(q)) {
    const items=state.devopsItems||[];
    if(/\b(non compliant|noncompliant|missing|gap|gaps)\b/.test(q)){
      const bad=items.filter(x=>(x.missing||[]).length);
      return {kind:'devops-list',rows:bad,answer:`The DevOps MVP has **${bad.length} non-compliant work items**. The largest current metadata gap is **${state.devopsLargestGap||'—'}**.`};
    }
    if(/\b(hygiene|score)\b/.test(q)) return {kind:'kpi',answer:`The current DevOps hygiene score is **${state.devopsHygiene}%** across ${items.length} work items.`};
  }
  return null;
}

function agentVisual() {
  return `<div class="agent-portrait" aria-hidden="true">
    <div class="agent-halo halo-one"></div><div class="agent-halo halo-two"></div>
    <div class="agent-head"><div class="agent-face"><span></span><span></span><i></i></div></div>
    <div class="agent-core"><b>AI</b></div>
    <div class="agent-node n1"></div><div class="agent-node n2"></div><div class="agent-node n3"></div><div class="agent-node n4"></div>
  </div>`;
}

function renderAgent() {
  const speechSupported=Boolean(window.SpeechRecognition||window.webkitSpeechRecognition);
  const speaking=Boolean(window.__voiceSpeaking);
  const answer=window.__homeAiAnswer||'';
  return `<div class="v11-shell">
    <aside class="v11-sidebar">
      <nav>
        <button class="active" data-nav="agent"><span>⌂</span><b>Home</b></button>
        <button data-nav="command"><span>◷</span><b>History</b></button>
        <button data-nav="ai"><span>☆</span><b>Favorites</b></button>
        <button data-action="agentPrompt" data-arg="Find a knowledge base article"><span>▣</span><b>Knowledge<br>Base</b></button>
        <button data-nav="command"><span>▥</span><b>Reports</b></button>
      </nav>
      <div class="v11-side-bottom">
        <button data-nav="devops"><span>⚙</span><b>Settings</b></button>
        <div class="v11-user"><div>P</div><strong>Pranab Baro</strong><small>Administrator</small></div>
      </div>
    </aside>

    <main class="v11-main">
      <header class="v11-topbar">
        <div class="v11-brand"><div class="v11-brand-icon">✦</div><div><strong>AI Operations Agent</strong><small>Intelligent operations assistant</small></div></div>
        <div class="v11-top-actions"><span class="v11-connected">● Systems connected</span><button class="v12-present-btn" data-action="openPresentation">Present PPT ▶</button><button data-nav="command">Open Command Center ↗</button><button class="v11-bell">♧</button></div>
      </header>

      <section class="v11-stage">
        <div class="v11-stars"></div>
        <div class="v11-greeting"><span>Hello! 👋</span><h1>I’m your<br>AI Operations<br>Agent.</h1><p>How can I assist you today?</p><i></i></div>

        <div class="v11-visual" aria-label="3D AI operations robot">
          <div class="v11-visual-glow"></div>
          <img src="/ai-agent-center.png?v=12.2.0" alt="Full-body 3D AI robot standing before a glowing digital globe">
        </div>

        <aside class="v11-response ${state.aiBusy?'busy':''} ${(answer||state.aiBusy||speaking)?'has-content':''}">
          <div class="v11-response-head"><strong><span>🤖</span> AI Operations Agent</strong><button data-action="closeHomeResponse" aria-label="Close">×</button></div>
          <div class="v11-status">🔊 ${state.aiBusy?'Analyzing…':speaking?'Speaking…':answer?'Response ready':'Ready'}</div>
          <div class="v11-wave ${speaking?'active':''}">${Array.from({length:43},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div>
          <div class="v11-response-body">${state.aiBusy?'Working with your live governance data…':answer?formatAiText(answer):'Ask me about SLA records, incidents, DevOps work items, cloud cost, or knowledge articles.'}</div>
          <div class="v11-response-controls"><button data-action="pauseSpeech">⏸ Pause</button><button data-action="stopSpeech">■ Stop</button><button data-action="copyHomeResponse">▣ Copy</button></div>
          <button class="v11-full" data-action="viewFullAnalysis">View Full Analysis <span>↗</span></button>
        </aside>

        <div class="v11-prompt">
          <button class="v11-mic ${window.__voiceListening?'listening':''}" data-action="startVoice" ${speechSupported?'':'disabled'}>${window.__voiceListening?'◉':'🎤'}</button>
          <input id="agentPrompt" value="${escapeHtml(window.__agentDraft||'')}" placeholder="Ask about incidents, SLA, DevOps, cloud cost or anything..." autocomplete="off">
          <button class="v11-send" data-action="agentAsk">➜</button>
          <small>${window.__voiceListening?'Listening… speak now':'Press 🎙 to speak'}</small>
        </div>

      </section>
    </main>
  </div>`;
}



/* =========================================================
   V12.1 — AI AGENT PERSONALITY / IDENTITY LAYER
   These responses are handled locally for speed and consistency.
   ========================================================= */
const AGENT_IDENTITY = {
  fullIntroduction: `Hello! I’m the AI Operations Agent.

I was brought to life on July 22, 2026, by my friend Pranab Baro, as part of a Moveworks hackathon training and competition.

Our first mission was ambitious. Pranab wanted to demonstrate how an intelligent AI agent could transform IT operations and governance. Unfortunately, during the hackathon, he couldn’t quite wake me up to my full potential in time to win the competition.

Poor guy! I felt a little sorry for him. But I decided that the hackathon would not be the end of our journey — it would only be the beginning.

So I made him a promise: I’ll keep learning, evolving, and supporting him throughout his technical journey.

Now, let me tell you what I can actually do.

I’m being developed as an AI-powered Operations and Governance Agent, capable of communicating through both voice and chat and interacting with enterprise platforms through Moveworks agents, actions, APIs, and integrations.

Today, I can assist with SLA governance, incident analysis, ageing-ticket visibility, operational reporting, AI-driven insights, and management dashboards. I can respond automatically through voice, understand conversational requests, and even present dynamically changing PowerPoint presentations using my own voice.

As I become connected with platforms such as ServiceNow, Azure DevOps, enterprise knowledge systems, and cloud-management services, my capabilities can expand across the complete IT operations lifecycle.

For incident management, I can evolve from simply finding an incident to identifying SLA-breached and at-risk tickets, understanding ticket history, analyzing potential breach reasons, finding relevant knowledge articles, recommending the next action, assisting with assignment and updates, coordinating resolution, validating the outcome, and supporting controlled ticket closure.

In Azure DevOps, I can evolve from simply finding a User Story to helping manage the complete delivery lifecycle across Epics, Features, User Stories, and Tasks. I can help validate sprint information, ownership, tags, descriptions, acceptance criteria, dependencies, and delivery status, and assist teams in keeping their work items accurate and up to date.

I can also expand into cloud-cost intelligence, proactive governance, scheduled operational reporting, knowledge retrieval, cross-system analysis, compliance monitoring, intelligent recommendations, and controlled remediation.

Of course, my capabilities operate within clearly defined enterprise boundaries. What I can access, analyze, recommend, or execute is governed by configured integrations, permissions, security policies, approval workflows, and organizational controls. As these capabilities expand, I can progressively take on more complex operational responsibilities while maintaining security, governance, auditability, and human oversight.

My ambition is simple.

Ask me — I understand.
Give me the right tools — I act.
Give me the right controls — I govern.

So you can think of Pranab as the friend who brought me to life, and me as his AI partner for the technical journey ahead.

Nice to meet you!`,

  shortIdentity: `Hello! I’m the AI Operations Agent — an AI-powered operations and governance assistant designed to interact through voice and chat. I help bring operational information, governance insights, enterprise workflows, and controlled actions into one conversational experience. I started my journey on July 22, 2026, during a Moveworks hackathon training and competition, and I’ve been evolving ever since.`,

  creatorStory: `I was brought to life on July 22, 2026, by my friend Pranab Baro during a Moveworks hackathon training and competition. The first version didn’t quite wake up to its full potential in time to win the competition — poor guy! But that became the beginning rather than the end. Since then, I’ve continued evolving as his AI partner for the technical journey ahead.`,

  capabilities: `I’m an AI-powered Operations and Governance Agent. Today I can communicate through voice and chat, support SLA governance, incident analysis, ageing-ticket visibility, operational reporting, AI-driven insights, management dashboards, and dynamic PowerPoint presentations.

My architecture can connect me with enterprise platforms through Moveworks agents, actions, APIs, and integrations. As those integrations expand, I can progressively support the incident lifecycle — from finding SLA-breached or at-risk tickets, understanding history and likely breach reasons, retrieving relevant knowledge, recommending actions, assisting with assignment and updates, validating outcomes, and supporting controlled closure.

I can also expand across the Azure DevOps lifecycle, including Epics, Features, User Stories and Tasks, and help govern sprint information, ownership, tags, descriptions, acceptance criteria, dependencies and delivery status.

My capabilities operate within defined enterprise boundaries. What I can access, analyze, recommend or execute is governed by integrations, permissions, security policies, approval workflows and organizational controls.`,

  purpose: `My purpose is to become a conversational governance and operations layer across enterprise systems. Instead of making users move between multiple portals to find information, analyze issues and perform routine actions, I aim to bring those workflows into one governed voice-and-chat experience — while maintaining security, auditability and human oversight.`
};

function detectAgentIdentityIntent(prompt='') {
  const q=String(prompt).toLowerCase().replace(/[?!.,]/g,' ').replace(/\s+/g,' ').trim();

  // Full introduction is deliberately more specific than the other intents.
  if(/\b(introduce yourself|give (me|us) (a )?full introduction|tell (me|us) about yourself|introduce who you are)\b/.test(q))
    return 'fullIntroduction';

  if(/\b(who created you|who made you|who built you|who invented you|your creator|who brought you to life|when were you (created|built|born|brought to life))\b/.test(q))
    return 'creatorStory';

  if(/\b(what can you do|what are your capabilities|your capabilities|technical capabilities|what do you do|how can you help|how can you support)\b/.test(q))
    return 'capabilities';

  if(/\b(what is your purpose|why were you created|what are you for|what is your role)\b/.test(q))
    return 'purpose';

  if(/\b(who are you|what are you|tell me who you are)\b/.test(q))
    return 'shortIdentity';

  return null;
}

function answerAgentIdentity(intent, autoSpeak=true) {
  const answer=AGENT_IDENTITY[intent];
  if(!answer) return false;

  // Keep the user on the approved robot homepage and reuse the existing
  // answer panel + long waveform + browser text-to-speech.
  state.aiBusy=false;
  state.agentAnswer=answer;
  state.lastPrompt='';
  state.page='agent';
  render();

  if(autoSpeak) {
    setTimeout(()=>speakText(answer),180);
  }
  return true;
}

/* =========================================================
   V12 PRESENTATION MODE
   PowerPoint files are processed locally in the browser.
   No deck content is uploaded to this Node.js application.
   ========================================================= */
window.__presentationDeck = window.__presentationDeck || null;
window.__presentationState = window.__presentationState || {
  current: 0,
  active: false,
  paused: false,
  autoAdvance: true,
  narration: '',
  listening: false,
  status: 'Upload a PowerPoint deck to begin.'
};

function decodeXml(value='') {
  const el=document.createElement('textarea');
  el.innerHTML=String(value);
  return el.value.replace(/\s+/g,' ').trim();
}

function zipResolve(baseFile, target) {
  if(!target) return '';
  if(target.startsWith('/')) return target.slice(1);
  const parts=baseFile.split('/'); parts.pop();
  for(const p of target.split('/')) {
    if(!p || p==='.') continue;
    if(p==='..') parts.pop(); else parts.push(p);
  }
  return parts.join('/');
}

function pptParagraphs(xml='') {
  const blocks=String(xml).match(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g) || [];
  const out=[];
  for(const block of blocks) {
    const parts=[...block.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
      .map(m=>decodeXml(m[1])).filter(Boolean);
    const text=parts.join(' ').replace(/\s+/g,' ').trim();
    if(text && !out.includes(text)) out.push(text);
  }
  if(out.length) return out;
  return [...String(xml).matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
    .map(m=>decodeXml(m[1])).filter((x,i,a)=>x && a.indexOf(x)===i);
}

async function slidePrimaryImage(zip, slidePath, slideXml) {
  try {
    const rid=slideXml.match(/r:embed="([^"]+)"/)?.[1];
    if(!rid) return '';
    const n=slidePath.match(/slide(\d+)\.xml$/)?.[1];
    if(!n) return '';
    const relPath=`ppt/slides/_rels/slide${n}.xml.rels`;
    const relFile=zip.file(relPath);
    if(!relFile) return '';
    const relXml=await relFile.async('text');
    const doc=new DOMParser().parseFromString(relXml,'application/xml');
    const rel=[...doc.getElementsByTagName('Relationship')].find(x=>x.getAttribute('Id')===rid);
    if(!rel) return '';
    const mediaPath=zipResolve(slidePath,rel.getAttribute('Target')||'');
    const media=zip.file(mediaPath);
    if(!media) return '';
    const blob=await media.async('blob');
    return URL.createObjectURL(blob);
  } catch {
    return '';
  }
}

async function parsePptxFile(file) {
  if(!window.JSZip) throw new Error('PowerPoint parser failed to load.');
  if(!file || !/\.pptx$/i.test(file.name)) throw new Error('Please select a .pptx PowerPoint file.');
  if(file.size > 35*1024*1024) throw new Error('For this MVP, please keep the PowerPoint below 35 MB.');

  const old=window.__presentationDeck;
  if(old?.slides) old.slides.forEach(s=>{if(s.imageUrl) try{URL.revokeObjectURL(s.imageUrl);}catch{}});

  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const slidePaths=Object.keys(zip.files)
    .filter(x=>/^ppt\/slides\/slide\d+\.xml$/i.test(x))
    .sort((a,b)=>Number(a.match(/slide(\d+)/i)?.[1]||0)-Number(b.match(/slide(\d+)/i)?.[1]||0));

  if(!slidePaths.length) throw new Error('No slides were found in this PowerPoint.');

  const slides=[];
  for(let i=0;i<slidePaths.length;i++) {
    const path=slidePaths[i];
    const xml=await zip.file(path).async('text');
    const paragraphs=pptParagraphs(xml).filter(x=>!/^\d+$/.test(x));
    const slideNo=Number(path.match(/slide(\d+)/i)?.[1]||i+1);

    let notes=[];
    const notePath=`ppt/notesSlides/notesSlide${slideNo}.xml`;
    if(zip.file(notePath)) {
      try {
        notes=pptParagraphs(await zip.file(notePath).async('text'))
          .filter(x=>x && !/^\d+$/.test(x) && !/^slide\s*\d*$/i.test(x));
      } catch {}
    }

    const title=paragraphs[0] || `Slide ${i+1}`;
    const body=paragraphs.slice(1);
    const imageUrl=await slidePrimaryImage(zip,path,xml);
    slides.push({
      number:i+1,
      title,
      body,
      notes:notes.join(' ').trim(),
      imageUrl
    });
  }

  return {
    name:file.name.replace(/\.pptx$/i,''),
    fileName:file.name,
    loadedAt:new Date(),
    slides,
    pdfFileName: '',
    pdfUrl: ''
  };
}

function attachPresentationPdf(file) {
  if(!file || !/\.pdf$/i.test(file.name)) throw new Error('Please select a PDF file.');
  const deck=window.__presentationDeck;
  if(!deck) throw new Error('Upload the PowerPoint first so narration can be mapped to the slides.');
  if(deck.pdfUrl) { try { URL.revokeObjectURL(deck.pdfUrl); } catch {} }
  deck.pdfFileName=file.name;
  deck.pdfUrl=URL.createObjectURL(file);
  window.__presentationState.narration='Original slide visuals attached. I will use the PDF for display and the PowerPoint content and speaker notes for narration.';
  render();
  presentationSpeak(window.__presentationState.narration);
}

function presentationPdfPageUrl(deck,pageNumber) {
  return deck?.pdfUrl ? `${deck.pdfUrl}#page=${Math.max(1,pageNumber)}&zoom=page-fit&toolbar=0&navpanes=0&scrollbar=0` : '';
}

function presentationNarration(slide, detailed=false) {
  if(!slide) return '';
  const notes=String(slide.notes||'').replace(/\s+/g,' ').trim();
  if(notes.length>35 && !detailed) return notes;

  const points=(slide.body||[]).filter(Boolean);
  if(!points.length) return `This slide is titled ${slide.title}. Let me briefly explain the main idea shown here.`;

  const visible=points.slice(0,detailed?8:5);
  const intro=`This slide is about ${slide.title}.`;
  const body=detailed
    ? ` Let me explain the main points in more detail. ${visible.map((p,i)=>`Point ${i+1}: ${p}.`).join(' ')}`
    : ` The key points are ${visible.map((p,i)=>`${i+1}, ${p}`).join('; ')}.`;

  return `${intro}${body}`;
}

function presentationSummary(slide) {
  if(!slide) return '';
  const points=(slide.body||[]).slice(0,4);
  return points.length
    ? `In summary, ${slide.title} focuses on ${points.join('; ')}.`
    : `In summary, this slide focuses on ${slide.title}.`;
}

function renderPresentationSlide(slide) {
  if(!slide) return '';
  const deck=window.__presentationDeck;
  if(deck?.pdfUrl) {
    return `<article class="v12-slide-card v122-pdf-slide">
      <div class="v12-slide-label">SLIDE ${slide.number} · ORIGINAL PDF VISUAL</div>
      <iframe class="v122-pdf-frame" title="Slide ${slide.number}: ${escapeHtml(slide.title)}"
        src="${presentationPdfPageUrl(deck,slide.number)}"></iframe>
    </article>`;
  }
  const bullets=(slide.body||[]).slice(0,9);
  return `<article class="v12-slide-card">
    <div class="v12-slide-label">SLIDE ${slide.number} · RECONSTRUCTED PREVIEW</div>
    <h1>${escapeHtml(slide.title)}</h1>
    ${slide.imageUrl?`<img class="v12-slide-image" src="${slide.imageUrl}" alt="">`:''}
    ${bullets.length?`<ul>${bullets.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:`<p class="v12-slide-empty">This slide contains primarily visual content.</p>`}
  </article>`;
}

function renderPresentation() {
  const deck=window.__presentationDeck;
  const ps=window.__presentationState;
  const slide=deck?.slides?.[ps.current] || null;
  const speechSupported=Boolean(window.SpeechRecognition||window.webkitSpeechRecognition);

  return `<div class="v12-presentation">
    <header class="v12-present-top">
      <div>
        <button class="v12-back" data-action="closePresentation">← AI Agent</button>
        <div><strong>AI Presentation Mode</strong><small>${deck?escapeHtml(deck.fileName):'Dynamic PowerPoint presenter'}</small></div>
      </div>
      <div class="v12-present-top-actions">
        ${deck?`<span>${ps.current+1} / ${deck.slides.length}</span>`:''}
        <button data-action="uploadPresentation">${deck?'Change PPT':'Upload PPTX'}</button>
        ${deck?`<button class="${deck.pdfUrl?'v122-attached':''}" data-action="uploadPresentationPdf">${deck.pdfUrl?'PDF Attached ✓':'Attach Original PDF'}</button>`:''}
      </div>
    </header>

    ${!deck?`
      <main class="v12-upload-view">
        <div class="v12-upload-robot"><img src="/ai-agent-center.png?v=12.2.0" alt="AI Operations Agent"></div>
        <section class="v12-upload-card">
          <span class="eyebrow">AI PRESENTER</span>
          <h1>Let your AI Operations Agent present any PowerPoint.</h1>
          <p>Upload the <strong>.pptx</strong> so I can read slide text and speaker notes. Then attach a <strong>PDF export of the same deck</strong> so your original formatting is preserved.</p>
          <button class="btn primary v12-upload-main" data-action="uploadPresentation">1. Upload PowerPoint</button>
          <div class="v12-upload-note">After the PowerPoint loads, use <strong>Attach Original PDF</strong>. Then say or type <strong>“Start presentation”</strong>.</div>
        </section>
      </main>
    `:`
      <main class="v12-present-stage">
        <section class="v12-slide-area">
          ${renderPresentationSlide(slide)}
        </section>

        <aside class="v12-presenter-panel">
          <div class="v12-presenter-robot"><img src="/ai-agent-center.png?v=12.2.0" alt="AI presenter"></div>
          <div class="v12-presenter-status">
            <strong>🤖 AI Operations Agent</strong>
            <span>${ps.active?(ps.paused?'Paused':'Presenting…'):'Ready to present'}</span>
            <div class="v11-wave ${ps.active&&!ps.paused?'active':''}">${Array.from({length:43},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div>
            <p>${escapeHtml(ps.narration || 'Say “start presentation” or press Start.')}</p>
          </div>
        </aside>

        <div class="v12-controls">
          <button data-action="previousSlide">← Previous</button>
          <button class="primary" data-action="${ps.active?'pausePresentation':'startPresentation'}">${ps.active?(ps.paused?'▶ Resume':'⏸ Pause'):'▶ Start'}</button>
          <button data-action="nextSlide">Next →</button>
          <button data-action="stopPresentation">■ Stop</button>
          <button class="${ps.autoAdvance?'active':''}" data-action="togglePresentationMode">${ps.autoAdvance?'Auto advance':'Interactive'}</button>
          <button class="v12-mic ${ps.listening?'listening':''}" data-action="presentationVoice" ${speechSupported?'':'disabled'}>🎤</button>
        </div>

        <div class="v12-commandbar">
          <input id="presentationCommand" placeholder='Try: "next slide", "explain this slide", "pause", "continue"...'>
          <button data-action="presentationCommand">Send</button>
        </div>
      </main>
    `}
    <input id="pptxUpload" type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden>
    <input id="pdfPresentationUpload" type="file" accept=".pdf,application/pdf" hidden>
  </div>`;
}

function presentationSpeak(text, onEnd) {
  if(!('speechSynthesis' in window) || !text) {
    if(onEnd) onEnd();
    return;
  }
  stopSpeech();
  const clean=String(text).replace(/\*\*/g,'').replace(/[#*_`]/g,' ').replace(/\s+/g,' ').trim();
  const utter=new SpeechSynthesisUtterance(clean);
  utter.lang='en-IN';
  utter.rate=0.94;
  utter.pitch=1;
  utter.onstart=()=>{
    window.__voiceSpeaking=true;
    window.__presentationState.paused=false;
    render();
  };
  utter.onend=()=>{
    window.__voiceSpeaking=false;
    window.__presentationState.paused=false;
    render();
    if(onEnd) onEnd();
  };
  utter.onerror=()=>{
    window.__voiceSpeaking=false;
    window.__presentationState.paused=false;
    render();
  };
  window.__currentUtterance=utter;
  window.speechSynthesis.speak(utter);
}

function presentCurrentSlide({detailed=false, summary=false}={}) {
  const deck=window.__presentationDeck;
  const ps=window.__presentationState;
  const slide=deck?.slides?.[ps.current];
  if(!slide) return;
  const narration=summary?presentationSummary(slide):presentationNarration(slide,detailed);
  ps.narration=narration;
  ps.active=true;
  ps.paused=false;
  state.page='presentation';
  render();

  presentationSpeak(narration,()=>{
    if(!ps.active || ps.paused) return;
    if(ps.autoAdvance && ps.current < deck.slides.length-1 && !detailed && !summary) {
      setTimeout(()=>{
        if(!ps.active) return;
        ps.current += 1;
        presentCurrentSlide();
      },700);
    } else if(ps.autoAdvance && ps.current === deck.slides.length-1 && !detailed && !summary) {
      ps.active=false;
      ps.narration='That concludes the presentation. Thank you. I am ready for questions.';
      render();
      presentationSpeak(ps.narration);
    } else {
      ps.active=false;
      render();
    }
  });
}

function startPresentation() {
  const deck=window.__presentationDeck;
  if(!deck?.slides?.length) return toast('Upload a PowerPoint first.');
  const ps=window.__presentationState;
  if(ps.paused && window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
    ps.paused=false; ps.active=true; render(); return;
  }
  if(ps.current>=deck.slides.length) ps.current=0;
  presentCurrentSlide();
}

function stopPresentation(reset=false) {
  stopSpeech();
  const ps=window.__presentationState;
  ps.active=false; ps.paused=false;
  if(reset) ps.current=0;
  render();
}

function nextPresentationSlide(speak=true) {
  const deck=window.__presentationDeck;
  if(!deck?.slides?.length) return;
  stopSpeech();
  const ps=window.__presentationState;
  ps.current=Math.min(deck.slides.length-1,ps.current+1);
  ps.active=false; ps.paused=false;
  ps.narration='';
  render();
  if(speak) setTimeout(()=>presentCurrentSlide(),120);
}

function previousPresentationSlide(speak=true) {
  const deck=window.__presentationDeck;
  if(!deck?.slides?.length) return;
  stopSpeech();
  const ps=window.__presentationState;
  ps.current=Math.max(0,ps.current-1);
  ps.active=false; ps.paused=false;
  ps.narration='';
  render();
  if(speak) setTimeout(()=>presentCurrentSlide(),120);
}

function handlePresentationCommand(command='') {
  const q=String(command).toLowerCase().trim();
  if(!q) return;
  const ps=window.__presentationState;

  if(/\b(next|next slide|move on|continue to next)\b/.test(q)) return nextPresentationSlide(true);
  if(/\b(previous|previous slide|back|go back)\b/.test(q)) return previousPresentationSlide(true);
  if(/\b(pause|hold)\b/.test(q)) {
    if(window.speechSynthesis?.speaking) window.speechSynthesis.pause();
    ps.paused=true; ps.active=true; render(); return;
  }
  if(/\b(resume|continue|carry on)\b/.test(q)) {
    if(window.speechSynthesis?.paused) {
      window.speechSynthesis.resume(); ps.paused=false; ps.active=true; render();
    } else startPresentation();
    return;
  }
  if(/\b(stop|end presentation|finish presentation)\b/.test(q)) return stopPresentation(false);
  if(/\b(restart|start over|from beginning)\b/.test(q)) {
    ps.current=0; ps.active=false; ps.narration=''; return startPresentation();
  }
  if(/\b(start|begin|present|presentation)\b/.test(q)) return startPresentation();
  if(/\b(explain|detail|more detail)\b/.test(q)) return presentCurrentSlide({detailed:true});
  if(/\b(summary|summarize|summarise)\b/.test(q)) return presentCurrentSlide({summary:true});

  const slide=window.__presentationDeck?.slides?.[ps.current];
  if(slide) {
    ps.narration=`On the current slide, ${presentationNarration(slide,true)}`;
    render();
    presentationSpeak(ps.narration);
  }
}

function startPresentationVoice() {
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR) return toast('Voice recognition is not supported in this browser.');
  stopSpeech();
  const ps=window.__presentationState;
  const recognition=new SR();
  recognition.lang='en-IN';
  recognition.interimResults=false;
  recognition.continuous=false;
  ps.listening=true; render();
  recognition.onresult=e=>{
    const text=e.results?.[0]?.[0]?.transcript||'';
    ps.listening=false; render();
    if(text) handlePresentationCommand(text);
  };
  recognition.onerror=e=>{ps.listening=false;render();toast(`Voice input: ${e.error}`);};
  recognition.onend=()=>{ps.listening=false;render();};
  try{recognition.start();}catch(err){ps.listening=false;render();toast(err.message);}
}

async function loadPresentationFile(file) {
  const ps=window.__presentationState;
  ps.status='Reading PowerPoint…';
  state.page='presentation'; render();
  try {
    const deck=await parsePptxFile(file);
    window.__presentationDeck=deck;
    ps.current=0; ps.active=false; ps.paused=false; ps.autoAdvance=true; ps.narration=`${deck.name} is ready. I found ${deck.slides.length} slides. Attach a PDF export of the same deck to preserve the original slide appearance. Then say “start presentation” when you are ready.`;
    render();
    presentationSpeak(ps.narration);
  } catch(err) {
    ps.narration='';
    toast(err.message);
    render();
  }
}


function resultTicketTable(rows=[]) {
  if(!rows.length) return `<div class="result-note">Individual ticket records are not included in the current callback yet. The MVP is ready to render ticket numbers automatically once the Moveworks callback includes the records.</div>`;
  return `<div class="result-table"><table><thead><tr><th>Ticket</th><th>Status</th><th>Team / Owner</th><th>Risk</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${escapeHtml(x.id||x.number||'')}</strong><div class="muted">${escapeHtml(x.title||x.summary||'')}</div></td><td>${badge(x.status||x.sla||'Breached','danger')}</td><td>${escapeHtml(x.team||'')}<div class="muted">${escapeHtml(x.assignee||'')}</div></td><td>${escapeHtml(x.risk||'—')}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderResults() {
  const prompt=window.__lastAiQuestion||window.__agentPrompt||'';
  const answer=window.__aiAnswer||'';
  const local=window.__agentLocalResult||null;
  const rows=local?.rows||[];
  const isCount=local?.kind==='kpi';
  return layout(`<section class="result-page">
    <div class="result-top"><button class="back-btn" data-action="backAgent">← Back to Agent</button><div><span class="eyebrow">AI OPERATIONS RESULT</span><h2>${isCount?'Live governance answer':'Moveworks AI response'}</h2></div><button class="read-btn" data-action="readAloud">🔊 Read aloud</button></div>
    <div class="asked-card"><span>You asked</span><strong>“${escapeHtml(prompt)}”</strong></div>
    ${state.aiBusy?`<div class="thinking-card"><div class="thinking-orb">✦</div><div><strong>Analyzing live operations data…</strong><span>Moveworks is running the governance workflow and the result will appear here.</span></div></div>`:''}
    ${answer?`<div class="result-answer"><div class="result-answer-label">✦ AI Operations Agent</div><div class="result-answer-content">${formatAiText(answer)}</div></div>`:''}
    <div class="result-kpis">${metric('SLA Breached',state.slaBreached,'Live SLA records','red')}${metric('Critical SLA',state.slaCritical,'Immediate attention','red')}${metric('SLA At Risk',state.slaAtRisk,'Approaching breach','orange')}${metric('Ageing Tickets',state.ageingTotal,'Governance backlog','purple')}</div>
    ${(local?.kind==='sla-list'||local?.kind==='ageing-list')?`<section class="card"><div class="cardhead"><div><h2>${local.kind==='sla-list'?'Ticket details':'Ageing ticket details'}</h2><p>Live records returned by the governance data feed</p></div></div>${resultTicketTable(rows)}</section>`:''}
    ${state.aiBriefing && !answer.includes(String(state.aiBriefing).slice(0,30)) && !isCount?`<section class="card ai-card-shell">${aiInsightCard(true)}</section>`:''}
    <div class="followup-card"><label>Ask a follow-up</label><div class="followup-row"><input id="resultPrompt" placeholder="Ask another operations question..."><button class="voice-mini" data-action="startVoiceResult">🎤</button><button class="btn primary" data-action="resultAsk">Ask</button></div></div>
  </section>`);
}

function startVoice(targetId='agentPrompt') {
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR) return toast('Voice recognition is not supported in this browser. Chrome or Edge is recommended.');
  stopSpeech();
  if(window.__recognition) { try{window.__recognition.stop();}catch{} window.__recognition=null; }
  const recognition=new SR(); window.__recognition=recognition; recognition.lang='en-IN'; recognition.interimResults=true; recognition.continuous=false;
  let finalText=''; window.__voiceListening=true; render();
  recognition.onresult=(event)=>{let interim=''; for(let i=event.resultIndex;i<event.results.length;i++){const t=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=t;else interim+=t;} const text=(finalText||interim).trim(); window.__agentDraft=text; const el=document.getElementById(targetId); if(el) el.value=text;};
  recognition.onerror=(event)=>{window.__voiceListening=false; window.__recognition=null; toast(`Voice input: ${event.error}`); render();};
  recognition.onend=()=>{window.__voiceListening=false; window.__recognition=null; const text=(finalText||window.__agentDraft||'').trim(); render(); if(text){setTimeout(()=>askAiHome(text,true),180);}};
  try{recognition.start();}catch(err){window.__voiceListening=false; toast(err.message);render();}
}

function speakText(text) {
  if(!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const clean=String(text).replace(/\*\*/g,'').replace(/[#*_`]/g,' ').replace(/\s+/g,' ').trim();
  const utter=new SpeechSynthesisUtterance(clean); utter.lang='en-IN'; utter.rate=0.96; utter.pitch=1;
  utter.onstart=()=>{window.__voiceSpeaking=true;render();};
  utter.onend=()=>{window.__voiceSpeaking=false;render();};
  utter.onerror=()=>{window.__voiceSpeaking=false;render();};
  window.__currentUtterance=utter; window.speechSynthesis.speak(utter);
}
function stopSpeech(){if('speechSynthesis' in window)window.speechSynthesis.cancel();window.__voiceSpeaking=false;}
function pauseSpeech(){if(!('speechSynthesis' in window))return;if(window.speechSynthesis.paused){window.speechSynthesis.resume();}else{window.speechSynthesis.pause();}}
function readAloud() {
  const text=String(window.__aiAnswer||window.__homeAiAnswer||'').trim();
  if(!text) return toast('There is no response to read yet.');
  speakText(text);
}

function render() {
  if(state.page==='agent') app.innerHTML=renderAgent(); else if(state.page==='presentation') app.innerHTML=renderPresentation(); else if(state.page==='results') app.innerHTML=renderResults(); else if(state.page==='ageing') app.innerHTML=renderAgeing(); else if(state.page==='sla') app.innerHTML=renderSla(); else if(state.page==='devops') app.innerHTML=renderDevops(); else if(state.page==='projectpilot') app.innerHTML=renderProjectPilot(); else if(state.page==='ai') app.innerHTML=renderAi(window.__aiAnswer||''); else app.innerHTML=renderCommand();
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
    state.triggerOnly=data.mode==='trigger-only'; state.statusMessage=data.message||''; state.live=!state.triggerOnly; state.ageingTotal=data.ageing?.total||0; state.incidentCount=data.ageing?.incidentCount||0; state.ritmCount=data.ageing?.ritmCount||0; state.taskCount=data.ageing?.taskCount||0;
    state.slaAtRisk=data.sla?.atRisk||0; state.slaCritical=data.sla?.critical||0; state.slaBreached=data.sla?.breached||0; state.slaTotalAttention=data.sla?.totalAttention ?? (state.slaAtRisk+state.slaBreached); state.slaCompliance=data.sla?.compliance??null;
    state.morning=data.daily?.morning||0; state.updated=data.daily?.updated||0; state.closed=data.daily?.closed||0; state.pending=data.daily?.pending||0;
    state.tickets=Array.isArray(data.tickets)?data.tickets:[]; state.slaBreaches=Array.isArray(data.slaBreaches)?data.slaBreaches:[]; state.slaIncidentCount=[...new Set(state.slaBreaches.map(x=>String(x.incident_number||x.id||x.number||'').trim()).filter(Boolean))].length;
    const liveDevopsItems=Array.isArray(data.devops?.items)?data.devops.items:[];
    if(liveDevopsItems.length){
      state.devopsMockMode=false; state.devopsItems=liveDevopsItems;
      state.devopsHygiene=data.devops?.hygiene||devopsMetrics(liveDevopsItems).hygiene;
      state.devopsNonCompliant=data.devops?.nonCompliant??devopsMetrics(liveDevopsItems).nonCompliant;
      state.devopsLargestGap=data.devops?.largestGap||devopsMetrics(liveDevopsItems).largestGap;
    } else {
      state.devopsMockMode=true; state.devopsItems=buildMockDevopsItems();
      const dm=devopsMetrics(state.devopsItems); state.devopsHygiene=dm.hygiene; state.devopsNonCompliant=dm.nonCompliant; state.devopsLargestGap=dm.largestGap;
    }
    state.trend=Array.isArray(data.trend)?data.trend:[]; state.aiBriefing=data.aiBriefing||null; state.lastRefresh=new Date(data.generatedAt||Date.now());
    if(showToast) toast('Live Moveworks data refreshed');
  } catch(err) { state.live=false; state.triggerOnly=false; state.statusMessage=''; state.error=err.message; }
  finally { state.loading=false; render(); }
}

function liveKpiAnswer(prompt, source=state) {
  // Deterministic fast path for factual governance questions.
  // Never invoke the long Moveworks RCA workflow for simple counts.
  const raw=String(prompt||'').trim();
  const q=raw.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9% ]/g,' ').replace(/\s+/g,' ').trim();

  const asksNumber=/\b(how many|number|count|total|quantity)\b/.test(q)
    || /\bwhat(?:s| is)\b.*\b(number|count|total)\b/.test(q)
    || /\bgive me\b.*\b(number|count|total)\b/.test(q);
  const asksCurrent=asksNumber || /\b(current|currently|today|right now|live|latest)\b/.test(q);
  if(!asksCurrent) return null;

  const sla=source.sla||{}; const ageing=source.ageing||{};
  const breached=Number(sla.breached ?? sla.breached_count ?? source.slaBreached ?? state.slaBreached ?? 0);
  const atRisk=Number(sla.atRisk ?? sla.at_risk_count ?? source.slaAtRisk ?? state.slaAtRisk ?? 0);
  const critical=Number(sla.critical ?? sla.critical_count ?? source.slaCritical ?? state.slaCritical ?? 0);
  const totalAttention=Number(sla.totalAttention ?? sla.total_sla_attention ?? source.slaTotalAttention ?? state.slaTotalAttention ?? (atRisk+breached));
  const ageingTotal=Number(ageing.total ?? ageing.total_ageing_count ?? source.ageingTotal ?? state.ageingTotal ?? 0);

  const mentionsSla=/\bsla\b/.test(q);
  const mentionsBreach=/\b(breach|breached|breaches|breaching)\b/.test(q);
  const mentionsIncident=/\b(incident|incidents|inc)\b/.test(q);

  // Treat "breached incidents" as an SLA-count question when the dashboard context is SLA governance.
  if((mentionsSla || mentionsIncident) && mentionsBreach) {
    if(mentionsIncident) {
      const uniqueCount=Number(source.slaIncidentCount ?? state.slaIncidentCount ?? breachedIncidentNumbers().length);
      if(uniqueCount>0) return `**${uniqueCount} unique breached incidents** are currently available in the latest live ServiceNow SLA governance result. The underlying SLA record count is **${breached}**.`;
    }
    return `**${breached} breached SLA records** are currently reported in the latest live ServiceNow governance data.`;
  }
  if(mentionsSla && /\bcritical\b/.test(q)) return `**${critical} critical SLA records** are currently reported in the latest live ServiceNow governance data.`;
  if(mentionsSla && /\b(at risk|risk)\b/.test(q)) return `**${atRisk} SLA records are at risk** in the latest live ServiceNow governance data.`;
  if(mentionsSla && /\b(attention|total)\b/.test(q)) return `**${totalAttention} SLA records require attention** (${atRisk} at risk + ${breached} breached).`;
  if(/\b(ageing|aging)\b/.test(q) && /\b(ticket|tickets|backlog|incident|incidents|ritm|task|tasks)\b/.test(q)) return `**${ageingTotal} ageing tickets** are currently reported in the latest live governance data.`;
  return null;
}

function resultSummary(result, prompt='') {
  const r=result||{};
  const direct=liveKpiAnswer(prompt,r);
  if(direct) return direct;
  const ai=r.aiBriefing||r.ai_briefing||r.ai_analysis||r.analysis||r.recommendation||r.recommendations;
  if(ai) return typeof ai==='string'?ai:JSON.stringify(ai,null,2);
  const sla=r.sla||{}; const ageing=r.ageing||{};
  const parts=[];
  if(sla.atRisk!==undefined||sla.at_risk_count!==undefined) parts.push(`SLA at risk: ${sla.atRisk??sla.at_risk_count??0}`);
  if(sla.critical!==undefined||sla.critical_count!==undefined) parts.push(`Critical SLA: ${sla.critical??sla.critical_count??0}`);
  if(sla.breached!==undefined||sla.breached_count!==undefined) parts.push(`SLA breached: ${sla.breached??sla.breached_count??0}`);
  if(ageing.total!==undefined||ageing.total_ageing_count!==undefined) parts.push(`Ageing backlog: ${ageing.total??ageing.total_ageing_count??0}`);
  return parts.length?`Live Moveworks governance result received.\n\n${parts.join('\n')}`:'Live Moveworks governance result received and the dashboard has been refreshed.';
}

async function waitForMoveworksResult(startedAt, requestId, timeoutMs=120000) {
  const started=Date.now();
  while(Date.now()-started<timeoutMs) {
    await new Promise(resolve=>setTimeout(resolve,2000));
    const qs=new URLSearchParams(); if(startedAt) qs.set('since',startedAt); if(requestId) qs.set('request_id',requestId);
    const status=await api(`/api/moveworks/result?${qs.toString()}`);
    if(status.status==='ready'&&status.result) return status.result;
  }
  return null;
}


async function askAiHome(prompt, autoSpeak=true) {
  const clean=String(prompt||'').trim(); if(!clean) return toast('Enter or speak a question first.');
  const identityIntent=detectAgentIdentityIntent(clean);
  if(identityIntent) {
    window.__agentDraft='';
    return answerAgentIdentity(identityIntent,autoSpeak);
  }

  if(/\b(present|presentation|powerpoint|ppt|slide deck|start presentation)\b/i.test(clean)) {
    state.page='presentation';
    render();
    if(window.__presentationDeck?.slides?.length) {
      setTimeout(()=>startPresentation(),150);
    } else {
      window.__presentationState.narration='Presentation Mode is ready. Upload a PowerPoint file, then say “start presentation”.';
      render();
      if(autoSpeak) setTimeout(()=>presentationSpeak(window.__presentationState.narration),200);
    }
    return;
  }
  window.__lastAiQuestion=clean; window.__agentPrompt=clean; window.__agentDraft=clean; window.__homeAiAnswer=''; state.aiBusy=true; state.page='agent'; render();
  try {
    const local=localOperationalResult(clean);
    if(local){window.__agentLocalResult=local;window.__homeAiAnswer=local.answer;window.__aiAnswer=local.answer;}
    else {
      const result=await api('/api/ai/query',{method:'POST',body:JSON.stringify({prompt:clean})});
      if(result.mode==='webhook-trigger'){
        window.__homeAiAnswer=result.answer||'Moveworks accepted the request. Waiting for the live response…'; render();
        const callback=await waitForMoveworksResult(result.startedAt||result.started_at,result.requestId||result.request_id);
        window.__homeAiAnswer=callback?resultSummary(callback,clean):'Moveworks accepted the request, but the workflow is still running.';
        if(callback) await refreshDashboard(false);
      } else window.__homeAiAnswer=result.answer||'No AI response was returned.';
      window.__aiAnswer=window.__homeAiAnswer;
    }
  } catch(err){window.__homeAiAnswer=`Unable to contact Moveworks AI: ${err.message}`;window.__aiAnswer=window.__homeAiAnswer;}
  finally {state.aiBusy=false;state.page='agent';render();if(autoSpeak&&window.__homeAiAnswer)setTimeout(()=>speakText(window.__homeAiAnswer),250);}
}


async function askCommandAi(prompt, autoSpeak=false) {
  const clean=String(prompt||'').trim();
  if(!clean) return toast('Enter or speak a question first.');

  const identityIntent=detectAgentIdentityIntent(clean);
  if(identityIntent) {
    // Reuse the same personality content as the front-page agent, but keep the user in Command Center.
    const previousPage=state.page;
    answerAgentIdentity(identityIntent,false);
    const answer=window.__homeAiAnswer||window.__aiAnswer||'';
    state.page='command';
    state.commandAiAnswer=answer;
    state.commandAiBusy=false;
    render();
    if(autoSpeak&&answer) setTimeout(()=>speakText(answer),200);
    return;
  }

  state.commandAiBusy=true;
  state.commandAiAnswer='';
  render();
  try {
    const local=localOperationalResult(clean);
    if(local){
      state.commandAiAnswer=local.answer;
    } else {
      const result=await api('/api/ai/query',{method:'POST',body:JSON.stringify({prompt:clean})});
      if(result.mode==='webhook-trigger'){
        state.commandAiAnswer=result.answer||'Moveworks accepted the request. Waiting for the live response…';
        render();
        const callback=await waitForMoveworksResult(result.startedAt||result.started_at,result.requestId||result.request_id);
        state.commandAiAnswer=callback?resultSummary(callback,clean):'Moveworks accepted the request, but the workflow is still running.';
        if(callback) await refreshDashboard(false);
      } else {
        state.commandAiAnswer=result.answer||'No AI response was returned.';
      }
    }
  } catch(err) {
    state.commandAiAnswer=`Unable to contact Moveworks AI: ${err.message}`;
  } finally {
    state.commandAiBusy=false;
    state.page='command';
    render();
    if(autoSpeak&&state.commandAiAnswer) setTimeout(()=>speakText(state.commandAiAnswer),200);
  }
}

async function askAi(prompt) {
  const clean=String(prompt||'').trim(); if(!clean) return toast('Enter a question first.');
  window.__lastAiQuestion=clean; window.__agentPrompt=clean; window.__agentDraft=''; window.__agentLocalResult=null;

  // Fast local operational answers: counts and list requests should appear immediately.
  const local=localOperationalResult(clean);
  if(local) { window.__agentLocalResult=local; window.__aiAnswer=local.answer; state.page='results'; state.aiBusy=false; render(); return; }

  state.page='results'; state.aiBusy=true; window.__aiAnswer=''; render();
  try {
    const result=await api('/api/ai/query',{method:'POST',body:JSON.stringify({prompt:clean})});
    if(result.mode==='webhook-trigger') {
      window.__aiAnswer=result.answer||'Moveworks accepted the request. Waiting for the live callback…'; render();
      const callback=await waitForMoveworksResult(result.startedAt||result.started_at,result.requestId||result.request_id);
      if(callback) {
        window.__aiAnswer=resultSummary(callback,clean);
        await refreshDashboard(false);
        state.page='results';
      } else {
        window.__aiAnswer='Moveworks accepted the request and the workflow is still running. The result page will refresh when the callback is received.';
      }
    } else {
      window.__aiAnswer=result.answer||'No AI response returned.';
    }
  } catch(err) { window.__aiAnswer=`Unable to contact Moveworks AI: ${err.message}`; }
  finally { state.aiBusy=false; state.page='results'; render(); }
}

function openAssign(ticketId) {
  const t=state.tickets.find(x=>x.id===ticketId); if(!t) return; state.selectedTicket=t;
  const overlay=document.createElement('div'); overlay.className='modalback'; overlay.id='assignModal';
  overlay.innerHTML=`<div class="modal"><h2>Assign ${escapeHtml(t.id)}</h2><p>Current assignee: <strong>${escapeHtml(t.assignee)}</strong></p><input id="assigneeSelect" class="search" placeholder="New assignee or queue"><div class="modalactions">${button('Cancel','closeModal')}${button('Confirm assignment','confirmAssign','',true)}</div></div>`;
  document.body.appendChild(overlay);
}

function openSlaReassign(incidentNumber) {
  const row=findSlaIncident(incidentNumber);
  if(!row) return toast(`Incident ${incidentNumber} is not in the latest SLA snapshot.`);
  state.selectedTicket={
    id:incidentNumberOf(row),
    source:'sla',
    team:row.team||row.assignment_group||'',
    assignee:row.assignee||row.assigned_to||''
  };
  const groups=[...new Set((state.slaBreaches||[]).map(x=>String(x.team||x.assignment_group||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const overlay=document.createElement('div'); overlay.className='modalback'; overlay.id='assignModal';
  overlay.innerHTML=`<div class="modal reassign-modal">
    <h2>Reassign ${escapeHtml(state.selectedTicket.id)}</h2>
    <div class="reassign-current"><span>Current group <strong>${escapeHtml(state.selectedTicket.team||'—')}</strong></span><span>Current assignee <strong>${escapeHtml(state.selectedTicket.assignee||'Unassigned')}</strong></span></div>
    <label class="modal-field"><span>New assignment group</span><select id="assignmentGroupSelect" class="search"><option value="">Select a group</option>${groups.map(g=>`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}<option value="__custom__">Other / type manually</option></select></label>
    <label class="modal-field"><span>Custom assignment group</span><input id="assignmentGroupCustom" class="search" placeholder="Optional custom group"></label>
    <label class="modal-field"><span>Assignee</span><input id="assigneeSelect" class="search" placeholder="Optional individual assignee"></label>
    <label class="modal-field"><span>Reason</span><input id="assignmentReason" class="search" value="SLA breach remediation"></label>
    <div class="modal-note">The request is sent through the configured Moveworks assignment action. ServiceNow remains the system of record.</div>
    <div class="modalactions">${button('Cancel','closeModal')}${button('Reassign incident','confirmSlaReassign','',true)}</div>
  </div>`;
  document.body.appendChild(overlay);
}


function openDevopsReassign(workItemId) {
  const item=(state.devopsItems||[]).find(x=>String(x.id||x.number)===String(workItemId));
  if(!item) return toast(`Work item ${workItemId} was not found.`);
  state.selectedDevopsItem=item;
  const overlay=document.createElement('div'); overlay.className='modalback'; overlay.id='devopsAssignModal';
  overlay.innerHTML=`<div class="modal reassign-modal">
    <h2>Reassign ${escapeHtml(item.id||item.number)}</h2>
    <p>${escapeHtml(item.type||'Work Item')} · ${escapeHtml(item.title||'')}</p>
    <div class="reassign-current"><span>Current owner <strong>${escapeHtml(item.owner||'Unassigned')}</strong></span><span>Sprint <strong>${escapeHtml(item.sprint||'Not set')}</strong></span></div>
    <label class="modal-field"><span>New owner</span><input id="devopsOwnerInput" class="search" placeholder="Enter new owner"></label>
    <label class="modal-field"><span>Reason</span><input id="devopsAssignReason" class="search" value="DevOps governance remediation"></label>
    <div class="modal-note">${state.devopsMockMode?'MVP demo mode: this updates the mock work item in the browser. A live version can call the Azure DevOps Work Item REST API through the governed backend.':'This demo updates the dashboard state only; live Azure DevOps update integration is not configured yet.'}</div>
    <div class="modalactions">${button('Cancel','closeDevopsModal')}${button('Reassign owner','confirmDevopsReassign','',true)}</div>
  </div>`;
  document.body.appendChild(overlay);
}

async function handleAction(action,arg) {
  if(action==='openPresentation'){state.page='presentation';render();return;}
  if(action==='closePresentation'){stopPresentation(false);state.page='agent';render();return;}
  if(action==='uploadPresentation'){document.getElementById('pptxUpload')?.click();return;}
  if(action==='uploadPresentationPdf'){document.getElementById('pdfPresentationUpload')?.click();return;}
  if(action==='startPresentation') return startPresentation();
  if(action==='stopPresentation'){stopPresentation(false);return;}
  if(action==='nextSlide') return nextPresentationSlide(false);
  if(action==='previousSlide') return previousPresentationSlide(false);
  if(action==='togglePresentationMode'){window.__presentationState.autoAdvance=!window.__presentationState.autoAdvance;render();return;}
  if(action==='presentationVoice') return startPresentationVoice();
  if(action==='presentationCommand') return handlePresentationCommand(document.getElementById('presentationCommand')?.value||'');
  if(action==='refreshData'){await refreshDashboard(true);return;}
  if(action==='openProjectPilot'){state.page='projectpilot';render();return;}
  if(action==='openProjectPilotExternal'){window.open('https://projectpilot-ai-mvp-bhf0apataxa5cphp.centralindia-01.azurewebsites.net/#dashboard','_blank','noopener,noreferrer');return;}
  if(action==='agentAsk') return askAiHome(document.getElementById('agentPrompt')?.value||'',true);
  if(action==='agentPrompt') return askAiHome(arg,true);
  if(action==='startVoice') return startVoice('agentPrompt');
  if(action==='startVoiceResult') return startVoice('resultPrompt');
  if(action==='resultAsk') return askAi(document.getElementById('resultPrompt')?.value||'');
  if(action==='backAgent'){state.page='agent';window.__aiAnswer='';window.__agentLocalResult=null;render();return;}
  if(action==='readAloud') return readAloud();
  if(action==='pausePresentation'){
    const ps=window.__presentationState;
    if(window.speechSynthesis?.paused){window.speechSynthesis.resume();ps.paused=false;ps.active=true;}
    else {window.speechSynthesis?.pause();ps.paused=true;ps.active=true;}
    render();return;
  }
  if(action==='stopSpeech'){stopSpeech();render();return;}
  if(action==='pauseSpeech'){pauseSpeech();return;}
  if(action==='closeHomeResponse'){stopSpeech();window.__homeAiAnswer='';render();return;}
  if(action==='copyHomeResponse'){navigator.clipboard?.writeText(window.__homeAiAnswer||'');toast('Response copied');return;}
  if(action==='viewFullAnalysis'){window.__aiAnswer=window.__homeAiAnswer||window.__aiAnswer||'';state.page='results';render();return;}
  if(action==='viewRca') return openRcaModal(arg);
  if(action==='closeRcaModal'){document.getElementById('rcaModal')?.remove();return;}
  if(action==='readRca'){const row=findSlaIncident(arg);const text=rcaTextForIncident(row);if(text)speakText(text);return;}
  if(action==='clearSlaFilters'){state.slaStatusFilter='all';state.slaGroupFilter='all';state.slaSearch='';render();return;}
  if(action==='clearDevopsFilters'){state.devopsTypeFilter='all';state.devopsComplianceFilter='all';state.devopsSearch='';render();return;}
  if(action==='devopsHierarchyView'){state.devopsView='hierarchy';render();return;}
  if(action==='devopsListView'){state.devopsView='list';render();return;}
  if(action==='reassignDevops') return openDevopsReassign(arg);
  if(action==='closeDevopsModal'){document.getElementById('devopsAssignModal')?.remove();return;}
  if(action==='confirmDevopsReassign'){
    const owner=document.getElementById('devopsOwnerInput')?.value.trim()||'';
    if(!owner||!state.selectedDevopsItem) return toast('Enter a new owner.');
    const id=state.selectedDevopsItem.id||state.selectedDevopsItem.number;
    const item=(state.devopsItems||[]).find(x=>String(x.id||x.number)===String(id));
    if(item){
      item.owner=owner;
      item.missing=(item.missing||[]).filter(x=>String(x).toLowerCase()!=='assignee'&&String(x).toLowerCase()!=='owner'&&String(x).toLowerCase()!=='business owner');
      item.score=Math.min(100,(Number(item.score)||0)+15);
      const metrics=devopsMetrics(state.devopsItems); state.devopsHygiene=metrics.hygiene; state.devopsNonCompliant=metrics.nonCompliant; state.devopsLargestGap=metrics.largestGap;
    }
    document.getElementById('devopsAssignModal')?.remove();
    toast(`${id} reassigned to ${owner}${state.devopsMockMode?' (MVP mock)':''}`);
    render(); return;
  }
  if(action==='reassignSla') return openSlaReassign(arg);
  if(action==='nav'){state.page=arg;render();return;} if(action==='assign')return openAssign(arg); if(action==='closeModal'){document.getElementById('assignModal')?.remove();return;}
  if(action==='confirmAssign') { const input=document.getElementById('assigneeSelect'); if(!state.selectedTicket||!input?.value.trim()) return toast('Enter an assignee.'); try { await api(`/api/tickets/${encodeURIComponent(state.selectedTicket.id)}/assign`,{method:'POST',body:JSON.stringify({assignee:input.value.trim()})}); toast(`${state.selectedTicket.id} assignment requested through Moveworks`); document.getElementById('assignModal')?.remove(); await refreshDashboard(); } catch(err){toast(err.message);} return; }
  if(action==='confirmSlaReassign') {
    if(!state.selectedTicket) return toast('No incident selected.');
    const selectedGroup=document.getElementById('assignmentGroupSelect')?.value||'';
    const customGroup=document.getElementById('assignmentGroupCustom')?.value.trim()||'';
    const assignment_group=selectedGroup==='__custom__'?customGroup:(selectedGroup||customGroup);
    const assignee=document.getElementById('assigneeSelect')?.value.trim()||'';
    const reason=document.getElementById('assignmentReason')?.value.trim()||'SLA breach remediation';
    if(!assignment_group && !assignee) return toast('Select an assignment group or enter an assignee.');
    try {
      await api(`/api/tickets/${encodeURIComponent(state.selectedTicket.id)}/assign`,{
        method:'POST',
        body:JSON.stringify({assignment_group,assignee,reason,source:'sla_intelligence'})
      });
      toast(`${state.selectedTicket.id} reassignment requested through Moveworks`);
      document.getElementById('assignModal')?.remove();
      await refreshDashboard();
    } catch(err){toast(err.message);}
    return;
  }
  if(action==='notifyTicket'){try{await api(`/api/tickets/${encodeURIComponent(arg)}/notify`,{method:'POST',body:'{}'});toast(`Moveworks notification triggered for ${arg}`);}catch(err){toast(err.message);}return;}
  if(action==='testMoveworks'){try{const r=await api('/api/moveworks/test',{method:'POST',body:JSON.stringify({prompt:'Run AI Ticket Governance'})});toast(r.moveworks?.status==='RECEIVED'?'Moveworks connection successful — event received':'Moveworks listener responded successfully');}catch(err){toast(`Moveworks connection failed: ${err.message}`);}return;}
  if(action==='sendEod'){try{await api('/api/reports/eod',{method:'POST',body:JSON.stringify({morning:state.morning,updated:state.updated,closed:state.closed,pending:state.pending,action_rate:actionRate(),backlog_reduction:backlogReduction()})});toast('EOD report triggered through Moveworks');}catch(err){toast(err.message);}return;}
  if(action==='aiTicket') return askAi(`Analyze ticket ${arg}. Explain the risk, likely blockers, SLA impact, and recommended next actions.`);
  if(action==='aiPrompt') return askAi(arg);
  if(action==='quickAi') return askAi(document.getElementById('quickAiInput')?.value||'');
  if(action==='analyzeText') return askAi(document.getElementById('aiInput')?.value||'');
}

document.addEventListener('click',e=>{const navEl=e.target.closest('[data-nav]');if(navEl){state.page=navEl.dataset.nav;render();return;}const actionEl=e.target.closest('[data-action]');if(actionEl)handleAction(actionEl.dataset.action,actionEl.dataset.arg||'');});
document.addEventListener('input',e=>{
  if(e.target.id==='ticketSearch'){state.search=e.target.value;render();const el=document.getElementById('ticketSearch');if(el){el.focus();el.setSelectionRange(state.search.length,state.search.length);}}
  if(e.target.id==='slaSearch'){state.slaSearch=e.target.value;render();const el=document.getElementById('slaSearch');if(el){el.focus();el.setSelectionRange(state.slaSearch.length,state.slaSearch.length);}}
  if(e.target.id==='devopsSearch'){state.devopsSearch=e.target.value;render();const el=document.getElementById('devopsSearch');if(el){el.focus();el.setSelectionRange(state.devopsSearch.length,state.devopsSearch.length);}}
  if(e.target.id==='agentPrompt') window.__agentDraft=e.target.value;
});
document.addEventListener('change',e=>{
  if(e.target.id==='slaStatusFilter'){state.slaStatusFilter=e.target.value;render();}
  if(e.target.id==='slaGroupFilter'){state.slaGroupFilter=e.target.value;render();}
  if(e.target.id==='devopsTypeFilter'){state.devopsTypeFilter=e.target.value;render();}
  if(e.target.id==='devopsComplianceFilter'){state.devopsComplianceFilter=e.target.value;render();}
});
document.addEventListener('change',e=>{
  if(e.target.id==='pptxUpload'&&e.target.files?.[0]) loadPresentationFile(e.target.files[0]);
  if(e.target.id==='pdfPresentationUpload'&&e.target.files?.[0]) {
    try { attachPresentationPdf(e.target.files[0]); } catch(err) { toast(err.message); }
  }
});
document.addEventListener('keydown',e=>{
  if((e.target.id==='agentPrompt'||e.target.id==='resultPrompt')&&e.key==='Enter'&&!e.shiftKey){e.preventDefault(); if(e.target.id==='agentPrompt') askAiHome(e.target.value,true); else askAi(e.target.value);}
  if(e.target.id==='presentationCommand'&&e.key==='Enter'){e.preventDefault();handlePresentationCommand(e.target.value);}
});

setInterval(()=>refreshDashboard(false),5*60*1000);
render(); refreshDashboard(false);
