import { test, expect, openTask, save, readTask, removeMember } from '../support/fixtures';

test.describe('US-12 — Editar tarea', () => {
  test('feliz: un miembro edita título, descripción y prioridad [CA1,3]', async ({ page, scenario }) => {
    await openTask(page, scenario);
    await page.getByTestId('task-title-input').fill('Implementar login con OAuth');
    await page.getByTestId('task-description-input').fill('Usar proveedor del equipo');
    await page.getByTestId('task-priority-select').selectOption('HIGH');
    const response = await save(page, scenario.task.id);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ title: 'Implementar login con OAuth',
      description: 'Usar proveedor del equipo', priority: 'HIGH', status: 'TODO' });
    await openTask(page, { ...scenario, task: { ...scenario.task, title: 'Implementar login con OAuth' } });
    await expect(page.getByTestId('task-description-input')).toHaveValue('Usar proveedor del equipo');
    await expect(page.getByTestId('task-priority-select')).toHaveValue('HIGH');
  });

  for (const title of ['', 'ab', 'x'.repeat(201)]) {
    test(`error: rechaza título de ${title.length} caracteres [CA2]`, async ({ page, request, scenario }) => {
      await openTask(page, scenario);
      await page.getByTestId('task-title-input').fill(title);
      const response = await save(page, scenario.task.id);
      expect(response.status()).toBe(400);
      expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
      await expect(page.getByRole('alert')).toContainText('title');
      expect((await readTask(request, scenario)).title).toBe(scenario.task.title);
    });
  }

  for (const length of [3, 200]) {
    test(`borde: acepta título de ${length} caracteres [CA2]`, async ({ page, request, scenario }) => {
      await openTask(page, scenario);
      const title = 'x'.repeat(length);
      await page.getByTestId('task-title-input').fill(title);
      const response = await save(page, scenario.task.id);
      expect(response.status()).toBe(200);
      expect((await readTask(request, scenario)).title).toBe(title);
      await expect(page.getByTestId('task-title-input')).toHaveValue(title);
    });
  }

  test('error: un miembro quitado no puede editar desde una pantalla abierta [CA5]', async ({ page, request, scenario }) => {
    await openTask(page, scenario);
    await removeMember(request, scenario);
    // Se evita reenviar al ex-miembro como asignado: el payload debe ser válido
    // para aislar la comprobación de permisos de la validación de asignación.
    await page.getByTestId('task-assignee-select').selectOption('');
    await page.getByTestId('task-title-input').fill('Cambio sin permiso');
    const response = await save(page, scenario.task.id);
    const persisted = await readTask(request, scenario);
    expect.soft(response.status()).toBe(403);
    expect.soft(persisted.title).toBe(scenario.task.title);
    await expect.soft(page.getByRole('alert')).toBeVisible();
  });
});
