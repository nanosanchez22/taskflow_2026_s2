# Contract Testing del Ejercicio 3

Contract testing *consumer-driven* con **Pact** entre el frontend (`taskflow-web`,
consumidor) y la API (`taskflow-api`, proveedor). Cubre el hueco que ni los tests
del backend ni los del frontend ven: nadie compara lo que el frontend **espera**
con lo que la API **entrega**. Si alguien renombra o cambia un campo de una
respuesta, la verificación lo detecta antes de integrar.

## Interacciones del contrato

| # | Pedido | Respuesta esperada (forma) |
| --- | --- | --- |
| 1 | `POST /api/auth/login` con `{ email, password }` | `200` · `{ token: string, user: { id: "user-N", email: string, name: string } }` |
| 2 | `GET /api/tasks/task-1/comments` con `Authorization: Bearer …` | `200` · `[ { id: "comment-N", taskId: "task-N", authorId: "user-N", body: string, createdAt: ISO } ]` |

Se usan *matchers* por forma (`like`, `eachLike`, `regex`), no valores exactos:
el contrato se rompe solo cuando cambia la estructura, no ante cualquier cambio de
datos.

## Estructura

```
client/
  contract/taskflow-web.consumer.test.ts   # consumidor: declara y genera el pact (vitest)
  vitest.config.ts                          # runner de los contract tests del cliente
  pacts/taskflow-web-taskflow-api.json      # contrato generado (no se versiona)
server/
  tests/contract/provider.pact.test.ts      # proveedor: verifica la API real contra el pact (jest)
```

El lado consumidor corre el cliente real (`api()` de `client/src/lib/api.ts`)
contra un mock server de Pact y escribe el contrato. El lado proveedor levanta la
app Express real (`createApp()`) en un puerto libre, prepara los datos con los
*state handlers* (reusando `server/tests/helpers.ts`) y reproduce cada pedido del
contrato, reemplazando el token de mentira por uno válido con `requestFilter`.

## Ejecución

Desde la raíz, con las dependencias instaladas (`@pact-foundation/pact@17.1.4`,
`vitest@2`):

```bash
# 1) consumidor: genera client/pacts/taskflow-web-taskflow-api.json
npm run test:contract:consumer

# 2) proveedor: verifica la API real contra ese contrato
npm run test:contract:provider

# o ambos en orden:
npm run test:contract
```

El proveedor se corre aparte de la suite normal. `npm test` y `npm run
test:coverage` ignoran `server/tests/contract/` (via `testPathIgnorePatterns`),
para no mezclarlo con la suite ni afectar el piso de cobertura.

## Resultado cuando el contrato se cumple

```
Verifying a pact between taskflow-web and taskflow-api
  un login con credenciales válidas
    returns a response which
      has status code 200 (OK)
      has a matching body (OK)
  un pedido del listado de comentarios de task-1
     Given ana es miembro de proj-1 y task-1 tiene comentarios
    returns a response which
      has status code 200 (OK)
      has a matching body (OK)

PASS tests/contract/provider.pact.test.ts
  ✓ verifica todas las interacciones del pact
```

## Rompiendo el contrato a propósito

Para comprobar que la verificación detecta un cambio incompatible, se renombró el
campo `body` → `text` en el *serializer* de comentarios
(`server/src/modules/comments/comments.service.ts`, función `serialize`) y se
volvió a correr el proveedor:

```
  un pedido del listado de comentarios de task-1
     Given ana es miembro de proj-1 y task-1 tiene comentarios
    returns a response which
      has status code 200 (OK)
      has a matching body (FAILED)

Failures:
1) ... un pedido del listado de comentarios de task-1
    1.1) has a matching body
           $[0] -> Actual map is missing the following keys: body

There were 1 pact failures
FAIL tests/contract/provider.pact.test.ts
```

La falla indica **qué pedido**, **qué campo** (`body`) y **de quién** es el
contrato: no hay que adivinar. Esto es exactamente lo que ni el backend ni el
frontend por separado detectan.

**El cambio fue revertido**: el *serializer* vuelve a emitir `body` y la
verificación vuelve a PASS. El repositorio queda en verde.

## Notas de implementación

- El contrato de login espera `user.name` como *string*. El estado base del
  proveedor registra al usuario de login **con nombre** (`name: 'Ana'`) para
  cumplir esa forma; si se registrara sin nombre, el proveedor devolvería
  `name: null` y la verificación fallaría (tipo `null` ≠ `string`). Es un ejemplo
  de que el estado del proveedor debe reflejar lo que el consumidor declara.
- El *state handler* de comentarios es idempotente (patrón anti-409): el usuario
  base se registra una sola vez aunque el estado se invoque varias veces.
- El `requestFilter` solo reescribe el header `Authorization` cuando existe, para
  no afectar el login (que no lleva token).
