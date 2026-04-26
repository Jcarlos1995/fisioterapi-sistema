import React from 'react';
import { LogOut } from 'lucide-react';
import { PortalPatient } from './types';
import logoFisioterapia from '../../assets/logo-fisioterapia.png';

interface PatientHeaderProps {
  patient: PortalPatient;
  onLogout: () => void;
}

const PatientHeader: React.FC<PatientHeaderProps> = ({ patient, onLogout }) => {
  return (
    <header className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <img src={logoFisioterapia} alt="Fisioterapi Chepén" className="h-10 w-auto object-contain shrink-0" />
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Portal de Pacientes</p>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">{patient.name}</h1>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
      >
        <LogOut size={16} />
        Cerrar sesión
      </button>
    </header>
  );
};

export default PatientHeader;
