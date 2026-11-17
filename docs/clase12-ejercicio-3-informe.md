# Informe de estado · TaskFlow

16/11/2026 · Rama `feat/clase_12_cicd` · Fuentes: pipeline local (Ej. 1b), tests de US-16 con IA (Ej. 2a), issues #4 a #7 y #10, reportes de la Clase 5, de seguridad y de k6.

## Resumen

El pipeline no corre en GitHub porque la cuenta dueña del repositorio está bloqueada por facturación. En local pasan 2 de 5 etapas. Hay 12 defectos abiertos, 3 de ellos altos, y el listado de tareas tarda 33 s (p95) con el volumen que exige la spec. **Recomendación: no liberar.**

## Métricas

| Métrica | Valor | Qué decisión cambia |
| --- | --- | --- |
| Defectos abiertos por severidad | 3 altos · 2 medios · 1 bajo · 6 sin clasificar | Con un defecto alto abierto no se libera |
| Etapas del pipeline en verde | 2/5 en local · 0/5 en GitHub | Ningún cambio se verifica antes de llegar a `main` |
| p95 del listado (5.000 tareas, 20 usuarios) | 33 s, contra 500 ms exigidos | La pantalla principal no es usable con volumen real |

En rojo están tres etapas. Lint tiene 3 errores en `comments.service.ts`. En tests pasan 58 de 68: de los 10 en rojo, 8 son bugs reales y 2 son tests mal escritos. Cobertura cumple el umbral, pero el job falla por esos mismos tests.

**Descartada: cobertura de líneas (83,96 %).** Supera el umbral y no anticipó ningún defecto: los 4 de la Clase 5, la inyección SQL y el de permisos están en líneas que ya estaban cubiertas. En el 2a subió 3,3 puntos con 6 de los 8 tests nuevos en rojo. Mide qué código se ejecutó, no qué se verificó.

## Defectos abiertos

- **Alta.**
  - #4: cualquier usuario autenticado edita tareas de proyectos ajenos. El issue cubría a un exmiembro; el 2a mostró que ni siquiera hace falta haber sido miembro.
  - #7: la fecha de vencimiento vuelve con un día menos en UTC-3.
  - SEC-01: inyección SQL en el buscador.
- **Media.** #5 y #6: etiquetas duplicadas y etiquetas con mayúsculas distintas.
- **Baja.** SEC-02: la cabecera `X-Powered-By` expone Express.
- **Sin clasificar.**
  - #10: el listado no está paginado.
  - 4 hallazgos de la Clase 5: los filtros no se combinan, la búsqueda distingue mayúsculas, los comentarios salen en orden inverso y se acepta una contraseña de 7 caracteres.
  - Del 2a: se acepta `2026-02-30` y se guarda como 2 de marzo.

## Riesgos sin mitigar

- **Seguridad.** La inyección SQL no tiene ningún test. El permiso de edición solo lo detectan el E2E y el 2a.
- **Falso verde en CI.** Los runners de GitHub corren en UTC, y ahí los tests de #7 pasan. Aunque se destrabe Actions, el pipeline no detectaría ese bug.
- **Sin red automática.** El CI no corre y `main` no está protegida.
- **Huecos de tests.** Agregar y quitar etiquetas (`tasks.service.ts:189-211`) no tiene tests de API. Que una tarea "se considera vencida" (US-16 CA7) no se puede observar desde la API.

## Recomendación: no liberar

Para reevaluar la decisión hace falta:

1. Corregir #4, #7 y SEC-01, cada uno con su test de regresión, y correr en CI los tests de fechas en UTC-3.
2. Paginar el listado y volver a medir con k6 hasta que el p95 sea de 500 ms o menos.
3. Destrabar GitHub Actions y llevar el pipeline a verde.
4. Asignar severidad a los 6 defectos sin clasificar.
