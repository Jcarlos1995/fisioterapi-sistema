import { doc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export type LiveEventMode = 'embed' | 'redirect';

export interface LiveEventDoc {
  active: boolean;
  facebookUrl: string;
  title: string;
  mode: LiveEventMode;
}

const LIVE_EVENT_REF = doc(db, 'config', 'liveEvent');

/** Escucha en tiempo real el documento del evento en vivo. */
export function subscribeToLiveEvent(
  onData: (event: LiveEventDoc | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    LIVE_EVENT_REF,
    (snap) => {
      if (!snap.exists()) { onData(null); return; }
      const raw = snap.data();
      onData({
        active:      Boolean(raw.active),
        facebookUrl: String(raw.facebookUrl ?? ''),
        title:       String(raw.title ?? 'Evento en Vivo'),
        mode:        raw.mode === 'redirect' ? 'redirect' : 'embed',
      });
    },
    onError,
  );
}

/** Activa el evento en vivo. */
export async function activateLiveEvent(event: LiveEventDoc): Promise<void> {
  await setDoc(LIVE_EVENT_REF, event);
}

/** Desactiva el evento en vivo. */
export async function deactivateLiveEvent(): Promise<void> {
  await setDoc(LIVE_EVENT_REF, {
    active: false, facebookUrl: '', title: 'Evento en Vivo', mode: 'embed',
  } satisfies LiveEventDoc);
}
