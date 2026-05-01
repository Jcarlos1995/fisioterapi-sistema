import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  });

  test('muestra el formulario de login al entrar sin sesión', async ({ page }) => {
    await expect(page.getByText('Fisioterapi Chepén').first()).toBeVisible();
    await expect(page.getByPlaceholder('profesional@fisioterapi.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /acceder al sistema/i })).toBeVisible();
  });

  test('muestra error con credenciales incorrectas', async ({ page }) => {
    await page.getByPlaceholder('profesional@fisioterapi.com').fill('noexiste@test.com');
    await page.getByPlaceholder('••••••••').fill('contraseñamala999');
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    await expect(
      page.getByText(/contraseña incorrecta|no existe una cuenta|error al iniciar/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test('el botón muestra "Verificando..." mientras procesa', async ({ page }) => {
    await page.getByPlaceholder('profesional@fisioterapi.com').fill('test@test.com');
    await page.getByPlaceholder('••••••••').fill('cualquiercosa');
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    // El botón se deshabilita y cambia texto mientras procesa
    await expect(page.getByRole('button', { name: /verificando/i })).toBeVisible({ timeout: 5_000 });
  });

  test('login exitoso redirige al Dashboard', async ({ page }) => {
    const email    = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, 'Requiere E2E_TEST_EMAIL y E2E_TEST_PASSWORD como variables de entorno');

    await page.getByPlaceholder('profesional@fisioterapi.com').fill(email!);
    await page.getByPlaceholder('••••••••').fill(password!);
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    await expect(page.getByText('Panel de Control')).toBeVisible({ timeout: 20_000 });
  });
});
