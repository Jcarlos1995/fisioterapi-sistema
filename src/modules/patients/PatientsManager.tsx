import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Edit2, Trash2, X, WifiOff, MessageCircle,
  ChevronLeft, ChevronRight, Download, UserX, Calendar,
  ShoppingBag, ClipboardList, CalendarRange, Loader2,
} from 'lucide-react';
import { Patient, Professional, Session } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useEscKey from '../../shared/hooks/useEscKey';
import { validateBirthDate, validateDni } from '../../shared/utils/validation';
import { writeAuditLog } from '../../shared/utils/auditLogger';
import { statusBadgeClass } from '../../shared/utils/session';
import ConfirmModal from '../../shared/components/ConfirmModal';
import { subscribeToPatients, createPatient, updatePatient, deletePatient } from './patientsService';
import { subscribeToProfessionals } from '../professionals/professionalsService';
import { fetchSessionsByPatient, fetchActivePatientIdsSince } from '../sessions/sessionsService';
import { fetchSalesByPatient, Sale } from '../sales/salesService';
import { fetchPatientTasksForDates, TherapyPatientTask } from '../daily-therapy/dailyTherapyService';
import { SkeletonHeader, SkeletonSearchBar, SkeletonTableRows } from '../../shared/components/SkeletonLoader';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const INACTIVE_MONTHS = 3;

// Fecha de HOY en zona horaria de Lima
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

/** Iniciales para el avatar. */
function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/** Edad a partir de la fecha de nacimiento. */
function calcAge(birthDate: string): number {
  const today = new Date();
  const b = new Date(`${birthDate}T12:00:00`);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return Math.max(0, age);
}

/** Link de WhatsApp a partir de un teléfono peruano (9 dígitos → prefijo 51). */
function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const full = digits.length === 9 ? `51${digits}` : digits;
  return `https://wa.me/${full}`;
}

/** Fecha corta: "vie 13 jun". */
function formatShort(dateStr: string): string {
  try {
    return new Date(`${dateStr}T12:00:00-05:00`).toLocaleDateString('es-PE', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch { return dateStr; }
}

/** Suma días a una fecha YYYY-MM-DD. */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Fecha de hace n meses (YYYY-MM-DD, Lima). */
function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

/** Etiqueta corta del día: "Lu". */
function dayLetter(dateStr: string): string {
  try {
    const label = new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'short' });
    return label.charAt(0).toUpperCase() + label.slice(1, 2);
  } catch { return '?'; }
}

function currency(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

const WEEK_DATES = Array.from({ length: 7 }, (_, i) => shiftDate(TODAY, i - 6));

interface ExpedienteData {
  sessions: Session[];
  sales: Sale[];
  week: Record<string, TherapyPatientTask[]>;
}

type ExpedienteTab = 'citas' | 'compras' | 'terapia';

// ─── Componente ───────────────────────────────────────────────────────────────

const PatientsManager: React.FC = () => {
  const { user, isTI, role, permissions } = useAuth();
  const { showToast } = useToast();
  const isAdminOrTI = isTI || role === 'admin';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros y paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [profFilter, setProfFilter] = useState('');
  const [page, setPage] = useState(1);

  // Detección de inactivos (bajo demanda)
  const [inactiveIds, setInactiveIds] = useState<Set<string> | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [showOnlyInactive, setShowOnlyInactive] = useState(false);

  // Modal de formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<Partial<Patient>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Expediente
  const [expPatient, setExpPatient] = useState<Patient | null>(null);
  const [expData, setExpData] = useState<ExpedienteData | null>(null);
  const [loadingExp, setLoadingExp] = useState(false);
  const [expTab, setExpTab] = useState<ExpedienteTab>('citas');

  useEscKey(() => setIsModalOpen(false), isModalOpen);
  useEscKey(() => setExpPatient(null), !!expPatient && !isModalOpen);

  useEffect(() => {
    const onErr = (err: Error) => {
      console.error('onSnapshot [patients/professionals]:', err);
      setLoadError('No se pudieron cargar los datos. Verifica tu conexión e intenta de nuevo.');
    };

    const unsubPatients = subscribeToPatients(
      (data) => { setLoadError(null); setIsLoading(false); setPatients(data); },
      onErr,
    );
    const unsubProfs = subscribeToProfessionals(
      (data) => setProfessionals(data),
      onErr,
    );

    return () => { unsubPatients(); unsubProfs(); };
  }, []);

  // Reiniciar página al cambiar filtros
  useEffect(() => { setPage(1); }, [searchTerm, profFilter, showOnlyInactive]);

  // ─── Lista filtrada y paginada ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return [...patients]
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      .filter(p =>
        ((p.name?.toLowerCase() ?? '').includes(term) || (p.dni?.toLowerCase() ?? '').includes(term)) &&
        (!profFilter || p.professionalId === profFilter) &&
        (!showOnlyInactive || (inactiveIds?.has(p.id) ?? false))
      );
  }, [patients, searchTerm, profFilter, showOnlyInactive, inactiveIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getProfName = (id?: string) =>
    professionals.find(p => p.id === id)?.name || 'No asignado';

  // ─── CRUD ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dniValidation = validateDni(currentPatient.dni ?? '');
      if (!dniValidation.valid) {
        showToast(dniValidation.error || 'DNI inválido.', 'error');
        return;
      }
      if (currentPatient.birthDate) {
        const birthDateValidation = validateBirthDate(currentPatient.birthDate);
        if (!birthDateValidation.valid) {
          showToast(birthDateValidation.error || 'Fecha de nacimiento inválida.', 'error');
          return;
        }
      }

      if (currentPatient.id) {
        await updatePatient(currentPatient as Patient, user);
      } else {
        await createPatient(currentPatient as Omit<Patient, 'id'>, user);
      }
      setIsModalOpen(false);
      setCurrentPatient({});
      showToast();
    } catch (error) {
      console.error("Error en Firebase:", error);
      showToast("Error al procesar la solicitud", 'error');
    }
  };

  const confirmDeletePatient = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      const patientName = patients.find(p => p.id === id)?.name;
      await deletePatient(id, patientName, user);
      if (expPatient?.id === id) setExpPatient(null);
      showToast('Paciente eliminado');
    } catch (error) {
      console.error("Error al eliminar:", error);
      showToast('Error al eliminar el paciente', 'error');
    }
  };

  // Abre el modal de edición y registra auditoría
  const handleEditOpen = (patient: Patient) => {
    setCurrentPatient(patient);
    setIsModalOpen(true);
    if (user) void writeAuditLog(user, 'open_patient_detail', patient.id, patient.name);
  };

  // ─── Expediente ──────────────────────────────────────────────────────────────
  const openExpediente = async (patient: Patient) => {
    setExpPatient(patient);
    setExpTab('citas');
    setExpData(null);
    setLoadingExp(true);
    if (user) void writeAuditLog(user, 'open_patient_detail', patient.id, patient.name);
    try {
      const [sessions, sales, week] = await Promise.all([
        fetchSessionsByPatient(patient.id),
        fetchSalesByPatient(patient.id),
        fetchPatientTasksForDates(patient.id, WEEK_DATES),
      ]);
      setExpData({ sessions, sales, week });
    } catch (error) {
      console.error('Error cargando expediente:', error);
      showToast('No se pudo cargar el expediente.', 'error');
    } finally {
      setLoadingExp(false);
    }
  };

  // Datos derivados del expediente
  const expSessions = useMemo(() =>
    (expData?.sessions ?? []).slice().sort((a, b) =>
      `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)
    ), [expData]);

  const nextAppointment = useMemo(() =>
    (expData?.sessions ?? [])
      .filter(s => s.date >= TODAY && (s.status === 'Programada' || s.status === 'Confirmada'))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0] ?? null,
    [expData]);

  const lastVisit = useMemo(() =>
    (expData?.sessions ?? [])
      .filter(s => s.date <= TODAY && (s.status === 'Efectuada' || s.status === 'Pagada'))
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))[0] ?? null,
    [expData]);

  const activePack = useMemo(() =>
    (expData?.sales ?? []).find(s =>
      !s.validOnlyToday && s.validFrom && s.validTo &&
      s.validFrom <= TODAY && s.validTo >= TODAY
    ) ?? null,
    [expData]);

  const expSales = useMemo(() =>
    (expData?.sales ?? []).slice().sort((a, b) => b.date.localeCompare(a.date)),
    [expData]);

  const totalSpent = useMemo(() =>
    (expData?.sales ?? []).reduce((sum, s) => sum + s.total, 0),
    [expData]);

  // ─── Detección de inactivos (bajo demanda) ───────────────────────────────────
  const handleDetectInactive = async () => {
    if (detecting) return;
    setDetecting(true);
    try {
      const activeIds = await fetchActivePatientIdsSince(monthsAgo(INACTIVE_MONTHS));
      const inactive = new Set(patients.filter(p => !activeIds.has(p.id)).map(p => p.id));
      setInactiveIds(inactive);
      setShowOnlyInactive(inactive.size > 0);
      showToast(inactive.size > 0
        ? `${inactive.size} paciente${inactive.size !== 1 ? 's' : ''} sin citas en los últimos ${INACTIVE_MONTHS} meses.`
        : 'Todos los pacientes tienen citas recientes.');
    } catch (error) {
      console.error('Error detectando inactivos:', error);
      showToast('No se pudo analizar la actividad.', 'error');
    } finally {
      setDetecting(false);
    }
  };

  // ─── Exportar CSV ────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const rows = [
      ['Nombre', 'DNI', 'Edad', 'Teléfono', 'Especialista', 'Registrado'],
      ...filtered.map(p => [
        p.name ?? '', p.dni ?? '', String(p.age ?? ''), p.phone ?? '',
        getProfName(p.professionalId), p.createdAt?.split('T')[0] ?? '',
      ]),
    ];
    const csv = '﻿' + rows
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pacientes_${TODAY}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Banner de error de carga */}
      {loadError && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
          <WifiOff size={18} className="shrink-0" />
          <span>{loadError}</span>
          <button
            onClick={() => setLoadError(null)}
            className="ml-auto text-rose-400 hover:text-rose-600 transition-colors"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmModal
          message="¿Eliminar este paciente? Esta acción no se puede deshacer."
          onConfirm={confirmDeletePatient}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonHeader />
          <SkeletonSearchBar />
          <SkeletonTableRows rows={6} cols={5} />
        </div>
      ) : <>

      {/* ── Cabecera ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
          <p className="text-slate-500 text-sm">
            {filtered.length} paciente{filtered.length !== 1 ? 's' : ''}
            {showOnlyInactive ? ' inactivos' : ''} · ordenados A→Z
          </p>
        </div>
        {(isTI || permissions.patients.add) && (
          <button
            onClick={() => { setCurrentPatient({}); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-md self-start sm:self-auto"
          >
            <Plus size={20} /> Nuevo Paciente
          </button>
        )}
      </div>

      {/* ── Toolbar: búsqueda + filtros + acciones ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filtro por especialista */}
        <select
          value={profFilter}
          onChange={e => setProfFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 font-medium outline-none focus:border-blue-500 shadow-sm"
        >
          <option value="">Todos los especialistas</option>
          {professionals.map(pro => (
            <option key={pro.id} value={pro.id}>{pro.name}</option>
          ))}
        </select>

        {isAdminOrTI && (
          <>
            <button
              onClick={handleDetectInactive}
              disabled={detecting}
              title={`Pacientes sin citas en los últimos ${INACTIVE_MONTHS} meses`}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              {detecting ? <Loader2 size={15} className="animate-spin" /> : <UserX size={15} />}
              Detectar inactivos
            </button>
            <button
              onClick={handleExportCsv}
              title="Exportar la lista filtrada a CSV"
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm transition-colors shadow-sm"
            >
              <Download size={15} />
              CSV
            </button>
          </>
        )}
      </div>

      {/* Chip de filtro de inactivos */}
      {inactiveIds !== null && (
        <div className="flex items-center gap-2 -mt-2">
          <button
            onClick={() => setShowOnlyInactive(v => !v)}
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
              showOnlyInactive
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            <UserX size={12} />
            Solo inactivos ({inactiveIds.size})
            {showOnlyInactive && <X size={12} />}
          </button>
        </div>
      )}

      {/* ── Lista de pacientes ── */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-14 text-center">
          <Search size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">
            {searchTerm || profFilter || showOnlyInactive
              ? 'No hay pacientes que coincidan con los filtros.'
              : 'Aún no hay pacientes registrados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pageItems.map(patient => (
            <div
              key={patient.id}
              onClick={() => openExpediente(patient)}
              className="bg-white border border-slate-100 rounded-2xl px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-xs font-bold text-blue-700">
                {initials(patient.name ?? '?')}
              </div>

              {/* Datos */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  <span>{patient.name}</span>
                  {patient.age ? <span className="text-xs text-slate-400 font-medium"> · {patient.age} años</span> : null}
                  {inactiveIds?.has(patient.id) && (
                    <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase align-middle">
                      Inactivo
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  DNI <span>{patient.dni || '---'}</span>
                  {' · '}
                  <span className="text-blue-600 font-semibold">{getProfName(patient.professionalId)}</span>
                </p>
              </div>

              {/* WhatsApp */}
              {patient.phone && (
                <a
                  href={waLink(patient.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  title="Abrir WhatsApp"
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0"
                >
                  <MessageCircle size={13} />
                  {patient.phone}
                </a>
              )}

              {/* Acciones */}
              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                {(isTI || permissions.patients.edit) && (
                  <button
                    onClick={() => handleEditOpen(patient)}
                    title="Editar paciente"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={17} />
                  </button>
                )}
                {(isTI || permissions.patients.delete) && (
                  <button
                    onClick={() => setConfirmDeleteId(patient.id)}
                    title="Eliminar paciente"
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-slate-500 font-medium">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            aria-label="Página siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* ── Expediente del paciente (drawer lateral) ── */}
      {expPatient && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end"
          onClick={() => setExpPatient(null)}
        >
          <div
            className="h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del expediente */}
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-6 py-4 flex items-center justify-between gap-3 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-sm font-bold text-blue-700">
                  {initials(expPatient.name ?? '?')}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-800 truncate">{expPatient.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {expPatient.age ? `${expPatient.age} años · ` : ''}
                    DNI {expPatient.dni || '---'} · {getProfName(expPatient.professionalId)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {expPatient.phone && (
                  <a
                    href={waLink(expPatient.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir WhatsApp"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <MessageCircle size={14} />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                )}
                {(isTI || permissions.patients.edit) && (
                  <button
                    onClick={() => handleEditOpen(expPatient)}
                    title="Editar paciente"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                <button
                  onClick={() => setExpPatient(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  aria-label="Cerrar expediente"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {loadingExp ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={32} className="animate-spin text-slate-300" />
                </div>
              ) : !expData ? (
                <p className="text-sm text-slate-400 text-center py-10">
                  No se pudo cargar la información del paciente.
                </p>
              ) : (
                <>
                  {/* Stats rápidas */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Próxima cita</p>
                      {nextAppointment ? (
                        <>
                          <p className="text-sm font-bold text-slate-800 capitalize">{formatShort(nextAppointment.date)} · {nextAppointment.time}</p>
                          <p className="text-xs text-slate-400 truncate">{nextAppointment.therapyType}</p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-slate-300">Sin citas próximas</p>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Sesiones</p>
                      <p className="text-sm font-bold text-slate-800">{expData.sessions.length}</p>
                      {lastVisit && (
                        <p className="text-xs text-slate-400 capitalize">última: {formatShort(lastVisit.date)}</p>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Pack vigente</p>
                      {activePack ? (
                        <>
                          <p className="text-sm font-bold text-emerald-600 truncate">{activePack.itemName}</p>
                          <p className="text-xs text-slate-400">vence {formatShort(activePack.validTo!)}</p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-slate-300">—</p>
                      )}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 border-b border-slate-200">
                    {([
                      { key: 'citas',   label: 'Citas',         icon: <Calendar size={14} /> },
                      { key: 'compras', label: 'Compras',       icon: <ShoppingBag size={14} /> },
                      { key: 'terapia', label: 'Terapia diaria', icon: <ClipboardList size={14} /> },
                    ] as { key: ExpedienteTab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
                      <button
                        key={key}
                        onClick={() => setExpTab(key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                          expTab === key
                            ? 'border-blue-600 text-blue-700'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {icon}{label}
                      </button>
                    ))}
                  </div>

                  {/* Tab: Citas */}
                  {expTab === 'citas' && (
                    expSessions.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8">Este paciente no tiene citas registradas.</p>
                    ) : (
                      <div className="space-y-2">
                        {expSessions.map(s => (
                          <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-100">
                            <Calendar size={15} className={s.date >= TODAY ? 'text-blue-500 shrink-0' : 'text-slate-300 shrink-0'} />
                            <span className={`text-sm flex-1 capitalize ${s.date >= TODAY ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                              {formatShort(s.date)} · {s.time} — {s.therapyType}
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusBadgeClass(s.status)}`}>
                              {s.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {/* Tab: Compras */}
                  {expTab === 'compras' && (
                    expSales.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8">Este paciente no tiene compras registradas.</p>
                    ) : (
                      <div className="space-y-2">
                        {expSales.map(s => (
                          <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-100">
                            <ShoppingBag size={15} className="text-slate-300 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate">
                                {s.itemName}
                                {s.qty > 1 && <span className="text-xs text-slate-400 font-medium"> × {s.qty}</span>}
                                {!s.validOnlyToday && (
                                  <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 uppercase">Pack</span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400 capitalize">
                                {formatShort(s.date)}
                                {!s.validOnlyToday && s.validFrom && s.validTo && (
                                  <span className="text-violet-500"> · <CalendarRange size={10} className="inline" /> {formatShort(s.validFrom)} → {formatShort(s.validTo)}</span>
                                )}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-slate-800 shrink-0">{currency(s.total)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center px-3.5 pt-2 border-t border-slate-100">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total histórico</span>
                          <span className="text-sm font-bold text-slate-800">{currency(totalSpent)}</span>
                        </div>
                      </div>
                    )
                  )}

                  {/* Tab: Terapia diaria */}
                  {expTab === 'terapia' && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Última semana</p>
                      <div className="flex gap-1.5">
                        {WEEK_DATES.map(date => {
                          const list = expData.week[date] ?? [];
                          const done = list.filter(t => t.done).length;
                          const total = list.length;
                          const isToday = date === TODAY;
                          let color = 'bg-slate-100 border border-slate-200';
                          if (total > 0) {
                            color = done === total ? 'bg-emerald-500' : done > 0 ? 'bg-amber-400' : 'bg-amber-200';
                          }
                          return (
                            <div key={date} className="flex-1 text-center" title={total > 0 ? `${done}/${total} tareas` : 'Sin tareas'}>
                              <div className={`h-8 rounded-md ${color} ${isToday ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`} />
                              <p className="text-[10px] text-slate-400 mt-1 font-semibold">{isToday ? 'Hoy' : dayLetter(date)}</p>
                            </div>
                          );
                        })}
                      </div>
                      {(() => {
                        const allWeek = WEEK_DATES.flatMap(d => expData.week[d] ?? []);
                        const doneWeek = allWeek.filter(t => t.done).length;
                        return allWeek.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-4">
                            Sin tareas de terapia asignadas en los últimos 7 días.
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500">
                            <span className="font-bold text-slate-700">{doneWeek}</span> de{' '}
                            <span className="font-bold text-slate-700">{allWeek.length}</span> tareas completadas esta semana.
                          </p>
                        );
                      })()}
                      <p className="text-[10px] text-slate-300">
                        Verde: todo completado · ámbar: parcial · gris: sin tareas
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: crear / editar paciente ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{currentPatient.id ? 'Editar Paciente' : 'Nuevo Paciente'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nombre completo</label>
                <input
                  placeholder="Ej. María Quispe Flores"
                  required
                  className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  value={currentPatient.name || ''}
                  onChange={(e) => setCurrentPatient({ ...currentPatient, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Especialista asignado</label>
                <select
                  required
                  className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  value={currentPatient.professionalId || ''}
                  onChange={(e) => setCurrentPatient({ ...currentPatient, professionalId: e.target.value })}
                >
                  <option value="">Seleccionar especialista...</option>
                  {professionals.map(pro => (
                    <option key={pro.id} value={pro.id}>{pro.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">DNI</label>
                  <input
                    placeholder="8 dígitos"
                    required
                    inputMode="numeric"
                    maxLength={8}
                    className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                    value={currentPatient.dni || ''}
                    onChange={(e) => setCurrentPatient({ ...currentPatient, dni: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Teléfono</label>
                  <input
                    placeholder="Ej. 926798464"
                    required
                    inputMode="tel"
                    className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                    value={currentPatient.phone || ''}
                    onChange={(e) => setCurrentPatient({ ...currentPatient, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Fecha de nacimiento</label>
                  <input
                    type="date"
                    className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                    value={currentPatient.birthDate || ''}
                    onChange={(e) => {
                      const birthDate = e.target.value;
                      // La edad se calcula sola al elegir la fecha (editable después)
                      setCurrentPatient({
                        ...currentPatient,
                        birthDate,
                        ...(birthDate ? { age: calcAge(birthDate) } : {}),
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Edad</label>
                  <input
                    placeholder="Se calcula sola"
                    type="number"
                    required
                    min={0}
                    max={120}
                    className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                    value={currentPatient.age || ''}
                    onChange={(e) => setCurrentPatient({ ...currentPatient, age: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email (opcional)</label>
                <input
                  placeholder="correo@ejemplo.com"
                  type="email"
                  className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  value={currentPatient.email || ''}
                  onChange={(e) => setCurrentPatient({ ...currentPatient, email: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>}
    </div>
  );
};

export default PatientsManager;
