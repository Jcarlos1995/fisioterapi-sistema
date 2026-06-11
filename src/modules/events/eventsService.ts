import { doc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export type LiveEventMode = 'embed' | 'redirect';
export type LiveEventPlatform = 'facebook' | 'youtube' | 'tiktok' | 'instagram' | 'other';

export interface LiveEventHistoryEntry {
  title: string;
  url: string;
  mode: LiveEventMode;
  activatedAt: string;
}

export interface LiveEventDoc {
  active: boolean;
  facebookUrl: string;
  title: string;
  mode: LiveEventMode;
  activatedAt?: string;
  history?: LiveEventHistoryEntry[];
}

const LIVE_EVENT_REF = doc(db, 'config', 'liveEvent');
const HISTORY_LIMIT = 5;

/** Valida que la URL sea http(s) con un dominio razonable. */
export function isValidEventUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Detecta la plataforma del directo a partir de la URL. */
export function detectPlatform(raw: string): LiveEventPlatform {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase();
    if (host.includes('facebook.com') || host.includes('fb.watch')) return 'facebook';
    if (host.includes('youtube.com') || host.includes('youtu.be'))  return 'youtube';
    if (host.includes('tiktok.com'))    return 'tiktok';
    if (host.includes('instagram.com')) return 'instagram';
    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * Solo Facebook y YouTube se pueden embeber en el modal de la landing.
 * Cualquier otra plataforma debe usar modo redirección.
 */
export function isEmbeddable(platform: LiveEventPlatform): boolean {
  return platform === 'facebook' || platform === 'youtube';
}

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
        activatedAt: raw.activatedAt ? String(raw.activatedAt) : undefined,
        history:     Array.isArray(raw.history) ? (raw.history as LiveEventHistoryEntry[]) : [],
      });
    },
    onError,
  );
}

/**
 * Activa el evento en vivo, guarda la fecha de activación y lo registra
 * en el historial (últimos 5, sin duplicar la misma URL).
 */
export async function activateLiveEvent(
  event: { title: string; facebookUrl: string; mode: LiveEventMode },
  previousHistory: LiveEventHistoryEntry[],
): Promise<void> {
  const activatedAt = new Date().toISOString();
  const entry: LiveEventHistoryEntry = {
    title: event.title,
    url:   event.facebookUrl,
    mode:  event.mode,
    activatedAt,
  };
  const history = [entry, ...previousHistory.filter(h => h.url !== entry.url)]
    .slice(0, HISTORY_LIMIT);

  await setDoc(LIVE_EVENT_REF, {
    active:      true,
    facebookUrl: event.facebookUrl,
    title:       event.title,
    mode:        event.mode,
    activatedAt,
    history,
  });
}

/** Desactiva el evento en vivo conservando el historial. */
export async function deactivateLiveEvent(): Promise<void> {
  await setDoc(LIVE_EVENT_REF, {
    active:      false,
    facebookUrl: '',
    title:       'Evento en Vivo',
    mode:        'embed',
    activatedAt: '',
  }, { merge: true });
}
