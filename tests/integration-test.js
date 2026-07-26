const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const upstreamPort = 19091;
const appPort = 19092;
const resultStorePath = `/tmp/ai-governance-test-${process.pid}.json`;
try { require('node:fs').unlinkSync(resultStorePath); } catch {}
let lastTriggerBody = null;

const mock = http.createServer((req,res)=>{
  let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
    res.setHeader('Content-Type','application/json');
    if(req.url==='/dashboard') return res.end(JSON.stringify({
      ageing:{incident_count:4,ritm_count:3,task_count:2,total_ageing_count:9,tickets:[{number:'INC1001',short_description:'Test incident',age_days:20,days_since_update:7,sla_status:'At Risk',assignment_group:'Network',assigned_to:'Alex',priority:'2',risk_score:88}]},
      sla:{at_risk_count:5,critical_count:2,breached_count:3,compliance:94.1,breaches:[{id:'INC1002',team:'Cloud',summary:'Test breach',cause:'Delayed Assignment'}]},
      daily:{morning:9,updated:4,closed:2,pending:3},
      devops:{hygiene:86,non_compliant:7,largest_gap:'Acceptance Criteria',items:[{id:'US-1',type:'User Story',title:'Test',owner:'Owner',score:75,missing:['Acceptance Criteria']}]},
      trend:[60,70,75,80,86]
    }));
    if(req.url==='/trigger') { if(req.headers.authorization!=='Bearer test-mw-key'){res.statusCode=401;return res.end(JSON.stringify({error:'unauthorized'}));} lastTriggerBody = body ? JSON.parse(body) : {}; return res.end(JSON.stringify({message:'Event received successfully',status:'RECEIVED'})); }
    if(req.url==='/rca') {
      const input=body?JSON.parse(body):{};
      if(input.incident_number!=='INC5784096') { res.statusCode=400; return res.end(JSON.stringify({error:'incident_number missing'})); }
      return res.end(JSON.stringify({status:'ACTION_STATUS_DONE',result:{ai_analysis:'Direct incident-specific RCA text',incident_number:'INC5784096'}}));
    }
    if(req.url==='/ai') return res.end(JSON.stringify({generated_output:'Real AI test answer from Moveworks mock.'}));
    if(req.url==='/assign'||req.url==='/notify'||req.url==='/eod') return res.end(JSON.stringify({ok:true,echo:body?JSON.parse(body):{}}));
    res.statusCode=404; res.end(JSON.stringify({error:'not found'}));
  });
});

function request(url, options={}) {
  return fetch(url, options).then(async r=>({status:r.status, body:await r.json()}));
}

(async()=>{
  await new Promise(resolve=>mock.listen(upstreamPort,'127.0.0.1',resolve));
  const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(appPort),MOVEWORKS_TRIGGER_URL:`http://127.0.0.1:${upstreamPort}/trigger`,MOVEWORKS_RCA_URL:`http://127.0.0.1:${upstreamPort}/rca`,MOVEWORKS_RCA_TIMEOUT_MS:'5000',MOVEWORKS_API_KEY:'test-mw-key',DEFAULT_NOTIFICATION_EMAIL:'demo.user@example.com',RESULT_STORE_PATH:resultStorePath,MOVEWORKS_ASSIGN_URL:`http://127.0.0.1:${upstreamPort}/assign`,MOVEWORKS_NOTIFY_URL:`http://127.0.0.1:${upstreamPort}/notify`,MOVEWORKS_EOD_URL:`http://127.0.0.1:${upstreamPort}/eod`},stdio:['ignore','pipe','pipe']});
  try {
    await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Server startup timeout')),8000);child.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(t);resolve();}});child.on('exit',c=>reject(new Error(`server exited ${c}`)));});
    let r=await request(`http://127.0.0.1:${appPort}/health`); if(r.status!==200||!r.body.moveworksConfigured||r.body.version!=='12.9.3') throw new Error('health failed');
    r=await request(`http://127.0.0.1:${appPort}/api/dashboard`); if(r.status!==200||r.body.mode!=='trigger-only'||r.body.source!=='moveworks-trigger') throw new Error('trigger-only dashboard state failed');
    r=await request(`http://127.0.0.1:${appPort}/api/moveworks/test`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'Run AI Ticket Governance'})}); if(r.status!==200||r.body.moveworks?.status!=='RECEIVED') throw new Error('Moveworks listener test failed');
    if(lastTriggerBody?.user_email!=='demo.user@example.com'||lastTriggerBody?.prompt!=='Run AI Ticket Governance') throw new Error('Webhook payload shape failed');
    if(!lastTriggerBody?.callback_url?.includes('/api/moveworks/result')||!lastTriggerBody?.request_id) throw new Error('Webhook callback metadata failed');
    r=await request(`http://127.0.0.1:${appPort}/api/moveworks/result`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:lastTriggerBody.request_id,at_risk_count:5,critical_count:2,breached_count:3,total_sla_attention:8,breached_incidents:[{incident_number:'INC5784096',incident_name:'Unable to reset timesheet',assignment_group:'PACE 1ST Service desk',assigned_to:'Nithin M S',priority:'4 - Low',state:'In progress',percentage:'1000.71',sla:'SHS_ITSM_INC_E2E_P4',rca_summary:'Delayed ownership after reassignment',likely_root_cause:'Incorrect resolver-group routing',contributing_factors:['Multiple reassignments'],corrective_action:'Assign to correct resolver group',preventive_action:'Escalate earlier',confidence:'Medium',evidence:['Assignment changed before breach']}],ageing:{incident_count:4,ritm_count:3,task_count:2,total_ageing_count:9},ai_analysis:'Callback AI analysis'})}); if(r.status!==200||r.body.status!=='ok') throw new Error('callback POST failed');
    r=await request(`http://127.0.0.1:${appPort}/api/moveworks/result?request_id=${encodeURIComponent(lastTriggerBody.request_id)}`); if(r.status!==200||r.body.status!=='ready'||r.body.result?.sla?.breached!==3) throw new Error('callback GET failed');
    r=await request(`http://127.0.0.1:${appPort}/api/dashboard`); if(r.status!==200||r.body.sla?.breached!==3||r.body.sla?.totalAttention!==8||r.body.ageing?.total!==9||r.body.aiBriefing!=='Callback AI analysis'||r.body.slaBreaches?.[0]?.id!=='INC5784096'||r.body.slaBreaches?.[0]?.summary!=='Unable to reset timesheet'||r.body.slaBreaches?.[0]?.team!=='PACE 1ST Service desk'||r.body.slaBreaches?.[0]?.rca_summary!=='Delayed ownership after reassignment'||r.body.slaBreaches?.[0]?.likely_root_cause!=='Incorrect resolver-group routing'||r.body.slaBreaches?.[0]?.hasRca!==true) throw new Error('callback dashboard projection failed');
    r=await request(`http://127.0.0.1:${appPort}/api/ai/query`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'How many SLA breached incidents are there?'})}); if(r.status!==200||r.body.mode!=='instant-kpi'||!(r.body.answer.includes('1 unique breached incidents')||r.body.answer.includes('3 breached SLA records'))) throw new Error('instant SLA KPI answer failed');
    r=await request(`http://127.0.0.1:${appPort}/api/ai/query`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'Why SLA?'})}); if(r.status!==202||r.body.mode!=='webhook-trigger'||!r.body.answer.includes('accepted')) throw new Error('AI webhook fallback failed');
    if(lastTriggerBody?.user_email!=='demo.user@example.com'||lastTriggerBody?.prompt!=='Why SLA?'||lastTriggerBody?.event_type!=='ticket_governance.ai_prompt') throw new Error('AI webhook payload shape failed');
    r=await request(`http://127.0.0.1:${appPort}/api/ai/query`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'Tell me why SLA is breached for INC5784096'})});
    if(r.status!==200||r.body.mode!=='embedded-dashboard-rca'||r.body.incident_number!=='INC5784096'||!r.body.answer.includes('Delayed ownership after reassignment')||!r.body.answer.includes('Incorrect resolver-group routing')) throw new Error('Embedded dashboard RCA failed');
    if(!r.body.requestId||r.body.request_id!==r.body.requestId) throw new Error('Embedded RCA response metadata failed');
    r=await request(`http://127.0.0.1:${appPort}/api/dashboard`);
    if(r.status!==200||r.body.sla?.breached!==3) throw new Error('Embedded RCA changed governance dashboard');

    r=await request(`http://127.0.0.1:${appPort}/api/tickets/INC1001/assign`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assignee:'Taylor'})}); if(r.status!==200||!r.body.success) throw new Error('assign proxy failed');
    r=await request(`http://127.0.0.1:${appPort}/api/tickets/INC5784096/assign`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assignment_group:'Network Operations',reason:'SLA breach remediation'})}); if(r.status!==200||!r.body.success) throw new Error('assignment-group reassign proxy failed');
    r=await request(`http://127.0.0.1:${appPort}/api/tickets/INC1001/notify`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); if(r.status!==200||!r.body.success) throw new Error('notify proxy failed');
    r=await request(`http://127.0.0.1:${appPort}/api/reports/eod`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({morning:9})}); if(r.status!==200||!r.body.success) throw new Error('EOD proxy failed');
    const page=await fetch(`http://127.0.0.1:${appPort}/`).then(r=>r.text()); if(!page.includes('Moveworks Hackathon')||!page.includes('app.js?v=12.9.3')) throw new Error('page branding/cache-bust failed');
    const appJs=await fetch(`http://127.0.0.1:${appPort}/app.js`).then(r=>r.text()); if(!appJs.includes('AI Operations Agent')||!appJs.includes('startVoice')||!appJs.includes('renderResults')) throw new Error('MVP agent UI/correlation fallback missing');
    console.log('HTTP integration test passed.');
  } finally {
    child.kill(); mock.close(); try { require('node:fs').unlinkSync(resultStorePath); } catch {}
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
