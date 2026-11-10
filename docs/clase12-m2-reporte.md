# Práctico Módulo 2 — Seguridad y accesibilidad

Fecha: 10/11/2026.

## Entorno

Se trabajó con TaskFlow en Windows y PowerShell. La API responde en `http://localhost:3000/api` y el cliente en `http://localhost:5173`. Las cuentas usadas fueron `ana@test.com` y `bob@test.com`, con contraseña `Password1`.

La guía corresponde a otra estructura: en este repositorio se usan `server/`, `client/` y `e2e/tests/`. Registro se abre desde el botón de `/login`. El test usa la base aislada que configura Playwright y crea sus propios usuarios, proyecto y tarea. Se mantienen las cuatro vistas solicitadas y se comprueba también el detalle de tarea para corregir la regla `label`, en la pantalla revisada durante XSS.

## Análisis de dependencias

Se ejecutaron `npm audit` y `npm audit --omit=dev` en la raíz, `server` y `client`, porque son paquetes separados.

| Paquete | Auditoría completa | Con --omit=dev |
| --- | --- | --- |
| Raíz | 1 CRITICAL | 0 |
| Servidor | 15: 7 LOW, 1 MODERATE y 7 HIGH | 7: 1 MODERATE y 6 HIGH |
| Cliente | 9: 2 MODERATE, 5 HIGH y 2 CRITICAL | 3 HIGH |

Se analizaron estos dos casos:

| Dependencia | Severidad de npm | Uso y exposición | Arreglo y compatibilidad |
| --- | --- | --- | --- |
| body-parser | HIGH | Llega mediante Express y permanece en el árbol de producción de la API. Los avisos describen denegación de servicio; no se intentó provocar una ni se demostraron sus condiciones en TaskFlow. | npm propone Express 4.22.3 con --force. Está fuera de la versión fijada, pero dentro de Express 4: eso no prueba por sí solo un cambio incompatible. Requiere validación. |
| tinypool | CRITICAL | Llega mediante Vitest y desaparece al excluir desarrollo. Los avisos afectan herramientas de pruebas; no se demostró ejecución de código desde la aplicación publicada. | npm propone Vitest 5.1.0 y lo marca como un cambio incompatible. |

Los conteos incluyen dependencias transitivas. No se aplicó `npm audit fix`. Los avisos pueden cambiar con el tiempo.

Referencias informadas por npm: [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828) y [tinypool](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3).

## Headers

Se ejecutó `curl.exe -I` sobre `/api/health` y `/api/projects`, este último autenticado como Ana. Ambos respondieron 200.

| Header | Valor observado | Interpretación |
| --- | --- | --- |
| Content-Security-Policy | Ausente | No hay política en estas respuestas. La protección de la interfaz también requiere revisar el servidor que entrega el frontend. |
| Strict-Transport-Security | Ausente | Debe configurarse en el despliegue HTTPS; esta prueba fue sobre HTTP local. |
| X-Frame-Options | Ausente | No se declara una restricción. Para evaluar clickjacking hay que revisar la respuesta que entrega la interfaz. |
| X-Content-Type-Options | Ausente | No se declara nosniff. |
| X-Powered-By | Express | Revela el framework. Se documenta como SEC-02. |
| Access-Control-Allow-Origin | * | La política permite cualquier origen. Eso no demuestra acceso a datos privados sin un token válido. |

## 4.1 Hallazgos de seguridad

### SEC-01 — Inyección SQL en el buscador de tareas

**Severidad:** HIGH.

**Descripción:** `findTasks`, en `server/src/modules/tasks/tasks.repository.ts`, concatena el parámetro `search` dentro de una consulta ejecutada con `db.$queryRawUnsafe`.

**Pasos de reproducción:**

1. Iniciar sesión como Ana y crear un proyecto privado con una tarea. En la ejecución se obtuvieron `proj-204` y `task-5013`, con título `Tarea privada de Ana`.
2. Consultar `GET /api/projects/proj-204/tasks` con el token de Ana y `search=Tarea privada de Ana`: respondió 200 y `total: 1`.
3. Enviar `search` con el valor `') > 0) AND 1=1 -- `, incluyendo el espacio final: respondió 200 y `total: 1`.
4. Cambiar la condición por `') > 0) AND 1=0 -- `: respondió 200, `items: []` y `total: 0`.

Se usó `curl.exe -G` con `--data-urlencode "search=$condicion"` y el header `Authorization: Bearer <token>`.

**Expectativa previa y resultado:** una búsqueda segura debería tratar la entrada como texto. El payload inicial `' OR '1'='1' --` produjo 500; la comparación verdadera/falsa confirmó después que la entrada cambia la lógica SQL.

**Impacto:** un usuario autenticado puede alterar una consulta de lectura. La prueba mantuvo el filtro del proyecto de Ana; no demostró lectura de otros proyectos, modificación de datos ni ejecución de comandos del sistema.

**Remediación propuesta:** parametrizar la consulta o usar filtros de Prisma. Conservar el filtro de proyecto y la validación de membresía. Agregar casos con comillas y condiciones SQL tratadas como texto literal.

### SEC-02 — Exposición del framework en X-Powered-By

**Severidad:** LOW.

**Descripción:** la API devuelve `X-Powered-By: Express`. En `server/src/app.ts` no se desactiva esta cabecera.

**Pasos de reproducción:**

1. Levantar la API.
2. Ejecutar `curl.exe -I http://localhost:3000/api/health`.
3. Observar `X-Powered-By: Express` en la respuesta 200. La misma cabecera apareció en `/api/projects` con autenticación.

**Impacto:** facilita identificar la tecnología utilizada. No informa una versión concreta ni permite por sí solo acceder a datos o ejecutar código.

**Remediación propuesta:** configurar `app.disable('x-powered-by')` y verificar la ausencia de la cabecera en respuestas públicas y protegidas.

## 4.2 Control verificado

**Qué se probó:** Bob intentó acceder a las tareas del proyecto privado nuevo de Ana y cambiar el estado de una de ellas.

**Resultado esperado:** 403 o 404 para Bob y ningún cambio en la tarea. Ana puede consultarla.

**Resultado obtenido:**

| Operación | Usuario | Respuesta |
| --- | --- | --- |
| GET /api/tasks/task-5013 | Ana | 200, estado TODO |
| GET /api/projects/proj-204/tasks | Bob | 403, no es miembro |
| GET /api/tasks/task-5013 | Bob | 403, no es miembro |
| PATCH /api/tasks/task-5013 con {"status":"IN_PROGRESS"} | Bob | 403, requiere asignado o administrador |
| GET /api/tasks/task-5013 después del intento | Ana | 200, TODO y mismo updatedAt |

**Código que lo explica:** los middleware `requireProjectMember` y `requireTaskProjectMember` controlan las lecturas. `assertCanChangeStatus`, en `tasks.service.ts`, limita el cambio de estado al asignado, owner o administrador. El resultado cubre estas operaciones. No se probó `GET /api/projects/:id` porque esa ruta no existe en esta versión.

### Otras pruebas solicitadas

| Prueba | Expectativa escrita antes | Resultado y explicación |
| --- | --- | --- |
| SQL injection en login | Rechazar el intento sin entregar token. | Email `' OR '1'='1' --` y contraseña `x`: 401, Invalid credentials. El login usa `db.user.findUnique({ where: { email } })`. |
| XSS almacenado | Mostrar el título como texto sin ejecutar JavaScript. | Se creó por API, a pedido del grupo, una tarea con `<img src=x onerror=alert(1)>`: 201, ID task-5014. La revisión visual confirmó texto literal; se aportó una captura del tablero. El tablero usa texto JSX y el detalle un input controlado. |
| Token sin firma | Rechazar el token aunque conserve los datos de Ana. | Se cambió la cabecera a alg: none y se quitó la firma: GET /api/projects respondió 401, Invalid or expired token. `authenticate` usa `jwt.verify`. |

## 4.3 Hallazgos de accesibilidad

### ACC-01 — Campos de etiqueta y comentario sin nombre accesible

- **SC WCAG 2.1:** 4.1.2, Nombre, función, valor.
- **Nivel:** A.
- **Principio POUR:** Robusto.
- **Cómo se detectó:** axe reportó la regla label con impacto CRITICAL, SC 4.1.2 y dos elementos afectados. Ese impacto de axe es distinto del nivel de conformidad A.
- **Vista afectada:** Detalle de tarea, revisada también durante la prueba XSS.
- **Descripción del fallo:** `tag-add-input` y `comment-add-input` no tienen un label asociado ni otro nombre accesible. Los encabezados de las secciones no están asociados a esos campos.
- **Fix aplicado:** se agregaron etiquetas visibles que contienen los campos: Nueva etiqueta para tag-add-input y Comentario para comment-add-input, en `client/src/pages/TaskDetailPage.tsx`. Los data-testid se conservaron.
- **Verificación:** `VERIFICAR.regla = 'label'`, `vistas = ['Detalle de tarea']`. Antes de la corrección, el informe detectó label en ambos campos y el verificador falló: 5 passed y 1 failed. Después del cambio, axe no reportó violaciones en Detalle de tarea y el verificador pasó: 6 passed, sin casos omitidos.

### ACC-02 — Propósito de los campos personales sin identificar

- **SC WCAG 2.1:** 1.3.5, Identificar el propósito de la entrada.
- **Nivel:** AA.
- **Principio POUR:** Perceptible.
- **Cómo se detectó:** revisión manual del marcado, comprobada mediante lectura de los atributos.
- **Vista afectada:** Login y Registro.
- **Descripción del fallo:** los campos de nombre, email y contraseña no declaran autocomplete. Los cinco atributos revisados devolvieron null. Las etiquetas visibles no reemplazan la identificación del propósito de los datos personales.
- **Fix propuesto:** usar name para nombre, username/current-password al ingresar y email/new-password al registrarse. Queda propuesto; la corrección elegida para la entrega es ACC-01.

### ACC-03 — Controles que desbordan a 320 píxeles

- **SC WCAG 2.1:** 1.4.10, Reajuste del contenido.
- **Nivel:** AA.
- **Principio POUR:** Perceptible.
- **Cómo se detectó:** revisión visual de capturas y medición del documento a 320 píxeles.
- **Vista afectada:** Proyectos y Detalle de proyecto.
- **Descripción del fallo:** con los datos de prueba, Proyectos midió 341 píxeles y el botón Salir quedó fuera del viewport. Detalle midió 423 píxeles y también desbordaron los selects de asignado de creación y filtrado. Se requiere desplazamiento horizontal para ver completos esos controles. Login y Registro midieron 320 píxeles.
- **Fix propuesto:** permitir el reajuste del encabezado y limitar el ancho de campos y contenedores. El hallazgo se refiere a navegación y formularios; no supone que todo desplazamiento horizontal del tablero incumpla WCAG.

Referencias: W3C, [4.1.2](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html), [1.3.5](https://www.w3.org/WAI/WCAG21/Understanding/identify-input-purpose.html) y [1.4.10](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html).

### Revisiones manuales de la guía

| Prueba | Resultado |
| --- | --- |
| Teclado | Se llegó al enlace del nombre de un proyecto con Tab, el foco fue visible y Enter abrió el tablero. |
| Idioma | `client/index.html` declara `lang="es"`, consistente con el contenido principal en español. |
| Mensaje de error del login | Al ingresar como Ana con contraseña incorrecta se mostró Invalid credentials. El componente ErrorMessage usa role="alert", por lo que el error está marcado para su anuncio por tecnologías de asistencia. No se realizó una prueba con lector de pantalla. |

## 4.4 User stories de remediación

### Seguridad — SEC-01

**Como** miembro de un proyecto, **quiero** que el buscador trate mi entrada como texto, **para** buscar tareas sin alterar las consultas a la base.

- **CA-01:** los tres payloads documentados en SEC-01 responden 200 y cero coincidencias en un proyecto cuyas tareas no contienen esos textos; no producen 500.
- **CA-02:** buscar un título existente devuelve solamente coincidencias del proyecto consultado, aunque otro proyecto tenga una tarea con el mismo título.
- **CA-03:** un usuario no miembro recibe 403 al consultar las tareas del proyecto, tanto con búsquedas normales como con los payloads SQL.

### Accesibilidad — ACC-01

**Como** persona que utiliza un lector de pantalla, **quiero** identificar los campos para agregar etiquetas y comentarios, **para** saber qué información escribir en cada uno.

- **CA-01:** axe no reporta la regla label en Detalle de tarea y el test de verificación pasa.
- **CA-02:** los campos tienen los nombres accesibles “Nueva etiqueta” y “Comentario”, respectivamente.
- **CA-03:** getByLabel permite completar ambos campos y los data-testid existentes se conservan.

## Validación de la entrega

La auditoría inicial de las cuatro vistas de la guía dio cero violaciones de axe. La comprobación del detalle de tarea detectó label en tag-add-input y comment-add-input; se eligió esa regla para la corrección.

| Comprobación | Resultado |
| --- | --- |
| `npm run test:e2e:types` | Aprobada con la versión final del test |
| Test antes de corregir label | 5 passed y 1 failed; dos campos sin nombre accesible |
| `npm run build:client` después de la corrección | TypeScript y Vite compilaron sin errores |
| `npx playwright test a11y --project=chromium` después de la corrección | 6 passed, sin casos omitidos; cero violaciones en las cinco vistas auditadas |
| Revisión manual | Teclado, idioma y mensaje de error registrados |

La corrección aplicada cubre ACC-01. Los otros hallazgos quedan documentados con sus propuestas de remediación. La ausencia de violaciones en axe no equivale a conformidad completa con WCAG.

La entrega comprende este reporte, `e2e/tests/a11y.spec.ts`, el cambio de accesibilidad en el cliente y la dependencia @axe-core/playwright en package.json/package-lock.json. No se requieren issues ni un tablero de GitHub Projects.
