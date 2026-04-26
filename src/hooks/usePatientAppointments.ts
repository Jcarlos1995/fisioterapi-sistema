import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { Session } from '../types';

export type PatientPortalSession = Session & { professionalName?: string };

interface GetPatientAppointmentsResponse {
  sessions: PatientPortalSession[];
}

const getPatientAppointmentsCallable = httpsCallable<
  { patientId: string; dni: string },
  GetPatientAppointmentsResponse
>(functions, 'getPatientAppointments');

export const usePatientAppointments = (patientId?: string, dni?: string) => {
  const [appointments, setAppointments] = useState<PatientPortalSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!patientId || !dni) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getPatientAppointmentsCallable({ patientId, dni });
      setAppointments(result.data.sessions || []);
    } catch {
      setError('No pudimos cargar tus citas. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [patientId, dni]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { appointments, loading, error, refresh };
};
