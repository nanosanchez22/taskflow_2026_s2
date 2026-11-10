// Prueba de carga del listado de tareas de TaskFlow.
// Ejecutar con k6; VUS, DURATION, BASE_URL y PROJECT_ID son configurables con -e.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000/api';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const BIG_PROJECT_NAME = '[Carga] Proyecto grande';

export const options = {
  vus: Number(__ENV.VUS || 1),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

// El login y la seleccion del proyecto se ejecutan una vez por prueba.
export function setup() {
  const login = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: 'ana@test.com', password: 'Password1' }),
    { headers: JSON_HEADERS }
  );
  check(login, { 'login 200': (r) => r.status === 200 });

  const body = login.json();
  const token = body.token || body.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  let projectId = __ENV.PROJECT_ID;
  if (!projectId) {
    const res = http.get(`${BASE}/projects`, { headers });
    const list = res.json();
    const big = list.find((p) => p.name && p.name.startsWith(BIG_PROJECT_NAME));
    projectId = big ? big.id : (list.length ? list[0].id : undefined);
  }

  return { headers, url: `${BASE}/projects/${projectId}/tasks` };
}

export default function (data) {
  const res = http.get(data.url, { headers: data.headers });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
