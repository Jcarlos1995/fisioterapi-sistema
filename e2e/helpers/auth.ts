import { Page } from '@playwright/test';

/**
 * Inicia sesión con las credenciales de prueba.
 * Retorna `true` si las credenciales no están disponibles (el test debe saltarse).
 */
export async function loginAsTestUser(page: Page): Promise<boolean> {
  const email    = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) return true; // sin credenciales → skip

  await page.goto('/');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });

  await page.getByPlaceholder('profesional@fisioterapi.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /acceder al sistema/i }).click();

  // Espera a que aparezca el dashboard
  await page.getByText('Panel de Control').waitFor({ timeout: 20_000 });
  return false;
}
