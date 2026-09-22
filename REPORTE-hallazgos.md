# Reporte de hallazgos — Taller Clase 5 (Testing de APIs REST)

**Módulos:** Tareas — filtros y búsqueda (US-07), Comentarios (US-08), Autenticación (US-01)
**Tests que lo demuestran:** `server/tests/hallazgos-taller-clase5.test.ts`

Reproducir toda la evidencia automatizada:

```bash
cd server
npm install          # el repo viene sin node_modules
npx prisma generate  # genera el Prisma Client
npx jest --runInBand hallazgos-taller-clase5
```

Resultado: **4 tests fallan** (uno por hallazgo) y **4 pasan** (controles que acotan cada defecto).

---

## Ambiente (común a todos los hallazgos)

| Campo                | Valor                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| SO                   | macOS 26.6.2 (build 25G83)                                                                          |
| Device               | Mac, Apple Silicon (arm64)                                                                          |
| Browser              | N/A — hallazgos verificados a nivel API (server-side) con Supertest; reproducibles por Postman/curl |
| Runtime              | Node.js v24.7.0 · npm 11.5.1                                                                        |
| Backend              | Express 4.21.2 · TypeScript 5.6.3 · Prisma 6.19.3 · SQLite                                          |
| Herramientas de test | Jest 29.7.0 · Supertest 7.0.0                                                                       |
| Ambiente             | Local / test (`NODE_ENV` de test; cada archivo de test corre contra su propia DB SQLite aislada)    |
| Base URL             | `http://localhost:3000/api` (al levantar con `npm run dev:server`)                                  |

---

## Hallazgo #1 — Los filtros de tareas no se combinan; se aplica solo uno

**Summary:** `GET /projects/:id/tasks` con `status` y `priority` juntos ignora `status` y filtra solo por `priority`.

**Descripción:**
Según **US-07, CA #5** — _"Los filtros son combinables entre sí y se aplican todos simultáneamente"_ —
al pasar `?status=TODO&priority=HIGH` el endpoint debe devolver únicamente las tareas que cumplen **ambas**
condiciones. En la práctica, el último filtro evaluado sobrescribe a los anteriores, así que solo se aplica
`priority=HIGH` y se devuelven tareas que no están en `TODO`. Es la "fila 3" de la tabla de decisión: con datos donde todas las tareas comparten estado el bug queda oculto, por eso el archivo de
tests incluye un caso "insuficiente" que pasa y otro que sí lo destapa.
Defecto en el código: `server/src/modules/tasks/tasks.repository.ts:12-26` (`buildFilters` reasigna `where`
en cada `if` en vez de acumular).

**Pasos para reproducir:**

1. Autenticarse (`POST /api/auth/register`) y crear un proyecto.
2. Crear 3 tareas con `priority: HIGH` (quedan en `TODO`).
3. Crear 2 tareas con `priority: HIGH`, asignárselas y moverlas a `IN_PROGRESS` (`PATCH /api/tasks/:id` con `status: IN_PROGRESS`).
4. `GET /api/projects/:id/tasks?status=TODO&priority=HIGH`.
5. **Esperado:** `total = 3`. **Obtenido:** `total = 5`.

**Evidencia (log de Jest):**

```
● Hallazgo 1 — US-07 CA#5: los filtros deben combinarse simultáneamente › combina estado y prioridad sin traer tareas de otro estado

    expect(received).toBe(expected) // Object.is equality

    Expected: 3
    Received: 5

    > 79 |     expect(res.body.total).toBe(3);
         |                            ^
      at Object.<anonymous> (tests/hallazgos-taller-clase5.test.ts:79:28)
```

**Ambiente:** ver tabla común arriba.

---

## Hallazgo #2 — La búsqueda por texto distingue mayúsculas/minúsculas

**Summary:** `GET /projects/:id/tasks?search=login` no encuentra la tarea "Implementar Login" (búsqueda case-sensitive).

**Descripción:**
Según **US-07, CA #4** — _"La búsqueda por texto busca en título y descripción, sin distinguir mayúsculas de
minúsculas"_ — buscar `login` debe devolver la tarea "Implementar **L**ogin". El código usa
`instr(title, '<term>')`, que en SQLite es **case-sensitive**, y no normaliza a minúsculas ni el término ni
la columna, así que la búsqueda en minúscula no matchea el título capitalizado.
Defecto en el código: `server/src/modules/tasks/tasks.repository.ts:29-51`.
_(Nota lateral de seguridad: ese `$queryRawUnsafe` interpola el input del usuario directo en el SQL, lo que
viola el RNF de Seguridad #1. Fuera del alcance del taller, pero registrado.)_

**Pasos para reproducir:**

1. Crear una tarea con título `"Implementar Login"`.
2. `GET /api/projects/:id/tasks?search=login` (término en minúscula).
3. **Esperado:** 1 resultado ("Implementar Login"). **Obtenido:** 0 resultados (`total = 0`).

**Evidencia (log de Jest):**

```
● Hallazgo 2 — US-07 CA#4: la búsqueda no distingue mayúsculas/minúsculas › GET ...?search=login encuentra la tarea "Implementar Login"

    expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 0

    > 103 |     expect(res.body.total).toBe(1);
          |                            ^
      at Object.<anonymous> (tests/hallazgos-taller-clase5.test.ts:103:28)
```

Caso de control que pasa: `?search=Login` (respetando mayúsculas) sí devuelve la tarea — confirma que el
defecto es específicamente la sensibilidad a mayúsculas/minúsculas.

**Ambiente:** ver tabla común arriba.

---

## Hallazgo #3 — Los comentarios se devuelven en orden inverso

**Summary:** `GET /tasks/:id/comments` devuelve los comentarios del más reciente al más antiguo, al revés de lo especificado.

**Descripción:**
Según **US-08, CA #4** — _"Los comentarios se devuelven ordenados por fecha ascendente, del más antiguo al
más reciente"_ — el listado debe ir del primero al último. El repositorio ordena por
`createdAt: 'desc'`, devolviendo el orden inverso.
Defecto en el código: `server/src/modules/comments/comments.repository.ts:3-7` (`orderBy` debería ser `asc`).

**Pasos para reproducir:**

1. Crear una tarea.
2. Agregar tres comentarios en orden: `"primero"`, `"segundo"`, `"tercero"` (con separación temporal para timestamps distintos).
3. `GET /api/tasks/:id/comments`.
4. **Esperado:** `["primero", "segundo", "tercero"]`. **Obtenido:** `["tercero", "segundo", "primero"]`.

**Evidencia (log de Jest):**

```
● Hallazgo 3 — US-08 CA#4: los comentarios se devuelven del más antiguo al más reciente › GET /tasks/:id/comments devuelve orden cronológico ascendente

    expect(received).toEqual(expected) // deep equality

    - Expected  - 2
    + Received  + 2

      Array [
    -   "primero",
    -   "segundo",
        "tercero",
    +   "segundo",
    +   "primero",
      ]

    > 152 |     expect(res.body.map((c) => c.body)).toEqual([
      at Object.<anonymous> (tests/hallazgos-taller-clase5.test.ts:152:59)
```

**Ambiente:** ver tabla común arriba.

---

## Hallazgo #4 — Se aceptan contraseñas de 7 caracteres (valores límite)

**Summary:** `POST /auth/register` acepta una contraseña de 7 caracteres, cuando el mínimo especificado es 8.

**Descripción:**
Según **US-01, CA #3** — _"La contraseña debe tener mínimo 8 caracteres, al menos 1 número y 1 mayúscula"_ —
una contraseña de 7 caracteres debe rechazarse con `400 VALIDATION_ERROR`. El validador comprueba
`password.length >= 7`, así que acepta 7. Además el mensaje de error dice "at least 8" mientras el chequeo
usa 7: off-by-one clásico en el límite. Técnica aplicada: **valores límite** (7 inválido, 8 y 9 válidos);
los controles de 8 y 9 devuelven `201`, confirmando que el defecto está acotado exactamente al límite.
Defecto en el código: `server/src/lib/validation.ts:20`.

**Pasos para reproducir:**

1. `POST /api/auth/register` con `{ "email": "pass7@test.com", "password": "Passwo1" }` (7 caracteres, con número y mayúscula).
2. **Esperado:** `400` + `error.code = "VALIDATION_ERROR"`. **Obtenido:** `201` (usuario creado con token).

**Evidencia (log de Jest):**

```
● Hallazgo 4 — US-01 CA#3: valores límite de la contraseña (mínimo 8) › rechaza una contraseña de 7 caracteres (último valor inválido)

    expect(received).toBe(expected) // Object.is equality

    Expected: 400
    Received: 201

    > 171 |     expect(res.status).toBe(400);
          |                        ^
      at Object.<anonymous> (tests/hallazgos-taller-clase5.test.ts:171:24)
```

**Ambiente:** ver tabla común arriba.

---

## Resumen

| #   | Módulo      | Endpoint                                  | Criterio   | Esperado | Obtenido |
| --- | ----------- | ----------------------------------------- | ---------- | -------- | -------- |
| 1   | Filtros     | `GET /projects/:id/tasks?status&priority` | US-07 CA#5 | 3        | 5        |
| 2   | Búsqueda    | `GET /projects/:id/tasks?search=login`    | US-07 CA#4 | 1        | 0        |
| 3   | Comentarios | `GET /tasks/:id/comments`                 | US-08 CA#4 | asc      | desc     |
| 4   | Auth        | `POST /auth/register` (pass 7 chars)      | US-01 CA#3 | 400      | 201      |
