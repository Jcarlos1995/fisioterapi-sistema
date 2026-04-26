import React, { useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import { useToast } from '../../context/ToastContext';
import { usePatientAppointments } from '../../hooks/usePatientAppointments';
import { PatientPortalSession } from '../../hooks/usePatientAppointments';
import { getCancellationEligibility } from '../../utils/cancellation';
import { PortalPatient } from './types';
import CancelAppointmentModal from './CancelAppointmentModal';
import PatientAppointmentCard from './PatientAppointmentCard';

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

const getSessionDateMs = (session: PatientPortalSession) => {
  const date = new Date(`${session.date}T${session.time}:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getCancelInfo = (session: PatientPortalSession): { allowed: boolean; message?: string } => {
  const eligibility = getCancellationEligibility(session.status, session.date, session.time);
  return { allowed: eligibility.cancelable, message: eligibility.message };
};

const PatientAppointmentsList: React.FC<PatientAppointmentsListProps> = ({ patient }) => {
  const { showToast } = useToast();
  const { appointments, loading, error, refresh } = usePatientAppointments(patient.id, patient.dni);
  const [activeSection, setActiveSection] = useState<SectionType>('upcoming');
  const [selectedSession, setSelectedSession] = useState<PatientPortalSession | null>(null);

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

  const handleCancelClick = (session: PatientPortalSession) => {
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
      <div className="grid grid-cols-3 bg-slate-100 rounded-2xl p-1 text-sm">
        <button
          onClick={() => setActiveSection('upcoming')}
          className={`py-2 rounded-xl font-semibold ${activeSection === 'upcoming' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
        >
          Próximas
        </button>
        <button
          onClick={() => setActiveSection('past')}
          className={`py-2 rounded-xl font-semibold ${activeSection === 'past' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
        >
          Pasadas
        </button>
        <button
          onClick={() => setActiveSection('cancelled')}
          className={`py-2 rounded-xl font-semibold ${activeSection === 'cancelled' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
        >
          Canceladas
        </button>
      </div>

      {loading && <p className="text-slate-500 text-sm">Cargando citas...</p>}
      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <div className="space-y-3">
        {!loading && currentItems.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-sm text-slate-500">
            No hay citas en esta sección.
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
