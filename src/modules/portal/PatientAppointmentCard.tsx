import React from 'react';
import { Clock, UserSquare2, XCircle } from 'lucide-react';
import { Session } from '../../types';

/** Solo los campos que esta tarjeta necesita mostrar y pasar al handler de cancelación. */
export type AppointmentCardSession = Pick<Session, 'id' | 'status' | 'therapyType' | 'date' | 'time'>;

interface PatientAppointmentCardProps {
  session: AppointmentCardSession;
  professionalName: string;
  cancelInfo?: { allowed: boolean; message?: string };
  onCancel: (session: AppointmentCardSession) => void;
}

const STATUS_CONFIG: Record<string, { border: string; badge: string }> = {
  Programada: { border: 'border-l-blue-500',    badge: 'bg-blue-50 text-blue-700'     },
  Confirmada: { border: 'border-l-emerald-500',  badge: 'bg-emerald-50 text-emerald-700' },
  Efectuada:  { border: 'border-l-slate-400',    badge: 'bg-slate-100 text-slate-600'  },
  Pagada:     { border: 'border-l-teal-500',     badge: 'bg-teal-50 text-teal-700'     },
  Cancelada:  { border: 'border-l-rose-400',     badge: 'bg-rose-50 text-rose-600'     },
};

function formatDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T12:00:00-05:00`).toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return dateStr; }
}

const PatientAppointmentCard: React.FC<PatientAppointmentCardProps> = ({
  session,
  professionalName,
  cancelInfo,
  onCancel,
}) => {
  const config = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.Programada;

  return (
    <article className={`bg-white rounded-2xl shadow-sm border border-slate-100 border-l-4 ${config.border} overflow-hidden`}>
      <div className="p-4 sm:p-5 space-y-3">

        {/* Cabecera: tipo + estado */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base">{session.therapyType}</h3>
            <p className="text-sm text-slate-500 capitalize mt-0.5">{formatDate(session.date)}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${config.badge}`}>
            {session.status}
          </span>
        </div>

        {/* Detalles */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Clock size={14} className="text-slate-400 shrink-0" />
            {session.time} h
          </span>
          <span className="flex items-center gap-1.5">
            <UserSquare2 size={14} className="text-slate-400 shrink-0" />
            {professionalName}
          </span>
        </div>

        {/* Botón cancelar */}
        {(session.status === 'Programada' || session.status === 'Confirmada') && (
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onCancel(session)}
              disabled={!cancelInfo?.allowed}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                cancelInfo?.allowed
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer'
                  : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
              title={cancelInfo?.allowed ? 'Cancelar esta cita' : cancelInfo?.message}
            >
              <XCircle size={15} />
              Cancelar cita
            </button>
            {!cancelInfo?.allowed && cancelInfo?.message && (
              <p className="text-xs text-amber-600 mt-2">{cancelInfo.message}</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

export default PatientAppointmentCard;
