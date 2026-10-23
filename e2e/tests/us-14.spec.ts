import { test, expect, openTask, save, readTask, removeMember } from '../support/fixtures';

test.describe('US-14 — Asignar tarea a un miembro', () => {
  test('feliz: un miembro no owner reasigna a otro miembro sin cambiar estado [CA2,4,5]', async ({ page, request, scenario }) => {
    await openTask(page, scenario);
    await page.getByTestId('task-assignee-select').selectOption(scenario.owner.user.id);
    const response = await save(page, scenario.task.id);
    expect(response.status()).toBe(200);
    expect(await readTask(request, scenario)).toMatchObject({ assigneeId: scenario.owner.user.id, status: 'TODO' });
    await expect(page.getByTestId('task-assignee-select')).toHaveValue(scenario.owner.user.id);
    await expect(page.getByTestId('task-current-status')).toHaveText('TODO');
  });

  test('error: rechaza asignar a un usuario que dejó de ser miembro [CA1]', async ({ page, request, scenario }) => {
    await openTask(page, scenario, scenario.owner);
    await removeMember(request, scenario);
    // La opción sigue visible en la pantalla abierta antes de quitar al miembro.
    await page.getByTestId('task-assignee-select').selectOption(scenario.member.user.id);
    const response = await save(page, scenario.task.id);
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
    await expect(page.getByRole('alert')).toContainText('member');
    expect((await readTask(request, scenario)).status).toBe('TODO');
  });

  test('borde: desasigna enviando null y conserva el estado [CA3,5]', async ({ page, request, scenario }) => {
    await openTask(page, scenario);
    await page.getByTestId('task-assignee-select').selectOption('');
    const response = await save(page, scenario.task.id);
    expect(response.request().postDataJSON().assigneeId).toBeNull();
    expect(response.status()).toBe(200);
    expect(await readTask(request, scenario)).toMatchObject({ assigneeId: null, status: 'TODO' });
    await expect(page.getByTestId('task-assignee-select')).toHaveValue('');
  });
});
