# Informe de estado · TaskFlow

17/11/2026 · PR #14 · Fuentes: run 44186311783 de GitHub Actions, Ej. 1b y 2a, issues #4 a #7 y #10, reportes de la Clase 5, de seguridad y de k6.

## Resumen

El pipeline corre en GitHub y pasan 3 de sus 6 etapas. Hay 12 defectos abiertos, 4 de ellos altos, y el listado de tareas tarda 33 s (p95) con el volumen de la spec. **Recomendación: no liberar.**

## Métricas

| Métrica | Valor | Qué decisión cambia |
| --- | --- | --- |
| Defectos abiertos por severidad | 4 altos · 5 medios · 3 bajos | Con un defecto alto abierto no se libera |
| Etapas del pipeline en verde | 3 de 6: builds y lint | Lo que está en rojo marca qué falta para liberar |
| p95 del listado (5.000 tareas, 20 usuarios) | 33 s, contra 500 ms exigidos | La pantalla principal no es usable con volumen real |

En rojo están tests (89 de 96: los 7 que fallan son bugs reales o tests del 2a mal escritos), E2E (24 de 30: los 6 que fallan reproducen #4 a #7) y cobertura (cumple el umbral, pero falla por esos tests).

**Descartada: cobertura de líneas (86,75 %).** No anticipó defectos: los de la Clase 5, la inyección y el de permisos están en líneas cubiertas. En el 2a subió 3,3 puntos con 6 de 8 tests nuevos en rojo.

## Defectos abiertos

- **Alta**
  - #4: cualquier usuario autenticado edita tareas ajenas, y un exmiembro que sigue asignado cambia su estado.
  - #7: la fecha de vencimiento vuelve con un día menos en UTC-3.
  - #10: el listado no está paginado.
  - SEC-01: inyección SQL en el buscador.
- **Media**
  - #5 y #6: etiquetas duplicadas o que distinguen mayúsculas.
  - Clase 5: filtros que no se combinan, búsqueda que distingue mayúsculas y contraseña de 7 caracteres.
- **Baja**
  - SEC-02: `X-Powered-By` expone Express.
  - Clase 5: los comentarios salen en orden inverso.
  - 2a: se acepta `2026-02-30`.

## Riesgos sin mitigar

- **Seguridad:** la inyección SQL no tiene test.
- **Zona horaria:** en los runners (UTC) los tests de API de #7 pasan. Solo lo detecta el E2E, que fija UTC-3.
- **El pipeline no bloquea:** `main` no está protegida y un PR en rojo se puede mergear.
- **Huecos:** las etiquetas no tienen tests de API, y que una tarea esté vencida (US-16 CA7) no se puede observar desde la API.

## Recomendación: no liberar

Para reevaluar la decisión hace falta:

1. Corregir #4, #7, #10 y SEC-01, cada uno con su test de regresión.
2. Medir con k6 hasta que el p95 sea de 500 ms o menos.
3. Llevar el pipeline a verde, correr los tests de API en UTC-3 y proteger `main`.
