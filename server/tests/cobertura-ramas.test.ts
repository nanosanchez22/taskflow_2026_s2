/**
 * Ejercicio: subir la cobertura de ramas de ~31% a ≥40%.
 *
 * Estos tests de integración ejercitan los "caminos infelices" que la suite base
 * no toca: permisos (403), recurso inexistente (404), conflicto (409), validación
 * (400) y transición inválida (422). Cada rama de permiso/validación que hoy no se
 * ejecuta es una rama de cobertura ganada.
 *
 * Cada test sigue Arrange · Act · Assert y verifica lo que ve el cliente: el código
 * de estado HTTP y el cuerpo de la respuesta (en TaskFlow, { error: { code, ... } }).
 *
 * Los dos tests marcados con it.failing afirman el comportamiento correcto según la
 * especificación: fallan por un bug del sistema y quedan anotados para la Etapa 2.
 * NO se ajustan al comportamiento incorrecto.
 */
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { Response } from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';

/**
 * Aserción de error: verifica el estado HTTP y el código de error del cuerpo,
 * que es exactamente lo que recibe (y maneja) el cliente ante un fallo.
 */
function expectError(res: Response, status: number, code: string): void {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
}

// ---------------------------------------------------------------------------
// PROYECTOS — projects.service.ts (el mayor hueco de ramas: 9%)
// ---------------------------------------------------------------------------
describe('Proyectos — caminos infelices', () => {
  it('crear con nombre demasiado largo (>100) devuelve 400', async () => {
    const { token } = await registerUser('cov-proj-long@test.com');
    const res = await request(app)
      .post('/api/projects')
      .set(auth(token))
      .send({ name: 'x'.repeat(101) });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('crear dos proyectos con el mismo nombre devuelve 409', async () => {
    const { token } = await registerUser('cov-proj-dup@test.com');
    await createProject(token, 'Repetido');
    const res = await request(app)
      .post('/api/projects')
      .set(auth(token))
      .send({ name: 'Repetido' });
    expectError(res, 409, 'CONFLICT');
  });

  it('editar un proyecto inexistente devuelve 404', async () => {
    const { token } = await registerUser('cov-proj-edit404@test.com');
    const res = await request(app)
      .patch('/api/projects/proj-99999')
      .set(auth(token))
      .send({ name: 'Nuevo nombre' });
    expectError(res, 404, 'NOT_FOUND');
  });

  it('editar con nombre demasiado corto (<3) devuelve 400', async () => {
    const { token } = await registerUser('cov-proj-editshort@test.com');
    const project = await createProject(token, 'Proyecto editable');
    const res = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(auth(token))
      .send({ name: 'ab' });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('un miembro no owner no puede editar el proyecto (403)', async () => {
    const owner = await registerUser('cov-proj-owner@test.com');
    const member = await registerUser('cov-proj-member@test.com');
    const project = await createProject(owner.token, 'Proyecto compartido');
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'cov-proj-member@test.com' });

    const res = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(auth(member.token))
      .send({ name: 'Intento de cambio' });
    expectError(res, 403, 'FORBIDDEN');
  });

  it('editar un proyecto ajeno (sin ser miembro) devuelve 404', async () => {
    const owner = await registerUser('cov-proj-owner2@test.com');
    const extrano = await registerUser('cov-proj-stranger@test.com');
    const project = await createProject(owner.token, 'Proyecto privado');

    const res = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(auth(extrano.token))
      .send({ name: 'Intruso' });
    expectError(res, 404, 'NOT_FOUND');
  });

  it('eliminar un proyecto propio devuelve 204', async () => {
    const { token } = await registerUser('cov-proj-del@test.com');
    const project = await createProject(token, 'Proyecto a borrar');
    const res = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set(auth(token));
    expect(res.status).toBe(204);
  });

  it('eliminar un proyecto inexistente devuelve 404', async () => {
    const { token } = await registerUser('cov-proj-del404@test.com');
    const res = await request(app)
      .delete('/api/projects/proj-99999')
      .set(auth(token));
    expectError(res, 404, 'NOT_FOUND');
  });

  it('un miembro no owner no puede eliminar el proyecto (403)', async () => {
    const owner = await registerUser('cov-proj-delowner@test.com');
    const member = await registerUser('cov-proj-delmember@test.com');
    const project = await createProject(owner.token, 'Proyecto no borrable');
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'cov-proj-delmember@test.com' });

    const res = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set(auth(member.token));
    expectError(res, 403, 'FORBIDDEN');
  });
});

describe('Proyectos — gestión de miembros', () => {
  it('solo el owner puede agregar miembros (403)', async () => {
    const owner = await registerUser('cov-mem-owner@test.com');
    const member = await registerUser('cov-mem-member@test.com');
    await registerUser('cov-mem-tercero@test.com');
    const project = await createProject(owner.token, 'Proyecto con equipo');
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'cov-mem-member@test.com' });

    // El member (no owner) intenta agregar a un tercero
    const res = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(member.token))
      .send({ email: 'cov-mem-tercero@test.com' });
    expectError(res, 403, 'FORBIDDEN');
  });

  it('agregar un email que no existe devuelve 404', async () => {
    const { token } = await registerUser('cov-mem-noemail@test.com');
    const project = await createProject(token, 'Proyecto sin ese user');
    const res = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(token))
      .send({ email: 'noexiste@test.com' });
    expectError(res, 404, 'NOT_FOUND');
  });

  it('agregar un email con formato inválido devuelve 400', async () => {
    const { token } = await registerUser('cov-mem-bademail@test.com');
    const project = await createProject(token, 'Proyecto email malo');
    const res = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(token))
      .send({ email: 'no-es-un-email' });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('agregar dos veces el mismo miembro devuelve 409', async () => {
    const owner = await registerUser('cov-mem-dupowner@test.com');
    await registerUser('cov-mem-dup@test.com');
    const project = await createProject(owner.token, 'Proyecto dup miembro');
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'cov-mem-dup@test.com' });
    const res = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'cov-mem-dup@test.com' });
    expectError(res, 409, 'CONFLICT');
  });

  it('el owner no puede quitarse a sí mismo (400)', async () => {
    const { token, id } = await registerUser('cov-mem-self@test.com');
    const project = await createProject(token, 'Proyecto self-remove');
    const res = await request(app)
      .delete(`/api/projects/${project.id}/members/${id}`)
      .set(auth(token));
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('quitar un miembro que no pertenece al proyecto devuelve 404', async () => {
    const owner = await registerUser('cov-mem-rm404owner@test.com');
    const ajeno = await registerUser('cov-mem-rm404ajeno@test.com');
    const project = await createProject(owner.token, 'Proyecto rm 404');
    const res = await request(app)
      .delete(`/api/projects/${project.id}/members/${ajeno.id}`)
      .set(auth(owner.token));
    expectError(res, 404, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// MEMBERSHIP — middleware (branch 0%): 401 / 404 / 403
// ---------------------------------------------------------------------------
describe('Membresía — middleware de acceso', () => {
  it('listar tareas de un proyecto ajeno devuelve 403', async () => {
    const owner = await registerUser('cov-mw-owner@test.com');
    const extrano = await registerUser('cov-mw-stranger@test.com');
    const project = await createProject(owner.token, 'Proyecto ajeno tareas');

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks`)
      .set(auth(extrano.token));
    expectError(res, 403, 'FORBIDDEN');
  });

  it('listar tareas de un proyecto inexistente devuelve 404', async () => {
    const { token } = await registerUser('cov-mw-404@test.com');
    const res = await request(app)
      .get('/api/projects/proj-99999/tasks')
      .set(auth(token));
    expectError(res, 404, 'NOT_FOUND');
  });

  it('operar sobre una tarea inexistente devuelve 404', async () => {
    const { token } = await registerUser('cov-mw-task404@test.com');
    const res = await request(app)
      .get('/api/tasks/task-99999')
      .set(auth(token));
    expectError(res, 404, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// TAREAS — tasks.service.ts y transitions.ts
// ---------------------------------------------------------------------------
describe('Tareas — validaciones y transiciones', () => {
  it('crear tarea con prioridad inválida devuelve 400', async () => {
    const { token } = await registerUser('cov-task-prio@test.com');
    const project = await createProject(token, 'Proyecto prioridad');
    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(token))
      .send({ title: 'Tarea con prioridad mala', priority: 'URGENTE' });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('crear tarea con título demasiado corto (<3) devuelve 400', async () => {
    const { token } = await registerUser('cov-task-title@test.com');
    const project = await createProject(token, 'Proyecto título corto');
    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(token))
      .send({ title: 'ab' });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('asignar a alguien que no es miembro del proyecto devuelve 400', async () => {
    const owner = await registerUser('cov-task-assign@test.com');
    const ajeno = await registerUser('cov-task-ajeno@test.com');
    const project = await createProject(owner.token, 'Proyecto asignación');
    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(owner.token))
      .send({ title: 'Tarea mal asignada', assigneeId: ajeno.id });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('transición inválida DONE→TODO devuelve 422', async () => {
    const { token, id } = await registerUser('cov-task-trans@test.com');
    const project = await createProject(token, 'Proyecto transición');
    const task = await createTask(token, project.id, {
      title: 'Tarea ciclo de vida',
      assigneeId: id,
    });
    // TODO -> IN_PROGRESS -> DONE
    await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'IN_PROGRESS' });
    await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'DONE' });
    // DONE -> TODO : prohibido
    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'TODO' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  // HALLAZGO (Etapa 2): la spec US-06 CA#2 dice que TODO→DONE NO está permitido
  // (debería devolver 422), pero transitions.ts solo bloquea las salidas de DONE,
  // así que el salto se acepta con 200. NO ajustamos el test al comportamiento
  // incorrecto: afirmamos lo que dice la spec y lo marcamos con test.failing, que
  // mantiene la suite en verde mientras el bug siga abierto.
  it.failing('transición inválida TODO→DONE devuelve 422 (spec US-06 CA#2)', async () => {
    // Arrange
    const { token, id } = await registerUser('cov-task-jump@test.com');
    const project = await createProject(token, 'Proyecto salto');
    const task = await createTask(token, project.id, {
      title: 'Tarea sin pasar por progreso',
      assigneeId: id,
    });
    // Act
    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'DONE' });
    // Assert — comportamiento esperado por la spec
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('un no-asignado sin ser admin no puede cambiar el estado (403)', async () => {
    const owner = await registerUser('cov-task-statusowner@test.com');
    const member = await registerUser('cov-task-statusmember@test.com');
    const project = await createProject(owner.token, 'Proyecto status permiso');
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'cov-task-statusmember@test.com' });
    // Tarea asignada al owner
    const task = await createTask(owner.token, project.id, {
      title: 'Tarea del owner',
      assigneeId: owner.id,
    });
    // El member (no asignado, rol MEMBER) intenta cambiar el estado
    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(member.token))
      .send({ status: 'IN_PROGRESS' });
    expectError(res, 403, 'FORBIDDEN');
  });

  it('eliminar una tarea inexistente devuelve 404', async () => {
    const { token } = await registerUser('cov-task-del404@test.com');
    const res = await request(app)
      .delete('/api/tasks/task-99999')
      .set(auth(token));
    expectError(res, 404, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// AUTH — auth.service.ts (login, duplicados, recuperación)
// ---------------------------------------------------------------------------
describe('Autenticación — caminos infelices', () => {
  it('registrar un email ya existente devuelve 409', async () => {
    await registerUser('cov-auth-dup@test.com');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'cov-auth-dup@test.com', password: 'Password1' });
    expectError(res, 409, 'CONFLICT');
  });

  it('registrar con email inválido devuelve 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'no-email', password: 'Password1' });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('login con contraseña incorrecta devuelve 401', async () => {
    await registerUser('cov-auth-login@test.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cov-auth-login@test.com', password: 'Incorrecta9' });
    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('login de un email inexistente devuelve 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@test.com', password: 'Password1' });
    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('login exitoso devuelve 200 y un token', async () => {
    await registerUser('cov-auth-ok@test.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cov-auth-ok@test.com', password: 'Password1' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  // HALLAZGO (Etapa 2): la spec US-17 CA#2 pide que forgot-password responda igual
  // exista o no el email (200 + mismo cuerpo), para no revelar qué cuentas existen.
  // El código hace throw notFound → 404, filtrando esa información. NO ajustamos el
  // test al comportamiento incorrecto: afirmamos la spec con it.failing.
  it.failing('forgot-password de un email inexistente devuelve 200 (spec US-17 CA#2)', async () => {
    // Arrange / Act
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'fantasma@test.com' });
    // Assert — comportamiento esperado por la spec
    expect(res.status).toBe(200);
  });

  it('forgot-password de un email registrado devuelve 200 con token', async () => {
    await registerUser('cov-auth-forgot-ok@test.com');
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'cov-auth-forgot-ok@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('reset-password con token inválido devuelve 400', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'token-que-no-existe', newPassword: 'Password2' });
    expectError(res, 400, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// COMENTARIOS — comments.service.ts
// ---------------------------------------------------------------------------
describe('Comentarios — caminos infelices', () => {
  it('comentar con cuerpo vacío devuelve 400', async () => {
    const { token } = await registerUser('cov-com-empty@test.com');
    const project = await createProject(token, 'Proyecto comentarios');
    const task = await createTask(token, project.id, { title: 'Tarea a comentar' });
    const res = await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: '' });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('no se puede eliminar el comentario de otro usuario (403)', async () => {
    const autor = await registerUser('cov-com-autor@test.com');
    const otro = await registerUser('cov-com-otro@test.com');
    const project = await createProject(autor.token, 'Proyecto comentario ajeno');
    await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(autor.token))
      .send({ email: 'cov-com-otro@test.com' });
    const task = await createTask(autor.token, project.id, { title: 'Tarea con comentario' });
    const comment = (
      await request(app)
        .post(`/api/tasks/${task.id}/comments`)
        .set(auth(autor.token))
        .send({ body: 'Comentario del autor' })
    ).body;

    const res = await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set(auth(otro.token));
    expectError(res, 403, 'FORBIDDEN');
  });

  it('eliminar un comentario inexistente devuelve 404', async () => {
    const { token } = await registerUser('cov-com-del404@test.com');
    const res = await request(app)
      .delete('/api/comments/comment-99999')
      .set(auth(token));
    expectError(res, 404, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// TAREAS — tasks.repository.ts (filtros y orden de las consultas · tabla slide 24)
// Datos reales creados por la API, sin mocks: el mock de findTasks sería un
// "falso verde" (slide 13-14) que no ejercita la consulta real.
// ---------------------------------------------------------------------------
describe('Filtros y búsqueda de tareas (tasks.repository)', () => {
  it('filtra tareas por status (rama status de buildFilters)', async () => {
    // Arrange: un proyecto con una tarea en TODO
    const { token, id } = await registerUser('cov-repo-status@test.com');
    const project = await createProject(token, 'Proyecto filtro status');
    const task = await createTask(token, project.id, {
      title: 'Tarea a avanzar',
      assigneeId: id,
    });
    await createTask(token, project.id, { title: 'Tarea que queda en TODO' });
    // una pasa a IN_PROGRESS
    await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'IN_PROGRESS' });

    // Act
    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?status=IN_PROGRESS`)
      .set(auth(token));

    // Assert: solo la que está IN_PROGRESS
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].status).toBe('IN_PROGRESS');
  });

  it('filtra tareas por priority (rama priority de buildFilters)', async () => {
    const { token } = await registerUser('cov-repo-prio@test.com');
    const project = await createProject(token, 'Proyecto filtro prioridad');
    await createTask(token, project.id, { title: 'Tarea HIGH', priority: 'HIGH' });
    await createTask(token, project.id, { title: 'Tarea LOW', priority: 'LOW' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?priority=HIGH`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].priority).toBe('HIGH');
  });

  it('filtra tareas por assignedTo (rama assigneeId de buildFilters)', async () => {
    const { token, id } = await registerUser('cov-repo-assignee@test.com');
    const project = await createProject(token, 'Proyecto filtro asignado');
    await createTask(token, project.id, { title: 'Tarea asignada', assigneeId: id });
    await createTask(token, project.id, { title: 'Tarea sin asignar' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?assignedTo=${id}`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].assigneeId).toBe(id);
  });

  it('busca tareas por texto en el título (rama search de findTasks/countTasks)', async () => {
    const { token } = await registerUser('cov-repo-search@test.com');
    const project = await createProject(token, 'Proyecto búsqueda');
    await createTask(token, project.id, { title: 'Implementar login' });
    await createTask(token, project.id, { title: 'Revisar diseño' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?search=login`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].title).toBe('Implementar login');
  });

  it('sin filtros devuelve todas las tareas del proyecto', async () => {
    const { token } = await registerUser('cov-repo-nofilter@test.com');
    const project = await createProject(token, 'Proyecto sin filtros');
    await createTask(token, project.id, { title: 'Tarea uno' });
    await createTask(token, project.id, { title: 'Tarea dos' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });
});
