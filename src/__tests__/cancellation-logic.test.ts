import { getCancellationEligibility } from '../utils/cancellation';

/**
 * La función getCancellationEligibility parsea fecha+hora con offset Lima (UTC-5).
 * Los helpers construyen strings en hora Lima a partir de un timestamp UTC,
 * así el diff calculado internamente coincide exactamente con lo esperado.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5

/** Convierte un timestamp UTC a { dateStr, timeStr } en hora Lima */
function toLima(utcMs: number): { dateStr: string; timeStr: string } {
  const d = new Date(utcMs + LIMA_OFFSET_MS); // desplazar a Lima
  return {
    dateStr: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    timeStr: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

describe('getCancellationEligibility', () => {
  const now = Date.now();

  const tomorrow    = toLima(now + 24 * 60 * 60 * 1000); // mañana en Lima
  const yesterday   = toLima(now - 24 * 60 * 60 * 1000); // ayer en Lima
  const in30min     = toLima(now + 30 * 60 * 1000);      // 30 min desde ahora → < 2h
  const in3hours    = toLima(now +  3 * 60 * 60 * 1000); // 3 h desde ahora  → > 2h

  it('cita con status Efectuada no es cancelable', () => {
    const result = getCancellationEligibility('Efectuada', tomorrow.dateStr, tomorrow.timeStr, now);
    expect(result.cancelable).toBe(false);
  });

  it('cita con status Pagada no es cancelable', () => {
    const result = getCancellationEligibility('Pagada', tomorrow.dateStr, tomorrow.timeStr, now);
    expect(result.cancelable).toBe(false);
  });

  it('cita con status Cancelada no es cancelable', () => {
    const result = getCancellationEligibility('Cancelada', tomorrow.dateStr, tomorrow.timeStr, now);
    expect(result.cancelable).toBe(false);
  });

  it('cita pasada no es cancelable', () => {
    const result = getCancellationEligibility('Programada', yesterday.dateStr, yesterday.timeStr, now);
    expect(result.cancelable).toBe(false);
    expect(result.message).toMatch(/futuras/i);
  });

  it('cita futura con menos de 2h no es cancelable', () => {
    const result = getCancellationEligibility('Confirmada', in30min.dateStr, in30min.timeStr, now);
    expect(result.cancelable).toBe(false);
    expect(result.message).toMatch(/2 horas/i);
  });

  it('cita futura con más de 2h es cancelable', () => {
    const result = getCancellationEligibility('Programada', in3hours.dateStr, in3hours.timeStr, now);
    expect(result.cancelable).toBe(true);
  });
});
