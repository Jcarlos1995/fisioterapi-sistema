import { getCancellationEligibility } from '../utils/cancellation';

describe('getCancellationEligibility', () => {
  const now = new Date('2026-04-26T10:00:00').getTime();

  it('cita con status Efectuada no es cancelable', () => {
    const result = getCancellationEligibility('Efectuada', '2026-04-27', '12:00', now);
    expect(result.cancelable).toBe(false);
  });

  it('cita con status Pagada no es cancelable', () => {
    const result = getCancellationEligibility('Pagada', '2026-04-27', '12:00', now);
    expect(result.cancelable).toBe(false);
  });

  it('cita con status Cancelada no es cancelable', () => {
    const result = getCancellationEligibility('Cancelada', '2026-04-27', '12:00', now);
    expect(result.cancelable).toBe(false);
  });

  it('cita pasada no es cancelable', () => {
    const result = getCancellationEligibility('Programada', '2026-04-25', '08:00', now);
    expect(result.cancelable).toBe(false);
    expect(result.message).toMatch(/futuras/i);
  });

  it('cita futura con menos de 2h no es cancelable', () => {
    const result = getCancellationEligibility('Confirmada', '2026-04-26', '11:30', now);
    expect(result.cancelable).toBe(false);
    expect(result.message).toMatch(/2 horas/i);
  });

  it('cita futura con más de 2h es cancelable', () => {
    const result = getCancellationEligibility('Programada', '2026-04-26', '13:00', now);
    expect(result.cancelable).toBe(true);
  });
});
