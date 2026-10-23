const fs = require('node:fs');
const path = require('node:path');

// Ejecutar después de la suite para preservar evidencia legible fuera de las
// carpetas que Playwright sobrescribe. No publica archivos ni modifica la app.
const root = path.resolve(__dirname, '../..');
const result = JSON.parse(fs.readFileSync(path.join(root, 'test-results/results.json'), 'utf8'));
const destination = path.join(root, 'docs/evidencia-e2e');
fs.mkdirSync(destination, { recursive: true });
const records = [];
const occurrences = new Map();
function visit(suite, parents = []) {
  const titles = [...parents, suite.title].filter(Boolean);
  for (const spec of suite.specs || []) {
    for (const test of spec.tests) {
      for (const run of test.results) {
        const key = `${spec.file}:${spec.title}:${test.projectName}`;
        const repeat = occurrences.get(key) || 0;
        occurrences.set(key, repeat + 1);
        const record = { file: spec.file, title: spec.title, groups: titles,
          repeat, status: run.status,
          errors: (run.errors || []).map(e => e.message.replace(/\u001b\[[0-9;]*m/g, '')) };
        records.push(record);
        if (repeat !== 0 || run.status !== 'failed') continue;
        let name;
        if (spec.file.includes('us-12')) name = 'bug-01-permisos';
        else if (spec.title.includes('normaliza')) name = 'bug-02-normalizacion';
        else if (spec.title.includes('repetir bug ')) name = 'bug-03-duplicado';
        else if (spec.title.includes('repetir BUG ')) name = 'bug-02-mayusculas-duplicadas';
        else if (spec.title.includes('mismo día')) name = 'bug-04-fecha';
        else if (spec.title.includes('fecha pasada')) name = 'bug-04-fecha-pasada';
        if (!name) continue;
        for (const attachment of run.attachments || []) {
          if (attachment.name === 'screenshot') {
            fs.copyFileSync(attachment.path, path.join(destination, `${name}.png`));
          } else if (attachment.name === 'respuestas-http.json' || attachment.name === 'entorno.json') {
            const bytes = attachment.path ? fs.readFileSync(attachment.path) : Buffer.from(attachment.body, 'base64');
            fs.writeFileSync(path.join(destination, `${name}-${attachment.name}`), bytes);
          }
        }
      }
    }
  }
  for (const child of suite.suites || []) visit(child, titles);
}
for (const suite of result.suites) visit(suite);
fs.writeFileSync(path.join(destination, 'resultados.json'), JSON.stringify({
  date: '2026-10-20', command: 'npx playwright test --repeat-each=2',
  stats: result.stats, records,
}, null, 2) + '\n');
console.log(JSON.stringify({ stats: result.stats, failed: records.filter(r => r.status === 'failed')
  .map(r => ({ title: r.title, repeat: r.repeat })), destination }, null, 2));
