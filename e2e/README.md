# Tests E2E del Ejercicio 2

Casos de US-12, US-14, US-15 y US-16 basados en `taskflow_especificacion_requerimientos.docx` v1.0. Los reportes de ejercicios anteriores quedan fuera de esta entrega.

## Ejecución

Desde la raíz del repositorio, con las dependencias del proyecto instaladas:

```powershell
npx playwright install chromium
npm run test:e2e:types
npx playwright test
npx playwright show-report
```

Para comprobar reproducibilidad de los fallos:

```powershell
npx playwright test --repeat-each=2
```

Playwright inicia automáticamente una API en `127.0.0.1:3101` y el frontend en `127.0.0.1:5175`. Esos puertos deben estar libres. Cada ejecución crea una base SQLite nueva en `e2e/.tmp/`; no usa la base de desarrollo ni necesita usuarios precargados. Cada caso registra sus propios usuarios y crea su proyecto y su tarea mediante la API. Las bases temporales se conservan para investigar los resultados y no se versionan.

El cliente y el servidor usan `America/Montevideo` (UTC-3). Esa configuración permite detectar conversiones indebidas de días calendario. Esta suite comprueba esa zona; no constituye una verificación de todas las zonas horarias ni de todos los criterios de las historias.

## Casos

| Historia | Feliz | Error | Borde | Cantidad |
| --- | --- | --- | --- | ---: |
| US-12 | Editar título, descripción y prioridad como miembro | Título vacío, 2 o 201 caracteres; miembro quitado intenta editar | Títulos de 3 y 200 caracteres | 7 |
| US-14 | Reasignar como miembro no owner conservando estado | Seleccionar un usuario que dejó de ser miembro | Desasignar con `null` | 3 |
| US-15 | Agregar y quitar; normalizar espacios y mayúsculas | Etiquetas vacías, solo espacios y 31 caracteres | 1 y 30 caracteres; 10 y 11 etiquetas; duplicados exactos y con distinta capitalización | 10 |
| US-16 | Guardar el mismo día calendario | Formato `DD/MM/YYYY` | Quitar vencimiento con `null`; fecha pasada | 4 |
| **Total** | | | | **24** |

Los nombres de los tests indican el tipo de caso y el criterio de aceptación (`CA`) que verifican. Las verificaciones esperan las respuestas reales de la API antes de comprobar el resultado. No se usan esperas de tiempo fijo ni respuestas simuladas. Las comprobaciones con `expect.soft` permiten recoger varias manifestaciones del mismo defecto antes de finalizar el test como fallido.

Para probar el formato de fecha inválido se cambia temporalmente el input de `date` a `text` desde el navegador. Esto permite enviar el valor por el formulario real y comprobar el rechazo del servidor; no representa la escritura habitual en el selector de fechas. Los casos de membresía revocada dejan la pantalla abierta y quitan al miembro mediante la API antes de guardar: reproducen datos y permisos que quedaron desactualizados en el navegador.

## Evidencia

El informe HTML queda en `playwright-report/index.html`, y el resultado estructurado en `test-results/results.json`. Cada caso adjunta `respuestas-http.json` y `entorno.json`; los fallidos también tienen captura y `trace.zip`. El registro HTTP adjunto excluye las respuestas de autenticación y no copia cabeceras Authorization. El trace nativo puede contener las credenciales de prueba y tokens de la base aislada.

Para abrir una traza:

```powershell
npx playwright show-trace "test-results/<carpeta-del-test>/trace.zip"
```

Los archivos de `test-results/` y `playwright-report/` se regeneran en cada ejecución. El reporte de bugs de esta entrega está en `docs/reporte-bugs-e2e.md`. Cada issue debe describir un defecto, aunque varios tests lo reproduzcan. Los tests mantienen los resultados esperados de la especificación y quedan fallidos mientras el comportamiento siga siendo incorrecto.
