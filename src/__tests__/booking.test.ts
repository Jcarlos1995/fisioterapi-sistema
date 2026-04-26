// Tests para la lógica de validación del booking (sin Firebase)

const REQUIRED_FIELDS = ['name', 'phone', 'email', 'dni', 'startStr'] as const;

type BookingInput = {
  name:     string;
  phone:    string;
  email:    string;
  dni:      string;
  age:      string;
  startStr: string;
  endStr:   string;
};

function validateBookingInput(input: Partial<BookingInput>): string | null {
  for (const field of REQUIRED_FIELDS) {
    if (!input[field]?.trim()) return `El campo '${field}' es obligatorio.`;
  }
  return null;
}

describe('validateBookingInput', () => {
  const valid: BookingInput = {
    name: 'Juan Pérez', phone: '987654321', email: 'juan@test.com',
    dni: '12345678', age: '35', startStr: '2026-04-20T09:00:00', endStr: '2026-04-20T10:00:00',
  };

  it('acepta datos completos', () => {
    expect(validateBookingInput(valid)).toBeNull();
  });

  it('rechaza nombre vacío', () => {
    expect(validateBookingInput({ ...valid, name: '' })).toMatch(/name/);
  });

  it('rechaza email vacío', () => {
    expect(validateBookingInput({ ...valid, email: '' })).toMatch(/email/);
  });

  it('rechaza DNI vacío', () => {
    expect(validateBookingInput({ ...valid, dni: '' })).toMatch(/dni/);
  });

  it('rechaza sin fecha de inicio', () => {
    expect(validateBookingInput({ ...valid, startStr: '' })).toMatch(/startStr/);
  });

  it('rechaza input completamente vacío', () => {
    expect(validateBookingInput({})).not.toBeNull();
  });
});
