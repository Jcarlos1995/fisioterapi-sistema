// Servicio de profesionales — toda la lógica de Firestore en un solo lugar.
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, getDocs, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Professional, UserPermissions } from '../../types';

/** Escucha en tiempo real la colección de profesionales. */
export function subscribeToProfessionals(
  onData:  (professionals: Professional[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'professionals'),
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Professional)),
    onError,
  );
}

/** Crea un profesional nuevo. */
export async function createProfessional(
  data: Omit<Professional, 'id'>,
): Promise<void> {
  await addDoc(collection(db, 'professionals'), data);
}

/** Actualiza los datos de un profesional. */
export async function updateProfessional(
  id: string,
  data: Partial<Omit<Professional, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db, 'professionals', id), data);
}

/** Elimina un profesional. */
export async function deleteProfessional(id: string): Promise<void> {
  await deleteDoc(doc(db, 'professionals', id));
}

/** Actualiza los permisos de un operador (guardados en el doc del profesional). */
export async function updateProfessionalPermissions(
  id: string,
  permissions: UserPermissions,
): Promise<void> {
  await updateDoc(doc(db, 'professionals', id), { permissions });
}

interface UserRoleDoc { uid: string; email: string; role: string; active: boolean; }

/** Obtiene todos los usuarios con un rol asignado (para el modal de gestión de usuarios TI). */
export async function fetchActiveUsers(): Promise<UserRoleDoc[]> {
  const snap = await getDocs(collection(db, 'userRoles'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }) as UserRoleDoc);
}

/** Activa o desactiva un usuario por su UID. */
export async function setUserActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'userRoles', uid), { active });
}

/** Cambia el rol de un usuario. */
export async function setUserRole(uid: string, role: string): Promise<void> {
  await updateDoc(doc(db, 'userRoles', uid), { role });
}
