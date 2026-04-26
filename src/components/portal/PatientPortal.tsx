import React from 'react';
import { useNavigate } from 'react-router-dom';
import PatientDashboard from './PatientDashboard';
import PatientHeader from './PatientHeader';
import PatientLogin from './PatientLogin';
import { usePatientAuth } from '../../context/PatientAuthContext';

const PatientPortal: React.FC = () => {
  const navigate = useNavigate();
  const { currentPatient, loading, logout } = usePatientAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600 font-medium">Cargando portal...</p>
      </div>
    );
  }

  if (!currentPatient) {
    return <PatientLogin onSuccess={() => navigate('/portal')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <PatientHeader patient={currentPatient} onLogout={logout} />
        <PatientDashboard patient={currentPatient} />
      </div>
    </div>
  );
};

export default PatientPortal;
