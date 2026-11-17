import { expect, Locator, Page, Response } from '@playwright/test';

/**
 * Detalle de una tarea (`/projects/:projectId/tasks/:taskId`): formulario de edición,
 * estado, etiquetas y comentarios. Las acciones esperan la respuesta real de la API
 * y la devuelven para que el test verifique status y cuerpo.
 */
export class TaskDetailPage {
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly prioritySelect: Locator;
  readonly assigneeSelect: Locator;
  readonly dueDateInput: Locator;
  readonly dueDateValue: Locator;
  readonly saveButton: Locator;
  readonly currentStatus: Locator;
  /** Cualquier mensaje de error de la pantalla (ErrorMessage usa role="alert"). */
  readonly alert: Locator;
  readonly tagsSection: Locator;
  readonly tagsAlert: Locator;
  readonly tagInput: Locator;
  readonly tagAddButton: Locator;
  readonly tagChips: Locator;
  readonly tagChipNames: Locator;
  readonly commentInput: Locator;

  constructor(readonly page: Page, readonly taskId: string) {
    this.titleInput = page.getByTestId('task-title-input');
    this.descriptionInput = page.getByTestId('task-description-input');
    this.prioritySelect = page.getByTestId('task-priority-select');
    this.assigneeSelect = page.getByTestId('task-assignee-select');
    this.dueDateInput = page.getByTestId('task-duedate-input');
    this.dueDateValue = page.getByTestId('task-duedate-value');
    this.saveButton = page.getByTestId('task-save-button');
    this.currentStatus = page.getByTestId('task-current-status');
    this.alert = page.getByRole('alert');
    this.tagsSection = page.getByTestId('task-tags-section');
    this.tagsAlert = this.tagsSection.getByRole('alert');
    this.tagInput = page.getByTestId('tag-add-input');
    this.tagAddButton = page.getByTestId('tag-add-button');
    this.tagChips = page.getByTestId('tag-chip');
    this.tagChipNames = page.getByTestId('tag-chip-name');
    this.commentInput = page.getByTestId('comment-add-input');
  }

  async goto(projectId: string) {
    await Promise.all([
      this.page.waitForResponse(r => new URL(r.url()).pathname === `/api/tasks/${this.taskId}` && r.request().method() === 'GET'),
      this.page.goto(`/projects/${projectId}/tasks/${this.taskId}`),
    ]);
  }

  /** Opción del select de asignado; useMembers la carga con otra solicitud. */
  assigneeOption(userId: string): Locator {
    return this.assigneeSelect.locator(`option[value="${userId}"]`);
  }

  tagChip(name: string): Locator {
    return this.tagChips.filter({ has: this.tagChipNames.and(this.page.getByText(name, { exact: true })) });
  }

  async save(): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(r => new URL(r.url()).pathname === `/api/tasks/${this.taskId}` && r.request().method() === 'PATCH'),
      this.saveButton.click(),
    ]);
    await response.finished();
    await expect(this.saveButton).toBeEnabled();
    return response;
  }

  async addTag(name: string): Promise<Response> {
    await this.tagInput.fill(name);
    const [response] = await Promise.all([
      this.page.waitForResponse(r => new URL(r.url()).pathname === `/api/tasks/${this.taskId}/tags` && r.request().method() === 'POST'),
      this.tagAddButton.click(),
    ]);
    await response.finished();
    if (response.ok()) {
      // Tras agregar, la pantalla recarga la tarea; se espera a que vuelva el formulario.
      await expect(this.titleInput).toBeVisible();
      await expect(this.tagInput).toHaveValue('');
    }
    return response;
  }

  async removeTag(tag: { id: string; name: string }): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(r => new URL(r.url()).pathname === `/api/tasks/${this.taskId}/tags/${tag.id}` && r.request().method() === 'DELETE'),
      this.tagChip(tag.name).getByTestId('tag-remove-button').click(),
    ]);
    return response;
  }
}
