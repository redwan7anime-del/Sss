// Entry point - loads the main bot script
// Make sure appstate.json exists and ROOM_IDS are configured before running

// Write fca-config.json before requiring the bot (library reads it at require-time)
const fs   = require('fs');
const path = require('path');
(function writeFcaConfig(){
  const cfg = {
    autoLogin: false,
    mqtt: { enabled: true, reconnectInterval: 1800 }
  };
  fs.writeFileSync(path.join(__dirname, 'fca-config.json'), JSON.stringify(cfg, null, 2));
})();

const http = require('http');
const PORT = process.env.PORT || 3000;

// Keep-alive HTTP server so Replit deployment stays running
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[keepalive] HTTP server listening on 0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error('[keepalive] server error:', err);
});

require('./attached_assets/maf_1763073931757.js');
