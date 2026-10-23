import { test, expect, openTask, addTag, readTask } from '../support/fixtures';

test.describe('US-15 — Etiquetar tareas', () => {
  test('feliz: agrega y quita una etiqueta [CA4,6]', async ({ page, request, scenario }) => {
    await openTask(page, scenario);
    const response = await addTag(page, scenario.task.id, 'backend');
    expect(response.status()).toBe(201);
    await expect(page.getByTestId('tag-chip-name')).toHaveText('backend');
    const tag = await response.json();
    const [removed] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === `/api/tasks/${scenario.task.id}/tags/${tag.id}` && r.request().method() === 'DELETE'),
      page.getByTestId('tag-remove-button').click(),
    ]);
    expect(removed.status()).toBe(204);
    await expect(page.getByTestId('tag-chip')).toHaveCount(0);
    expect((await readTask(request, scenario)).tags).toEqual([]);
  });

  for (const name of ['', ' ', 'x'.repeat(31)]) {
    test(`error: rechaza etiqueta ${JSON.stringify(name)} [CA4]`, async ({ page, request, scenario }) => {
      await openTask(page, scenario);
      const response = await addTag(page, scenario.task.id, name);
      expect(response.status()).toBe(400);
      expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
      await expect(page.getByTestId('task-tags-section').getByRole('alert')).toBeVisible();
      expect((await readTask(request, scenario)).tags).toEqual([]);
    });
  }

  for (const length of [1, 30]) {
    test(`borde: acepta etiqueta de ${length} caracteres [CA4]`, async ({ page, scenario }) => {
      await openTask(page, scenario);
      const response = await addTag(page, scenario.task.id, 'x'.repeat(length));
      expect(response.status()).toBe(201);
      await expect(page.getByTestId('tag-chip-name')).toHaveText('x'.repeat(length));
    });
  }

  test('borde: admite diez etiquetas y rechaza la undécima [CA5]', async ({ page, request, scenario }) => {
    await openTask(page, scenario);
    for (let i = 1; i <= 10; i++) {
      const response = await addTag(page, scenario.task.id, `etiqueta-${i}`);
      expect(response.status()).toBe(201);
      await expect(page.getByTestId('tag-chip')).toHaveCount(i);
    }
    const response = await addTag(page, scenario.task.id, 'etiqueta-11');
    expect(response.status()).toBe(400);
    await expect(page.getByTestId('tag-chip')).toHaveCount(10);
    expect((await readTask(request, scenario)).tags).toHaveLength(10);
  });

  test('feliz: normaliza espacios y mayúsculas [CA1]', async ({ page, request, scenario }) => {
    await openTask(page, scenario);
    const response = await addTag(page, scenario.task.id, '  BuG  ');
    expect(response.status()).toBe(201);
    expect.soft((await readTask(request, scenario)).tags?.map(t => t.name)).toEqual(['bug']);
    await expect.soft(page.getByTestId('tag-chip-name')).toHaveText('bug');
  });

  for (const repeated of ['bug', 'BUG']) {
    test(`borde: repetir ${repeated} devuelve 200 sin duplicar bug [CA2,3]`, async ({ page, request, scenario }) => {
      await openTask(page, scenario);
      expect((await addTag(page, scenario.task.id, 'bug')).status()).toBe(201);
      await expect(page.getByTestId('tag-chip')).toHaveCount(1);
      const response = await addTag(page, scenario.task.id, repeated);
      const persisted = await readTask(request, scenario);
      expect.soft(response.status()).toBe(200);
      expect.soft(persisted.tags?.map(t => t.name)).toEqual(['bug']);
      await expect.soft(page.getByTestId('tag-chip')).toHaveCount(1);
    });
  }
});
