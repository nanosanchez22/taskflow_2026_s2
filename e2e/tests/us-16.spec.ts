import { test, expect, openTask, save, readTask } from '../support/fixtures';

test.describe('US-16 — Fecha de vencimiento', () => {
  test('feliz: guarda el mismo día calendario en UTC-3 [CA1,2,3]', async ({ page, request, scenario }) => {
    await openTask(page, scenario);
    await page.getByTestId('task-duedate-input').fill('2026-11-15');
    const response = await save(page, scenario.task.id);
    expect(response.status()).toBe(200);
    const persisted = await readTask(request, scenario);
    expect.soft((await response.json()).dueDate).toBe('2026-11-15');
    expect.soft(persisted.dueDate).toBe('2026-11-15');
    await expect.soft(page.getByTestId('task-duedate-value')).toHaveText('2026-11-15');
  });

  test('error: rechaza formato DD/MM/YYYY [CA6]', async ({ page, request, scenario }) => {
    await openTask(page, scenario);
    // Un input date impide tipear este formato. Se cambia a text para comprobar
    // la validación del servidor a través del formulario real, sin simular la API.
    await page.getByTestId('task-duedate-input').evaluate((input: HTMLInputElement) => { input.type = 'text'; });
    await page.getByTestId('task-duedate-input').fill('15/09/2026');
    const response = await save(page, scenario.task.id);
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
    await expect(page.getByRole('alert')).toContainText('dueDate');
    expect((await readTask(request, scenario)).dueDate).toBeNull();
  });

  test('borde: permite quitar el vencimiento enviando null [CA4,5]', async ({ page, request, scenario }) => {
    const setup = await request.patch(`/api/tasks/${scenario.task.id}`, {
      headers: scenario.ownerHeaders, data: { dueDate: '2026-11-15' },
    });
    expect(setup.status()).toBe(200);
    await openTask(page, scenario);
    await page.getByTestId('task-duedate-input').fill('');
    const response = await save(page, scenario.task.id);
    expect(response.request().postDataJSON().dueDate).toBeNull();
    expect(response.status()).toBe(200);
    expect((await readTask(request, scenario)).dueDate).toBeNull();
    await expect(page.getByTestId('task-duedate-value')).toHaveText('—');
  });

  test('borde: acepta una fecha pasada y conserva el día [CA3,7]', async ({ page, request, scenario }) => {
    await openTask(page, scenario);
    await page.getByTestId('task-duedate-input').fill('2020-01-01');
    const response = await save(page, scenario.task.id);
    expect(response.status()).toBe(200);
    expect.soft((await readTask(request, scenario)).dueDate).toBe('2020-01-01');
    await expect.soft(page.getByTestId('task-duedate-value')).toHaveText('2020-01-01');
  });
});
