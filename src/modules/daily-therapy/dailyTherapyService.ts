import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface TherapyTask {
  id: string;
  name: string;
  order: number;
  active: boolean;
  createdAt: string;
}

export interface TherapyPatientTask {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  taskId: string;
  taskName: string;
  assignedAt: string;
  assignedByUid: string;
  assignedByName: string;
  done: boolean;
  completedAt?: string;
  completedByUid?: string;
  completedByName?: string;
}

/** Escucha la plantilla global de tareas en tiempo real. */
export function subscribeToTherapyTasks(
  onData: (tasks: TherapyTask[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'therapyTasks'), orderBy('createdAt', 'desc')),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as TherapyTask)),
    onError,
  );
}

/** Añade una tarea nueva a la plantilla global. */
export async function addTherapyTask(name: string, order: number): Promise<void> {
  await addDoc(collection(db, 'therapyTasks'), {
    name, order, active: true,
    createdAt: new Date().toISOString(),
  });
}

/** Activa o desactiva una tarea de la plantilla. */
export async function toggleTherapyTask(id: string, currentActive: boolean): Promise<void> {
  await updateDoc(doc(db, 'therapyTasks', id), { active: !currentActive });
}

/** Elimina una tarea de la plantilla global. */
export async function deleteTherapyTask(id: string): Promise<void> {
  await deleteDoc(doc(db, 'therapyTasks', id));
}

/** Escucha las tareas asignadas a un paciente en una fecha concreta. */
export function subscribeToPatientTasks(
  patientId: string,
  date: string,
  onData: (tasks: TherapyPatientTask[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, 'therapyPatientTasks'),
      where('patientId', '==', patientId),
      where('date', '==', date),
    ),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as TherapyPatientTask)),
    onError,
  );
}

interface AssignTaskParams {
  patientId: string;
  patientName: string;
  date: string;
  taskId: string;
  taskName: string;
  assignedByUid: string;
  assignedByName: string;
}

/** Asigna una tarea a un paciente para una fecha. */
export async function assignPatientTask(params: AssignTaskParams): Promise<void> {
  await addDoc(collection(db, 'therapyPatientTasks'), {
    ...params,
    assignedAt: new Date().toISOString(),
    done: false,
  });
}

/** Retira la asignación de una tarea a un paciente. */
export async function unassignPatientTask(taskDocId: string): Promise<void> {
  await deleteDoc(doc(db, 'therapyPatientTasks', taskDocId));
}

interface MarkDoneParams {
  taskDocId: string;
  done: boolean;
  completedByUid?: string;
  completedByName?: string;
}

/** Marca una tarea asignada como hecha o pendiente. */
export async function togglePatientTaskDone(params: MarkDoneParams): Promise<void> {
  const { taskDocId, done, completedByUid, completedByName } = params;
  if (done) {
    await updateDoc(doc(db, 'therapyPatientTasks', taskDocId), {
      done: false, completedAt: null, completedByUid: null, completedByName: null,
    });
  } else {
    await updateDoc(doc(db, 'therapyPatientTasks', taskDocId), {
      done: true,
      completedAt: new Date().toISOString(),
      completedByUid: completedByUid ?? '',
      completedByName: completedByName ?? '',
    });
  }
}
