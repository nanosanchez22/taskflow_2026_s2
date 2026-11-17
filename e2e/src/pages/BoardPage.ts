import { Locator, Page } from '@playwright/test';
import { TaskCard, TaskStatus } from '../components/TaskCard';

/**
 * Tablero de un proyecto (`/projects/:projectId`): formulario de alta, filtros y una
 * columna por estado. Cada tarjeta se expone como un TaskCard.
 */
export class BoardPage {
  readonly cards: Locator;
  readonly createAssigneeSelect: Locator;

  constructor(readonly page: Page) {
    this.cards = page.getByTestId('task-card');
    this.createAssigneeSelect = page.getByTestId('task-create-assignee-select');
  }

  /** Opción del select de asignado del alta; useMembers la carga con otra solicitud. */
  createAssigneeOption(userId: string): Locator {
    return this.createAssigneeSelect.locator(`option[value="${userId}"]`);
  }

  /** Tarjetas de una columna, para contarlas con toHaveCount. */
  cardsIn(status: TaskStatus): Locator {
    return this.page.getByTestId(`board-column-list-${status}`).getByTestId('task-card');
  }

  cardByTitle(title: string): TaskCard {
    return new TaskCard(this.cards.filter({
      has: this.page.getByTestId('task-card-title').and(this.page.getByText(title, { exact: true })),
    }));
  }

  /** La tarjeta no tiene un testid con el id: se identifica por el enlace de su título. */
  cardById(taskId: string): TaskCard {
    return new TaskCard(this.cards.filter({
      has: this.page.getByTestId('task-card-title').and(this.page.locator(`[href$="/tasks/${taskId}"]`)),
    }));
  }
}
