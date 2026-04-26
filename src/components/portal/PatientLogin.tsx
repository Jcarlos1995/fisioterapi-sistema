import React, { useState } from 'react';
import { UserCircle } from 'lucide-react';
import { BOOKING_URL, LANDING_URL } from '../../config';
import { useToast } from '../../context/ToastContext';
import { usePatientAuth } from '../../context/PatientAuthContext';
import { validateBirthDate, validateDni } from '../../utils/validation';

interface PatientLoginProps {
  onSuccess: () => void;
}

const PatientLogin: React.FC<PatientLoginProps> = ({ onSuccess }) => {
  const { showToast } = useToast();
  const { login } = usePatientAuth();
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDni = dni.trim();
    const dniValidation = validateDni(cleanDni);
    const birthValidation = validateBirthDate(birthDate);

    if (!dniValidation.valid) {
      showToast(dniValidation.error || 'DNI inválido.', 'error');
      return;
    }

    if (!birthValidation.valid) {
      showToast(birthValidation.error || 'Fecha de nacimiento inválida.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await login(cleanDni, birthDate);
      showToast('Bienvenido(a) a tu portal.');
      onSuccess();
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code ?? '';
      if (code.includes('resource-exhausted')) {
        showToast('Demasiados intentos. Espera una hora para volver a intentar.', 'warning');
      } else if (code.includes('not-found')) {
        showToast('Los datos no coinciden.', 'error');
      } else {
        showToast('No pudimos validar tus datos. Intenta nuevamente.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-3">
            <UserCircle size={30} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Mi Portal de Paciente</h1>
          <p className="text-slate-500 text-sm mt-1">Ingresa con tu DNI y fecha de nacimiento</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">DNI</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="Ej. 12345678"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de nacimiento</label>
            <input
              type="date"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold transition-colors"
          >
            {submitting ? 'Validando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-5 space-y-2 text-sm text-center">
          <a href={BOOKING_URL} className="text-blue-700 hover:text-blue-800 font-semibold">
            ¿Necesitas reservar tu primera cita?
          </a>
          <p>
            <a href={LANDING_URL} className="text-slate-600 hover:text-slate-800">
              Volver al sitio principal
            </a>
          </p>
          <p className="text-xs text-slate-500">
            Si nunca has venido o falta tu fecha de nacimiento, acércate a recepción.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatientLogin;
