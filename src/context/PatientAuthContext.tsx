import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { PortalPatient } from '../modules/portal/types';

const STORAGE_KEY = 'patientPortalSession';
const SESSION_MS = 60 * 60 * 1000;

interface ValidatePatientLoginResponse {
  patient: {
    id: string;
    name: string;
    email: string;
    phone: string;
    birthDate: string;
  };
}

interface StoredPatientSession {
  patientId: string;
  patientDni: string;
  patientBirthDate: string;
  expiresAt: number;
}

interface PatientAuthContextType {
  currentPatient: PortalPatient | null;
  loading: boolean;
  login: (dni: string, birthDate: string) => Promise<PortalPatient>;
  logout: () => void;
}

const PatientAuthContext = createContext<PatientAuthContextType>({
  currentPatient: null,
  loading: true,
  login: async () => {
    throw new Error('PatientAuthContext no inicializado');
  },
  logout: () => {},
});

const validatePatientLoginCallable = httpsCallable<
  { dni: string; birthDate: string },
  ValidatePatientLoginResponse
>(functions, 'validatePatientLogin');

const mapPortalPatient = (
  data: ValidatePatientLoginResponse['patient'],
  dni: string
): PortalPatient => ({
  id: data.id,
  name: data.name,
  email: data.email,
  phone: data.phone,
  birthDate: data.birthDate,
  dni,
});

export const PatientAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPatient, setCurrentPatient] = useState<PortalPatient | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setCurrentPatient(null);
  }, []);

  const login = useCallback(async (dni: string, birthDate: string) => {
    const cleanDni = dni.trim().toUpperCase();
    const cleanBirthDate = birthDate.trim();
    const result = await validatePatientLoginCallable({ dni: cleanDni, birthDate: cleanBirthDate });
    const patient = mapPortalPatient(result.data.patient, cleanDni);

    const sessionData: StoredPatientSession = {
      patientId: patient.id,
      patientDni: cleanDni,
      patientBirthDate: cleanBirthDate,
      expiresAt: Date.now() + SESSION_MS,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    setCurrentPatient(patient);
    return patient;
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as StoredPatientSession;
        if (!parsed.expiresAt || parsed.expiresAt <= Date.now()) {
          logout();
          setLoading(false);
          return;
        }

        const result = await validatePatientLoginCallable({
          dni: parsed.patientDni,
          birthDate: parsed.patientBirthDate,
        });

        setCurrentPatient(mapPortalPatient(result.data.patient, parsed.patientDni));
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [logout]);

  const value = useMemo(
    () => ({ currentPatient, loading, login, logout }),
    [currentPatient, loading, login, logout]
  );

  return <PatientAuthContext.Provider value={value}>{children}</PatientAuthContext.Provider>;
};

export const usePatientAuth = () => useContext(PatientAuthContext);
