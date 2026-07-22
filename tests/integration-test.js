const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const upstreamPort = 19091;
const appPort = 19092;

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
    if(req.url==='/trigger') { if(req.headers.authorization!=='Bearer test-mw-key'){res.statusCode=401;return res.end(JSON.stringify({error:'unauthorized'}));} return res.end(JSON.stringify({message:'Event received successfully',status:'RECEIVED'})); }
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
  const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(appPort),MOVEWORKS_DASHBOARD_URL:`http://127.0.0.1:${upstreamPort}/dashboard`,MOVEWORKS_TRIGGER_URL:`http://127.0.0.1:${upstreamPort}/trigger`,MOVEWORKS_API_KEY:'test-mw-key',MOVEWORKS_AI_URL:`http://127.0.0.1:${upstreamPort}/ai`,MOVEWORKS_ASSIGN_URL:`http://127.0.0.1:${upstreamPort}/assign`,MOVEWORKS_NOTIFY_URL:`http://127.0.0.1:${upstreamPort}/notify`,MOVEWORKS_EOD_URL:`http://127.0.0.1:${upstreamPort}/eod`},stdio:['ignore','pipe','pipe']});
  try {
    await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Server startup timeout')),8000);child.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(t);resolve();}});child.on('exit',c=>reject(new Error(`server exited ${c}`)));});
    let r=await request(`http://127.0.0.1:${appPort}/health`); if(r.status!==200||!r.body.moveworksConfigured) throw new Error('health failed');
    r=await request(`http://127.0.0.1:${appPort}/api/dashboard`); if(r.status!==200||r.body.ageing.total!==9||r.body.sla.breached!==3||r.body.devops.hygiene!==86) throw new Error('dashboard normalization failed');
    r=await request(`http://127.0.0.1:${appPort}/api/moveworks/test`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'Run AI Ticket Governance'})}); if(r.status!==200||r.body.moveworks?.status!=='RECEIVED') throw new Error('Moveworks listener test failed');
    r=await request(`http://127.0.0.1:${appPort}/api/ai/query`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'Why SLA?'})}); if(r.status!==200||!r.body.answer.includes('Real AI test answer')) throw new Error('AI proxy failed');
    r=await request(`http://127.0.0.1:${appPort}/api/tickets/INC1001/assign`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assignee:'Taylor'})}); if(r.status!==200||!r.body.success) throw new Error('assign proxy failed');
    r=await request(`http://127.0.0.1:${appPort}/api/tickets/INC1001/notify`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); if(r.status!==200||!r.body.success) throw new Error('notify proxy failed');
    r=await request(`http://127.0.0.1:${appPort}/api/reports/eod`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({morning:9})}); if(r.status!==200||!r.body.success) throw new Error('EOD proxy failed');
    const page=await fetch(`http://127.0.0.1:${appPort}/`).then(r=>r.text()); if(!page.includes('Moveworks Hackathon')) throw new Error('page branding failed');
    console.log('HTTP integration test passed.');
  } finally {
    child.kill(); mock.close();
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
