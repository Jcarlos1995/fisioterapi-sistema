import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ArrowLeft, CalendarDays, ShieldCheck } from 'lucide-react';
import logoFisioterapia from '../../assets/logo-fisioterapia.png';
import { BOOKING_URL, LANDING_URL } from '../../config';
import { functions } from '../../firebaseConfig';
import { useToast } from '../../context/ToastContext';
import { usePatientAuth } from '../../context/PatientAuthContext';
import { validateBirthDate, validateDni } from '../../utils/validation';
import RegisterPatientModal from './RegisterPatientModal';

interface PatientLoginProps {
  onSuccess: () => void;
}

interface RegisterPatientPortalResponse {
  success: boolean;
  patientId: string;
}

const registerPatientPortalCallable = httpsCallable<
  { name: string; dni: string; birthDate: string; age: number; phone: string },
  RegisterPatientPortalResponse
>(functions, 'registerPatientPortal');

const PatientLogin: React.FC<PatientLoginProps> = ({ onSuccess }) => {
  const { showToast } = useToast();
  const { login } = usePatientAuth();
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

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
      const code    = (error as { code?: string })?.code ?? '';
      const message = (error as { message?: string })?.message ?? '';
      if (code.includes('resource-exhausted')) {
        showToast('Demasiados intentos. Tienes un bloqueo temporal por seguridad.', 'warning');
      } else if (code.includes('failed-precondition')) {
        showToast(
          'Aún no tenemos tu fecha de nacimiento registrada. Acércate a recepción para activar tu portal.',
          'warning'
        );
      } else if (code.includes('not-found')) {
        if (message.toLowerCase().includes('no encontramos tu dni')) {
          showToast('No encontramos tu DNI. Puedes registrarte ahora.', 'warning');
          setShowRegisterModal(true);
        } else {
          showToast('Los datos no coinciden.', 'error');
        }
      } else {
        showToast('No pudimos validar tus datos. Intenta nuevamente.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100 flex items-center justify-center p-4">

      {/* Botón volver */}
      <a
        href={LANDING_URL}
        className="fixed top-5 left-5 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 hover:border-blue-200"
      >
        <ArrowLeft size={16} />
        Volver al inicio
      </a>

      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-blue-100/60 border border-slate-100 overflow-hidden">

          {/* Banner azul superior */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 pt-10 pb-8 text-center">
            <img
              src={logoFisioterapia}
              alt="Fisioterapi Chepén"
              className="h-24 w-auto mx-auto object-contain mb-5 drop-shadow"
            />
            <h1 className="text-white text-2xl font-bold">Mi Portal de Paciente</h1>
            <p className="text-blue-200 text-sm mt-1.5">Ingresa con tu DNI y fecha de nacimiento</p>
          </div>

          {/* Formulario */}
          <div className="px-8 py-8 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* DNI */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  DNI
                </label>
                <div className="relative">
                  <ShieldCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="Ej. 12345678"
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 font-medium"
                    value={dni}
                    onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              {/* Fecha de nacimiento */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Fecha de nacimiento
                </label>
                <div className="relative">
                  <CalendarDays size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                  <input
                    type="date"
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 font-medium"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold transition-colors shadow-sm shadow-blue-200 text-base"
              >
                {submitting ? 'Validando...' : 'Ingresar'}
              </button>
            </form>

            <p className="text-center">
              <a href={BOOKING_URL} className="text-blue-600 hover:text-blue-700 font-semibold text-sm">
                ¿Necesitas reservar tu primera cita?
              </a>
            </p>
          </div>
        </div>
      </div>

      {showRegisterModal && (
        <RegisterPatientModal
          initialDni={dni}
          initialBirthDate={birthDate}
          onClose={() => setShowRegisterModal(false)}
          onSubmit={async (payload) => {
            try {
              await registerPatientPortalCallable(payload);
              showToast('Registro exitoso. Ahora puedes ingresar con tu DNI y fecha de nacimiento.');
              setDni(payload.dni);
              setBirthDate(payload.birthDate);
            } catch (error: unknown) {
              const code = (error as { code?: string })?.code ?? '';
              if (code.includes('already-exists')) {
                showToast('Este DNI ya existe. Verifica tus datos e intenta iniciar sesión.', 'warning');
              } else {
                showToast('No se pudo completar el registro. Intenta nuevamente.', 'error');
              }
              throw error;
            }
          }}
        />
      )}
    </div>
  );
};

export default PatientLogin;
