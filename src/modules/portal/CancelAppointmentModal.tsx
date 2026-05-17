import React, { useState } from 'react';
import { X } from 'lucide-react';
import useEscKey from '../../shared/hooks/useEscKey';

/** Solo los campos que el modal necesita mostrar en el resumen de la cita. */
interface CancelModalSession {
  date: string;
  time: string;
  therapyType: string;
}

interface CancelAppointmentModalProps {
  session: CancelModalSession;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

const CancelAppointmentModal: React.FC<CancelAppointmentModalProps> = ({
  session,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  useEscKey(onClose, true);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(reason);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Confirmar cancelación</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            ¿Deseas cancelar esta cita?
            <span className="block mt-2 font-semibold text-slate-800">
              {session.date} - {session.time} ({session.therapyType})
            </span>
          </p>

          <div>
            <label className="text-sm font-semibold text-slate-700">Motivo (opcional)</label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Escribe un motivo para la cancelación..."
              className="mt-1 w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold"
            >
              {loading ? 'Cancelando...' : 'Confirmar cancelación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancelAppointmentModal;
