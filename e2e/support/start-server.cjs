const { randomUUID } = require('node:crypto');
const { mkdirSync, closeSync, openSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '../..');
const tmp = resolve(root, 'e2e/.tmp');
mkdirSync(tmp, { recursive: true });
// Una base nueva por ejecución; no se borra ni se reutiliza la base habitual.
const database = resolve(tmp, `${randomUUID()}.db`);
closeSync(openSync(database, 'wx'));
process.env.DATABASE_URL = `file:${database.replace(/\\/g, '/')}`;
process.env.PORT = '3101';
process.env.TZ = 'America/Montevideo';
process.env.JWT_SECRET = 'taskflow-local-e2e-only';
process.env.NODE_ENV = 'test';
process.env.TS_NODE_PROJECT = resolve(root, 'server/tsconfig.json');

execFileSync(process.execPath, [
  resolve(root, 'server/node_modules/prisma/build/index.js'),
  'migrate', 'deploy', '--schema', resolve(root, 'server/prisma/schema.prisma'),
], { cwd: root, env: process.env, stdio: 'inherit' });
require(resolve(root, 'server/node_modules/ts-node/register/transpile-only'));
require(resolve(root, 'server/src/index.ts'));
