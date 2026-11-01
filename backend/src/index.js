import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig();
const server = createServer(config);
server.listen(config.port, () => {
  console.log(`CivicPulse API listening on http://localhost:${config.port}`);
  console.log(`Triage mode: ${config.triageMode} | demo data: ${config.seedDemoData ? 'on' : 'off'} | reports stored: ${server.store.items.length}`);
});
