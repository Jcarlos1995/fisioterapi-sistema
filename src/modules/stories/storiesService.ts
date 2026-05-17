// Servicio de historias/testimonios — toda la lógica de Firestore en un solo lugar.
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, Unsubscribe,
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

/** Sube una imagen al Storage y devuelve su URL de descarga. */
export async function uploadStoryImage(file: File): Promise<string> {
  const storageRef = ref(storage, `stories/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/** Crea una historia nueva, con imagen opcional. */
export async function createStory(
  data: Omit<Story, 'id'>,
  imageFile?: File | null,
): Promise<void> {
  const imageUrl = imageFile ? await uploadStoryImage(imageFile) : undefined;
  await addDoc(collection(db, 'stories'), {
    ...data,
    ...(imageUrl ? { imageUrl } : {}),
  });
}

/** Actualiza una historia existente, con imagen opcional. */
export async function updateStory(
  id: string,
  data: Partial<Omit<Story, 'id'>>,
  imageFile?: File | null,
): Promise<void> {
  const imageUrl = imageFile ? await uploadStoryImage(imageFile) : undefined;
  await updateDoc(doc(db, 'stories', id), {
    ...data,
    ...(imageUrl ? { imageUrl } : {}),
  });
}

/** Elimina una historia. */
export async function deleteStory(id: string): Promise<void> {
  await deleteDoc(doc(db, 'stories', id));
}
