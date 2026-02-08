
export interface Patient {
  id: string;
  name: string;
  email: string;
  age: number;
  phone: string;
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone?: string;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  dni: string;
  age: number;
  phone: string;
  professionalId?: string;
  createdAt?: string;
}

export interface Session {
  id: string;
  patientId: string;
  professionalId: string;
  date: string;
  time: string;
  therapyType: string;
  status: 'Programada' | 'Confirmada' | 'Efectuada';
  notes?: string;
}

export type SessionStatus = 'Programada' | 'Confirmada' | 'Efectuada' | 'Cancelada';

export type TherapyType = 'Fisioterapia' | 'Quiropraxia' | 'Masajes' | 'Terapia de Temporada' | 'Medicina General' | 'Otros';

export interface DashboardStats {
  totalPatients: number;
  totalProfessionals: number;
  totalSessions: number;
  professionalsPerformance: { name: string; patientsCount: number }[];
  therapyDistribution: { name: string; value: number }[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

export interface Story {
  id?: string;
  patientName: string;
  diagnosis: string;
  testimony: string;
  displayDate: string; // Tu fecha manual (ej: "Marzo 2026")
  imageUrl?: string;
}