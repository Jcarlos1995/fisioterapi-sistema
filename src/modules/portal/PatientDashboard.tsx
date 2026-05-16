import React, { useState } from 'react';
import { Calendar, CreditCard, Calendar as CalendarIcon, Phone, User, Package } from 'lucide-react';
import { PortalPatient } from './types';
import PatientAppointmentsList from './PatientAppointmentsList';
import PatientProductsList from './PatientProductsList';

interface PatientDashboardProps {
  patient: PortalPatient;
}

type Tab = 'appointments' | 'products' | 'profile';

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'appointments', label: 'Mis citas',  icon: <Calendar     size={16} /> },
  { key: 'products',     label: 'Productos',  icon: <Package      size={16} /> },
  { key: 'profile',      label: 'Mis datos',  icon: <User         size={16} /> },
];

function formatBirthDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(`${dateStr}T12:00:00-05:00`).toLocaleDateString('es-PE', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return dateStr; }
}

function capitalize(str?: string): string {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

const PatientDashboard: React.FC<PatientDashboardProps> = ({ patient }) => {
  const [tab, setTab] = useState<Tab>('appointments');

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">

      {/* Barra de tabs */}
      <div className="flex border-b border-slate-100">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold border-b-2 transition-all ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="p-4 sm:p-5">
        {tab === 'appointments' ? (
          <PatientAppointmentsList patient={patient} />
        ) : tab === 'products' ? (
          <PatientProductsList patient={patient} />
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Datos personales</h2>

            {[
              {
                icon: <User size={18} className="text-blue-500" />,
                label: 'Nombre completo',
                value: capitalize(patient.name),
              },
              {
                icon: <CreditCard size={18} className="text-blue-500" />,
                label: 'DNI',
                value: patient.dni,
              },
              {
                icon: <Phone size={18} className="text-blue-500" />,
                label: 'Teléfono',
                value: patient.phone,
              },
              {
                icon: <CalendarIcon size={18} className="text-blue-500" />,
                label: 'Fecha de nacimiento',
                value: formatBirthDate(patient.birthDate),
              },
            ].map(({ icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  {icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-slate-800 font-semibold mt-0.5">{value || '—'}</p>
                </div>
              </div>
            ))}

            <p className="text-xs text-slate-400 pt-2 text-center">
              Para actualizar tus datos, acércate a recepción.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;
