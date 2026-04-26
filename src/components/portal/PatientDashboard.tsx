import React, { useState } from 'react';
import { PortalPatient } from './types';
import PatientAppointmentsList from './PatientAppointmentsList';

interface PatientDashboardProps {
  patient: PortalPatient;
}

type Tab = 'appointments' | 'profile';

const PatientDashboard: React.FC<PatientDashboardProps> = ({ patient }) => {
  const [tab, setTab] = useState<Tab>('appointments');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 bg-slate-100 rounded-2xl p-1 text-sm">
        <button
          onClick={() => setTab('appointments')}
          className={`py-2 rounded-xl font-semibold ${tab === 'appointments' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
        >
          Mis citas
        </button>
        <button
          onClick={() => setTab('profile')}
          className={`py-2 rounded-xl font-semibold ${tab === 'profile' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
        >
          Mis datos
        </button>
      </div>

      {tab === 'appointments' ? (
        <PatientAppointmentsList patient={patient} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-sm">
          <h2 className="text-base font-bold text-slate-800">Datos personales</h2>
          <p><span className="font-semibold text-slate-700">Nombre:</span> {patient.name || '---'}</p>
          <p><span className="font-semibold text-slate-700">DNI:</span> {patient.dni || '---'}</p>
          <p><span className="font-semibold text-slate-700">Teléfono:</span> {patient.phone || '---'}</p>
          <p><span className="font-semibold text-slate-700">Email:</span> {patient.email || '---'}</p>
          <p><span className="font-semibold text-slate-700">Fecha de nacimiento:</span> {patient.birthDate || '---'}</p>
          <p className="text-xs text-slate-500 pt-2">
            Si necesitas actualizar tus datos, acércate a recepción.
          </p>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
