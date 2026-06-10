// Servicio de sesiones — toda la lógica de Firestore en un solo lugar.
import { User } from 'firebase/auth';
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, getDocs, query, where, getDoc, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Session, Patient } from '../../types';
import { writeAuditLog } from '../../shared/utils/auditLogger';

/** Escucha en tiempo real la colección de sesiones. */
export function subscribeToSessions(
  onData:  (sessions: Session[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'sessions'),
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Session)),
    onError,
  );
}

/** Sesiones de un paciente (lectura única — para el expediente). */
export async function fetchSessionsByPatient(patientId: string): Promise<Session[]> {
  const snap = await getDocs(
    query(collection(db, 'sessions'), where('patientId', '==', patientId)),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Session);
}

/**
 * IDs de pacientes con al menos una sesión desde una fecha dada.
 * Para detectar pacientes inactivos sin descargar toda la colección.
 */
export async function fetchActivePatientIdsSince(sinceDate: string): Promise<Set<string>> {
  const snap = await getDocs(
    query(collection(db, 'sessions'), where('date', '>=', sinceDate)),
  );
  return new Set(snap.docs.map(d => (d.data() as Session).patientId));
}

/** Obtiene los precios de servicios configurados (doc único). */
export async function fetchServicePrices(): Promise<Record<string, number>> {
  const snap = await getDoc(doc(db, 'servicePrices', 'default'));
  return snap.exists() ? (snap.data() as Record<string, number>) : {};
}

/** Verifica si ya existe una venta ligada a una sesión. */
export async function saleExistsForSession(sessionId: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, 'sales'), where('sessionId', '==', sessionId)),
  );
  return !snap.empty;
}

interface AutoSaleParams {
  session:       Session;
  patients:      Patient[];
  servicePrices: Record<string, number>;
  user:          User | null;
  staffName:     string;
}

/** Crea la venta automática al marcar una sesión como Pagada. */
export async function createAutoSale({
  session, patients, servicePrices, user, staffName,
}: AutoSaleParams): Promise<void> {
  const patient = patients.find(p => p.id === session.patientId);
  const price   = servicePrices[session.therapyType] ?? 0;
  await addDoc(collection(db, 'sales'), {
    type:           'service',
    sessionId:      session.id,
    patientId:      session.patientId,
    patientName:    patient?.name || 'Paciente',
    itemName:       session.therapyType,
    unitPrice:      price,
    qty:            1,
    total:          price,
    date:           session.date,
    validOnlyToday: true,
    notes:          'Venta registrada automáticamente al marcar como Pagada.',
    createdAt:      new Date().toISOString(),
    createdByUid:   user?.uid ?? '',
    createdByName:  staffName,
  });
}

/** Actualiza el estado de una sesión. */
export async function updateSessionStatus(
  sessionId:  string,
  newStatus:  Session['status'],
  user:       User | null,
  patientName?: string,
  oldStatus?:   Session['status'],
): Promise<void> {
  await updateDoc(doc(db, 'sessions', sessionId), { status: newStatus });
  if (user) {
    void writeAuditLog(user, 'update_session_status', sessionId, patientName, {
      oldStatus,
      newStatus,
    });
  }
}

interface NewSessionData {
  patientId:      string;
  professionalId: string;
  date:           string;
  time:           string;
  therapyType:    string;
  status:         Session['status'];
  notes:          string;
}

/** Crea una sesión nueva y registra auditoría. */
export async function createSession(
  data:       NewSessionData,
  user:       User | null,
  patientName?: string,
): Promise<void> {
  const ref = await addDoc(collection(db, 'sessions'), {
    ...data,
    yearMonth: data.date.substring(0, 7),
  });
  if (user) {
    void writeAuditLog(user, 'create_session', ref.id, patientName, {
      date: data.date,
      therapyType: data.therapyType,
    });
  }
}

/** Elimina una sesión y registra auditoría. */
export async function deleteSession(
  id:          string,
  user:        User | null,
  patientName?: string,
  sessionMeta?: { date?: string; therapyType?: string },
): Promise<void> {
  await deleteDoc(doc(db, 'sessions', id));
  if (user) {
    void writeAuditLog(user, 'delete_session', id, patientName, sessionMeta);
  }
}
