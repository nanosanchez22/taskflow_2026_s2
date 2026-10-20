const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const evidence = path.join(root, 'docs/evidencia-e2e');
const results = JSON.parse(fs.readFileSync(path.join(evidence, 'resultados.json'), 'utf8'));
const environment = JSON.parse(fs.readFileSync(path.join(evidence, 'bug-01-permisos-entorno.json'), 'utf8'));
const commit = '08a264a5edaea3b4ac3cfed5ef918123f95a9c1e';
const env = `Windows 11 Home 10.0.26200 x64 · Chromium ${environment.browser} · Node ${environment.node} · Playwright 1.64.0 · cliente y servidor America/Montevideo (UTC-3) · commit ${commit}. API local en 127.0.0.1:3101 y frontend en 127.0.0.1:5175; SQLite aislada.`;
const bugs = [
  {
    id: 'BUG-01', evidence: 'bug-01-permisos', severity: 'alta',
    title: '[Tareas] Un exmiembro puede editar una tarea desde el detalle abierto antes de su baja',
    criterion: 'US-12 CA5: "Solo los miembros del proyecto al que pertenece la tarea pueden editarla (HTTP 403)".',
    preconditions: 'Proyecto con owner y miembro; tarea asignada inicialmente al miembro. El miembro inicia sesión y deja abierto el detalle de la tarea.',
    steps: ['Como owner, quitar al miembro mediante DELETE /api/projects/:projectId/members/:userId (204).',
      'En la pantalla que el exmiembro dejó abierta, elegir Sin asignar para enviar un asignado válido (null).',
      'Cambiar el título a Cambio sin permiso y pulsar Guardar.',
      'Consultar la tarea como owner para comprobar su título persistido.'],
    expected: 'PATCH /api/tasks/:taskId devuelve 403. El título original se conserva.',
    actual: 'PATCH devuelve 200; el título cambia a Cambio sin permiso tanto en la pantalla del exmiembro como en la consulta posterior del owner.',
    tests: ['e2e/tests/us-12.spec.ts › error: un miembro quitado no puede editar desde una pantalla abierta [CA5]'],
    impact: 'Un usuario sin membresía vigente modifica datos de otro proyecto. Severidad alta por la pérdida de control de acceso.',
    cause: 'Las rutas PATCH /tasks/:taskId y su servicio no comprueban la membresía para editar los campos generales (server/src/modules/tasks/tasks.routes.ts y tasks.service.ts).',
  },
  {
    id: 'BUG-02', evidence: 'bug-02-normalizacion', severity: 'media',
    title: '[Etiquetas] Se conservan las mayúsculas y BUG se agrega como una etiqueta distinta de bug',
    criterion: 'US-15 CA1: "Las etiquetas se guardan normalizadas a minúsculas y sin espacios al inicio ni al final". CA2: "Las etiquetas no distinguen mayúsculas de minúsculas: \'Bug\', \'BUG\' y \'bug\' son la misma etiqueta".',
    preconditions: 'Miembro autenticado con una tarea sin etiquetas. Usar otra tarea vacía para comprobar la variante con distinta capitalización.',
    steps: ['Agregar la etiqueta con texto "  BuG  " desde el detalle y consultar la tarea.',
      'En otra tarea sin etiquetas, agregar bug y luego BUG.',
      'Observar las etiquetas de la pantalla y de GET /api/tasks/:taskId.'],
    expected: 'La primera etiqueta se guarda como bug. En el segundo caso hay una sola etiqueta bug; la variante BUG no crea otra etiqueta.',
    actual: 'La primera etiqueta se guarda como BuG. Al agregar bug y después BUG quedan dos etiquetas, bug y BUG, y el segundo POST responde 201.',
    tests: ['e2e/tests/us-15.spec.ts › feliz: normaliza espacios y mayúsculas [CA1]',
      'e2e/tests/us-15.spec.ts › borde: repetir BUG devuelve 200 sin duplicar bug [CA2,3]'],
    impact: 'La categorización depende de cómo se escriben las mayúsculas y las variantes consumen el cupo de etiquetas. Severidad media.',
    cause: 'addTag aplica trim sin toLowerCase y busca por el nombre exacto en server/src/modules/tasks/tasks.service.ts.',
    extraEvidence: 'bug-02-mayusculas-duplicadas',
  },
  {
    id: 'BUG-03', evidence: 'bug-03-duplicado', severity: 'media',
    title: '[Etiquetas] Agregar bug dos veces a la misma tarea crea un duplicado y devuelve 201',
    criterion: 'US-15 CA3: "Una tarea no puede tener la misma etiqueta más de una vez; volver a agregarla devuelve HTTP 200 y no genera un duplicado".',
    preconditions: 'Miembro autenticado y una tarea sin etiquetas.',
    steps: ['Agregar la etiqueta bug desde el detalle (primer POST con 201).',
      'Agregar nuevamente bug a la misma tarea.', 'Consultar la tarea y contar sus etiquetas.'],
    expected: 'El segundo POST devuelve 200 y la tarea mantiene exactamente una etiqueta bug.',
    actual: 'El segundo POST devuelve 201. La consulta y la interfaz muestran dos ocurrencias de bug, con el mismo identificador de etiqueta.',
    tests: ['e2e/tests/us-15.spec.ts › borde: repetir bug devuelve 200 sin duplicar bug [CA2,3]'],
    impact: 'Se duplican asociaciones y se consume el límite de diez con valores repetidos. Es independiente de la falta de normalización: también ocurre repitiendo exactamente el mismo nombre. Severidad media.',
    cause: 'addTag crea una asociación taskTag sin comprobar si la tarea ya tiene esa etiqueta; el esquema tampoco impone unicidad para taskId y tagId.',
  },
  {
    id: 'BUG-04', evidence: 'bug-04-fecha', severity: 'alta',
    title: '[Vencimiento] Guardar una fecha devuelve el día anterior cuando el servidor usa UTC-3',
    criterion: 'US-16 CA3: "La fecha que se devuelve es siempre la misma que se cargó, sin importar la zona horaria del cliente ni la del servidor".',
    preconditions: 'Miembro autenticado, tarea sin vencimiento, cliente y servidor configurados en America/Montevideo (UTC-3).',
    steps: ['Abrir el detalle, seleccionar 2026-11-15 y pulsar Guardar.',
      'Inspeccionar la respuesta del PATCH y consultar GET /api/tasks/:taskId.',
      'Repetir en otra tarea con la fecha pasada 2020-01-01.'],
    expected: 'PATCH, GET e interfaz conservan 2026-11-15. La fecha pasada se acepta y se devuelve como 2020-01-01.',
    actual: 'PATCH responde 200 pero devuelve 2026-11-14; GET e interfaz muestran ese día anterior. Con la fecha pasada, el servidor devuelve y la pantalla muestra 2019-12-31. El valor enviado por el navegador es el día correcto.',
    tests: ['e2e/tests/us-16.spec.ts › feliz: guarda el mismo día calendario en UTC-3 [CA1,2,3]',
      'e2e/tests/us-16.spec.ts › borde: acepta una fecha pasada y conserva el día [CA3,7]'],
    impact: 'La aplicación presenta vencimientos incorrectos, afectando la planificación y la interpretación de fechas pasadas. Severidad alta.',
    cause: 'parseDueDate interpreta YYYY-MM-DD como UTC, mientras formatDueDate usa getFullYear/getMonth/getDate en hora local (server/src/lib/ids.ts).',
    extraEvidence: 'bug-04-fecha-pasada',
  },
];

const bugsDirectory = path.join(root, 'docs/bugs');
fs.mkdirSync(bugsDirectory, { recursive: true });
for (const bug of bugs) {
  const http = JSON.parse(fs.readFileSync(path.join(evidence, `${bug.evidence}-respuestas-http.json`), 'utf8'));
  const relevant = http.filter(r => r.method === 'PATCH' || (r.method === 'POST' && r.path.endsWith('/tags')));
  const text = `# ${bug.id}\n\n**Título:** ${bug.title}\n\n**Criterio violado:** ${bug.criterion}\n\n**Entorno:** ${env}\n\n**Datos / precondiciones:** ${bug.preconditions} Los usuarios, proyectos y tareas son exclusivos de cada caso. Los identificadores concretos están en la evidencia HTTP.\n\n**Pasos:**\n${bug.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n**Esperado:** ${bug.expected}\n\n**Obtenido:** ${bug.actual}\n\n**Reproducibilidad:** 2 de 2 veces por cada test indicado, en la ejecución final con --repeat-each=2. Comprobado en el entorno descrito; otros navegadores y zonas horarias no se evaluaron.\n\n**Evidencia:**\n\n![Captura del defecto](../evidencia-e2e/${bug.evidence}.png)\n\n[Respuestas HTTP completas](../evidencia-e2e/${bug.evidence}-respuestas-http.json) · [Entorno](../evidencia-e2e/${bug.evidence}-entorno.json)\n${bug.extraEvidence ? `\n[Captura del segundo caso](../evidencia-e2e/${bug.extraEvidence}.png) · [HTTP del segundo caso](../evidencia-e2e/${bug.extraEvidence}-respuestas-http.json)\n` : ''}\nSolicitud y respuesta observadas:\n\n\`\`\`json\n${JSON.stringify(relevant, null, 2)}\n\`\`\`\n\nLos traces originales están en test-results/, asociados al test en el informe HTML de Playwright.\n\n**Test que lo reproduce:**\n\n${bug.tests.map(t => `- ${t}`).join('\n')}\n\n**Severidad:** ${bug.severity}. ${bug.impact}\n\n**Causa identificada al revisar el código:** ${bug.cause}\n`;
  const content = ['BUG-02', 'BUG-03'].includes(bug.id)
    ? text.replace('**Evidencia:**\n\n', '**Evidencia:**\n\nLas capturas de etiquetas se tomaron en una ejecución adicional de los mismos tres casos, con página completa para mostrar las etiquetas. Las respuestas HTTP pertenecen a la ejecución completa de dos repeticiones; los identificadores de las tareas cambian entre ejecuciones. Los traces adicionales están en test-results-capturas/.\n\n')
    : text;
  fs.writeFileSync(path.join(bugsDirectory, `${bug.id}.md`), content);
}
fs.writeFileSync(path.join(evidence, 'bugs.json'), JSON.stringify(bugs.map(({ id, title, severity }) => ({ id, title, severity })), null, 2) + '\n');
const report = `# Reporte de bugs E2E de TaskFlow\n\nFecha: 20 de octubre de 2026. Alcance: US-12, US-14, US-15 y US-16 del Ejercicio 2. Fuente: taskflow_especificacion_requerimientos.docx v1.0. Se excluyen los reportes y hallazgos anteriores según lo solicitado.\n\nSe ejecutaron 24 casos distintos dos veces: **${results.stats.expected} ejecuciones aprobadas y ${results.stats.unexpected} fallidas**, sobre 48 ejecuciones. Son 18 casos aprobados y 6 fallidos por repetición. Los seis casos fallidos corresponden a **cuatro bugs**, todos reproducidos en ambas repeticiones.\n\n| Historia | Casos distintos | Aprobados por repetición | Fallidos por repetición |\n| --- | ---: | ---: | ---: |\n| US-12 | 7 | 6 | 1 |\n| US-14 | 3 | 3 | 0 |\n| US-15 | 10 | 7 | 3 |\n| US-16 | 4 | 2 | 2 |\n| **Total** | **24** | **18** | **6** |\n\n## Bugs encontrados\n\n| ID | Defecto | Criterio | Severidad |\n| --- | --- | --- | --- |\n${bugs.map(bug => `| [${bug.id}](bugs/${bug.id}.md) | ${bug.title} | ${bug.criterion.split(':')[0]} | ${bug.severity} |`).join('\n')}\n\nLa normalización y los duplicados exactos de etiquetas se registran por separado porque son comportamientos distintos. Los dos fallos de fechas se agrupan en un único bug. Que los tres casos de US-14 pasen no implica que se hayan probado todos sus criterios.\n\n## Entorno y ejecución\n\n${env}\n\nComprobación de TypeScript: npm run test:e2e:types, aprobada. Ejecución funcional: npx playwright test --repeat-each=2. El código de salida 1 corresponde a las aserciones fallidas contra el comportamiento esperado de la especificación.\n\nLos casos usan la interfaz real con datos preparados por API, esperan las respuestas HTTP antes de las comprobaciones y verifican persistencia cuando corresponde. El caso de formato de fecha inválido transforma temporalmente el input en texto para enviar el dato por el formulario real. El caso de permisos conserva abierta una pantalla y luego revoca la membresía.\n\n## Evidencia y reproducción\n\n- [Guía de ejecución y matriz de casos](../e2e/README.md).\n- [Resultados de las 48 ejecuciones](evidencia-e2e/resultados.json).\n- Cada reporte individual contiene captura, respuestas HTTP, precondiciones, pasos, resultado esperado, resultado obtenido y test asociado.\n- El informe HTML completo está en playwright-report/index.html; abrir con npx playwright show-report. Los traces quedan en test-results/ y se abren con npx playwright show-trace. Estas dos carpetas son locales y se regeneran.\n\nNo se modificó el comportamiento de la aplicación para corregir los defectos. Los tests conservan las expectativas de la especificación.\n`;
fs.writeFileSync(path.join(root, 'docs/reporte-bugs-e2e.md'), report);
console.log(`Reporte escrito: ${bugs.length} bugs.`);
