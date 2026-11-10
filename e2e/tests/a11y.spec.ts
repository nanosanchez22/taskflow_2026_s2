import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/fixtures';

/**
 * Adaptado del test de la clase 12 a la estructura de este repositorio.
 * Ejecutar: npx playwright test a11y --project=chromium
 *
 * Playwright levanta la API y el cliente con una base aislada. La fixture
 * scenario crea los usuarios, el proyecto y la tarea de cada caso.
 * El registro se abre desde el botón de /login; no existe /register.
 */

const TAGS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const VERIFICAR = {
  regla: 'label',
  vistas: ['Detalle de tarea'],
};

type DatosAuditoria = {
  owner: { user: { id: string; email: string } };
  project: { id: string };
  task: { id: string; title: string };
};

async function iniciarSesion(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email-input').fill(email);
  await page.getByTestId('login-password-input').fill('Password1');
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/projects');
  await expect(page.getByTestId('project-card-name')).toBeVisible();
}

const VISTAS: {
  nombre: string;
  abrir: (page: Page, datos: DatosAuditoria) => Promise<void>;
}[] = [
  {
    nombre: 'Login',
    abrir: async (page) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
    },
  },
  {
    nombre: 'Registro',
    abrir: async (page) => {
      await page.goto('/login');
      await page.getByTestId('login-mode-toggle').click();
      await expect(page.getByRole('heading', { name: 'Crear cuenta', exact: true })).toBeVisible();
      await expect(page.getByTestId('login-name-input')).toBeVisible();
    },
  },
  {
    nombre: 'Proyectos',
    abrir: async (page, datos) => {
      await iniciarSesion(page, datos.owner.user.email);
    },
  },
  {
    nombre: 'Detalle de proyecto',
    abrir: async (page, datos) => {
      await iniciarSesion(page, datos.owner.user.email);
      await page.getByTestId('project-card-name').click();
      await expect(page).toHaveURL(`/projects/${datos.project.id}`);
      await expect(page.getByTestId('task-card-title')).toHaveText(datos.task.title);
      await expect(page.getByTestId('task-create-assignee-select')
        .locator(`option[value="${datos.owner.user.id}"]`)).toHaveCount(1);
    },
  },
  // Esta pantalla se recorre también durante la prueba de XSS de la guía.
  // Contiene los campos que se verifican con la regla label.
  {
    nombre: 'Detalle de tarea',
    abrir: async (page, datos) => {
      await iniciarSesion(page, datos.owner.user.email);
      await page.goto(`/projects/${datos.project.id}/tasks/${datos.task.id}`);
      await expect(page.getByTestId('task-title-input')).toHaveValue(datos.task.title);
      await expect(page.getByTestId('task-assignee-select')
        .locator(`option[value="${datos.owner.user.id}"]`)).toHaveCount(1);
      await expect(page.getByTestId('comment-add-input')).toBeVisible();
    },
  },
];

/** 'wcag143' -> '1.4.3'; 'wcag2410' -> '2.4.10'. */
function tagASc(tag: string): string | null {
  const m = /^wcag(\d)(\d)(\d{1,2})$/.exec(tag);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

function nivel(tags: string[]): string {
  return tags.some((t) => t.endsWith('aa')) ? 'AA' : 'A';
}

async function auditar(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS_WCAG).analyze();
  return violations;
}

// El informe no falla por violaciones; sí falla si no logra abrir o analizar la vista.
test.describe('Informe de accesibilidad WCAG 2.1 AA', () => {
  for (const vista of VISTAS) {
    test(`${vista.nombre}: informe de violaciones`, async ({ page, scenario }, testInfo) => {
      await vista.abrir(page, scenario);
      const violations = await auditar(page);

      console.log(`\n=== ${vista.nombre}: ${violations.length} regla(s) violada(s) ===`);
      for (const v of violations) {
        const sc = v.tags.map(tagASc).filter(Boolean).join(', ');
        console.log(`\n[${(v.impact ?? 'n/a').toUpperCase()}] ${v.id} — ${v.help}`);
        console.log(`   SC WCAG: ${sc || 'n/a'} · Nivel ${nivel(v.tags)}`);
        console.log(`   Elementos afectados: ${v.nodes.length}`);
        v.nodes.slice(0, 3).forEach((n) => console.log(`   · ${n.target.join(' ')}`));
        console.log(`   Más info: ${v.helpUrl}`);
      }

      await testInfo.attach(`axe-${vista.nombre}.json`, {
        body: JSON.stringify(violations, null, 2),
        contentType: 'application/json',
      });
    });
  }
});

test.describe('Verificación de la corrección', () => {
  for (const vista of VISTAS.filter((v) => VERIFICAR.vistas.includes(v.nombre))) {
    test(`${vista.nombre}: ya no hay violaciones de "${VERIFICAR.regla}"`, async ({ page, scenario }) => {
      await vista.abrir(page, scenario);
      const violations = await auditar(page);
      expect(violations.map((v) => v.id)).not.toContain(VERIFICAR.regla);
    });
  }
});
