// Servicio de historias/testimonios — toda la lógica de Firestore en un solo lugar.
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, getDocs, Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { Story } from '../../types';

/** Escucha en tiempo real la colección de historias. */
export function subscribeToStories(
  onData:  (stories: Story[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'stories'),
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Story)),
    onError,
  );
}

/**
 * Sube un blob (imagen ya comprimida en el componente) al Storage
 * y devuelve su URL de descarga.
 */
export async function uploadStoryBlob(blob: Blob, fileName: string): Promise<string> {
  const storageRef = ref(storage, `stories/${Date.now()}_${fileName}`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

/** Crea una historia nueva en Firestore. */
export async function saveStory(data: Omit<Story, 'id'>): Promise<void> {
  await addDoc(collection(db, 'stories'), data);
}

/** Obtiene todas las historias (lectura única). */
export async function fetchStories(): Promise<Story[]> {
  const snap = await getDocs(collection(db, 'stories'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Story);
}

/** Elimina una historia. */
export async function deleteStory(id: string): Promise<void> {
  await deleteDoc(doc(db, 'stories', id));
}
