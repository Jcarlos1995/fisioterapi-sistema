import React, { useState } from 'react';
import useEscKey from '../../shared/hooks/useEscKey';
import { X, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [status, setStatus]             = useState<Status>('idle');
  const [errorMsg, setErrorMsg]         = useState('');

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setStatus('idle');
    setErrorMsg('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleClose = () => { reset(); onClose(); };

  useEscKey(handleClose, isOpen);

  const getFirebaseError = (code: string): string => {
    switch (code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'La contraseña actual es incorrecta.';
      case 'auth/weak-password':
        return 'La nueva contraseña debe tener al menos 6 caracteres.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Intenta más tarde.';
      case 'auth/requires-recent-login':
        return 'Por seguridad, cierra sesión, vuelve a iniciar y repite el proceso.';
      default:
        return 'Ocurrió un error inesperado. Intenta nuevamente.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMsg('La nueva contraseña debe ser diferente a la actual.');
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      setErrorMsg('No se encontró una sesión activa. Por favor, recarga la página.');
      return;
    }

    setStatus('loading');

    try {
      // Reautenticar antes de cambiar contraseña (requerido por Firebase)
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Cambiar contraseña
      await updatePassword(user, newPassword);

      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(getFirebaseError(err.code));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Panel */}
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">

        {/* Cabecera */}
        <div className="bg-slate-800 px-7 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Cambiar Contraseña</h2>
              <p className="text-white/60 text-xs mt-0.5">
                {auth.currentUser?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white/50 hover:text-white transition-colors p-1"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido */}
        <div className="px-7 py-6">

          {/* Estado: éxito */}
          {status === 'success' ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle2 size={36} className="text-green-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-base">¡Contraseña actualizada!</p>
                <p className="text-slate-500 text-sm mt-1">
                  Tu contraseña fue cambiada exitosamente.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="mt-2 bg-slate-800 text-white px-8 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-900 transition-all active:scale-95"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Error global */}
              {errorMsg && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Contraseña actual */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Contraseña actual
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Ingresa tu contraseña actual"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Nueva contraseña */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Indicador de fortaleza */}
                {newPassword.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          newPassword.length >= i * 3
                            ? newPassword.length >= 12
                              ? 'bg-green-500'
                              : newPassword.length >= 8
                              ? 'bg-yellow-400'
                              : 'bg-red-400'
                            : 'bg-slate-100'
                        }`}
                      />
                    ))}
                    <span className="text-[10px] text-slate-400 ml-1">
                      {newPassword.length >= 12 ? 'Fuerte' : newPassword.length >= 8 ? 'Media' : 'Débil'}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirmar nueva contraseña */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repite la nueva contraseña"
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm text-slate-800 pr-10 focus:outline-none focus:ring-2 focus:border-transparent placeholder:text-slate-300 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-red-300 focus:ring-red-400'
                        : confirmPassword && confirmPassword === newPassword
                        ? 'border-green-300 focus:ring-green-400'
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500 mt-0.5">Las contraseñas no coinciden.</p>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    'Actualizar contraseña'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
