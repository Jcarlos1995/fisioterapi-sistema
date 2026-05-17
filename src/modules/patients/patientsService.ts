// Servicio de pacientes — toda la lógica de Firestore en un solo lugar.
// Los componentes solo llaman estas funciones y manejan su propio estado de UI.
import { User } from 'firebase/auth';
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, where, getDocs, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Patient } from '../../types';
import { writeAuditLog } from '../../shared/utils/auditLogger';

/** Escucha en tiempo real la colección de pacientes. */
export function subscribeToPatients(
  onData:  (patients: Patient[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'patients'),
    (snap) => onData(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Patient)),
    onError,
  );
}

/** Crea un paciente nuevo y registra auditoría. */
export async function createPatient(
  data: Omit<Patient, 'id'>,
  user: User | null,
): Promise<void> {
  const ref = await addDoc(collection(db, 'patients'), {
    ...data,
    createdAt: new Date().toISOString(),
  });
  if (user) void writeAuditLog(user, 'create_patient', ref.id, data.name);
}

/**
 * Actualiza un paciente y propaga el cambio de profesional en cascada
 * a todas sus sesiones activas.
 */
export async function updatePatient(
  patient: Patient,
  user: User | null,
): Promise<void> {
  const { id, createdAt: _createdAt, ...patientData } = patient;
  await updateDoc(doc(db, 'patients', id), patientData);
  if (user) void writeAuditLog(user, 'update_patient', id, patient.name);

  // Cascada: sincronizar professionalId en todas las sesiones del paciente
  if (patient.professionalId) {
    const snap = await getDocs(
      query(collection(db, 'sessions'), where('patientId', '==', id)),
    );
    await Promise.all(
      snap.docs.map(s =>
        updateDoc(doc(db, 'sessions', s.id), { professionalId: patient.professionalId }),
      ),
    );
  }
}

/** Elimina un paciente y registra auditoría. */
export async function deletePatient(
  id: string,
  patientName: string | undefined,
  user: User | null,
): Promise<void> {
  await deleteDoc(doc(db, 'patients', id));
  if (user) void writeAuditLog(user, 'delete_patient', id, patientName);
}
