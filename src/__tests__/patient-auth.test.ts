import { validateBirthDate, validateDni } from '../shared/utils/validation';

// ─── validateDni ──────────────────────────────────────────────────────────────
describe('validateDni', () => {
  it('DNI vacío falla', () => {
    const r = validateDni('');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/obligatorio/i);
  });

  it('DNI con solo espacios falla', () => {
    expect(validateDni('        ').valid).toBe(false);
  });

  it('DNI con 7 dígitos falla', () => {
    const r = validateDni('1234567');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/8 dígitos/i);
  });

  it('DNI con 9 dígitos falla', () => {
    expect(validateDni('123456789').valid).toBe(false);
  });

  it('DNI con letras falla', () => {
    expect(validateDni('1234ABCD').valid).toBe(false);
  });

  it('DNI con guión falla', () => {
    expect(validateDni('1234-678').valid).toBe(false);
  });

  it('DNI con punto falla', () => {
    expect(validateDni('1234.678').valid).toBe(false);
  });

  it('DNI exactamente de 8 dígitos pasa', () => {
    const r = validateDni('12345678');
    expect(r.valid).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it('DNI con ceros válido pasa', () => {
    expect(validateDni('00000001').valid).toBe(true);
  });

  it('DNI con espacios alrededor se limpia y valida', () => {
    expect(validateDni('  12345678  ').valid).toBe(true);
  });
});

// ─── validateBirthDate ────────────────────────────────────────────────────────
describe('validateBirthDate', () => {
  it('fecha vacía falla', () => {
    const r = validateBirthDate('');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/obligatori/i);
  });

  it('formato DD/MM/YYYY falla', () => {
    expect(validateBirthDate('20/03/1990').valid).toBe(false);
  });

  it('formato MM-DD-YYYY falla', () => {
    expect(validateBirthDate('03-20-1990').valid).toBe(false);
  });

  it('fecha inválida del calendario falla (mes 13)', () => {
    expect(validateBirthDate('1990-13-01').valid).toBe(false);
  });

  it('fecha futura falla', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Usar fecha local (no UTC) para evitar desfases de zona horaria
    const iso = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-');
    const r = validateBirthDate(iso);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/futura/i);
  });

  it('fecha de más de 120 años falla', () => {
    expect(validateBirthDate('1900-01-01').valid).toBe(false);
  });

  it('fecha de nacimiento válida pasa', () => {
    expect(validateBirthDate('1990-03-20').valid).toBe(true);
  });

  it('fecha de ayer pasa', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const iso = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, '0'),
      String(yesterday.getDate()).padStart(2, '0'),
    ].join('-');
    expect(validateBirthDate(iso).valid).toBe(true);
  });

  it('fecha de hace exactamente 100 años pasa', () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 100);
    const iso = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
    expect(validateBirthDate(iso).valid).toBe(true);
  });
});
