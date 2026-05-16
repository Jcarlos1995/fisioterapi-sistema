// ================================================================
// MÓDULO DE EVENTOS EN VIVO
// ================================================================
// Solo visible para el rol TI.
// Controla el botón "Ver evento en vivo" de la landing pública
// sin necesidad de hacer deploy.
//
// Firestore: fisiosystem-8c492 → colección: config → doc: liveEvent
//   active      (boolean) — true muestra el botón en la landing
//   facebookUrl (string)  — URL del directo (Facebook, TikTok, YouTube…)
//   title       (string)  — Título mostrado en el modal de la landing
//
// La landing lee este documento a través de firebaseSistema.ts (segunda
// instancia apuntando a fisiosystem-8c492) con el hook useLiveEvent.ts.
// Busca "BOTÓN DE EVENTO EN VIVO" en landing/src/components/Hero.tsx
// para ver cómo se renderiza el botón y el modal.
// ================================================================

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Radio, Globe, CheckCircle, XCircle, Tv, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface LiveEventDoc {
  active: boolean;
  facebookUrl: string;
  title: string;
}

const LIVE_EVENT_REF = doc(db, 'config', 'liveEvent');

const DEFAULT_DOC: LiveEventDoc = {
  active:      false,
  facebookUrl: '',
  title:       'Evento en Vivo',
};

const EventsManager: React.FC = () => {
  const { showToast } = useToast();

  // Estado actual leído desde Firestore
  const [current, setCurrent]   = useState<LiveEventDoc | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  // Campos del formulario
  const [titleInput, setTitleInput]       = useState('');
  const [urlInput,   setUrlInput]         = useState('');
  const [saving,     setSaving]           = useState(false);
  const [deactivating, setDeactivating]   = useState(false);

  // Escucha en tiempo real el doc liveEvent
  useEffect(() => {
    const unsub = onSnapshot(
      LIVE_EVENT_REF,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as LiveEventDoc;
          setCurrent(data);
          // Solo pre-rellena el form si no hay un evento activo (para no
          // interrumpir una edición en curso)
          if (!data.active) {
            setTitleInput(data.title || '');
            setUrlInput(data.facebookUrl || '');
          }
        } else {
          setCurrent(null);
          setTitleInput('');
          setUrlInput('');
        }
        setLoadingDoc(false);
      },
      (err) => {
        console.error('[EventsManager] onSnapshot error:', err);
        setLoadingDoc(false);
      }
    );
    return () => unsub();
  }, []);

  const handleActivate = async () => {
    const url = urlInput.trim();
    const title = titleInput.trim() || 'Evento en Vivo';

    if (!url) {
      showToast('Debes ingresar la URL del evento antes de activar.', 'error');
      return;
    }

    setSaving(true);
    try {
      await setDoc(LIVE_EVENT_REF, {
        active:      true,
        facebookUrl: url,
        title:       title,
      } satisfies LiveEventDoc);
      showToast('¡Evento activado! El botón ya aparece en la landing.', 'success');
    } catch (err) {
      console.error('[EventsManager] Error activando evento:', err);
      showToast('Error al activar el evento. Revisa la consola.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await setDoc(LIVE_EVENT_REF, {
        active:      false,
        facebookUrl: current?.facebookUrl ?? '',
        title:       current?.title ?? 'Evento en Vivo',
      } satisfies LiveEventDoc);
      showToast('Evento desactivado. El botón ya no aparece en la landing.', 'success');
    } catch (err) {
      console.error('[EventsManager] Error desactivando evento:', err);
      showToast('Error al desactivar el evento. Revisa la consola.', 'error');
    } finally {
      setDeactivating(false);
    }
  };

  if (loadingDoc) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isActive = current?.active === true;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="bg-red-100 p-2.5 rounded-xl">
          <Radio size={22} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Eventos en Vivo</h1>
          <p className="text-slate-500 text-sm">
            Activa o desactiva el botón de evento en vivo en la landing pública. Sin deploy.
          </p>
        </div>
      </div>

      {/* Estado actual */}
      <div className={`rounded-2xl border-2 p-5 flex items-start gap-4 ${
        isActive
          ? 'border-green-300 bg-green-50'
          : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="mt-0.5 shrink-0">
          {isActive
            ? <CheckCircle size={22} className="text-green-600" />
            : <XCircle    size={22} className="text-slate-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${isActive ? 'text-green-700' : 'text-slate-500'}`}>
            {isActive ? 'Evento ACTIVO' : 'Sin evento activo'}
          </p>
          {isActive && current && (
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-slate-700">
                <span className="font-medium">Título:</span>{' '}
                <span className="text-slate-600">{current.title}</span>
              </p>
              <p className="text-slate-700 break-all">
                <span className="font-medium">URL:</span>{' '}
                <a
                  href={current.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {current.facebookUrl}
                </a>
              </p>
            </div>
          )}
          {!isActive && (
            <p className="text-slate-400 text-sm mt-1">
              El botón no aparece en la landing hasta que actives un evento.
            </p>
          )}
        </div>

        {/* Botón desactivar — solo cuando hay evento activo */}
        {isActive && (
          <button
            onClick={handleDeactivate}
            disabled={deactivating}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            <XCircle size={16} />
            {deactivating ? 'Desactivando...' : 'Desactivar'}
          </button>
        )}
      </div>

      {/* Formulario de activación */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Tv size={18} className="text-slate-500" />
          <h2 className="font-semibold text-slate-700">
            {isActive ? 'Actualizar evento' : 'Configurar nuevo evento'}
          </h2>
        </div>

        {/* Título */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Título del evento
          </label>
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder='Ej: Sorteo Día de la Madre 🎁'
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={80}
          />
          <p className="text-xs text-slate-400 mt-1">
            Se muestra como encabezado en el modal de la landing.
          </p>
        </div>

        {/* URL */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Globe size={14} className="text-slate-500" />
            URL de Facebook Live
          </label>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder='https://www.facebook.com/video/...'
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
          <p className="text-xs text-slate-400 mt-1">
            Solo compatible con Facebook Live.
          </p>
        </div>

        {/* Aviso Facebook */}
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>
            Usa la URL directa del video o directo de Facebook
            (ej: <span className="font-mono">https://www.facebook.com/TuPagina/videos/123456789</span>).
            El video debe ser público y pertenecer a una Página de Facebook.
          </p>
        </div>

        {/* Botón activar */}
        <button
          onClick={handleActivate}
          disabled={saving || !urlInput.trim()}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Activando...
            </>
          ) : (
            <>
              <Radio size={17} />
              {isActive ? 'Actualizar evento en vivo' : 'Activar evento en vivo'}
            </>
          )}
        </button>

        {!urlInput.trim() && (
          <p className="text-center text-xs text-slate-400">
            Ingresa la URL del evento para poder activarlo.
          </p>
        )}
      </div>

      {/* Ayuda */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-700 space-y-2">
        <p className="font-semibold">¿Cómo funciona?</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600">
          <li>Al activar, el botón rojo "Ver evento en vivo" aparece al instante en la landing.</li>
          <li>Al hacer clic en ese botón, los visitantes ven el directo en un modal.</li>
          <li>Al desactivar, el botón desaparece sin necesidad de deploy.</li>
          <li>Solo funciona con Facebook Live (videos públicos de Páginas de Facebook).</li>
          <li>Puedes reutilizarlo para cualquier evento: sorteos, clases, anuncios, etc.</li>
        </ul>
      </div>

    </div>
  );
};

export default EventsManager;
