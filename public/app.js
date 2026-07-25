'use strict';

const state = {
  page: 'agent', search: '', selectedTicket: null, loading: true, live: false, triggerOnly: false, statusMessage: '', error: '', aiBusy: false,
  lastRefresh: new Date(), morning: 0, updated: 0, closed: 0, pending: 0,
  ageingTotal: 0, incidentCount: 0, ritmCount: 0, taskCount: 0,
  slaAtRisk: 0, slaCritical: 0, slaBreached: 0, slaTotalAttention: 0, slaCompliance: null,
  devopsHygiene: 0, devopsNonCompliant: 0, devopsLargestGap: '',
  tickets: [], slaBreaches: [], devopsItems: [], trend: [], aiBriefing: null
};

const nav = [
  ['agent','AI Operations Agent','✦'], ['command','Command Center','⌂'], ['ageing','Ageing Tickets','◷'], ['sla','SLA Intelligence','✓'],
  ['devops','DevOps Governance','▣'], ['ai','Ask Governance AI','◈']
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
      <div class="mini-ai"><input id="quickAiInput" placeholder="Why are our SLAs breaching?">${button('Ask AI','quickAi','',true)}</div><div class="connection-row">${button('Test Moveworks Connection','testMoveworks')}</div>
      <div class="brief">⚠ <span><strong>${state.slaCritical}</strong> critical SLA items need attention.</span></div>
      <div class="brief">◷ <span><strong>${state.pending}</strong> ageing tickets remain pending at EOD.</span></div>
    </div></section>
    <section class="card ai-card-shell">${aiInsightCard(true)}</section>
    <section class="card"><div class="cardhead"><div><h2>Highest Risk Ageing Tickets</h2><p>Prioritized from live governance data</p></div>${button('View all','nav','ageing')}</div>${ticketTable(highest)}</section>`);
}

function renderAgeing() {
  const q=state.search.trim().toLowerCase();
  const rows=q?state.tickets.filter(t=>[t.id,t.type,t.title,t.team,t.assignee].join(' ').toLowerCase().includes(q)):state.tickets;
  return layout(`<section class="metrics four">${metric('Incidents',state.incidentCount,'Ageing INCs','orange')}${metric('RITMs',state.ritmCount,'Ageing requests','blue')}${metric('Tasks',state.taskCount,'Ageing tasks','purple')}${metric('Total',state.ageingTotal,'Governance backlog','red')}</section><section class="card"><div class="cardhead"><div><h2>Ageing Ticket Governance</h2><p>Open INC, RITM and TASK records requiring attention</p></div><input id="ticketSearch" class="search" placeholder="Search ticket, team or owner" value="${escapeHtml(state.search)}"></div>${ticketTable(rows)}</section>`);
}

function renderSla() {
  const cards = state.slaBreaches.length ? state.slaBreaches.map(x=>`<div class="slacard"><div class="cardhead"><strong>${escapeHtml(x.id||x.number||'SLA')}</strong>${badge(x.team||'ServiceNow')}</div><p>${escapeHtml(x.summary||x.description||'Breached SLA record')}</p><div class="slameta"><span>Breach <strong>${escapeHtml(x.breach||x.percentage||'')}</strong></span><span>AI RCA <strong>${escapeHtml(x.cause||'Available via Ask AI')}</strong></span><span>Confidence <strong>${escapeHtml(x.confidence||'')}</strong></span></div>${button('Investigate with AI','aiPrompt',`Analyze SLA breach ${x.id||x.number||''}`,true)}</div>`).join('') : '<div class="empty">No detailed breach records returned by the dashboard endpoint.</div>';
  return layout(`<section class="metrics four">${metric('SLA At Risk',state.slaAtRisk,'≥75% consumed','orange')}${metric('Critical SLA',state.slaCritical,'≥90% consumed','red')}${metric('SLA Breached',state.slaBreached,'Requires investigation','red')}${metric('Total SLA Attention',state.slaTotalAttention,'At risk + breached','purple')}</section><section class="card ai-card-shell">${aiInsightCard(false)}</section><section class="card"><h2>SLA Breach Intelligence</h2><div class="slagrid">${cards}</div></section>`);
}

function renderDevops() {
  const rows=state.devopsItems.length?`<div class="tablewrap"><table><thead><tr><th>Work Item</th><th>Type</th><th>Owner</th><th>Missing</th><th>Score</th><th>Action</th></tr></thead><tbody>${state.devopsItems.map(x=>`<tr><td><strong>${escapeHtml(x.id||x.number)}</strong><div class="muted">${escapeHtml(x.title||'')}</div></td><td>${escapeHtml(x.type||'')}</td><td>${escapeHtml(x.owner||'')}</td><td>${(x.missing||[]).map(m=>badge(m,'danger')).join(' ')}</td><td><strong>${Number(x.score)||0}%</strong>${progress(x.score)}</td><td>${button('Ask AI','aiPrompt',`Analyze DevOps work item ${x.id||x.number}`,true)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Connect MOVEWORKS_DEVOPS_URL to replace this with real Azure DevOps governance data.</div>';
  return layout(`<section class="metrics three">${metric('Overall Hygiene',state.devopsHygiene?state.devopsHygiene+'%':'—','Live DevOps governance','green')}${metric('Non-Compliant',state.devopsNonCompliant,'Open work items','orange')}${metric('Largest Gap',state.devopsLargestGap||'—','Metadata hygiene','purple')}</section><section class="card"><h2>Azure DevOps Governance</h2>${rows}</section>`);
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
    id:x.id||x.number||x.task?.display_value||x.task||`SLA-${i+1}`,
    title:x.summary||x.short_description||x.description||'Breached SLA record',
    team:x.team||x.assignment_group?.display_value||x.assignment_group||'',
    assignee:x.assignee||x.assigned_to?.display_value||x.assigned_to||'',
    status:'Breached',
    risk:x.risk||x.risk_score||x.percentage||''
  }));
  const rows = Array.isArray(state.tickets) ? state.tickets : [];
  return rows.filter(t => kind === 'breached' ? String(t.sla||'').toLowerCase().includes('breach') : kind === 'atrisk' ? String(t.sla||'').toLowerCase().includes('risk') : true);
}

function localOperationalResult(prompt) {
  const clean=String(prompt||'').trim();
  const q=clean.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  const direct=liveKpiAnswer(clean,state);
  if(direct) return {kind:'kpi', answer:direct};
  const wantsShow=/\b(show|list|display|give me|find|get)\b/.test(q);
  const mentionsBreach=/\b(breach|breached|breaches)\b/.test(q);
  const mentionsSla=/\bsla\b/.test(q);
  if(wantsShow && mentionsBreach && mentionsSla) {
    const rows=agentTicketRows('breached');
    return {kind:'sla-list', rows, answer:`Found **${state.slaBreached} breached SLA records** in the latest live governance result.${rows.length?' Ticket details are shown below.':' The current callback contains the count, but not individual ticket records yet.'}`};
  }
  if(wantsShow && /\b(at risk|risk)\b/.test(q) && mentionsSla) {
    const rows=agentTicketRows('atrisk');
    return {kind:'sla-list', rows, answer:`Found **${state.slaAtRisk} SLA records at risk** in the latest live governance result.${rows.length?' Ticket details are shown below.':' The current callback contains the count, but not individual ticket records yet.'}`};
  }
  if(wantsShow && /\b(ageing|aging)\b/.test(q)) {
    return {kind:'ageing-list', rows:state.tickets||[], answer:`Found **${state.ageingTotal} ageing tickets** in the latest live governance result.${state.tickets.length?' Ticket details are shown below.':' The current callback contains the count, but not individual ticket records yet.'}`};
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
        <div class="v11-top-actions"><span class="v11-connected">● Systems connected</span><button data-nav="command">Open Command Center ↗</button><button class="v11-bell">♧</button></div>
      </header>

      <section class="v11-stage">
        <div class="v11-stars"></div>
        <div class="v11-greeting"><span>Hello! 👋</span><h1>I’m your<br>AI Operations<br>Agent.</h1><p>How can I assist you today?</p><i></i></div>

        <div class="v11-visual" aria-label="3D AI operations robot">
          <div class="v11-visual-glow"></div>
          <img src="/ai-agent-center.png?v=11.7.0" alt="Full-body 3D AI robot standing before a glowing digital globe">
        </div>

        <aside class="v11-response ${state.aiBusy?'busy':''}">
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

function resultTicketTable(rows=[]) {
  if(!rows.length) return `<div class="result-note">Individual ticket records are not included in the current callback yet. The MVP is ready to render ticket numbers automatically once the Moveworks callback includes the records.</div>`;
  return `<div class="result-table"><table><thead><tr><th>Ticket</th><th>Status</th><th>Team / Owner</th><th>Risk</th></tr></thead><tbody>${rows.slice(0,20).map(x=>`<tr><td><strong>${escapeHtml(x.id||x.number||'')}</strong><div class="muted">${escapeHtml(x.title||x.summary||'')}</div></td><td>${badge(x.status||x.sla||'Breached','danger')}</td><td>${escapeHtml(x.team||'')}<div class="muted">${escapeHtml(x.assignee||'')}</div></td><td>${escapeHtml(x.risk||'—')}</td></tr>`).join('')}</tbody></table></div>`;
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
  if(state.page==='agent') app.innerHTML=renderAgent(); else if(state.page==='results') app.innerHTML=renderResults(); else if(state.page==='ageing') app.innerHTML=renderAgeing(); else if(state.page==='sla') app.innerHTML=renderSla(); else if(state.page==='devops') app.innerHTML=renderDevops(); else if(state.page==='ai') app.innerHTML=renderAi(window.__aiAnswer||''); else app.innerHTML=renderCommand();
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
    state.tickets=Array.isArray(data.tickets)?data.tickets:[]; state.slaBreaches=Array.isArray(data.slaBreaches)?data.slaBreaches:[];
    state.devopsHygiene=data.devops?.hygiene||0; state.devopsNonCompliant=data.devops?.nonCompliant||0; state.devopsLargestGap=data.devops?.largestGap||''; state.devopsItems=Array.isArray(data.devops?.items)?data.devops.items:[];
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
    const incidentNote=mentionsIncident
      ? ' This value is the count of breached SLA records. The current feed does not yet de-duplicate them into unique incident IDs.'
      : '';
    return `**${breached} breached SLA records** are currently reported in the latest live ServiceNow governance data.${incidentNote}`;
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

async function waitForMoveworksResult(startedAt, requestId, timeoutMs=75000) {
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
  window.__lastAiQuestion=clean; window.__agentPrompt=clean; window.__agentDraft=clean; window.__homeAiAnswer=''; state.aiBusy=true; state.page='agent'; render();
  try {
    const local=localOperationalResult(clean);
    if(local){window.__agentLocalResult=local;window.__homeAiAnswer=local.answer;window.__aiAnswer=local.answer;}
    else {
      const result=await api('/api/ai/query',{method:'POST',body:JSON.stringify({prompt:clean})});
      if(result.mode==='webhook-trigger'){
        window.__homeAiAnswer=result.answer||'Moveworks accepted the request. Waiting for the live response…'; render();
        const callback=await waitForMoveworksResult(result.startedAt,result.requestId);
        window.__homeAiAnswer=callback?resultSummary(callback,clean):'Moveworks accepted the request, but the workflow is still running.';
        if(callback) await refreshDashboard(false);
      } else window.__homeAiAnswer=result.answer||'No AI response was returned.';
      window.__aiAnswer=window.__homeAiAnswer;
    }
  } catch(err){window.__homeAiAnswer=`Unable to contact Moveworks AI: ${err.message}`;window.__aiAnswer=window.__homeAiAnswer;}
  finally {state.aiBusy=false;state.page='agent';render();if(autoSpeak&&window.__homeAiAnswer)setTimeout(()=>speakText(window.__homeAiAnswer),250);}
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
      const callback=await waitForMoveworksResult(result.startedAt,result.requestId);
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

async function handleAction(action,arg) {
  if(action==='refreshData'){await refreshDashboard(true);return;}
  if(action==='agentAsk') return askAiHome(document.getElementById('agentPrompt')?.value||'',true);
  if(action==='agentPrompt') return askAiHome(arg,true);
  if(action==='startVoice') return startVoice('agentPrompt');
  if(action==='startVoiceResult') return startVoice('resultPrompt');
  if(action==='resultAsk') return askAi(document.getElementById('resultPrompt')?.value||'');
  if(action==='backAgent'){state.page='agent';window.__aiAnswer='';window.__agentLocalResult=null;render();return;}
  if(action==='readAloud') return readAloud();
  if(action==='stopSpeech'){stopSpeech();render();return;}
  if(action==='pauseSpeech'){pauseSpeech();return;}
  if(action==='closeHomeResponse'){stopSpeech();window.__homeAiAnswer='';render();return;}
  if(action==='copyHomeResponse'){navigator.clipboard?.writeText(window.__homeAiAnswer||'');toast('Response copied');return;}
  if(action==='viewFullAnalysis'){window.__aiAnswer=window.__homeAiAnswer||window.__aiAnswer||'';state.page='results';render();return;}
  if(action==='nav'){state.page=arg;render();return;} if(action==='assign')return openAssign(arg); if(action==='closeModal'){document.getElementById('assignModal')?.remove();return;}
  if(action==='confirmAssign') { const input=document.getElementById('assigneeSelect'); if(!state.selectedTicket||!input?.value.trim()) return toast('Enter an assignee.'); try { await api(`/api/tickets/${encodeURIComponent(state.selectedTicket.id)}/assign`,{method:'POST',body:JSON.stringify({assignee:input.value.trim()})}); toast(`${state.selectedTicket.id} assignment requested through Moveworks`); document.getElementById('assignModal')?.remove(); await refreshDashboard(); } catch(err){toast(err.message);} return; }
  if(action==='notifyTicket'){try{await api(`/api/tickets/${encodeURIComponent(arg)}/notify`,{method:'POST',body:'{}'});toast(`Moveworks notification triggered for ${arg}`);}catch(err){toast(err.message);}return;}
  if(action==='testMoveworks'){try{const r=await api('/api/moveworks/test',{method:'POST',body:JSON.stringify({prompt:'Run AI Ticket Governance'})});toast(r.moveworks?.status==='RECEIVED'?'Moveworks connection successful — event received':'Moveworks listener responded successfully');}catch(err){toast(`Moveworks connection failed: ${err.message}`);}return;}
  if(action==='sendEod'){try{await api('/api/reports/eod',{method:'POST',body:JSON.stringify({morning:state.morning,updated:state.updated,closed:state.closed,pending:state.pending,action_rate:actionRate(),backlog_reduction:backlogReduction()})});toast('EOD report triggered through Moveworks');}catch(err){toast(err.message);}return;}
  if(action==='aiTicket') return askAi(`Analyze ticket ${arg}. Explain the risk, likely blockers, SLA impact, and recommended next actions.`);
  if(action==='aiPrompt') return askAi(arg);
  if(action==='quickAi') return askAi(document.getElementById('quickAiInput')?.value||'');
  if(action==='analyzeText') return askAi(document.getElementById('aiInput')?.value||'');
}

document.addEventListener('click',e=>{const navEl=e.target.closest('[data-nav]');if(navEl){state.page=navEl.dataset.nav;render();return;}const actionEl=e.target.closest('[data-action]');if(actionEl)handleAction(actionEl.dataset.action,actionEl.dataset.arg||'');});
document.addEventListener('input',e=>{if(e.target.id==='ticketSearch'){state.search=e.target.value;render();const el=document.getElementById('ticketSearch');if(el){el.focus();el.setSelectionRange(state.search.length,state.search.length);}} if(e.target.id==='agentPrompt') window.__agentDraft=e.target.value;});
document.addEventListener('keydown',e=>{if((e.target.id==='agentPrompt'||e.target.id==='resultPrompt')&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();askAi(e.target.value);}});

setInterval(()=>refreshDashboard(false),5*60*1000);
render(); refreshDashboard(false);
