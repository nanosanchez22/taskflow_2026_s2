import { test, expect, openTask, readTask } from '../support/fixtures';

test.describe('US-15 — Etiquetar tareas', () => {
  test('feliz: agrega y quita una etiqueta [CA4,6]', async ({ page, request, scenario }) => {
    const detail = await openTask(page, scenario);
    const response = await detail.addTag('backend');
    expect(response.status()).toBe(201);
    await expect(detail.tagChipNames).toHaveText('backend');
    const tag = await response.json();
    const removed = await detail.removeTag(tag);
    expect(removed.status()).toBe(204);
    await expect(detail.tagChips).toHaveCount(0);
    expect((await readTask(request, scenario)).tags).toEqual([]);
  });

  for (const name of ['', ' ', 'x'.repeat(31)]) {
    test(`error: rechaza etiqueta ${JSON.stringify(name)} [CA4]`, async ({ page, request, scenario }) => {
      const detail = await openTask(page, scenario);
      const response = await detail.addTag(name);
      expect(response.status()).toBe(400);
      expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
      await expect(detail.tagsAlert).toBeVisible();
      expect((await readTask(request, scenario)).tags).toEqual([]);
    });
  }

  for (const length of [1, 30]) {
    test(`borde: acepta etiqueta de ${length} caracteres [CA4]`, async ({ page, scenario }) => {
      const detail = await openTask(page, scenario);
      const response = await detail.addTag('x'.repeat(length));
      expect(response.status()).toBe(201);
      await expect(detail.tagChipNames).toHaveText('x'.repeat(length));
    });
  }

  test('borde: admite diez etiquetas y rechaza la undécima [CA5]', async ({ page, request, scenario }) => {
    const detail = await openTask(page, scenario);
    for (let i = 1; i <= 10; i++) {
      const response = await detail.addTag(`etiqueta-${i}`);
      expect(response.status()).toBe(201);
      await expect(detail.tagChips).toHaveCount(i);
    }
    const response = await detail.addTag('etiqueta-11');
    expect(response.status()).toBe(400);
    await expect(detail.tagChips).toHaveCount(10);
    expect((await readTask(request, scenario)).tags).toHaveLength(10);
  });

  test('feliz: normaliza espacios y mayúsculas [CA1]', async ({ page, request, scenario }) => {
    const detail = await openTask(page, scenario);
    const response = await detail.addTag('  BuG  ');
    expect(response.status()).toBe(201);
    expect.soft((await readTask(request, scenario)).tags?.map(t => t.name)).toEqual(['bug']);
    await expect.soft(detail.tagChipNames).toHaveText('bug');
  });

  for (const repeated of ['bug', 'BUG']) {
    test(`borde: repetir ${repeated} devuelve 200 sin duplicar bug [CA2,3]`, async ({ page, request, scenario }) => {
      const detail = await openTask(page, scenario);
      expect((await detail.addTag('bug')).status()).toBe(201);
      await expect(detail.tagChips).toHaveCount(1);
      const response = await detail.addTag(repeated);
      const persisted = await readTask(request, scenario);
      expect.soft(response.status()).toBe(200);
      expect.soft(persisted.tags?.map(t => t.name)).toEqual(['bug']);
      await expect.soft(detail.tagChips).toHaveCount(1);
    });
  }
});
