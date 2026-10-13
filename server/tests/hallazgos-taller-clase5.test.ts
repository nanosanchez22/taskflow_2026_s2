/**
 * Taller Clase 5 — Testing de APIs REST
 *
 * Cada test de este archivo afirma el comportamiento CORRECTO según la
 * especificación (taskflow_especificacion_requerimientos.docx). Por eso, contra
 * el código actual, estos tests FALLAN: esa falla es la evidencia del bug.
 *
 * Los tests de control (los que verifican el comportamiento que sí es correcto)
 * pasan, y sirven para mostrar que el defecto está acotado a un caso puntual.
 */
import request from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';

// Pequeña espera para forzar timestamps distintos entre creaciones.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Hallazgo 1 — US-07 CA#5: los filtros deben combinarse simultáneamente', () => {
  // Spec US-07 CA#5: "Los filtros son combinables entre sí y se aplican todos
  // simultáneamente." BDD: 3 tareas TODO/HIGH + 4 TODO/LOW, con
  // ?status=TODO&priority=HIGH ⇒ exactamente 3 resultados.
  //
  // OJO (lección de la slide 17): con este dataset "ingenuo" el test PASA aunque
  // el filtro esté roto. Como todas las tareas están en TODO, filtrar solo por
  // priority=HIGH (que es lo único que hace el código) da igual el resultado
  // correcto. Este es justo el motivo por el que "la fila 3 se salta": un caso
  // mal diseñado no distingue el bug. El caso siguiente sí lo distingue.
  it('caso insuficiente: con todas las tareas en TODO el bug queda oculto', async () => {
    const { token } = await registerUser('filtros@test.com');
    const project = await createProject(token, 'Proyecto de filtros');

    // 3 tareas TODO + HIGH
    for (let i = 0; i < 3; i++) {
      await createTask(token, project.id, { title: `Tarea HIGH ${i}`, priority: 'HIGH' });
    }
    // 4 tareas TODO + LOW (mismo estado inicial TODO, distinta prioridad)
    for (let i = 0; i < 4; i++) {
      await createTask(token, project.id, { title: `Tarea LOW ${i}`, priority: 'LOW' });
    }

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?status=TODO&priority=HIGH`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3); // pasa, pero NO porque el filtro combine bien
  });

  // Caso que SÍ distingue el bug: combinar status con priority donde el conjunto difiere.
  // 2 tareas HIGH que se mueven a IN_PROGRESS + 3 tareas HIGH que quedan en TODO.
  // ?status=TODO&priority=HIGH debe devolver 3, pero como priority pisa a status,
  // el código devuelve las 5 tareas HIGH.
  it('combina estado y prioridad sin traer tareas de otro estado', async () => {
    const { token, id } = await registerUser('filtros2@test.com');
    const project = await createProject(token, 'Proyecto de filtros 2');

    // 3 TODO + HIGH (se quedan en TODO)
    for (let i = 0; i < 3; i++) {
      await createTask(token, project.id, { title: `HIGH TODO ${i}`, priority: 'HIGH' });
    }
    // 2 HIGH que avanzamos a IN_PROGRESS (asignadas al owner para poder cambiar estado)
    for (let i = 0; i < 2; i++) {
      const task = await createTask(token, project.id, {
        title: `HIGH IP ${i}`,
        priority: 'HIGH',
        assigneeId: id,
      });
      await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(auth(token))
        .send({ status: 'IN_PROGRESS' });
    }

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?status=TODO&priority=HIGH`)
      .set(auth(token));

    expect(res.status).toBe(200);
    // Spec: exactamente las 3 que son TODO+HIGH. El bug hace que devuelva las 5 HIGH.
    expect(res.body.total).toBe(3);
    for (const task of res.body.items) {
      expect(task.status).toBe('TODO');
    }
  });
});

describe('Hallazgo 2 — US-07 CA#4: la búsqueda no distingue mayúsculas/minúsculas', () => {
  // Spec US-07 CA#4: "La búsqueda por texto busca en título y descripción, sin
  // distinguir mayúsculas de minúsculas." BDD: título "Implementar Login" con
  // ?search=login ⇒ debe devolver esa tarea.
  it('GET ...?search=login encuentra la tarea "Implementar Login"', async () => {
    const { token } = await registerUser('busqueda@test.com');
    const project = await createProject(token, 'Proyecto de búsqueda');
    await createTask(token, project.id, { title: 'Implementar Login' });
    await createTask(token, project.id, { title: 'Revisar diseño' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?search=login`)
      .set(auth(token));

    expect(res.status).toBe(200);
    // Esperado: 1 (la tarea "Implementar Login"). El bug hace que instr() sea
    // case-sensitive y devuelva 0.
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].title).toBe('Implementar Login');
  });

  // Caso de control: la búsqueda exacta en mayúsculas/minúsculas SÍ funciona hoy.
  it('control: la búsqueda respetando mayúsculas encuentra la tarea', async () => {
    const { token } = await registerUser('busqueda-ctrl@test.com');
    const project = await createProject(token, 'Proyecto de búsqueda ctrl');
    await createTask(token, project.id, { title: 'Implementar Login' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?search=Login`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });
});

describe('Hallazgo 3 — US-08 CA#4: los comentarios se devuelven del más antiguo al más reciente', () => {
  // Spec US-08 CA#4: "Los comentarios se devuelven ordenados por fecha
  // ascendente, del más antiguo al más reciente."
  it('GET /tasks/:id/comments devuelve orden cronológico ascendente', async () => {
    const { token } = await registerUser('coments@test.com');
    const project = await createProject(token, 'Proyecto de comentarios');
    const task = await createTask(token, project.id, { title: 'Tarea con comentarios' });

    // Tres comentarios en orden, con espera para garantizar timestamps distintos.
    await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: 'primero' });
    await sleep(5);
    await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: 'segundo' });
    await sleep(5);
    await request(app)
      .post(`/api/tasks/${task.id}/comments`)
      .set(auth(token))
      .send({ body: 'tercero' });

    const res = await request(app).get(`/api/tasks/${task.id}/comments`).set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    // Esperado por la spec: del más antiguo al más reciente.
    // El bug (orderBy createdAt desc) devuelve el orden inverso.
    expect(res.body.map((c: { body: string }) => c.body)).toEqual([
      'primero',
      'segundo',
      'tercero',
    ]);
  });
});

describe('Hallazgo 4 — US-01 CA#3: valores límite de la contraseña (mínimo 8)', () => {
  // Spec US-01 CA#3: "La contraseña debe tener mínimo 8 caracteres, al menos 1
  // número y 1 mayúscula." El código valida length >= 7, así que acepta 7.
  // Técnica: valores límite (probar 7, 8 y 9).

  it('rechaza una contraseña de 7 caracteres (último valor inválido)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'pass7@test.com', password: 'Passwo1' }); // 7 chars, con número y mayúscula

    // Esperado por la spec: 400 + VALIDATION_ERROR. El bug devuelve 201.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('control: acepta una contraseña de 8 caracteres (primer valor válido)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'pass8@test.com', password: 'Passwor1' }); // 8 chars

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it('control: acepta una contraseña de 9 caracteres', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'pass9@test.com', password: 'Passwrd12' }); // 9 chars

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });
});
