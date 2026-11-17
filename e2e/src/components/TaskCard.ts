import { expect, Locator, Response } from '@playwright/test';
import { TaskDetailPage } from '../pages/TaskDetailPage';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

/**
 * Tarjeta de tarea del tablero (Component Object). BoardPage.tsx la repite en las
 * columnas TODO, IN_PROGRESS y DONE; los locators se buscan dentro de `root` para
 * no mezclar datos de dos tarjetas.
 */
export class TaskCard {
  readonly title: Locator;
  readonly priority: Locator;
  readonly assignee: Locator;
  readonly dueDate: Locator;
  readonly commentCount: Locator;
  readonly statusSelect: Locator;

  constructor(readonly root: Locator) {
    this.title = root.getByTestId('task-card-title');
    this.priority = root.getByTestId('task-card-priority');
    this.assignee = root.getByTestId('task-card-assignee');
    this.dueDate = root.getByTestId('task-card-duedate');
    this.commentCount = root.getByTestId('task-card-comment-count');
    this.statusSelect = root.getByTestId('task-card-status-select');
  }

  /** La tarjeta no tiene un testid con el id; se toma del enlace al detalle. */
  async taskId(): Promise<string> {
    const href = await this.title.getAttribute('href');
    const id = href?.split('/tasks/')[1];
    if (!id) throw new Error(`La tarjeta no enlaza a una tarea: ${href}`);
    return id;
  }

  async open(): Promise<TaskDetailPage> {
    const taskId = await this.taskId();
    const page = this.root.page();
    await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === `/api/tasks/${taskId}` && r.request().method() === 'GET'),
      this.title.click(),
    ]);
    return new TaskDetailPage(page, taskId);
  }

  async changeStatus(status: TaskStatus): Promise<Response> {
    const taskId = await this.taskId();
    const [response] = await Promise.all([
      this.root.page().waitForResponse(r => new URL(r.url()).pathname === `/api/tasks/${taskId}` && r.request().method() === 'PATCH'),
      this.statusSelect.selectOption(status),
    ]);
    await response.finished();
    // El select es controlado: muestra el estado nuevo recién cuando el tablero recarga la lista.
    if (response.ok()) await expect(this.statusSelect).toHaveValue(status);
    return response;
  }
}
