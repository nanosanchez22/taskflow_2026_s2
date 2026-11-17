/**
 * Tests de caracterización de PATCH /api/tasks/:taskId (updateTask).
 *
 * Fijan el comportamiento ACTUAL de updateTask antes de seguir refactorizándolo
 * (smell 1 de CODE_SMELLS.md): quién puede cambiar el estado, qué transiciones
 * acepta, qué queda en el historial y en qué orden se validan los cambios. Si un
 * refactor cambia alguno de estos resultados, la suite lo marca.
 *
 * Roles: asignado (rol MEMBER), owner del proyecto y admin, los dos sin ser
 * asignados. La API no tiene un endpoint para nombrar admins (addMember siempre
 * crea MEMBER), así que el rol ADMIN se asigna directo en la base.
 *
 * Los casos marcados con "DIFIERE DE LA SPEC" caracterizan un comportamiento que
 * contradice la especificación. No son el test de la spec: están para que un
 * refactor no los cambie sin querer. Corregir el bug los cambia a propósito.
 */
import request, { Response } from 'supertest';
import { db } from '../src/lib/db';
import { parsePublicId } from '../src/lib/ids';
import { app, auth, createProject, createTask, registerUser } from './helpers';

type Status = 'TODO' | 'IN_PROGRESS' | 'DONE';
type Actor = { token: string; id: string };

let seq = 0;
function email(prefix: string) {
  seq += 1;
  return `car-${prefix}-${seq}@test.com`;
}

function expectError(res: Response, status: number, code: string): void {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
}

function patch(actor: Actor, taskId: string, body: Record<string, unknown>) {
  return request(app).patch(`/api/tasks/${taskId}`).set(auth(actor.token)).send(body);
}

async function historyOf(actor: Actor, taskId: string) {
  const res = await request(app).get(`/api/tasks/${taskId}/history`).set(auth(actor.token));
  expect(res.status).toBe(200);
  return res.body as Array<{ changedBy: string; fromStatus: string; toStatus: string }>;
}

async function addMember(owner: Actor, projectId: string, memberEmail: string) {
  const res = await request(app)
    .post(`/api/projects/${projectId}/members`)
    .set(auth(owner.token))
    .send({ email: memberEmail });
  expect(res.status).toBe(201);
}

async function makeAdmin(projectId: string, userId: string) {
  await db.projectMember.update({
    where: {
      projectId_userId: {
        projectId: parsePublicId(projectId, 'proj')!,
        userId: parsePublicId(userId, 'user')!,
      },
    },
    data: { role: 'ADMIN' },
  });
}

/**
 * Proyecto con owner, un miembro asignado a la tarea, un admin y un miembro sin
 * asignar. La tarea queda en el estado pedido, avanzada por el asignado.
 */
async function scenario(start: Status = 'TODO') {
  const ownerEmail = email('owner');
  const owner = await registerUser(ownerEmail);
  const assigneeEmail = email('asignado');
  const assignee = await registerUser(assigneeEmail);
  const adminEmail = email('admin');
  const admin = await registerUser(adminEmail);
  const memberEmail = email('miembro');
  const member = await registerUser(memberEmail);
  const outsider = await registerUser(email('ajeno'));

  const project = await createProject(owner.token, 'Proyecto caracterización');
  await addMember(owner, project.id, assigneeEmail);
  await addMember(owner, project.id, adminEmail);
  await addMember(owner, project.id, memberEmail);
  await makeAdmin(project.id, admin.id);

  const task = await createTask(owner.token, project.id, {
    title: 'Tarea a caracterizar',
    assigneeId: assignee.id,
  });

  const path: Status[] = start === 'TODO' ? [] : start === 'IN_PROGRESS' ? ['IN_PROGRESS'] : ['IN_PROGRESS', 'DONE'];
  for (const status of path) {
    expect((await patch(assignee, task.id, { status })).status).toBe(200);
  }

  return { owner, assignee, admin, member, outsider, projectId: project.id as string, taskId: task.id as string };
}

type Role = 'assignee' | 'owner' | 'admin';
const ROLES: Role[] = ['assignee', 'owner', 'admin'];

describe('Caracterización de updateTask: transiciones válidas por rol', () => {
  const VALID: Array<[Status, Status]> = [
    ['TODO', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'DONE'],
    ['IN_PROGRESS', 'TODO'],
  ];

  for (const role of ROLES) {
    for (const [from, to] of VALID) {
      it(`${role}: ${from} → ${to} devuelve 200 y queda en el historial con su autor`, async () => {
        // Arrange
        const s = await scenario(from);
        const actor = s[role];
        const before = await historyOf(s.owner, s.taskId);

        // Act
        const res = await patch(actor, s.taskId, { status: to });

        // Assert
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(to);
        const after = await historyOf(s.owner, s.taskId);
        expect(after).toHaveLength(before.length + 1);
        expect(after[after.length - 1]).toMatchObject({ changedBy: actor.id, fromStatus: from, toStatus: to });
      });
    }
  }
});

describe('Caracterización de updateTask: transiciones bloqueadas por rol', () => {
  const BLOCKED: Array<[Status, Status]> = [
    ['DONE', 'TODO'],
    ['DONE', 'IN_PROGRESS'],
  ];

  for (const role of ROLES) {
    for (const [from, to] of BLOCKED) {
      it(`${role}: ${from} → ${to} devuelve 422 y no agrega historial`, async () => {
        const s = await scenario(from);
        const before = await historyOf(s.owner, s.taskId);

        const res = await patch(s[role], s.taskId, { status: to });

        expectError(res, 422, 'INVALID_TRANSITION');
        expect(await historyOf(s.owner, s.taskId)).toHaveLength(before.length);
      });
    }

    // DIFIERE DE LA SPEC: US-06 CA2 prohíbe TODO → DONE (422). El test contra la
    // spec es el it.failing de cobertura-ramas.test.ts.
    it(`${role}: TODO → DONE hoy se acepta con 200`, async () => {
      const s = await scenario('TODO');

      const res = await patch(s[role], s.taskId, { status: 'DONE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DONE');
    });
  }
});

describe('Caracterización de updateTask: quién no puede cambiar el estado', () => {
  it('un miembro que no es el asignado recibe 403 y el estado no cambia', async () => {
    const s = await scenario('TODO');

    const res = await patch(s.member, s.taskId, { status: 'IN_PROGRESS' });

    expectError(res, 403, 'FORBIDDEN');
    const task = await request(app).get(`/api/tasks/${s.taskId}`).set(auth(s.owner.token));
    expect(task.body.status).toBe('TODO');
  });

  it('un usuario ajeno al proyecto recibe 403', async () => {
    const s = await scenario('TODO');

    const res = await patch(s.outsider, s.taskId, { status: 'IN_PROGRESS' });

    expectError(res, 403, 'FORBIDDEN');
  });

  // DIFIERE DE LA SPEC: US-06 CA6 pide que quien cambia el estado sea miembro
  // vigente (403). removeMember no desasigna las tareas y assertCanChangeStatus
  // acepta al asignado antes de mirar la membresía.
  it('un exmiembro que sigue asignado hoy puede cambiar el estado (200)', async () => {
    const s = await scenario('TODO');
    const removed = await request(app)
      .delete(`/api/projects/${s.projectId}/members/${s.assignee.id}`)
      .set(auth(s.owner.token));
    expect(removed.status).toBe(204);

    const res = await patch(s.assignee, s.taskId, { status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });
});

describe('Caracterización de updateTask: orden de las reglas', () => {
  it('el permiso se evalúa sobre el asignado original, no sobre el que llega en la misma solicitud', async () => {
    const s = await scenario('TODO');

    // El miembro sin asignar intenta asignarse y avanzar la tarea a la vez.
    const res = await patch(s.member, s.taskId, { assigneeId: s.member.id, status: 'IN_PROGRESS' });

    expectError(res, 403, 'FORBIDDEN');
    const task = await request(app).get(`/api/tasks/${s.taskId}`).set(auth(s.owner.token));
    expect(task.body.assigneeId).toBe(s.assignee.id);
  });

  it('el asignado puede reasignar y cambiar el estado en la misma solicitud', async () => {
    const s = await scenario('TODO');

    const res = await patch(s.assignee, s.taskId, { assigneeId: s.member.id, status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ assigneeId: s.member.id, status: 'IN_PROGRESS' });
  });

  it('la validación de campos va antes que el permiso: 400 aunque quien envía no pueda cambiar el estado', async () => {
    const s = await scenario('TODO');

    const res = await patch(s.member, s.taskId, { title: 'ab', status: 'IN_PROGRESS' });

    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('una transición rechazada no guarda los demás campos de la solicitud', async () => {
    const s = await scenario('DONE');

    const res = await patch(s.owner, s.taskId, { title: 'Título que no se guarda', status: 'TODO' });

    expectError(res, 422, 'INVALID_TRANSITION');
    const task = await request(app).get(`/api/tasks/${s.taskId}`).set(auth(s.owner.token));
    expect(task.body.title).toBe('Tarea a caracterizar');
  });

  it('pedir el mismo estado no cuenta como cambio: 200, sin historial y sin chequear permiso', async () => {
    const s = await scenario('TODO');
    const before = await historyOf(s.owner, s.taskId);

    // El miembro sin asignar no puede cambiar el estado, pero TODO → TODO no lo cambia.
    const res = await patch(s.member, s.taskId, { status: 'TODO' });

    expect(res.status).toBe(200);
    expect(await historyOf(s.owner, s.taskId)).toHaveLength(before.length);
  });

  it('una solicitud sin cambios devuelve la tarea sin tocar updatedAt', async () => {
    const s = await scenario('TODO');
    const original = await request(app).get(`/api/tasks/${s.taskId}`).set(auth(s.owner.token));

    const res = await patch(s.owner, s.taskId, {});

    expect(res.status).toBe(200);
    expect(res.body.updatedAt).toBe(original.body.updatedAt);
  });

  it('editar título y prioridad sin estado no agrega historial', async () => {
    const s = await scenario('IN_PROGRESS');
    const before = await historyOf(s.owner, s.taskId);

    const res = await patch(s.owner, s.taskId, { title: 'Título editado', priority: 'HIGH' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Título editado', priority: 'HIGH', status: 'IN_PROGRESS' });
    expect(await historyOf(s.owner, s.taskId)).toHaveLength(before.length);
  });
});
