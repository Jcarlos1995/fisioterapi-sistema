import React from 'react';

/* ── Base pulse block ─────────────────────────────────────────────── */
const Pulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
);

/* ── Dashboard: stat cards (5 tarjetas) ──────────────────────────── */
export const SkeletonStatCards: React.FC = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <Pulse className="w-9 h-9 rounded-xl" />
        <Pulse className="h-7 w-16" />
        <Pulse className="h-3 w-20" />
      </div>
    ))}
  </div>
);

/* ── Dashboard: gráficas ──────────────────────────────────────────── */
export const SkeletonCharts: React.FC = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
      <Pulse className="h-5 w-48" />
      <div className="h-64 flex items-end gap-3 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <Pulse className="w-full animate-pulse" style={{ height: `${40 + Math.random() * 120}px` } as React.CSSProperties} />
          </div>
        ))}
      </div>
    </div>
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-4">
      <Pulse className="h-5 w-36 self-start" />
      <Pulse className="w-44 h-44 rounded-full" />
      <div className="flex gap-4">
        <Pulse className="h-4 w-20" />
        <Pulse className="h-4 w-16" />
      </div>
    </div>
  </div>
);

/* ── Tabla genérica: filas (Patients, Products) ───────────────────── */
export const SkeletonTableRows: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 6,
  cols = 4,
}) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-3 bg-white rounded-xl border border-slate-100">
        {Array.from({ length: cols }).map((_, j) => (
          <Pulse key={j} className={`h-4 ${j === 0 ? 'w-32 flex-shrink-0' : 'flex-1'}`} />
        ))}
      </div>
    ))}
  </div>
);

/* ── Sessions: tarjetas de sesión ─────────────────────────────────── */
export const SkeletonSessionCards: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100">
        <Pulse className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-4 w-40" />
          <Pulse className="h-3 w-56" />
        </div>
        <Pulse className="h-6 w-20 rounded-full flex-shrink-0" />
      </div>
    ))}
  </div>
);

/* ── Professionals: tarjetas ──────────────────────────────────────── */
export const SkeletonProfessionalCards: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Pulse className="w-12 h-12 rounded-full flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Pulse className="h-4 w-32" />
            <Pulse className="h-3 w-24" />
          </div>
        </div>
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-3/4" />
      </div>
    ))}
  </div>
);

/* ── Header de sección genérico (título + botón) ─────────────────── */
export const SkeletonHeader: React.FC = () => (
  <div className="flex items-center justify-between">
    <Pulse className="h-8 w-48" />
    <Pulse className="h-9 w-32 rounded-xl" />
  </div>
);

/* ── Barra de búsqueda ────────────────────────────────────────────── */
export const SkeletonSearchBar: React.FC = () => (
  <Pulse className="h-10 w-full rounded-xl" />
);
