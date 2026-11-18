import { test, expect, openTask, readTask, removeMember } from '../support/fixtures';

test.describe('US-12 — Editar tarea', () => {
  test('feliz: un miembro edita título, descripción y prioridad [CA1,3]', async ({ page, scenario }) => {
    const detail = await openTask(page, scenario);
    await detail.titleInput.fill('Implementar login con OAuth');
    await detail.descriptionInput.fill('Usar proveedor del equipo');
    await detail.prioritySelect.selectOption('HIGH');
    const response = await detail.save();
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ title: 'Implementar login con OAuth',
      description: 'Usar proveedor del equipo', priority: 'HIGH', status: 'TODO' });
    const reopened = await openTask(page, { ...scenario, task: { ...scenario.task, title: 'Implementar login con OAuth' } });
    await expect(reopened.descriptionInput).toHaveValue('Usar proveedor del equipo');
    await expect(reopened.prioritySelect).toHaveValue('HIGH');
  });

  for (const title of ['', 'ab', 'x'.repeat(201)]) {
    test(`error: rechaza título de ${title.length} caracteres [CA2]`, async ({ page, request, scenario }) => {
      const detail = await openTask(page, scenario);
      await detail.titleInput.fill(title);
      const response = await detail.save();
      expect(response.status()).toBe(400);
      expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
      await expect(detail.alert).toContainText('title');
      expect((await readTask(request, scenario)).title).toBe(scenario.task.title);
    });
  }

  for (const length of [3, 200]) {
    test(`borde: acepta título de ${length} caracteres [CA2]`, async ({ page, request, scenario }) => {
      const detail = await openTask(page, scenario);
      const title = 'x'.repeat(length);
      await detail.titleInput.fill(title);
      const response = await detail.save();
      expect(response.status()).toBe(200);
      expect((await readTask(request, scenario)).title).toBe(title);
      await expect(detail.titleInput).toHaveValue(title);
    });
  }

  test('error: un miembro quitado no puede editar desde una pantalla abierta [CA5]', async ({ page, request, scenario }) => {
    const detail = await openTask(page, scenario);
    await removeMember(request, scenario);
    // Se evita reenviar al ex-miembro como asignado: el payload debe ser válido
    // para aislar la comprobación de permisos de la validación de asignación.
    await detail.assigneeSelect.selectOption('');
    await detail.titleInput.fill('Cambio sin permiso');
    const response = await detail.save();
    const persisted = await readTask(request, scenario);
    expect.soft(response.status()).toBe(403);
    expect.soft(persisted.title).toBe(scenario.task.title);
    await expect.soft(detail.alert).toBeVisible();
  });
});
