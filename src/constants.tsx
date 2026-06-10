
import { TherapyType, SessionStatus } from './types';

// Catálogo único de servicios de la clínica.
// Lo usan: Sesiones (tipo de terapia), Área Reservada (ventas y precios)
// y el portal de reservas online. OJO: el calendario de reservas permite
// hasta 5 servicios simultáneos por slot — esta lista debe tener 5 ítems.
export const THERAPY_TYPES: TherapyType[] = [
  'Fisioterapia',
  'Quiropraxia',
  'Rehabilitación Post-Operatoria',
  'Masaje Terapéutico',
  'Terapia Deportiva',
];

export const SESSION_STATUSES: SessionStatus[] = [
  'Programada',
  'Confirmada',
  'Efectuada',
  'Pagada'
];
