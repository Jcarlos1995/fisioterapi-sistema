// Tests de lógica pura extraída de BookingSystem.tsx (sin Firebase ni React)

// ─── Implementaciones bajo prueba ────────────────────────────────────────────
// Copia exacta de slotKey en BookingSystem.tsx
function slotKey(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const minutes = d.getMinutes();
    d.setMinutes(minutes < 30 ? 0 : 30, 0, 0);
    return d.toISOString();
  } catch {
    return iso;
  }
}

type BookedSlot = { start: string; end: string; therapyType: string };

function buildOccupancyMap(bookedSlots: BookedSlot[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  bookedSlots.forEach(s => {
    const key = slotKey(s.start);
    if (!map.has(key)) map.set(key, new Set());
    if (s.therapyType) map.get(key)!.add(s.therapyType);
  });
  return map;
}

const THERAPY_OPTIONS = [
  'Fisioterapia',
  'Quiropraxia',
  'Rehabilitación Post-Operatoria',
  'Masaje Terapéutico',
  'Terapia Deportiva',
];

function handleSelectAllow(
  startStr: string,
  occupancyMap: Map<string, Set<string>>,
  now: number,
): boolean {
  const startTime = new Date(startStr).getTime();
  if (startTime <= now) return false;
  const key   = slotKey(startStr);
  const taken = occupancyMap.get(key)?.size ?? 0;
  return taken < THERAPY_OPTIONS.length;
}

// ─── slotKey ─────────────────────────────────────────────────────────────────
describe('slotKey', () => {
  it('deja intactos los minutos ya en :00', () => {
    const iso = '2026-04-26T09:00:00.000Z';
    expect(slotKey(iso)).toBe('2026-04-26T09:00:00.000Z');
  });

  it('deja intactos los minutos ya en :30', () => {
    const iso = '2026-04-26T09:30:00.000Z';
    expect(slotKey(iso)).toBe('2026-04-26T09:30:00.000Z');
  });

  it('redondea :15 hacia abajo a :00', () => {
    const iso = '2026-04-26T09:15:00.000Z';
    expect(slotKey(iso)).toBe('2026-04-26T09:00:00.000Z');
  });

  it('redondea :45 hacia abajo a :30', () => {
    const iso = '2026-04-26T09:45:00.000Z';
    expect(slotKey(iso)).toBe('2026-04-26T09:30:00.000Z');
  });

  it('redondea :29 hacia abajo a :00', () => {
    const iso = '2026-04-26T14:29:59.000Z';
    expect(slotKey(iso)).toBe('2026-04-26T14:00:00.000Z');
  });

  it('redondea :59 hacia abajo a :30', () => {
    const iso = '2026-04-26T14:59:59.000Z';
    expect(slotKey(iso)).toBe('2026-04-26T14:30:00.000Z');
  });

  it('pone segundos y milisegundos a cero', () => {
    const result = slotKey('2026-04-26T10:12:45.321Z');
    expect(result.endsWith('00.000Z')).toBe(true);
  });

  it('devuelve la cadena original cuando la fecha es inválida', () => {
    expect(slotKey('no-es-fecha')).toBe('no-es-fecha');
  });

  it('devuelve la cadena original para string vacío', () => {
    expect(slotKey('')).toBe('');
  });

  it('dos fechas en el mismo slot de 30 min producen la misma clave', () => {
    expect(slotKey('2026-04-26T08:05:00.000Z')).toBe(
      slotKey('2026-04-26T08:22:00.000Z'),
    );
  });

  it('fechas en distintos slots de 30 min producen claves distintas', () => {
    expect(slotKey('2026-04-26T08:00:00.000Z')).not.toBe(
      slotKey('2026-04-26T08:30:00.000Z'),
    );
  });
});

// ─── buildOccupancyMap ────────────────────────────────────────────────────────
describe('buildOccupancyMap', () => {
  it('devuelve un mapa vacío con array vacío', () => {
    expect(buildOccupancyMap([])).toEqual(new Map());
  });

  it('crea una entrada con un servicio para un slot', () => {
    const map = buildOccupancyMap([
      { start: '2026-04-26T09:00:00.000Z', end: '2026-04-26T09:30:00.000Z', therapyType: 'Fisioterapia' },
    ]);
    const key = slotKey('2026-04-26T09:00:00.000Z');
    expect(map.get(key)?.has('Fisioterapia')).toBe(true);
    expect(map.get(key)?.size).toBe(1);
  });

  it('agrupa dos reservas del mismo slot bajo la misma clave', () => {
    const slots: BookedSlot[] = [
      { start: '2026-04-26T09:00:00.000Z', end: '2026-04-26T09:30:00.000Z', therapyType: 'Fisioterapia' },
      { start: '2026-04-26T09:10:00.000Z', end: '2026-04-26T09:40:00.000Z', therapyType: 'Quiropraxia' },
    ];
    const map = buildOccupancyMap(slots);
    const key = slotKey('2026-04-26T09:00:00.000Z');
    expect(map.size).toBe(1);
    expect(map.get(key)?.size).toBe(2);
    expect(map.get(key)?.has('Quiropraxia')).toBe(true);
  });

  it('crea entradas distintas para slots en distintos horarios', () => {
    const slots: BookedSlot[] = [
      { start: '2026-04-26T09:00:00.000Z', end: '2026-04-26T09:30:00.000Z', therapyType: 'Fisioterapia' },
      { start: '2026-04-26T09:30:00.000Z', end: '2026-04-26T10:00:00.000Z', therapyType: 'Quiropraxia' },
    ];
    const map = buildOccupancyMap(slots);
    expect(map.size).toBe(2);
  });

  it('normaliza inicio con minutos intermedios al slot correcto', () => {
    const slots: BookedSlot[] = [
      { start: '2026-04-26T09:15:00.000Z', end: '2026-04-26T09:45:00.000Z', therapyType: 'Masaje Terapéutico' },
    ];
    const map = buildOccupancyMap(slots);
    const key = slotKey('2026-04-26T09:00:00.000Z');
    expect(map.get(key)?.has('Masaje Terapéutico')).toBe(true);
  });

  it('no añade el servicio si therapyType es cadena vacía', () => {
    const map = buildOccupancyMap([
      { start: '2026-04-26T09:00:00.000Z', end: '2026-04-26T09:30:00.000Z', therapyType: '' },
    ]);
    const key = slotKey('2026-04-26T09:00:00.000Z');
    expect(map.get(key)?.size).toBe(0);
  });

  it('un slot con los 5 servicios tiene size === 5', () => {
    const iso = '2026-04-26T10:00:00.000Z';
    const slots: BookedSlot[] = THERAPY_OPTIONS.map(t => ({
      start: iso, end: '2026-04-26T10:30:00.000Z', therapyType: t,
    }));
    const map = buildOccupancyMap(slots);
    const key = slotKey(iso);
    expect(map.get(key)?.size).toBe(5);
  });

  it('duplicados del mismo servicio en el mismo slot no aumentan el size', () => {
    const iso = '2026-04-26T10:00:00.000Z';
    const slots: BookedSlot[] = [
      { start: iso, end: '', therapyType: 'Fisioterapia' },
      { start: iso, end: '', therapyType: 'Fisioterapia' },
    ];
    const map = buildOccupancyMap(slots);
    expect(map.get(slotKey(iso))?.size).toBe(1);
  });
});

// ─── handleSelectAllow ────────────────────────────────────────────────────────
describe('handleSelectAllow', () => {
  const FUTURE = new Date('2099-01-01T10:00:00.000Z').getTime();
  const NOW    = new Date('2026-04-26T12:00:00.000Z').getTime();
  const PAST   = new Date('2020-01-01T10:00:00.000Z').toISOString();

  it('bloquea un slot cuyo inicio ya pasó', () => {
    expect(handleSelectAllow(PAST, new Map(), NOW)).toBe(false);
  });

  it('bloquea un slot que coincide exactamente con "ahora"', () => {
    const isoNow = new Date(NOW).toISOString();
    expect(handleSelectAllow(isoNow, new Map(), NOW)).toBe(false);
  });

  it('permite un slot futuro con mapa vacío', () => {
    const isoFuture = new Date(FUTURE).toISOString();
    expect(handleSelectAllow(isoFuture, new Map(), NOW)).toBe(true);
  });

  it('permite un slot futuro con 1 servicio ocupado', () => {
    const isoFuture = new Date(FUTURE).toISOString();
    const map = buildOccupancyMap([
      { start: isoFuture, end: '', therapyType: 'Fisioterapia' },
    ]);
    expect(handleSelectAllow(isoFuture, map, NOW)).toBe(true);
  });

  it('permite un slot futuro con 4 servicios ocupados', () => {
    const isoFuture = new Date(FUTURE).toISOString();
    const slots: BookedSlot[] = THERAPY_OPTIONS.slice(0, 4).map(t => ({
      start: isoFuture, end: '', therapyType: t,
    }));
    const map = buildOccupancyMap(slots);
    expect(handleSelectAllow(isoFuture, map, NOW)).toBe(true);
  });

  it('bloquea un slot futuro con los 5 servicios ocupados', () => {
    const isoFuture = new Date(FUTURE).toISOString();
    const slots: BookedSlot[] = THERAPY_OPTIONS.map(t => ({
      start: isoFuture, end: '', therapyType: t,
    }));
    const map = buildOccupancyMap(slots);
    expect(handleSelectAllow(isoFuture, map, NOW)).toBe(false);
  });

  it('inicio en minutos intermedios se normaliza correctamente para la comprobación', () => {
    // :15 del mismo slot que :00 → mismo key → hereda ocupación
    const isoBase    = new Date(FUTURE).toISOString();
    const isoAt15    = new Date(FUTURE + 15 * 60 * 1000).toISOString(); // +15 min
    const slots: BookedSlot[] = THERAPY_OPTIONS.map(t => ({
      start: isoBase, end: '', therapyType: t,
    }));
    const map = buildOccupancyMap(slots);
    // isoAt15 cae en el mismo slot que isoBase → debe bloquearse
    expect(handleSelectAllow(isoAt15, map, NOW)).toBe(false);
  });
});
