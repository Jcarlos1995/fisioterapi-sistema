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
//   activatedAt (string)  — ISO de la última activación
//   history     (array)   — últimos 5 eventos activados (para "Reusar")
//
// La landing lee este documento a través de firebaseSistema.ts (segunda
// instancia apuntando a fisiosystem-8c492) con el hook useLiveEvent.ts.
// Solo lee active/facebookUrl/title/mode — los campos extra son inocuos.
// ================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio, Globe, CheckCircle, XCircle, Tv, AlertCircle, ExternalLink,
  Clock, History, RefreshCw, Youtube, Facebook, Instagram, Music2, AlertTriangle,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { LANDING_URL } from '../../config';
import {
  subscribeToLiveEvent, activateLiveEvent, deactivateLiveEvent,
  isValidEventUrl, detectPlatform, isEmbeddable,
  LiveEventDoc, LiveEventPlatform, LiveEventHistoryEntry,
} from './eventsService';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const PLATFORM_LABELS: Record<LiveEventPlatform, string> = {
  facebook:  'Facebook',
  youtube:   'YouTube',
  tiktok:    'TikTok',
  instagram: 'Instagram',
  other:     'esta plataforma',
};

const PlatformIcon: React.FC<{ platform: LiveEventPlatform; size?: number; className?: string }> = ({
  platform, size = 15, className = 'text-slate-400',
}) => {
  switch (platform) {
    case 'facebook':  return <Facebook size={size} className={className} />;
    case 'youtube':   return <Youtube size={size} className={className} />;
    case 'instagram': return <Instagram size={size} className={className} />;
    case 'tiktok':    return <Music2 size={size} className={className} />;
    default:          return <Globe size={size} className={className} />;
  }
};

/** "sábado 14 de junio, 8:30 p. m." en hora de Lima. */
function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

/** "10 may 2026" para el historial. */
function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-PE', {
      timeZone: 'America/Lima', day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

const EventsManager: React.FC = () => {
  const { showToast } = useToast();

  // Estado actual leído desde Firestore
  const [current, setCurrent]   = useState<LiveEventDoc | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  // Campos del formulario
  const [titleInput, setTitleInput]       = useState('');
  const [urlInput,   setUrlInput]         = useState('');
  const [redirectMode, setRedirectMode]   = useState(false);
  const [saving,     setSaving]           = useState(false);
  const [deactivating, setDeactivating]   = useState(false);

  // Escucha en tiempo real el doc liveEvent
  useEffect(() => {
    return subscribeToLiveEvent(
      (data) => {
        setCurrent(data);
        // El formulario siempre arranca vacío — reusar un evento anterior
        // es una acción explícita desde "Eventos recientes".
        setLoadingDoc(false);
      },
      (err) => {
        console.error('[EventsManager] onSnapshot error:', err);
        setLoadingDoc(false);
      },
    );
  }, []);

  // ── Detección de plataforma y validación de URL ──────────────────────────────
  const trimmedUrl = urlInput.trim();
  const urlValid   = trimmedUrl !== '' && isValidEventUrl(trimmedUrl);
  const platform: LiveEventPlatform | null = urlValid ? detectPlatform(trimmedUrl) : null;
  // Si la plataforma no permite embed, la redirección es obligatoria
  const forcedRedirect = platform !== null && !isEmbeddable(platform);

  useEffect(() => {
    if (forcedRedirect) setRedirectMode(true);
  }, [forcedRedirect]);

  const handleActivate = async () => {
    const url = trimmedUrl;
    const title = titleInput.trim() || 'Evento en Vivo';

    if (!url) {
      showToast('Debes ingresar la URL del evento antes de activar.', 'error');
      return;
    }
    if (!isValidEventUrl(url)) {
      showToast('La URL no es válida. Debe empezar con https:// y tener un dominio real.', 'error');
      return;
    }

    setSaving(true);
    try {
      await activateLiveEvent(
        {
          title,
          facebookUrl: url,
          mode: redirectMode ? 'redirect' : 'embed',
        },
        current?.history ?? [],
      );
      showToast('¡Evento activado! El botón ya aparece en la landing.', 'success');
      setTitleInput('');
      setUrlInput('');
      setRedirectMode(false);
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
      await deactivateLiveEvent();
      showToast('Evento desactivado. El botón ya no aparece en la landing.', 'success');
    } catch (err) {
      console.error('[EventsManager] Error desactivando evento:', err);
      showToast('Error al desactivar el evento. Revisa la consola.', 'error');
    } finally {
      setDeactivating(false);
    }
  };

  /** Rellena el formulario con un evento del historial. */
  const handleReuse = (entry: LiveEventHistoryEntry) => {
    setTitleInput(entry.title);
    setUrlInput(entry.url);
    setRedirectMode(entry.mode === 'redirect');
    showToast('Formulario rellenado. Revisa los datos y activa cuando quieras.');
  };

  // Evento activo hace más de 12 horas — probable olvido
  const longRunning = useMemo(() => {
    if (!current?.active || !current.activatedAt) return false;
    return Date.now() - new Date(current.activatedAt).getTime() > TWELVE_HOURS_MS;
  }, [current]);

  if (loadingDoc) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isActive = current?.active === true;
  const activePlatform = isActive && current ? detectPlatform(current.facebookUrl) : null;
  const history = current?.history ?? [];

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
              <p className="text-slate-700 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium">Plataforma:</span>{' '}
                <span className="inline-flex items-center gap-1 text-slate-600">
                  {activePlatform && <PlatformIcon platform={activePlatform} size={13} className="text-slate-500" />}
                  {activePlatform ? PLATFORM_LABELS[activePlatform] : '—'}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  current.mode === 'redirect'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {current.mode === 'redirect' ? <><ExternalLink size={11} /> Redirección</> : <><Tv size={11} /> Modal embebido</>}
                </span>
              </p>
              {current.activatedAt && (
                <p className="text-slate-600 flex items-center gap-1.5 text-sm">
                  <Clock size={13} className="text-slate-400 shrink-0" />
                  Activo desde el {formatDateTime(current.activatedAt)}
                </p>
              )}
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
              <a
                href={LANDING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline mt-1"
              >
                <ExternalLink size={12} />
                Ver cómo quedó en la landing
              </a>
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

      {/* Aviso: evento activo hace más de 12 horas */}
      {longRunning && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <p>
            Este evento lleva <strong>más de 12 horas</strong> activo. Si el directo ya terminó,
            recuerda desactivarlo para que el botón desaparezca de la landing.
          </p>
        </div>
      )}

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
            URL del evento en vivo
          </label>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={redirectMode
              ? 'https://www.tiktok.com/@usuario/live'
              : 'https://www.facebook.com/TuPagina/videos/123456789'}
            className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent font-mono ${
              trimmedUrl && !urlValid
                ? 'border-rose-300 focus:ring-rose-400'
                : 'border-slate-300 focus:ring-blue-500'
            }`}
          />
          {trimmedUrl && !urlValid ? (
            <p className="text-xs text-rose-500 mt-1 font-medium">
              La URL no es válida — debe empezar con https:// y tener un dominio real.
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">
              {redirectMode
                ? 'Acepta cualquier URL (TikTok, Instagram, YouTube, etc.). Se abrirá en una pestaña nueva.'
                : 'Solo Facebook y YouTube se pueden embeber en el modal de la landing.'}
            </p>
          )}
        </div>

        {/* Aviso: plataforma detectada que no permite embed */}
        {forcedRedirect && platform && (
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-sm text-blue-700">
            <PlatformIcon platform={platform} size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p>
              Detecté una URL de <strong>{PLATFORM_LABELS[platform]}</strong> — esta plataforma no
              permite embed, así que activé <strong>"Solo redireccionar"</strong> automáticamente.
            </p>
          </div>
        )}

        {/* Toggle de modo redirección */}
        <label
          htmlFor="redirect-mode"
          className={`flex items-start gap-3 p-3.5 border rounded-xl transition-colors ${
            forcedRedirect ? 'cursor-not-allowed' : 'cursor-pointer'
          } ${
            redirectMode
              ? 'bg-blue-50 border-blue-300'
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <input
            id="redirect-mode"
            type="checkbox"
            checked={redirectMode}
            disabled={forcedRedirect}
            onChange={(e) => setRedirectMode(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer shrink-0 disabled:cursor-not-allowed"
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <ExternalLink size={14} className="text-slate-500" />
              Solo redireccionar (no abrir modal)
              {forcedRedirect && (
                <span className="text-xs font-medium text-blue-500">· marcado automáticamente</span>
              )}
            </span>
            <span className="text-xs text-slate-500 block mt-1 leading-relaxed">
              Útil para TikTok Live, Instagram Live u otras plataformas que no permiten embed.
              El botón en la landing dirá <span className="font-semibold">"ESTAMOS EN VIVO"</span> y
              llevará al usuario directo al enlace en una pestaña nueva.
            </span>
          </div>
        </label>

        {/* Aviso solo cuando NO está en modo redirect */}
        {!redirectMode && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>
              Para embed en el modal usa Facebook (video público de Página) o YouTube
              (cualquier video o directo). Otras plataformas pueden no funcionar — para
              esas activa "Solo redireccionar".
            </p>
          </div>
        )}

        {/* Botón activar */}
        <button
          onClick={handleActivate}
          disabled={saving || !urlValid}
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

        {!trimmedUrl && (
          <p className="text-center text-xs text-slate-400">
            Ingresa la URL del evento para poder activarlo.
          </p>
        )}
      </div>

      {/* ── Eventos recientes ── */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <History size={16} className="text-slate-500" />
            <h2 className="font-semibold text-slate-700">Eventos recientes</h2>
          </div>
          <div className="space-y-2">
            {history.map((entry, i) => {
              const entryPlatform = detectPlatform(entry.url);
              return (
                <div
                  key={`${entry.url}-${i}`}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-100"
                >
                  <PlatformIcon platform={entryPlatform} size={16} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{entry.title}</p>
                    <p className="text-xs text-slate-400">
                      {PLATFORM_LABELS[entryPlatform] === 'esta plataforma' ? 'Otra plataforma' : PLATFORM_LABELS[entryPlatform]}
                      {' · '}{entry.mode === 'redirect' ? 'redirección' : 'modal embebido'}
                      {' · '}{formatShortDate(entry.activatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReuse(entry)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw size={12} />
                    Reusar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ayuda */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-700 space-y-2">
        <p className="font-semibold">¿Cómo funciona?</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600">
          <li>Al activar, el botón rojo "Ver evento en vivo" aparece al instante en la landing.</li>
          <li>Al hacer clic en ese botón, los visitantes ven el directo en un modal.</li>
          <li>Al desactivar, el botón desaparece sin necesidad de deploy.</li>
          <li><strong>Modal embebido:</strong> Facebook (video público de Página) o YouTube.</li>
          <li><strong>Solo redireccionar:</strong> cualquier otra plataforma (TikTok, Instagram, etc.) — se marca solo al detectar la URL.</li>
          <li>Puedes reutilizar un evento anterior desde "Eventos recientes".</li>
        </ul>
      </div>

    </div>
  );
};

export default EventsManager;
