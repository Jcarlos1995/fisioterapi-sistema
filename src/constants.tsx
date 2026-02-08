
import { TherapyType, SessionStatus, Session } from './types';

export const THERAPY_TYPES: TherapyType[] = [
  'Fisioterapia',
  'Quiropraxia',
  'Masajes',
  'Terapia de Temporada',
  'Medicina General',
  'Otros'
];

export const SESSION_STATUSES: SessionStatus[] = [
  'Programada',
  'Confirmada',
  'Efectuada',
  'Cancelada'
];

export const MOCK_PATIENTS = [
  { id: '1', name: 'Juan Pérez', email: 'juan@example.com', age: 34, phone: '555-0101' },
  { id: '2', name: 'María García', email: 'maria@example.com', age: 28, phone: '555-0102' },
  { id: '3', name: 'Carlos López', email: 'carlos@example.com', age: 45, phone: '555-0103' },
];

export const MOCK_PROFESSIONALS = [
  { id: 'p1', name: 'Dr. Smith', specialty: 'Fisioterapia', email: 'smith@clinic.com' },
  { id: 'p2', name: 'Dra. Jones', specialty: 'Quiropraxia', email: 'jones@clinic.com' },
];

export const MOCK_PRODUCTS = [
  { id: 'pr1', name: 'Vendaje Elástico', price: 15.5, stock: 50, category: 'Suministros' },
  { id: 'pr2', name: 'Aceite de Masaje', price: 22.0, stock: 15, category: 'Terapia' },
];

export const MOCK_SESSIONS: Session[] = [
  { 
    id: 's1', 
    patientId: '1', 
    professionalId: 'p1', 
    therapyType: 'Fisioterapia', 
    date: '2023-10-25', 
    time: '10:00', // <-- Añadimos esto
    notes: 'Sesión inicial', 
    status: 'Efectuada' 
  },
  { 
    id: 's2', 
    patientId: '2', 
    professionalId: 'p2', 
    therapyType: 'Quiropraxia', 
    date: '2023-10-26', 
    time: '11:30', // <-- Añadimos esto
    notes: 'Ajuste cervical', 
    status: 'Confirmada' 
  },
  { 
    id: 's3', 
    patientId: '1', 
    professionalId: 'p2', 
    therapyType: 'Masajes', 
    date: '2023-10-27', 
    time: '16:00', // <-- Añadimos esto
    notes: 'Relajación muscular', 
    status: 'Programada' 
  },
];
