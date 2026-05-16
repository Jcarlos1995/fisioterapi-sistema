import React from 'react';
import { LogOut } from 'lucide-react';
import { PortalPatient } from './types';
import logoFisioterapia from '../../assets/logo-fisioterapia.png';

interface PatientHeaderProps {
  patient: PortalPatient;
  onLogout: () => void;
}

const PatientHeader: React.FC<PatientHeaderProps> = ({ patient, onLogout }) => {
  const displayName = patient.name?.replace(/\b\w/g, c => c.toUpperCase()) || '';
  const initial = displayName.charAt(0) || 'P';

  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-5 sm:p-6 flex items-center justify-between gap-4 shadow-lg shadow-blue-300/40">
      <div className="flex items-center gap-4">
        {/* Avatar con inicial */}
        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xl">{initial}</span>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-blue-200 text-xs font-semibold uppercase tracking-wider">
            <img src={logoFisioterapia} alt="" className="h-4 w-auto opacity-75" />
            Portal de Pacientes
          </p>
          <h1 className="text-white font-bold text-lg sm:text-xl mt-0.5">{displayName}</h1>
        </div>
      </div>

      <button
        onClick={onLogout}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-sm transition-colors shrink-0"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">Cerrar sesión</span>
        <span className="sm:hidden">Salir</span>
      </button>
    </header>
  );
};

export default PatientHeader;
