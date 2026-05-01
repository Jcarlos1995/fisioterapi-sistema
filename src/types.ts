export type UserRole = 'ti' | 'admin' | 'operador' | 'viewer';

export interface ModulePermissions {
  add: boolean;
  edit: boolean;
  delete: boolean;
}

export interface UserPermissions {
  professionals: ModulePermissions;
  patients:      ModulePermissions;
  appointments:  ModulePermissions;
  products:      ModulePermissions;
  stories:       ModulePermissions;
  dailyTherapy:  ModulePermissions;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  professionals: { add: false, edit: false, delete: false },
  patients:      { add: false, edit: false, delete: false },
  appointments:  { add: false, edit: false, delete: false },
  products:      { add: false, edit: false, delete: false },
  stories:       { add: false, edit: false, delete: false },
  dailyTherapy:  { add: false, edit: false, delete: false },
};

export const FULL_PERMISSIONS: UserPermissions = {
  professionals: { add: true, edit: true, delete: true },
  patients:      { add: true, edit: true, delete: true },
  appointments:  { add: true, edit: true, delete: true },
  products:      { add: true, edit: true, delete: true },
  stories:       { add: true, edit: true, delete: true },
  dailyTherapy:  { add: true, edit: true, delete: true },
};

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
  email?: string;
  dni: string;
  birthDate?: string;
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
  status: 'Programada' | 'Confirmada' | 'Efectuada' | 'Pagada' | 'Cancelada';
  notes?: string;
  // Campos adicionales escritos por BookingSystem (reservas online)
  type?: 'online-booking';
  endDate?: string;
  createdAt?: string;
}

export type SessionStatus = 'Programada' | 'Confirmada' | 'Efectuada' | 'Pagada' | 'Cancelada';

export type TherapyType = 'Fisioterapia' | 'Quiropraxia' | 'Masajes' | 'Terapia de Temporada' | 'Medicina General' | 'Otros';

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