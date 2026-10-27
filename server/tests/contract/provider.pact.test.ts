/**
 * Contract testing — Etapa 3 · lado PROVEEDOR (taskflow-api).
 *
 * Reproduce cada interacción del contrato generado por el consumidor
 * (client/pacts/...) contra la API REAL y compara las respuestas. Si una
 * respuesta ya no cumple la forma esperada, la verificación falla y señala
 * qué pedido y qué campo rompió.
 *
 * - Levantamos la app Express real en un puerto libre.
 * - Los "given" (states) preparan los datos vía los helpers de test.
 * - El token del contrato es de mentira: el requestFilter lo reemplaza por
 *   uno válido antes de que el pedido llegue a la API.
 *
 * Este archivo vive en tests/contract/ y jest.config lo ignora en `npm test`
 * (se corre aparte con `npm run test:contract`).
 */
import path from 'node:path';
import type { Server } from 'node:http';
import request from 'supertest';
import { Verifier } from '@pact-foundation/pact';
import { app, registerUser, createProject, createTask, auth } from '../helpers';

// Credenciales que el contrato de login fija (deben existir en el proveedor).
const LOGIN_EMAIL = 'ana@test.com';
const LOGIN_PASSWORD = 'Password1';

let server: Server;
let port: number;

// Token válido de un miembro del proyecto, para los pedidos autenticados.
let memberToken = '';

/**
 * Estado base idempotente: se arma una sola vez aunque lo pidan varios states.
 * Registra al usuario del login, y crea proj-1 + task-1 para comentarios.
 */
async function estadoBase(): Promise<void> {
  if (memberToken) return;

  // Usuario del contrato de login. Lo registramos CON nombre: el contrato
  // espera user.name como string, y el estado del proveedor debe cumplirlo.
  await request(app)
    .post('/api/auth/register')
    .send({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD, name: 'Ana' });

  // Usuario/proyecto/tarea base para el contrato de comentarios.
  const base = await registerUser('base@test.com');
  memberToken = base.token;
  const project = await createProject(memberToken, 'Rediseño del sitio'); // → proj-1
  await createTask(memberToken, project.id, { title: 'Implementar login' }); // → task-1
}

beforeAll(async () => {
  await estadoBase();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('taskflow-api cumple el contrato de taskflow-web', () => {
  it('verifica todas las interacciones del pact', async () => {
    const output = await new Verifier({
      provider: 'taskflow-api',
      providerBaseUrl: `http://127.0.0.1:${port}`,
      pactUrls: [
        path.resolve(__dirname, '../../../client/pacts/taskflow-web-taskflow-api.json'),
      ],
      stateHandlers: {
        'ana es miembro de proj-1 y task-1 tiene comentarios': async () => {
          await estadoBase();
          await request(app)
            .post('/api/tasks/task-1/comments')
            .set(auth(memberToken))
            .send({ body: 'Primer comentario' });
        },
      },
      // El token del contrato es de mentira: lo cambiamos por uno válido.
      // (El login no lleva Authorization, así que no lo pisa.)
      requestFilter: (req, _res, next) => {
        if (req.headers.authorization) {
          req.headers.authorization = `Bearer ${memberToken}`;
        }
        next();
      },
    }).verifyProvider();

    // verifyProvider() rechaza la promesa si alguna interacción no cumple el
    // contrato; si resuelve, todas pasaron. El resultado trae "result":true.
    expect(output).toContain('"result":true');
  });
});
