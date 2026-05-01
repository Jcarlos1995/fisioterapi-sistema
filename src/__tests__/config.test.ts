import {
  LANDING_URL,
  BOOKING_URL,
  PORTAL_URL,
  SISTEMA_URL,
  WHATSAPP_URL,
} from '../config';

// Garantiza que los cambios de URL no rompan silenciosamente los enlaces
// entre la landing, el sistema y el portal de reservas.

describe('URLs de configuración del sistema', () => {
  it('todas las URLs comienzan con https://', () => {
    [LANDING_URL, BOOKING_URL, PORTAL_URL, SISTEMA_URL, WHATSAPP_URL].forEach(url => {
      expect(url.startsWith('https://')).toBe(true);
    });
  });

  it('LANDING_URL apunta al dominio principal de la clínica', () => {
    expect(LANDING_URL).toContain('www.fisioterapichepen.com');
  });

  it('BOOKING_URL apunta al subdominio del sistema', () => {
    expect(BOOKING_URL).toContain('sistema.fisioterapichepen.com');
  });

  it('BOOKING_URL incluye la ruta de agendamiento (#/agendar)', () => {
    expect(BOOKING_URL).toContain('#/agendar');
  });

  it('PORTAL_URL apunta al subdominio del sistema', () => {
    expect(PORTAL_URL).toContain('sistema.fisioterapichepen.com');
  });

  it('PORTAL_URL incluye la ruta del portal (#/portal)', () => {
    expect(PORTAL_URL).toContain('#/portal');
  });

  it('SISTEMA_URL apunta al subdominio del sistema', () => {
    expect(SISTEMA_URL).toContain('sistema.fisioterapichepen.com');
  });

  it('WHATSAPP_URL incluye el número de la clínica', () => {
    expect(WHATSAPP_URL).toContain('51926798464');
  });

  it('WHATSAPP_URL es un enlace válido de wa.me', () => {
    expect(WHATSAPP_URL).toContain('wa.me');
  });

  it('BOOKING_URL y PORTAL_URL son URLs distintas', () => {
    expect(BOOKING_URL).not.toBe(PORTAL_URL);
  });

  it('LANDING_URL y SISTEMA_URL son URLs distintas (proyectos separados)', () => {
    expect(LANDING_URL).not.toBe(SISTEMA_URL);
  });
});
