// Small helper to tail the alert logs (JSONL) and pretty-print
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || 'apps/streamer/logs/telegram_alerts.log';
function tail(f){
  try{
    const s = fs.readFileSync(f,'utf8');
    const lines = s.trim().split(/\r?\n/).slice(-20);
    lines.forEach(l=>{ try{ const i=l.indexOf('{'); const ts=l.slice(0,i).trim(); const j=JSON.parse(l.slice(i)); console.log(ts, JSON.stringify(j.data)); }catch(e){ console.log(l); } });
  }catch(e){ console.error('read error',e.message); }
}
tail(file);
