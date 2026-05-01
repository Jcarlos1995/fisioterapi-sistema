import { test, expect } from '@playwright/test';

test.describe('Portal de Reservas (público, sin login)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/agendar');
  });

  test('carga el portal de reservas correctamente', async ({ page }) => {
    // El título o encabezado del portal debe estar visible
    await expect(
      page.getByText(/reserva|cita|fisioterapi/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('muestra el calendario de FullCalendar', async ({ page }) => {
    // FullCalendar siempre renderiza un elemento con clase .fc
    await expect(page.locator('.fc')).toBeVisible({ timeout: 15_000 });
  });

  test('muestra el botón de retroceso hacia la landing', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /volver/i })
        .or(page.getByText(/volver/i).first())
    ).toBeVisible({ timeout: 10_000 });
  });

  test('no es accesible el panel interno sin login', async ({ page }) => {
    // Navegar a ruta protegida debe mostrar el login, no el panel
    await page.goto('/');
    await expect(page.getByPlaceholder('profesional@fisioterapi.com')).toBeVisible({ timeout: 10_000 });
    // NO debe mostrar el sidebar del panel
    await expect(page.getByText('Panel de Control')).not.toBeVisible();
  });
});
