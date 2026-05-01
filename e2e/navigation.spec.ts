import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('Navegación del panel interno', () => {
  test.beforeEach(async ({ page }) => {
    const noCredentials = await loginAsTestUser(page);
    test.skip(noCredentials, 'Requiere E2E_TEST_EMAIL y E2E_TEST_PASSWORD');
  });

  // ── Dashboard ────────────────────────────────────────────────────────────────
  test('Dashboard muestra "Panel de Control" y los links del sidebar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Panel de Control' })).toBeVisible();
    // Los links del sidebar deben estar siempre presentes (sidebar arranca expandido)
    await expect(page.getByRole('link', { name: 'Pacientes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sesiones' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Profesionales' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Productos' })).toBeVisible();
  });

  // ── Pacientes ────────────────────────────────────────────────────────────────
  test('navega a Pacientes y carga la lista', async ({ page }) => {
    await page.getByRole('link', { name: 'Pacientes' }).click();
    await page.waitForURL(/#\/patients/);
    // El heading aparece cuando Firestore termina de cargar (sustituye al skeleton)
    await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible({ timeout: 15_000 });
  });

  // ── Sesiones ─────────────────────────────────────────────────────────────────
  test('navega a Sesiones y muestra la agenda', async ({ page }) => {
    await page.getByRole('link', { name: 'Sesiones' }).click();
    await page.waitForURL(/#\/sessions/);
    await expect(page.getByRole('heading', { name: 'Agenda de Sesiones' })).toBeVisible({ timeout: 15_000 });
  });

  // ── Profesionales ─────────────────────────────────────────────────────────────
  test('navega a Profesionales y muestra el equipo', async ({ page }) => {
    await page.getByRole('link', { name: 'Profesionales' }).click();
    await page.waitForURL(/#\/professionals/);
    await expect(page.getByRole('heading', { name: 'Equipo Profesional' })).toBeVisible({ timeout: 15_000 });
  });

  // ── Productos / Inventario ───────────────────────────────────────────────────
  test('navega a Productos y muestra el inventario', async ({ page }) => {
    await page.getByRole('link', { name: 'Productos' }).click();
    await page.waitForURL(/#\/products/);
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible({ timeout: 15_000 });
  });

  // ── Historias ────────────────────────────────────────────────────────────────
  test('navega a Historias y muestra los testimonios', async ({ page }) => {
    await page.getByRole('link', { name: 'Historias' }).click();
    await page.waitForURL(/#\/stories/);
    await expect(page.getByRole('heading', { name: 'Historias que Inspiran' })).toBeVisible({ timeout: 15_000 });
  });

  // ── Terapia Diaria ───────────────────────────────────────────────────────────
  test('navega a Terapia Diaria y muestra la vista', async ({ page }) => {
    await page.getByRole('link', { name: 'Terapia Diaria' }).click();
    await page.waitForURL(/#\/daily-therapy/);
    await expect(page.getByRole('heading', { name: 'Terapia Diaria' })).toBeVisible({ timeout: 15_000 });
  });

  // ── Logout ───────────────────────────────────────────────────────────────────
  test('cierra sesión y vuelve al formulario de login', async ({ page }) => {
    // El botón tiene texto visible cuando el sidebar está expandido (default)
    await page.getByRole('button', { name: /cerrar sesión/i }).click();
    await expect(
      page.getByPlaceholder('profesional@fisioterapi.com')
    ).toBeVisible({ timeout: 15_000 });
  });
});
