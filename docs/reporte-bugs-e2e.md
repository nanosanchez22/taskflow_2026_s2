# Reporte de bugs E2E de TaskFlow

Fecha: 20 de octubre de 2026. Alcance: US-12, US-14, US-15 y US-16 del Ejercicio 2. Fuente: taskflow_especificacion_requerimientos.docx v1.0. Se excluyen los reportes y hallazgos anteriores según lo solicitado.

Se ejecutaron 24 casos distintos dos veces: **36 ejecuciones aprobadas y 12 fallidas**, sobre 48 ejecuciones. Son 18 casos aprobados y 6 fallidos por repetición. Los seis casos fallidos corresponden a **cuatro bugs**, todos reproducidos en ambas repeticiones.

| Historia | Casos distintos | Aprobados por repetición | Fallidos por repetición |
| --- | ---: | ---: | ---: |
| US-12 | 7 | 6 | 1 |
| US-14 | 3 | 3 | 0 |
| US-15 | 10 | 7 | 3 |
| US-16 | 4 | 2 | 2 |
| **Total** | **24** | **18** | **6** |

## Bugs encontrados

Registrados en GitHub Issues del repositorio del equipo:

- [BUG-01 — [Tareas] Un exmiembro puede editar una tarea desde el detalle abierto antes de su baja](https://github.com/nanosanchez22/taskflow_2026_s2/issues/4)
- [BUG-02 — [Etiquetas] Se conservan las mayúsculas y BUG se agrega como una etiqueta distinta de bug](https://github.com/nanosanchez22/taskflow_2026_s2/issues/5)
- [BUG-03 — [Etiquetas] Agregar bug dos veces a la misma tarea crea un duplicado y devuelve 201](https://github.com/nanosanchez22/taskflow_2026_s2/issues/6)
- [BUG-04 — [Vencimiento] Guardar una fecha devuelve el día anterior cuando el servidor usa UTC-3](https://github.com/nanosanchez22/taskflow_2026_s2/issues/7)

Cada issue tiene la plantilla completa, evidencia HTTP y etiqueta de severidad. Queda pendiente adjuntar una captura o trace; esos archivos se conservan localmente.

| ID | Defecto | Criterio | Severidad |
| --- | --- | --- | --- |
| [BUG-01](bugs/BUG-01.md) | [Tareas] Un exmiembro puede editar una tarea desde el detalle abierto antes de su baja | US-12 CA5 | alta |
| [BUG-02](bugs/BUG-02.md) | [Etiquetas] Se conservan las mayúsculas y BUG se agrega como una etiqueta distinta de bug | US-15 CA1 | media |
| [BUG-03](bugs/BUG-03.md) | [Etiquetas] Agregar bug dos veces a la misma tarea crea un duplicado y devuelve 201 | US-15 CA3 | media |
| [BUG-04](bugs/BUG-04.md) | [Vencimiento] Guardar una fecha devuelve el día anterior cuando el servidor usa UTC-3 | US-16 CA3 | alta |

La normalización y los duplicados exactos de etiquetas se registran por separado porque son comportamientos distintos. Los dos fallos de fechas se agrupan en un único bug. Que los tres casos de US-14 pasen no implica que se hayan probado todos sus criterios.

## Entorno y ejecución

Windows 11 Home 10.0.26200 x64 · Chromium 156.0.8078.4 · Node v22.14.0 · Playwright 1.64.0 · cliente y servidor America/Montevideo (UTC-3) · commit 08a264a5edaea3b4ac3cfed5ef918123f95a9c1e. API local en 127.0.0.1:3101 y frontend en 127.0.0.1:5175; SQLite aislada.

Comprobación de TypeScript: npm run test:e2e:types, aprobada. Ejecución funcional: npx playwright test --repeat-each=2. El código de salida 1 corresponde a las aserciones fallidas contra el comportamiento esperado de la especificación.

Los casos usan la interfaz real con datos preparados por API, esperan las respuestas HTTP antes de las comprobaciones y verifican persistencia cuando corresponde. El caso de formato de fecha inválido transforma temporalmente el input en texto para enviar el dato por el formulario real. El caso de permisos conserva abierta una pantalla y luego revoca la membresía.

## Evidencia y reproducción

- [Guía de ejecución y matriz de casos](../e2e/README.md).
- [Resultados de las 48 ejecuciones](evidencia-e2e/resultados.json).
- Cada reporte individual contiene captura, respuestas HTTP, precondiciones, pasos, resultado esperado, resultado obtenido y test asociado.
- El informe HTML completo está en playwright-report/index.html; abrir con npx playwright show-report. Los traces quedan en test-results/ y se abren con npx playwright show-trace. Estas dos carpetas son locales y se regeneran.

No se modificó el comportamiento de la aplicación para corregir los defectos. Los tests conservan las expectativas de la especificación.
