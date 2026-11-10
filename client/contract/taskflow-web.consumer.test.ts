/**
 * Contract testing — Etapa 3 · lado CONSUMIDOR (taskflow-web).
 *
 * El frontend declara qué le pide a la API y qué forma espera recibir.
 * Pact levanta un mock server, corre el cliente real (`api()` de src/lib/api)
 * contra él, y guarda el contrato en ../pacts/.
 *
 * Dos interacciones (Ejercicio 3):
 *   1. POST /api/auth/login  → { token, user: { id, email, name } }
 *   2. GET  /api/tasks/task-1/comments → [ { id, taskId, body, createdAt } ]
 *
 * Usamos matchers (like/eachLike/regex): no fijamos valores exactos sino la
 * FORMA, para que el contrato se rompa solo cuando cambia la estructura.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import { api, setToken, clearToken } from '../src/lib/api';

const { like, eachLike, regex } = MatchersV3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// api.ts usa localStorage para el token; en Node no existe, lo definimos una
// vez de forma persistente (no con stubGlobal, que afterEach limpiaría).
beforeAll(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

const provider = new PactV4({
  consumer: 'taskflow-web',
  provider: 'taskflow-api',
  dir: path.resolve(__dirname, '../pacts'), // acá se escribe el contrato
});

// api() llama a fetch('/api/...') con URL relativa; en Node la apuntamos al
// mock server de Pact anteponiendo su baseURL.
function apuntarFetchA(baseUrl: string) {
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
    realFetch(`${baseUrl}${url}`, init),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToken();
});

describe('taskflow-web → taskflow-api', () => {
  it('login devuelve un token y un user con la forma esperada', async () => {
    await provider
      .addInteraction()
      .uponReceiving('un login con credenciales válidas')
      .withRequest('POST', '/api/auth/login', (b) =>
        b.jsonBody({ email: 'ana@test.com', password: 'Password1' }),
      )
      .willRespondWith(200, (b) =>
        b.jsonBody({
          token: like('jwt-token-de-prueba'),
          user: {
            id: regex(/^user-\d+$/, 'user-1'),
            email: like('ana@test.com'),
            name: like('Ana'),
          },
        }),
      )
      .executeTest(async (mock) => {
        apuntarFetchA(mock.url);
        const res = await api<{ token: string; user: { id: string; email: string } }>(
          '/auth/login',
          { method: 'POST', body: { email: 'ana@test.com', password: 'Password1' } },
        );
        expect(typeof res.token).toBe('string');
        expect(res.user.id).toMatch(/^user-\d+$/);
      });
  });

  it('el listado de comentarios de una tarea tiene la forma esperada', async () => {
    await provider
      .addInteraction()
      .given('ana es miembro de proj-1 y task-1 tiene comentarios')
      .uponReceiving('un pedido del listado de comentarios de task-1')
      .withRequest('GET', '/api/tasks/task-1/comments', (b) =>
        b.headers({ Authorization: regex(/^Bearer .+$/, 'Bearer token-de-prueba') }),
      )
      .willRespondWith(200, (b) =>
        b.jsonBody(
          eachLike({
            id: regex(/^comment-\d+$/, 'comment-1'),
            taskId: regex(/^task-\d+$/, 'task-1'),
            authorId: regex(/^user-\d+$/, 'user-1'),
            body: like('Primer comentario'),
            createdAt: like('2026-01-15T10:30:00.000Z'),
          }),
        ),
      )
      .executeTest(async (mock) => {
        apuntarFetchA(mock.url);
        setToken('jwt-token-de-prueba'); // para que api() mande Authorization
        const res = await api<
          Array<{ id: string; taskId: string; body: string; createdAt: string }>
        >('/tasks/task-1/comments');
        expect(Array.isArray(res)).toBe(true);
        expect(res[0].id).toMatch(/^comment-\d+$/);
        expect(res[0].body).toBeTypeOf('string');
      });
  });
});
