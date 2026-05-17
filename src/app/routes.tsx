// Configuración declarativa de rutas — principio Open/Closed.
// Para añadir un nuevo módulo: agrega una entrada aquí. App.tsx nunca cambia.
import React from 'react';
import {
  LayoutDashboard,
  Users,
  UserSquare2,
  Package,
  CalendarDays,
  BookOpen,
  ClipboardList,
  BadgeDollarSign,
  Radio,
} from 'lucide-react';

import Dashboard            from '../modules/dashboard/Dashboard';
import PatientsManager      from '../modules/patients/PatientsManager';
import ProfessionalsManager from '../modules/professionals/ProfessionalsManager';
import ProductsManager      from '../modules/products/ProductsManager';
import SessionsManager      from '../modules/sessions/SessionsManager';
import Stories              from '../modules/stories/Stories';
import DailyTherapy         from '../modules/daily-therapy/DailyTherapy';
import SalesArea            from '../modules/sales/SalesArea';
import EventsManager        from '../modules/events/EventsManager';

/** Nivel de acceso mínimo para que la ruta sea visible en el sidebar. */
export type RouteAccess = 'all' | 'adminOrTI' | 'ti';

export interface AppRouteConfig {
  path:      string;
  label:     string;
  icon:      React.ReactNode;
  component: React.ComponentType;
  access:    RouteAccess;
}

export const APP_ROUTES: AppRouteConfig[] = [
  { path: '/',              label: 'Dashboard',      icon: <LayoutDashboard size={20} />, component: Dashboard,            access: 'all'       },
  { path: '/patients',      label: 'Pacientes',      icon: <Users size={20} />,           component: PatientsManager,      access: 'all'       },
  { path: '/professionals', label: 'Profesionales',  icon: <UserSquare2 size={20} />,     component: ProfessionalsManager, access: 'all'       },
  { path: '/products',      label: 'Productos',      icon: <Package size={20} />,         component: ProductsManager,      access: 'all'       },
  { path: '/sessions',      label: 'Sesiones',       icon: <CalendarDays size={20} />,    component: SessionsManager,      access: 'all'       },
  { path: '/stories',       label: 'Historias',      icon: <BookOpen size={20} />,        component: Stories,              access: 'all'       },
  { path: '/daily-therapy', label: 'Terapia Diaria', icon: <ClipboardList size={20} />,  component: DailyTherapy,         access: 'all'       },
  { path: '/sales-area',    label: 'Área Reservada', icon: <BadgeDollarSign size={20} />, component: SalesArea,            access: 'adminOrTI' },
  { path: '/events',        label: 'Eventos',        icon: <Radio size={20} />,           component: EventsManager,        access: 'ti'        },
];
