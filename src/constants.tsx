
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

// Instrumentos / equipos de la clínica. Se les pone precio en Área Reservada
// (columna "Instrumentos") y se pueden registrar en una venta para dejar
// constancia de qué equipo se usó con el paciente. Lista fija.
export const INSTRUMENTS = [
  'TENS',
  'Ondas Rusas',
  'Ultrasonido',
  'Láser',
  'Electro Punción',
  'Infrarrojo',
  'Compresas Frías y Calientes',
  'Botas de Compresión',
  'Magneto',
  'Ondas de Choque',
] as const;
