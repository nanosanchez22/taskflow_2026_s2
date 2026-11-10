# Práctico de k6

Se midió el listado de tareas de TaskFlow el 10/11/2026, con la API local en modo de desarrollo y k6 v2.3.0. Se ejecutó una prueba por escenario, siguiendo los parámetros de la consigna.

## Resultados

| Métrica | Seed chica: 1 VU, 30 s | Seed grande: 20 VUs, 1 min |
|---|---:|---:|
| p95 (`http_req_duration`) | 28,81 ms | 33 s |
| Error rate (`http_req_failed`) | 0,00 % | 0,00 % |
| Iteraciones por segundo | 0,964926 | 0,665464 |

Con los datos grandes, el p95 quedó por encima de los 500 ms exigidos en la sección Rendimiento de la especificación. No hubo errores HTTP, pero se incumplió el tiempo de respuesta esperado.

## Hipótesis

El listado recupera todas las tareas aunque recibe parámetros de paginación. Después hace consultas adicionales por cada tarea para buscar al asignado y contar los comentarios. Al crecer la cantidad de tareas, crecen las consultas y el tamaño de la respuesta; con más usuarios ese trabajo se repite simultáneamente. Esto explicaría la demora observada.

La comparación cambia tanto el volumen de datos como la cantidad de usuarios, por lo que no permite separar el efecto de cada variable. Las métricas HTTP del script incluyen el login y el listado de proyectos de `setup`.

## Evidencia e issue

- [Salida original con seed chica](results/seed-chica.txt).
- [Salida original con seed grande](results/seed-grande.txt).
- [Issue #10: listado de tareas con p95 de 33 segundos](https://github.com/nanosanchez22/taskflow_2026_s2/issues/10).

## Comandos utilizados

Con la seed chica cargada y la API levantada:

```sh
k6 run -e VUS=1 -e DURATION=30s performance/scenarios/api-load.k6.js
npm --prefix server run db:seed:large
k6 run -e VUS=20 -e DURATION=1m performance/scenarios/api-load.k6.js
```

El seed grande genera 200 proyectos de carga y concentra 5.000 tareas y 20.000 comentarios en `[Carga] Proyecto grande`. El comando `db:seed:large` ya estaba definido en `server/package.json`.
