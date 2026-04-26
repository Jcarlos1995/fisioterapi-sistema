import { validateBirthDate, validateDni } from '../utils/validation';

describe('validateDni', () => {
  it('DNI vacío falla', () => {
    expect(validateDni('').valid).toBe(false);
  });

  it('DNI con menos de 8 dígitos falla', () => {
    expect(validateDni('1234567').valid).toBe(false);
  });

  it('DNI con más de 8 dígitos falla', () => {
    expect(validateDni('123456789').valid).toBe(false);
  });

  it('DNI con letras falla', () => {
    expect(validateDni('1234ABCD').valid).toBe(false);
  });

  it('DNI válido pasa', () => {
    expect(validateDni('12345678').valid).toBe(true);
  });
});

describe('validateBirthDate', () => {
  it('DNI válido + fecha vacía falla', () => {
    expect(validateDni('12345678').valid).toBe(true);
    expect(validateBirthDate('').valid).toBe(false);
  });

  it('DNI válido + fecha con formato malo falla', () => {
    expect(validateDni('12345678').valid).toBe(true);
    expect(validateBirthDate('20/03/1990').valid).toBe(false);
  });

  it('caso completo válido pasa', () => {
    expect(validateDni('12345678').valid).toBe(true);
    expect(validateBirthDate('1990-03-20').valid).toBe(true);
  });
});
