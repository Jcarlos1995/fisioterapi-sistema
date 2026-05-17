import React, { useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { BOOKING_URL } from '../../config';
import { useToast } from '../../context/ToastContext';
import { usePatientAppointments } from './hooks/usePatientAppointments';
import { PatientPortalSession } from './hooks/usePatientAppointments';
import { getCancellationEligibility } from '../../shared/utils/cancellation';
import { PortalPatient } from './types';
import CancelAppointmentModal from './CancelAppointmentModal';
import PatientAppointmentCard, { AppointmentCardSession } from './PatientAppointmentCard';

interface PatientAppointmentsListProps {
  patient: PortalPatient;
}

interface CancelPatientBookingResponse {
  success: boolean;
}

const cancelPatientBookingCallable = httpsCallable<
  { sessionId: string; patientDni: string; patientBirthDate: string; reason?: string },
  CancelPatientBookingResponse
>(functions, 'cancelPatientBooking');

type SectionType = 'upcoming' | 'past' | 'cancelled';

const getSessionDateMs = (session: PatientPortalSession): number => {
  // Normalizar date: puede llegar como string "YYYY-MM-DD" o como objeto Timestamp de Firestore
  const rawDate = session.date as unknown;
  let dateStr: string;
  if (rawDate && typeof rawDate === 'object' && '_seconds' in (rawDate as Record<string, unknown>)) {
    // Firestore Timestamp serializado — convertir a YYYY-MM-DD
    dateStr = new Date(
      ((rawDate as Record<string, number>)._seconds) * 1000
    ).toISOString().split('T')[0];
  } else {
    dateStr = String(rawDate || '');
  }

  const timeStr = String(session.time || '00:00');
  // Forzar zona horaria de Lima (UTC-5) para que el filtro funcione
  // independientemente del timezone del navegador del paciente.
  const date = new Date(`${dateStr}T${timeStr}:00-05:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getCancelInfo = (session: AppointmentCardSession): { allowed: boolean; message?: string } => {
  const eligibility = getCancellationEligibility(session.status, session.date, session.time);
  return { allowed: eligibility.cancelable, message: eligibility.message };
};

const PatientAppointmentsList: React.FC<PatientAppointmentsListProps> = ({ patient }) => {
  const { showToast } = useToast();
  const { appointments, loading, error, refresh } = usePatientAppointments(patient.id, patient.dni);
  const [activeSection, setActiveSection] = useState<SectionType>('upcoming');
  const [selectedSession, setSelectedSession] = useState<AppointmentCardSession | null>(null);

  const grouped = useMemo(() => {
    const now = Date.now();
    const sorted = [...appointments].sort((a, b) => getSessionDateMs(a) - getSessionDateMs(b));
    return {
      upcoming: sorted.filter((s) => {
        const ms = getSessionDateMs(s);
        return ms > now && (s.status === 'Programada' || s.status === 'Confirmada');
      }),
      past: sorted.filter((s) => s.status === 'Efectuada' || s.status === 'Pagada'),
      cancelled: sorted.filter((s) => s.status === 'Cancelada'),
    };
  }, [appointments]);

  const currentItems = grouped[activeSection];

  const handleCancelClick = (session: AppointmentCardSession) => {
    const info = getCancelInfo(session);
    if (!info.allowed) {
      showToast(info.message || 'No se puede cancelar esta cita.', 'warning');
      return;
    }
    setSelectedSession(session);
  };

  const confirmCancellation = async (reason: string) => {
    if (!selectedSession || !patient.birthDate) return;
    try {
      await cancelPatientBookingCallable({
        sessionId: selectedSession.id,
        patientDni: patient.dni,
        patientBirthDate: patient.birthDate,
        reason,
      });
      showToast('Tu cita fue cancelada correctamente.');
      await refresh();
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code ?? '';
      if (code.includes('failed-precondition')) {
        showToast(
          'Las cancelaciones requieren mínimo 2 horas de anticipación. Llama directamente a la clínica.',
          'warning'
        );
      } else {
        showToast('No se pudo cancelar la cita. Intenta nuevamente.', 'error');
      }
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            { key: 'upcoming',   label: 'Próximas',   count: grouped.upcoming.length   },
            { key: 'past',       label: 'Pasadas',    count: grouped.past.length       },
            { key: 'cancelled',  label: 'Canceladas', count: grouped.cancelled.length  },
          ] as { key: SectionType; label: string; count: number }[]
        ).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSection === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                activeSection === key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-500 text-sm">Cargando citas...</p>}
      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <div className="space-y-3">
        {!loading && currentItems.length === 0 && (
          <div className="py-10 text-center space-y-3">
            <p className="text-3xl">
              {activeSection === 'upcoming' ? '📅' : activeSection === 'past' ? '✅' : '🚫'}
            </p>
            <p className="text-slate-500 text-sm font-medium">
              {activeSection === 'upcoming'
                ? 'No tienes citas próximas.'
                : activeSection === 'past'
                ? 'Aún no tienes citas anteriores.'
                : 'No tienes citas canceladas.'}
            </p>
            {activeSection === 'upcoming' && (
              <a
                href={BOOKING_URL}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                Agendar una cita
              </a>
            )}
          </div>
        )}
        {currentItems.map((session) => (
          <PatientAppointmentCard
            key={session.id}
            session={session}
            professionalName={session.professionalName || 'Profesional no asignado'}
            cancelInfo={getCancelInfo(session)}
            onCancel={handleCancelClick}
          />
        ))}
      </div>

      {selectedSession && (
        <CancelAppointmentModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onConfirm={confirmCancellation}
        />
      )}
    </section>
  );
};

export default PatientAppointmentsList;
