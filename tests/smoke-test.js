const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
for (const file of ['server.js','public/index.html','public/app.js','public/styles.css']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
}
const js = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
for (const text of ['Command Center','Ageing Tickets','SLA Intelligence','DevOps Governance','Ask Governance AI','Send EOD Report','Moveworks Hackathon']) {
  if (!js.includes(text) && !html.includes(text)) throw new Error(`Expected UI text not found: ${text}`);
}
for (const endpoint of ['/api/dashboard','/api/ai/query','/api/moveworks/result','/api/reports/eod']) {
  if (!fs.readFileSync(path.join(root,'server.js'),'utf8').includes(endpoint)) throw new Error(`Missing API route: ${endpoint}`);
}
new Function(js);
console.log('Static smoke test passed.');
