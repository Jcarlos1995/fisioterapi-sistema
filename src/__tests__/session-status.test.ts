import {
  isToday,
  shouldAutoCreateSale,
  shouldWarnOnLeave,
  isTerminalStatus,
  statusBadgeClass,
} from '../shared/utils/session';
import { Session } from '../types';

// ─── isToday ──────────────────────────────────────────────────────────────────
describe('isToday', () => {
  const pad = (n: number) => String(n).padStart(2, '0');

  it('reconoce la fecha de hoy', () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    expect(isToday(today)).toBe(true);
  });

  it('rechaza la fecha de ayer', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    expect(isToday(yesterday)).toBe(false);
  });

  it('rechaza la fecha de mañana', () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    expect(isToday(tomorrow)).toBe(false);
  });

  it('rechaza una fecha de otro año', () => {
    expect(isToday('2020-01-01')).toBe(false);
  });

  it('rechaza una fecha del futuro lejano', () => {
    expect(isToday('2099-12-31')).toBe(false);
  });
});

// ─── shouldAutoCreateSale ─────────────────────────────────────────────────────
describe('shouldAutoCreateSale', () => {
  const statuses: Session['status'][] = ['Programada', 'Confirmada', 'Efectuada', 'Pagada', 'Cancelada'];

  it('devuelve true cuando se entra a Pagada desde cualquier otro estado', () => {
    const otros = statuses.filter(s => s !== 'Pagada');
    otros.forEach(from => {
      expect(shouldAutoCreateSale(from, 'Pagada')).toBe(true);
    });
  });

  it('devuelve false cuando el nuevo estado no es Pagada', () => {
    const nosPagada = statuses.filter(s => s !== 'Pagada');
    nosPagada.forEach(to => {
      expect(shouldAutoCreateSale('Programada', to)).toBe(false);
    });
  });

  it('devuelve false cuando se "cambia" a Pagada desde Pagada (mismoestado)', () => {
    expect(shouldAutoCreateSale('Pagada', 'Pagada')).toBe(false);
  });
});

// ─── shouldWarnOnLeave ────────────────────────────────────────────────────────
describe('shouldWarnOnLeave', () => {
  it('devuelve true cuando el estado actual es Pagada', () => {
    expect(shouldWarnOnLeave('Pagada')).toBe(true);
  });

  it('devuelve false para todos los demás estados', () => {
    const otros: Session['status'][] = ['Programada', 'Confirmada', 'Efectuada', 'Cancelada'];
    otros.forEach(s => {
      expect(shouldWarnOnLeave(s)).toBe(false);
    });
  });
});

// ─── isTerminalStatus ─────────────────────────────────────────────────────────
describe('isTerminalStatus', () => {
  it('Efectuada es terminal', () => {
    expect(isTerminalStatus('Efectuada')).toBe(true);
  });

  it('Pagada es terminal', () => {
    expect(isTerminalStatus('Pagada')).toBe(true);
  });

  it('Programada no es terminal', () => {
    expect(isTerminalStatus('Programada')).toBe(false);
  });

  it('Confirmada no es terminal', () => {
    expect(isTerminalStatus('Confirmada')).toBe(false);
  });

  it('Cancelada no es terminal', () => {
    expect(isTerminalStatus('Cancelada')).toBe(false);
  });
});

// ─── statusBadgeClass ─────────────────────────────────────────────────────────
describe('statusBadgeClass', () => {
  it('Cancelada devuelve clases rose', () => {
    expect(statusBadgeClass('Cancelada')).toContain('rose');
  });

  it('Pagada devuelve clases emerald', () => {
    expect(statusBadgeClass('Pagada')).toContain('emerald');
  });

  it('Efectuada devuelve clases green', () => {
    expect(statusBadgeClass('Efectuada')).toContain('green');
  });

  it('Confirmada devuelve clases blue', () => {
    expect(statusBadgeClass('Confirmada')).toContain('blue');
  });

  it('Programada devuelve clases amber (default)', () => {
    expect(statusBadgeClass('Programada')).toContain('amber');
  });

  it('todos los estados devuelven string no vacío', () => {
    const statuses: Session['status'][] = ['Programada', 'Confirmada', 'Efectuada', 'Pagada', 'Cancelada'];
    statuses.forEach(s => {
      expect(statusBadgeClass(s).length).toBeGreaterThan(0);
    });
  });
});
