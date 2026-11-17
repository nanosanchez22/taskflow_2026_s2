# Clase 12 — Ejercicio 1b: clasificación de las etapas en rojo

Fecha: 10/11/2026.

## Entorno

El pipeline `.github/workflows/ci.yml` se agregó en la rama `feat/clase_12_cicd` (PR #13). En GitHub Actions los cinco jobs terminaron en rojo sin llegar a ejecutarse. La anotación de cada uno es `The job was not started because your account is locked due to a billing issue.` Es una falla de entorno (categoría d), ajena al código. Por eso la clasificación se hizo corriendo en local los mismos comandos de cada job.

- Node 24.7.0 en local; el pipeline usa Node 22.
- `npx prisma generate` en `server/` antes del build y de los tests, igual que en CI.
- Sin `.env`: la base SQLite de los tests la arma `globalSetup`.

## Resultado por job

| Job | Comando | Exit code | Estado |
| --- | --- | --- | --- |
| Build del servidor | `npm run build` | 0 | Verde |
| Lint (ESLint) | `npm run lint` | 1 | Rojo |
| Tests (unit e integración) | `npm test` | 1 | Rojo |
| Cobertura con umbral (líneas 70 / ramas 40) | `npx jest --runInBand --coverage --coverageThreshold='{"global":{"lines":70,"branches":40}}'` en `server/` | 1 | Rojo |
| Build del cliente | `npm run build:client` | 0 | Verde |

Quedan 3 de 5 etapas en rojo.

## Clasificación

| Etapa en rojo | Categoría | Línea del log que lo demuestra |
| --- | --- | --- |
| Lint (ESLint) | c. Calidad de código | `src/modules/comments/comments.service.ts` `7:30 error Unexpected any. Specify a different type @typescript-eslint/no-explicit-any` |
| Lint (ESLint) | c. Calidad de código | `src/modules/comments/comments.service.ts` `16:12 error 'e' is defined but never used @typescript-eslint/no-unused-vars` |
| Lint (ESLint) | c. Calidad de código | `src/modules/comments/comments.service.ts` `26:70 error Unexpected any. Specify a different type @typescript-eslint/no-explicit-any` |
| Tests | a. Bug real | `● Hallazgo 1 — US-07 CA#5: los filtros deben combinarse simultáneamente › combina estado y prioridad sin traer tareas de otro estado` — `Expected: 3` / `Received: 5` |
| Tests | a. Bug real | `● Hallazgo 2 — US-07 CA#4: la búsqueda no distingue mayúsculas/minúsculas › GET ...?search=login encuentra la tarea "Implementar Login"` — `Expected: 1` / `Received: 0` |
| Tests | a. Bug real | `● Hallazgo 3 — US-08 CA#4: los comentarios se devuelven del más antiguo al más reciente › GET /tasks/:id/comments devuelve orden cronológico ascendente` — esperado `"primero", "segundo", "tercero"`, recibido `"tercero", "segundo", "primero"` |
| Tests | a. Bug real | `● Hallazgo 4 — US-01 CA#3: valores límite de la contraseña (mínimo 8) › rechaza una contraseña de 7 caracteres (último valor inválido)` — `Expected: 400` / `Received: 201` |
| Cobertura con umbral | a. Bug real | `All files \| 76.86 \| 53.97 \| 80.68 \| 80.66` y `Tests: 4 failed, 56 passed, 60 total`, sin ningún mensaje `coverage threshold ... not met` |

### Lint: calidad de código

Los tres hallazgos están en `server/src/modules/comments/comments.service.ts`:

- Dos `any`: el parámetro `c` de `serialize` y el `body` de `create`.
- La variable `e` del `catch` en `serialize`, que no se usa.

No cambian el comportamiento de la API. ESLint los reporta como `error`, y por eso el job termina con exit code 1.

### Tests: bug real

Los cuatro tests que fallan están en `server/tests/hallazgos-taller-clase5.test.ts` y comparan contra la spec. Se revisó el código para confirmar que el defecto está en TaskFlow y no en el test:

| Test (línea del `expect`) | Criterio | Esperado / obtenido | Causa en el código |
| --- | --- | --- | --- |
| Hallazgo 1 (`:79`) | US-07 CA#5: los filtros se combinan | `total` 3 / 5 | `server/src/modules/tasks/tasks.repository.ts:15-19`: `buildFilters` reasigna `where` con cada filtro, así que `priority` pisa a `status`. |
| Hallazgo 2 (`:103`) | US-07 CA#4: la búsqueda no distingue mayúsculas | `total` 1 / 0 | `server/src/modules/tasks/tasks.repository.ts:49`: `instr()` de SQLite distingue mayúsculas. |
| Hallazgo 3 (`:152`) | US-08 CA#4: comentarios del más antiguo al más reciente | primero, segundo, tercero / tercero, segundo, primero | `server/src/modules/comments/comments.repository.ts:6`: `orderBy: { createdAt: 'desc' }`. |
| Hallazgo 4 (`:171`) | US-01 CA#3: contraseña de mínimo 8 caracteres | 400 / 201 con `Passwo1` (7 caracteres) | `server/src/lib/validation.ts:20`: valida `password.length >= 7`. |

Los tests de control de esos mismos hallazgos pasan. Por ejemplo, la búsqueda que respeta mayúsculas y las contraseñas de 8 y 9 caracteres. Eso indica que el armado de los datos es correcto y que el rojo viene del defecto.

### Cobertura: bug real, no falta de tests

Por el nombre del job, se podría clasificar como "b. Falta de tests", pero el log muestra que el umbral se cumple. Las líneas cubiertas son 80,66 % (el mínimo es 70) y las ramas 53,97 % (el mínimo es 40). Jest no imprime ningún aviso de `coverage threshold ... not met`.

El exit code 1 viene de los mismos cuatro tests en rojo. Con `--coverage`, Jest corre la suite completa y falla si falla cualquier test. Con la cobertura actual, este job pasaría una vez corregidos los cuatro defectos, sin agregar tests.

## Conclusión

- Etapas en rojo en local: 1 de calidad de código (c) y 2 de bug real (a). Las dos de tipo a tienen la misma causa: cuatro defectos de TaskFlow contra la spec. Ninguna se debe a falta de tests (b).
- En GitHub Actions, las cinco etapas quedan como pipeline o entorno (d) mientras la cuenta dueña del repositorio siga bloqueada.
- No se arregló nada. Los tests en rojo contra la spec quedan como están.
