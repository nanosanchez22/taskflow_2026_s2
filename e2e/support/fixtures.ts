import { test as base, expect, APIRequestContext, Page, Request } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { TaskDetailPage } from '../src/pages/TaskDetailPage';

type Account = { user: { id: string; email: string }; token: string };
export type Task = {
  id: string; title: string; description: string; priority: string;
  status: string; assigneeId: string | null; dueDate: string | null;
  tags?: { id: string; name: string }[];
};
type Scenario = {
  owner: Account; member: Account; outsider: Account;
  project: { id: string }; task: Task;
  ownerHeaders: { Authorization: string };
};

export const test = base.extend<{ scenario: Scenario; evidence: void }>({
  evidence: [async ({ page, browser }, use, testInfo) => {
    const responses: unknown[] = [];
    const pending: Promise<void>[] = [];
    const record = (request: Request) => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/auth/')) return;
      pending.push((async () => {
        const response = await request.response();
        if (!response) return;
        let body: unknown;
        try { body = await response.json(); } catch { body = await response.text().catch(() => ''); }
        responses.push({ method: request.method(), path: url.pathname + url.search,
          request: request.postDataJSON(), status: response.status(), body });
      })());
    };
    // Registrar solo solicitudes completadas evita esperar cuerpos de peticiones
    // de fondo que el navegador todavía está descargando al terminar el caso.
    page.on('requestfinished', record);
    await use();
    page.off('requestfinished', record);
    await Promise.all(pending);
    await testInfo.attach('respuestas-http.json', {
      body: JSON.stringify(responses, null, 2), contentType: 'application/json',
    });
    await testInfo.attach('entorno.json', {
      body: JSON.stringify({ os: process.platform, node: process.version,
        browser: browser.version(), clientTimezone: 'America/Montevideo',
        serverTimezone: 'America/Montevideo', retry: testInfo.retry,
        repeatEachIndex: testInfo.repeatEachIndex }, null, 2), contentType: 'application/json',
    });
  }, { auto: true }],
  scenario: async ({ request }, use) => {
    const register = async (role: string): Promise<Account> => {
      const response = await request.post('/api/auth/register', {
        data: { email: `${role}-${randomUUID()}@test.com`, password: 'Password1' },
      });
      expect(response.status(), 'Preparación: registrar usuario').toBe(201);
      return response.json();
    };
    const owner = await register('owner');
    const member = await register('member');
    const outsider = await register('outsider');
    const ownerHeaders = { Authorization: `Bearer ${owner.token}` };
    const projectResponse = await request.post('/api/projects', {
      headers: ownerHeaders, data: { name: `E2E ${randomUUID()}` },
    });
    expect(projectResponse.status()).toBe(201);
    const project = await projectResponse.json();
    const memberResponse = await request.post(`/api/projects/${project.id}/members`, {
      headers: ownerHeaders, data: { email: member.user.email },
    });
    expect(memberResponse.status()).toBe(201);
    const taskResponse = await request.post(`/api/projects/${project.id}/tasks`, {
      headers: ownerHeaders,
      data: { title: 'Tarea original', description: 'Descripción original',
        priority: 'MEDIUM', assigneeId: member.user.id },
    });
    expect(taskResponse.status()).toBe(201);
    await use({ owner, member, outsider, project, task: await taskResponse.json(), ownerHeaders });
    // Los datos quedan únicamente en la base aislada para poder investigar los fallos.
  },
});
export { expect };

/** Inicia sesión por la UI y abre el detalle de la tarea del escenario. */
export async function openTask(page: Page, s: Scenario, account = s.member): Promise<TaskDetailPage> {
  await page.goto('/login');
  await page.getByTestId('login-email-input').fill(account.user.email);
  await page.getByTestId('login-password-input').fill('Password1');
  await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login' && r.request().method() === 'POST'),
    page.getByTestId('login-submit').click(),
  ]);
  await page.waitForURL('**/projects');
  const detail = new TaskDetailPage(page, s.task.id);
  await detail.goto(s.project.id);
  await expect(detail.titleInput).toHaveValue(s.task.title);
  // useMembers carga las opciones mediante otra solicitud real.
  await expect(detail.assigneeOption(s.owner.user.id)).toHaveCount(1);
  return detail;
}

export async function readTask(request: APIRequestContext, s: Scenario): Promise<Task> {
  const response = await request.get(`/api/tasks/${s.task.id}`, { headers: s.ownerHeaders });
  expect(response.status()).toBe(200);
  return response.json();
}

export async function removeMember(request: APIRequestContext, s: Scenario) {
  const response = await request.delete(`/api/projects/${s.project.id}/members/${s.member.user.id}`, {
    headers: s.ownerHeaders,
  });
  expect(response.status()).toBe(204);
}
