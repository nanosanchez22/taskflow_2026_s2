import request from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';

/**
 * US-16: fecha de vencimiento de tarea.
 *
 * Hay un it() por criterio de aceptación. Los escenarios de la historia están
 * dentro de CA2 (asignar una fecha), CA3 (cliente en UTC-3) y CA6 ('15/09/2026').
 *
 * Todos los tests del archivo usan la misma base. Por eso cada test crea sus
 * propios usuarios, proyecto y tarea, y usa los ids que devuelve la API en vez
 * de suponer 'task-1'.
 *
 * Supuesto: la tarea se crea con { title }.
 *
 * Queda fuera porque la historia no lo define (no se afirma nada sobre esto):
 * - Si una fecha con hora ('2026-09-15T10:00:00Z') se rechaza o se trunca.
 * - Cómo se muestra que una tarea "está vencida" (CA7): no hay campo ni endpoint para eso.
 * - Si una tarea sin vencimiento devuelve dueDate: null o no devuelve el campo.
 *   Se aceptan las dos formas.
 */

const DUE_DATE = '2026-09-15';
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

let seq = 0;
function uniqueEmail(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}@us16.test`;
}

function expect2xx(res: request.Response) {
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
}

async function setupTask() {
  const owner = await registerUser(uniqueEmail('owner'));
  const project = await createProject(owner.token, 'Proyecto US-16');
  const task = await createTask(owner.token, project.id, { title: 'Tarea US-16' });
  expect(project.id).toEqual(expect.any(String));
  expect(task.id).toEqual(expect.any(String));
  return { owner, projectId: project.id as string, taskId: task.id as string };
}

function patchDueDate(token: string, taskId: string, dueDate: unknown) {
  return request(app).patch(`/api/tasks/${taskId}`).set(auth(token)).send({ dueDate });
}

function getTask(token: string, taskId: string) {
  return request(app).get(`/api/tasks/${taskId}`).set(auth(token));
}

/**
 * Supertest corre la app en el mismo proceso que el test, así que process.env.TZ
 * cambia la zona horaria del "cliente" y del servidor a la vez. Node aplica el
 * cambio de TZ en tiempo de ejecución, y cada llamada lo comprueba con
 * getTimezoneOffset para que el test no pase por error.
 */
async function withTimezone<T>(tz: string, fn: () => PromiseLike<T>): Promise<T> {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

const TIMEZONES = [
  { tz: 'UTC', offsetMinutes: 0 },
  { tz: 'America/Montevideo', offsetMinutes: 180 }, // UTC-3, el del escenario
  { tz: 'Pacific/Pago_Pago', offsetMinutes: 660 }, // UTC-11
  { tz: 'Pacific/Kiritimati', offsetMinutes: -840 }, // UTC+14
];

describe('US-16: fecha de vencimiento de tarea', () => {
  it('CA1: la fecha de vencimiento es un día calendario, sin hora', async () => {
    const { owner, taskId } = await setupTask();

    const patched = await patchDueDate(owner.token, taskId, DUE_DATE);
    expect(patched.status).toBe(200);

    const fetched = await getTask(owner.token, taskId);
    expect(fetched.status).toBe(200);

    // Solo AAAA-MM-DD: sin 'T', hora, milisegundos, offset ni 'Z'.
    expect([patched.body.dueDate, fetched.body.dueDate]).toEqual([
      expect.stringMatching(ISO_DATE_ONLY),
      expect.stringMatching(ISO_DATE_ONLY),
    ]);
  });

  it('CA2: se envía y se devuelve en formato ISO 8601 de fecha (escenario: asignar una fecha)', async () => {
    const { owner, taskId } = await setupTask();

    const patched = await patchDueDate(owner.token, taskId, DUE_DATE);
    expect(patched.status).toBe(200);
    expect(patched.body.dueDate).toBe(DUE_DATE);

    const fetched = await getTask(owner.token, taskId);
    expect(fetched.status).toBe(200);
    expect(fetched.body.dueDate).toBe(DUE_DATE);
  });

  it('CA3: la fecha devuelta es la misma que se cargó, sin importar la zona horaria del cliente ni la del servidor', async () => {
    const { owner, taskId } = await setupTask();
    const observed: Array<{ writeTz: string; readTz: string; patch: unknown; get: unknown }> = [];

    // Se escribe en cada zona y se lee en todas las zonas. Así se cubre el cliente
    // en UTC-3 (escenario) y un servidor que cambia de zona entre la escritura y la lectura.
    for (const write of TIMEZONES) {
      const patchRes = await withTimezone(write.tz, async () => {
        expect(new Date(`${DUE_DATE}T12:00:00Z`).getTimezoneOffset()).toBe(write.offsetMinutes);
        return patchDueDate(owner.token, taskId, DUE_DATE);
      });
      expect(patchRes.status).toBe(200);

      for (const read of TIMEZONES) {
        const getRes = await withTimezone(read.tz, async () => {
          expect(new Date(`${DUE_DATE}T12:00:00Z`).getTimezoneOffset()).toBe(read.offsetMinutes);
          return getTask(owner.token, taskId);
        });
        expect(getRes.status).toBe(200);
        observed.push({
          writeTz: write.tz,
          readTz: read.tz,
          patch: patchRes.body.dueDate,
          get: getRes.body.dueDate,
        });
      }
    }

    expect(observed).toEqual(
      observed.map(({ writeTz, readTz }) => ({ writeTz, readTz, patch: DUE_DATE, get: DUE_DATE })),
    );
  });

  it('CA4: la fecha de vencimiento es opcional; una tarea puede no tener vencimiento', async () => {
    // setupTask crea la tarea sin dueDate.
    const { owner, taskId } = await setupTask();

    const fetched = await getTask(owner.token, taskId);
    expect(fetched.status).toBe(200);
    expect(fetched.body.dueDate ?? null).toBeNull();
  });

  it('CA5: se puede quitar la fecha de vencimiento enviando el campo en nulo', async () => {
    const { owner, taskId } = await setupTask();

    const set = await patchDueDate(owner.token, taskId, DUE_DATE);
    expect(set.status).toBe(200);
    expect(set.body.dueDate).toBe(DUE_DATE);

    const cleared = await patchDueDate(owner.token, taskId, null);
    expect(cleared.status).toBe(200);
    expect(cleared.body.dueDate ?? null).toBeNull();

    const fetched = await getTask(owner.token, taskId);
    expect(fetched.status).toBe(200);
    expect(fetched.body.dueDate ?? null).toBeNull();
  });

  it('CA6: una fecha con formato inválido devuelve HTTP 400 (escenario: 15/09/2026)', async () => {
    const { owner, taskId } = await setupTask();
    expect((await patchDueDate(owner.token, taskId, DUE_DATE)).status).toBe(200);

    // Ninguno de estos valores es una fecha ISO 8601 con el formato '2026-09-15'.
    // '2026-13-01' y '2026-02-30' tienen el formato correcto, pero no son fechas del calendario.
    const INVALID: unknown[] = [
      '15/09/2026',
      '2026/09/15',
      '09-15-2026',
      '2026-9-15',
      '2026-13-01',
      '2026-02-30',
      'no-es-una-fecha',
      '',
      20260915,
    ];

    const observed: Array<{ value: unknown; status: number; code: unknown; hasMessage: boolean }> = [];
    for (const value of INVALID) {
      const res = await patchDueDate(owner.token, taskId, value);
      observed.push({
        value,
        status: res.status,
        code: res.body.code,
        hasMessage: typeof res.body.message === 'string',
      });
    }

    expect(observed).toEqual(
      INVALID.map((value) => ({ value, status: 400, code: 'VALIDATION_ERROR', hasMessage: true })),
    );

    // Un pedido rechazado no cambia la fecha que ya estaba guardada.
    const fetched = await getTask(owner.token, taskId);
    expect(fetched.status).toBe(200);
    expect(fetched.body.dueDate).toBe(DUE_DATE);
  });

  it('CA7: se admite cargar una fecha pasada y el sistema no la rechaza', async () => {
    const { owner, taskId } = await setupTask();
    const PAST = '2020-01-01';

    const patched = await patchDueDate(owner.token, taskId, PAST);
    expect(patched.status).toBe(200);
    expect(patched.body.dueDate).toBe(PAST);

    const fetched = await getTask(owner.token, taskId);
    expect(fetched.status).toBe(200);
    expect(fetched.body.dueDate).toBe(PAST);

    // "La tarea se considera vencida": la API no define cómo se muestra eso,
    // así que no se puede verificar desde acá.
  });

  it('CA8: solo los miembros del proyecto pueden modificar la fecha de vencimiento (403)', async () => {
    const { owner, projectId, taskId } = await setupTask();

    const memberEmail = uniqueEmail('member');
    const member = await registerUser(memberEmail);
    const outsider = await registerUser(uniqueEmail('outsider'));

    expect2xx(
      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set(auth(owner.token))
        .send({ email: memberEmail }),
    );

    // Un miembro sí puede modificarla.
    const byMember = await patchDueDate(member.token, taskId, DUE_DATE);
    expect(byMember.status).toBe(200);
    expect(byMember.body.dueDate).toBe(DUE_DATE);

    // Un usuario autenticado que no es miembro no puede asignarla ni quitarla.
    const outsiderAttempts: Array<{ value: unknown; status: number; code: unknown }> = [];
    for (const value of ['2026-10-01', null]) {
      const res = await patchDueDate(outsider.token, taskId, value);
      outsiderAttempts.push({ value, status: res.status, code: res.body.code });
    }
    expect(outsiderAttempts).toEqual([
      { value: '2026-10-01', status: 403, code: 'FORBIDDEN' },
      { value: null, status: 403, code: 'FORBIDDEN' },
    ]);

    // Un miembro que fue quitado del proyecto ya no puede modificarla.
    expect2xx(
      await request(app)
        .delete(`/api/projects/${projectId}/members/${member.id}`)
        .set(auth(owner.token)),
    );
    const byExMember = await patchDueDate(member.token, taskId, '2026-10-01');
    expect(byExMember.status).toBe(403);
    expect(byExMember.body.code).toBe('FORBIDDEN');

    // Ningún intento rechazado cambió la fecha.
    const fetched = await getTask(owner.token, taskId);
    expect(fetched.status).toBe(200);
    expect(fetched.body.dueDate).toBe(DUE_DATE);
  });
});
