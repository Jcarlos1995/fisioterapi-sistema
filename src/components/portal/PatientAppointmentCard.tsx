import React from 'react';
import { Calendar, Clock, Stethoscope, UserSquare2 } from 'lucide-react';
import { Session } from '../../types';

interface PatientAppointmentCardProps {
  session: Session;
  professionalName: string;
  cancelInfo?: { allowed: boolean; message?: string };
  onCancel: (session: Session) => void;
}

const STATUS_COLORS: Record<string, string> = {
  Programada: 'bg-blue-100 text-blue-700',
  Confirmada: 'bg-emerald-100 text-emerald-700',
  Efectuada: 'bg-slate-200 text-slate-700',
  Pagada: 'bg-teal-100 text-teal-700',
  Cancelada: 'bg-rose-100 text-rose-700',
};

const PatientAppointmentCard: React.FC<PatientAppointmentCardProps> = ({
  session,
  professionalName,
  cancelInfo,
  onCancel,
}) => {
  const statusClass = STATUS_COLORS[session.status] || 'bg-slate-100 text-slate-700';

  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Cita</p>
          <h3 className="text-base sm:text-lg font-bold text-slate-800">{session.therapyType}</h3>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusClass}`}>{session.status}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-sm text-slate-600">
        <p className="flex items-center gap-2"><Calendar size={15} /> {session.date}</p>
        <p className="flex items-center gap-2"><Clock size={15} /> {session.time}</p>
        <p className="sm:col-span-2 flex items-center gap-2"><UserSquare2 size={15} /> {professionalName}</p>
      </div>

      {(session.status === 'Programada' || session.status === 'Confirmada') && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onCancel(session)}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              cancelInfo?.allowed
                ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title={cancelInfo?.allowed ? 'Cancelar esta cita' : cancelInfo?.message}
          >
            <Stethoscope size={15} />
            Cancelar cita
          </button>
          {!cancelInfo?.allowed && cancelInfo?.message && (
            <p className="text-xs text-amber-600 mt-2">{cancelInfo.message}</p>
          )}
        </div>
      )}
    </article>
  );
};

export default PatientAppointmentCard;
