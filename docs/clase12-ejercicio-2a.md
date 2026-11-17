# Clase 12 — Ejercicio 2a: tests de US-16 generados con IA

Fecha: 16/11/2026.

## Herramienta y prompt

- **Herramienta:** Claude Code, con el modelo Claude Opus 5.5. Se usó una sesión aparte que recibió solo el prompt, sin acceso al código del repositorio ni a los bugs conocidos.
- **Prompt:** los seis componentes de la slide 33 (rol, contexto, instrucción, datos de entrada, restricciones y formato de salida). El texto completo está en el anexo.
- **Archivo:** `server/tests/us16-ia.test.ts`, pegado sin cambios. Tiene 8 `it()`, uno por criterio.

## Resultado

Se corrió `npx jest --runInBand tests/us16-ia.test.ts` en `server/` dos veces:

- **En local**, con la zona del equipo (America/Montevideo, UTC-3): 2 en verde y 6 en rojo.
- **Con `TZ=UTC`**, la zona de los runners `ubuntu-latest` que usa el `ci.yml`: 5 en verde y 3 en rojo.

## Clasificación

| Test | Local (UTC-3) | `TZ=UTC` | Clasificación | Evidencia |
| --- | --- | --- | --- | --- |
| CA1: día calendario, sin hora | ✓ | ✓ | Verde y correcto | Verifica que la fecha vuelva como `AAAA-MM-DD`, sin hora. No mira el día; eso lo cubren CA2 y CA3. |
| CA2: formato ISO de ida y vuelta | ✕ | ✓ | Rojo por bug real (#7) | `:100` `Expected: "2026-09-15"` / `Received: "2026-09-14"` |
| CA3: misma fecha en cualquier zona | ✕ | ✕ | Rojo por test mal escrito | `:115` `Expected: 0` / `Received: 180`. El test simula zonas cambiando `process.env.TZ`, pero dentro de Jest eso no cambia la zona del proceso (en Node directo sí). Su propia verificación lo frena antes de llegar a la fecha: no da un verde falso, pero tampoco prueba CA3. |
| CA4: la fecha es opcional | ✓ | ✓ | Verde y correcto | Una tarea creada sin fecha vuelve con `dueDate` nulo. |
| CA5: quitar la fecha con `null` | ✕ | ✓ | Rojo por bug real (#7) | `:154`: falla al cargar la fecha antes de quitarla (`"2026-09-14"`). En UTC pasa, así que quitar la fecha funciona. |
| CA6: formato inválido → 400 | ✕ | ✕ | Rojo por test mal escrito; además encontró un bug | Las 9 filas devuelven `"code": undefined` y `"hasMessage": false`. La API responde `{ error: { code, message } }` (`src/middleware/errors.ts:17-19`) y el test lee `res.body.code`. Además, `"2026-02-30"` devuelve `"status": 200` en lugar de 400. |
| CA7: se admite una fecha pasada | ✕ | ✓ | Rojo por bug real (#7) | `:210` `Expected: "2020-01-01"` / `Received: "2019-12-31"`. La fecha pasada se acepta con 200, como pide el criterio. |
| CA8: solo miembros (403) | ✕ | ✕ | Rojo por bug real | En local se corta en `:237` por #7. En UTC llega a `:245`: un usuario que nunca fue miembro asigna y quita la fecha con `"status": 200`, cuando se esperaba 403. |

| Clasificación | Tests (corrida local) |
| --- | --- |
| Verde y correcto | 2 (CA1, CA4) |
| Verde pero no prueba nada | 0 |
| Rojo por bug real | 4 (CA2, CA5, CA7, CA8) |
| Rojo por test mal escrito | 2 (CA3, CA6) |
| Alucinado | 0 |

La IA no inventó endpoints ni reglas. No exigió 422 para las fechas pasadas y dejó fuera, de forma explícita, lo que la historia no define. El error de CA6 viene del prompt: el contexto describía los errores como `{ code, message, details? }`, sin el envoltorio `error`.

## Cobertura antes y después

Se corrió `npx jest --runInBand --coverage` en `server/`, en local.

| | Antes | Después |
| --- | --- | --- |
| Líneas (global) | 80,66 % | 83,96 % |
| Ramas (global) | 53,97 % | 56,90 % |
| Líneas de `src/lib/ids.ts` | 59,25 % | 92,59 % |
| Líneas de `src/modules/tasks/tasks.service.ts` | 62,5 % | 68,75 % |
| Tests | 4 en rojo, 56 en verde, 60 en total | 10 en rojo, 58 en verde, 68 en total |

La cobertura subió 3,3 puntos aunque 6 de los 8 tests nuevos están en rojo y 2 de ellos están mal escritos. Mide qué código se ejecutó, no qué se verificó.

## Hallazgos

1. **Nuevo: cualquier usuario autenticado puede editar una tarea de un proyecto ajeno.** El PATCH devuelve 200 en lugar de 403. Amplía el #4, que solo cubría a un exmiembro desde el E2E. `PATCH /api/tasks/:taskId` no usa `requireTaskProjectMember` (`src/modules/tasks/tasks.routes.ts:14`), y ni el controlador ni `updateTask` verifican la membresía. Criterios violados: US-16 CA8 y US-12 CA5.
2. **Nuevo: se acepta `2026-02-30`.** La API responde 200 y guarda el 2 de marzo, que no es la fecha que se cargó. Criterios violados: US-16 CA1 y CA3.
3. **Confirmado: #7.** La fecha vuelve con un día menos en UTC-3. Afecta a CA2, CA5, CA7 y CA8.
4. **Riesgo de entorno.** En UTC, CA2, CA5 y CA7 pasan aunque #7 sigue presente. Los runners de GitHub corren en UTC, así que el pipeline no detectaría #7 aunque se destrabe Actions.

## Lo que quedó sin verificar

- **CA3**, porque el test está mal escrito.
- **CA7, "la tarea se considera vencida".** La API no expone ese dato, así que el criterio no tiene un test posible. Es un hueco de trazabilidad.
- **CA8 con un exmiembro.** El test se corta antes de llegar a ese caso en las dos corridas.

No se arregló nada: el archivo queda tal como lo generó la IA y los tests en rojo se anotan.

## Anexo: prompt usado

**Rol.** Sos un ingeniero de QA que diseña tests de API.

**Contexto.** TaskFlow es una API REST en Express + Prisma (SQLite). Los tests usan Jest + Supertest y viven en `server/tests/`. Cada archivo de test corre contra su propia base vacía. Convenciones:

- Los ids son legibles y con prefijo: `user-1`, `proj-1`, `task-1`.
- Todo endpoint, salvo los de `/api/auth`, requiere `Authorization: Bearer <token>`.
- Sin token devuelve 401. Autenticado pero sin acceso al recurso devuelve 403.
- Los errores son `{ code, message, details? }` con `VALIDATION_ERROR` (400), `FORBIDDEN` (403) y `NOT_FOUND` (404).

Helpers existentes: se pegó completo `server/tests/helpers.ts`.

Endpoints que existen (prefijo `/api`):

- `POST /auth/register`, `POST /auth/login`
- `POST /projects`, `GET /projects`, `PATCH /projects/:projectId`, `DELETE /projects/:projectId`
- `POST /projects/:projectId/members` (body `{ email }`), `DELETE /projects/:projectId/members/:userId`
- `GET /projects/:projectId/tasks`, `POST /projects/:projectId/tasks`
- `GET /tasks/:taskId`, `PATCH /tasks/:taskId`, `DELETE /tasks/:taskId`, `GET /tasks/:taskId/history`
- `POST /tasks/:taskId/tags`, `DELETE /tasks/:taskId/tags/:tagId`
- `GET /tasks/:taskId/comments`, `POST /tasks/:taskId/comments`, `DELETE /comments/:commentId`

**Instrucción.** Proponé casos de prueba para esta historia.

**Datos de entrada.** US-16, fecha de vencimiento de tarea, con sus 8 criterios de aceptación, los tres escenarios Gherkin y la regla general de fechas, copiados de la especificación.

**Restricciones.** Usá solo endpoints que existen. No inventes criterios.

**Formato de salida.** Archivo `.test.ts`, un `it()` por criterio.
