# Feedback de corrección — Equipo 9 (2026-11-17)

Testing y Calidad de Software 2026. Integrantes: Fernando Sanchez y Lucas Alegre.

## Cómo leer estas notas

- Cada nota es de una tarea, sobre 100, y se desglosa por ítem en la columna "Desglose".
- Las tareas por equipo valen en total 43,50 puntos del curso. Con lo calificado hasta ahora aportan **28,74 de 100**, y el promedio ponderado de esas tareas es 87.
- **Esto es una etapa parcial.** El **proyecto final corregido vale 50 puntos (el 50 % de la nota final)** y se califica después de que arreglen lo señalado más abajo. Las tareas individuales (6,50 puntos) se llevan aparte.
- Faltan por calificar: Taller de refinamiento (hecho a mano) y Presentación (pendiente de entrega). La nota de Performance es provisoria: no se pudo correr k6, las métricas son las declaradas.

## Notas por tarea

| Tarea | Nota (sobre 100) | Desglose |
|---|---|---|
| Taller de refinamiento | pendiente | Se hizo a mano (no figura en el repo; se buscó en `docs/`, el README y las 9 ramas). Pendiente de calificar fuera del repo. |
| Integration + cobertura + refactor (código pestilente + Ej. 1 de clase 7) | 90 | **Smells y refactor 40/50:** `CODE_SMELLS.md` lista 5 smells (4 refactorizados, 1 documentado), pero los refactors no tienen tests de caracterización previos (-10). **Cobertura 50/50:** ramas 53,97 % y líneas 80,66 % en `main` (corrido), con umbral 70/40 configurado en `server/jest.config.js`. |
| Postman + Supertest, caza de bugs | 90 | **Supertest 50/50:** 8 tests de hallazgos (4 rojos por bugs de la spec y 4 controles) y 39 de integración con AAA, status, cuerpo y casos negativos. **Reportes de bug 40/50:** `REPORTE-hallazgos.md` no tiene reproducibilidad ni severidad (-10) y no son GitHub issues. Postman no se cuenta. |
| ADR | 57 | **Component Object 0/33,3:** el ADR propone `TaskCard`, pero no existe `e2e/src/components/`. **Framework Playwright 26,7/33,3:** hay fixtures, config y datos por API, pero ningún Page Object. **ADR 30/33,3:** contexto, decisión y consecuencias con costos; las alternativas descartadas son solo una mención de Screenplay. |
| E2E + bugs | 100 | **Tests 50/50:** 24 casos (US-12: 7, US-14: 3, US-15: 10, US-16: 4). Los corrí con Chromium: 18 pasan y 6 fallan, y los 6 rojos reproducen los bugs de los issues #4 (US-12 CA5), #5 y #6 (US-15) y #7 (US-16). **Bugs 50/50:** 4 GitHub issues con los 8 campos (#4 a #7), con capturas linkeadas. |
| Performance (k6: tabla seed chica vs grande + issue) | 100 | **Tabla 33,3/33,3, hipótesis 33,3/33,3 e issue 33,3/33,3.** Hipótesis verificada en `tasks.controller.ts` (`limit` y `offset` no llegan a la consulta); el issue #10 cita el criterio de la spec. Métricas declaradas, no verificadas: no se corrió k6, pero coinciden entre README, salidas e issue. |
| Seguridad + accesibilidad (ZAP, axe-core, CVSS) | 70 | **ZAP 12/25:** pruebas manuales y `npm audit`, sin ZAP (parcial). **axe-core 25/25:** test en Playwright y fix en `TaskDetailPage.tsx`; corrí los 6 tests de axe y pasan. **CVSS 8/25:** solo etiquetas HIGH/LOW, sin vector ni número. **User stories de remediación 25/25.** |
| Pipeline (`ci.yml` y job de E2E) | 97 | **`ci.yml` 50/50:** 5 jobs independientes con cache de npm, en `feat/clase_12_cicd` (PR #13 sin mergear). Builds verificados en local; lint (3 errores de código reales), tests y cobertura en rojo por causas reales o por bugs de la spec, que no se penalizan. Los runs de Actions sí se ejecutan. **Job de E2E 47/50:** falta (opcional, -3). |
| Presentación (por definir) | pendiente | Pendiente: todavía no la hicieron. |
| Informe de una página | 80 | **Tabla de métricas 25/25 y recomendación explícita (no liberar) 25/25.** **Una sola página 15/25:** 583 palabras, probablemente pase de una página. **Números 15/25:** coinciden tests, lint, cobertura y p95, pero dice que GitHub no corre el pipeline (ya corre, 2 de 5 en verde) y deja el issue #10 como sin clasificar teniendo severidad alta. |

## Sugerencias de arreglo

Notas en escala 0-100. Los "GitHub issues" son los tickets de la pestaña Issues del repo.

### ADR (hasta unos 43 puntos de la tarea)
- **Component Object y Page Objects sin implementar:** el ADR decide POM y COM, pero no existe `e2e/src/components/` ni `e2e/src/pages/`. Crear `e2e/src/components/TaskCard.ts` (locators y acciones de la tarjeta con los `data-testid` existentes) y `e2e/src/pages/` con al menos `BoardPage` y `TaskDetailPage`, y refactorizar un spec para usarlos. Si no los van a hacer, actualizar el ADR a "Reemplazada" y explicar qué se hizo.
- **Alternativas descartadas:** ampliar la mención de Screenplay con costos de cada opción.

### Seguridad + accesibilidad
- **Falta OWASP ZAP:** baseline scan contra el frontend local, exportar el HTML a `docs/` y cruzar sus hallazgos con los manuales. Hasta 13 puntos.
- **Falta CVSS:** calcular vector y puntaje (CVSS 3.1, first.org/cvss/calculator/3.1) de SEC-01 y SEC-02. Hasta 17 puntos.

### Informe de una página (hasta 20 puntos)
- Actualizar el estado de GitHub: Actions ya corre (2 de 5 etapas en verde, lint/tests/cobertura en rojo) y quitar "destrabar Actions" de las condiciones.
- Reclasificar el issue #10 como severidad alta (su texto lo dice).
- Acortarlo a una sola página.

### Integration + cobertura + refactor
- **Sin tests de caracterización:** antes de seguir refactorizando `updateTask`, escribir tests de `PATCH /tasks/:id` que cubran asignado, owner y admin con sus transiciones (`tasks.service.ts` cubre 68,75 % de líneas). Hasta 10 puntos.
- Quitar de `CODE_SMELLS.md` la frase "La captura de la consigna no enumera los nombres…".

### Postman + Supertest
- **Reportes de bug incompletos:** agregar reproducibilidad (x de y veces) y severidad a los 4 hallazgos de `REPORTE-hallazgos.md`, o abrirlos como GitHub issues. Hasta 10 puntos.

### Pipeline
- **Job de E2E (opcional):** checkout, setup-node con cache, `npm ci`, `npx prisma generate` (en `server`), `npx playwright install --with-deps chromium` y `npm run test:e2e`, subiendo el reporte como artefacto. 3 puntos.
- **Lint rojo:** tipar `c` y `body` en `comments.service.ts` y quitar el `catch (e)` sin usar (también cierra el smell 5).
- **Mergear el PR #13** a `main`.

### Pendientes de entrega
- Taller de refinamiento: hecho a mano, pendiente de calificar fuera del repo.
- Presentación: pendiente de entrega.
