import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('Navegación del panel interno', () => {
  test.beforeEach(async ({ page }) => {
    const noCredentials = await loginAsTestUser(page);
    test.skip(noCredentials, 'Requiere E2E_TEST_EMAIL y E2E_TEST_PASSWORD');
  });

  test('Dashboard muestra "Panel de Control" y tarjetas de stats', async ({ page }) => {
    await expect(page.getByText('Panel de Control')).toBeVisible();
    await expect(page.getByText('Pacientes')).toBeVisible();
    await expect(page.getByText('Profesionales')).toBeVisible();
  });

  test('navega a Pacientes y muestra la lista', async ({ page }) => {
    await page.getByRole('link', { name: /pacientes/i }).first().click();
    await expect(page.getByText('Pacientes').first()).toBeVisible({ timeout: 10_000 });
  });

  test('navega a Sesiones y muestra la agenda', async ({ page }) => {
    await page.getByRole('link', { name: /sesiones/i }).first().click();
    await expect(page.getByText('Agenda de Sesiones')).toBeVisible({ timeout: 10_000 });
  });

  test('navega a Profesionales y muestra el equipo', async ({ page }) => {
    await page.getByRole('link', { name: /profesionales/i }).first().click();
    await expect(page.getByText('Equipo Profesional')).toBeVisible({ timeout: 10_000 });
  });

  test('navega a Inventario y muestra productos', async ({ page }) => {
    await page.getByRole('link', { name: /productos/i }).first().click();
    await expect(page.getByText('Inventario')).toBeVisible({ timeout: 10_000 });
  });

  test('cierra sesión y redirige fuera del panel', async ({ page }) => {
    await page.getByRole('button', { name: /cerrar sesión/i }).click();
    // Tras logout redirige a la landing o muestra el login
    await expect(
      page.getByPlaceholder('profesional@fisioterapi.com')
        .or(page.getByText(/fisioterapichepen\.com|fisioterapi chepén/i).first())
    ).toBeVisible({ timeout: 15_000 });
  });
});
