import { createServer } from '../../client/node_modules/vite/dist/node/index.js';
import { fileURLToPath } from 'node:url';

const client = fileURLToPath(new URL('../../client/', import.meta.url));
const server = await createServer({
  root: client,
  configFile: fileURLToPath(new URL('../../client/vite.config.ts', import.meta.url)),
  server: {
    host: '127.0.0.1', port: 5175, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3101' },
  },
});
await server.listen();
server.printUrls();
