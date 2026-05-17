import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, Unsubscribe } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface CancellationNotification {
  id: string;
  patientName: string;
  therapyType: string;
  sessionDate: string;
  sessionTime: string;
  reason?: string | null;
}

/** Escucha notificaciones de cancelación no leídas. */
export function subscribeToCancellationNotifications(
  onData: (items: CancellationNotification[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'cancellationNotifications'),
    where('read', '==', false),
    orderBy('cancelledAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CancellationNotification));
  }, onError);
}

/** Marca una notificación como leída. */
export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'cancellationNotifications', id), { read: true });
}
