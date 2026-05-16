// ─── Utilidades puras de sesiones ─────────────────────────────────────────────
import { Session } from '../../types';

/**
 * Indica si una fecha en formato YYYY-MM-DD corresponde al día de hoy
 * (comparación local, sin depender de zona horaria de servidor).
 */
export const isToday = (dateString: string): boolean => {
  const today       = new Date();
  const sessionDate = new Date(dateString + 'T00:00:00');
  return (
    sessionDate.getFullYear() === today.getFullYear() &&
    sessionDate.getMonth()    === today.getMonth()    &&
    sessionDate.getDate()     === today.getDate()
  );
};

/**
 * Indica si al entrar al nuevo estado se debe crear una venta automática.
 * Solo aplica cuando el estado nuevo es 'Pagada' (y el actual no lo era).
 */
export const shouldAutoCreateSale = (
  currentStatus: Session['status'],
  newStatus: Session['status'],
): boolean => newStatus === 'Pagada' && currentStatus !== 'Pagada';

/**
 * Indica si al salir del estado actual se debe mostrar advertencia de venta ya registrada.
 * Solo aplica cuando se sale de 'Pagada'.
 */
export const shouldWarnOnLeave = (currentStatus: Session['status']): boolean =>
  currentStatus === 'Pagada';

/**
 * Indica si un estado de sesión es terminal (no puede cancelarse ni cambiarse sin confirmación).
 * Efectuada y Pagada están cerradas operativamente.
 */
export const isTerminalStatus = (status: Session['status']): boolean =>
  status === 'Efectuada' || status === 'Pagada';

/**
 * Devuelve las clases Tailwind para el badge de estado de una sesión.
 */
export const statusBadgeClass = (status: Session['status']): string => {
  switch (status) {
    case 'Cancelada':  return 'bg-rose-100 text-rose-700';
    case 'Pagada':     return 'bg-emerald-100 text-emerald-700';
    case 'Efectuada':  return 'bg-green-100 text-green-700';
    case 'Confirmada': return 'bg-blue-100 text-blue-700';
    default:           return 'bg-amber-100 text-amber-700'; // Programada
  }
};
