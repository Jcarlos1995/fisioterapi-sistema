import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare, Square, ClipboardList, Search, Plus, X,
  Settings, History, Users, Trash2, Calendar, WifiOff,
  ChevronLeft, ChevronRight, ListChecks, TrendingUp, UserSearch,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useEscKey from '../../shared/hooks/useEscKey';
import ConfirmModal from '../../shared/components/ConfirmModal';
import { Patient } from '../../types';
import {
  subscribeToTherapyTasks, addTherapyTask, toggleTherapyTask, deleteTherapyTask,
  subscribeToPatientTasks, subscribeToTasksByDate, fetchPatientTasksForDates,
  assignPatientTask, unassignPatientTask, togglePatientTaskDone,
  TherapyTask, TherapyPatientTask,
} from './dailyTherapyService';
import { subscribeToPatients } from '../patients/patientsService';
import { fetchProfessionalByEmail } from '../professionals/professionalsService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Fecha de HOY en zona horaria de Lima (toISOString daría la fecha UTC,
// que entre las 19:00 y 24:00 hora peruana ya es "mañana")
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

function formatDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return dateStr; }
}

function formatTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString('es-PE', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
    });
  } catch { return isoStr; }
}

/** Suma días a una fecha YYYY-MM-DD. */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Las últimas n fechas terminando en endDate (inclusive), ascendente. */
function lastNDates(endDate: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDate(endDate, i - (n - 1)));
}

/** Etiqueta corta del día de la semana: "Lu", "Ma"... */
function dayLetter(dateStr: string): string {
  try {
    const label = new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'short' });
    return label.charAt(0).toUpperCase() + label.slice(1, 2);
  } catch { return '?'; }
}

/** Iniciales para el avatar del paciente. */
function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

interface SelectedPatient {
  id: string;
  name: string;
  dni?: string;
}

interface PatientDaySummary {
  patientId: string;
  patientName: string;
  done: number;
  total: number;
}

// ─── Componente principal ─────────────────────────────────────────────────────

const DailyTherapy: React.FC = () => {
  const { user, isTI, role, permissions, isViewer } = useAuth();
  const { showToast } = useToast();

  // Admin/TI pueden asignar tareas al paciente
  const canManage = isTI || role === 'admin';
  // Profesionales con permiso pueden tachar tareas como hechas
  const canMark = !isViewer && (isTI || role === 'admin' || permissions.dailyTherapy.edit);

  const [loadError, setLoadError] = useState<string | null>(null);
  const onSnapErr = (label: string) => (err: Error) => {
    console.error(`onSnapshot [${label}]:`, err);
    setLoadError('No se pudieron cargar los datos. Verifica tu conexión e intenta de nuevo.');
  };

  // ─── Nombre del profesional logueado ────────────────────────────────────────
  const [professionalName, setProfessionalName] = useState('');
  useEffect(() => {
    if (!user?.email) return;
    fetchProfessionalByEmail(user.email)
      .then(name => setProfessionalName(name))
      .catch(() => setProfessionalName(user?.email ?? ''));
  }, [user?.email]);

  // ─── Plantilla global de tareas ──────────────────────────────────────────────
  const [tasks, setTasks] = useState<TherapyTask[]>([]);
  useEffect(() => {
    return subscribeToTherapyTasks(
      (data) => { setLoadError(null); setTasks(data); },
      onSnapErr('therapyTasks'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const activeTasks = tasks.filter(t => t.active);

  // ─── Todas las tareas asignadas HOY (todos los pacientes) ───────────────────
  const [todayAll, setTodayAll] = useState<TherapyPatientTask[]>([]);
  useEffect(() => {
    return subscribeToTasksByDate(
      TODAY,
      (data) => setTodayAll(data),
      onSnapErr('todayAll'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pacientes con tareas hoy, con su progreso — incompletos primero
  const patientsToday = useMemo<PatientDaySummary[]>(() => {
    const map = new Map<string, PatientDaySummary>();
    todayAll.forEach(t => {
      const entry = map.get(t.patientId) ?? {
        patientId: t.patientId, patientName: t.patientName, done: 0, total: 0,
      };
      entry.total += 1;
      if (t.done) entry.done += 1;
      map.set(t.patientId, entry);
    });
    return Array.from(map.values()).sort((a, b) => {
      const aComplete = a.done === a.total ? 1 : 0;
      const bComplete = b.done === b.total ? 1 : 0;
      if (aComplete !== bComplete) return aComplete - bComplete;
      return a.patientName.localeCompare(b.patientName);
    });
  }, [todayAll]);

  // KPIs del día
  const kpis = useMemo(() => {
    const total = todayAll.length;
    const done  = todayAll.filter(t => t.done).length;
    return {
      patients: patientsToday.length,
      done,
      total,
      pct: total > 0 ? Math.round((done / total) * 100) : null,
    };
  }, [todayAll, patientsToday]);

  // ─── Modal gestionar tareas ──────────────────────────────────────────────────
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);

  const closeTaskModal = () => { setShowTaskModal(false); setNewTaskName(''); };
  useEscKey(closeTaskModal, showTaskModal && !confirmDeleteTaskId);

  const handleAddTask = async () => {
    const name = newTaskName.trim();
    if (!name || addingTask) return;
    setAddingTask(true);
    try {
      const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) : 0;
      await addTherapyTask(name, maxOrder + 1);
      setNewTaskName('');
    } catch {
      showToast('No se pudo agregar la tarea.', 'error');
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTaskActive = async (task: TherapyTask) => {
    try {
      await toggleTherapyTask(task.id, task.active);
    } catch {
      showToast('No se pudo actualizar la tarea.', 'error');
    }
  };

  const handleConfirmDeleteTask = async () => {
    if (!confirmDeleteTaskId) return;
    const id = confirmDeleteTaskId;
    setConfirmDeleteTaskId(null);
    try {
      await deleteTherapyTask(id);
      showToast('Tarea eliminada del catálogo.');
    } catch {
      showToast('No se pudo eliminar la tarea.', 'error');
    }
  };

  // ─── Paciente seleccionado ───────────────────────────────────────────────────
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');

  useEffect(() => {
    return subscribeToPatients(
      (data) => setPatients(data),
      onSnapErr('patients'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return patients
      .filter(p => p.name.toLowerCase().includes(q) || (p.dni || '').includes(q))
      .slice(0, 8);
  }, [patients, searchQuery]);

  const selectedPatientId = selectedPatient?.id ?? null;

  /** Selecciona desde la lista "Pacientes de hoy". */
  const selectFromToday = (summary: PatientDaySummary) => {
    const full = patients.find(p => p.id === summary.patientId);
    setSelectedPatient({
      id: summary.patientId,
      name: full?.name ?? summary.patientName,
      dni: full?.dni,
    });
    setSearchQuery('');
    setShowDropdown(false);
    setShowAssign(false);
    setHistoryDate(TODAY);
  };

  /** Selecciona desde el buscador (paciente nuevo del día). */
  const selectFromSearch = (p: Patient) => {
    setSelectedPatient({ id: p.id, name: p.name, dni: p.dni });
    setSearchQuery('');
    setShowDropdown(false);
    setHistoryDate(TODAY);
    // Si aún no tiene tareas hoy, abrir directo el panel de asignación
    const hasTasksToday = todayAll.some(t => t.patientId === p.id);
    setShowAssign(canManage && !hasTasksToday);
  };

  // Tareas de HOY del paciente seleccionado — derivadas de la suscripción global
  const selectedTodayTasks = useMemo(
    () => todayAll.filter(t => t.patientId === selectedPatientId),
    [todayAll, selectedPatientId],
  );
  const doneTodayCount     = selectedTodayTasks.filter(t => t.done).length;
  const assignedTodayCount = selectedTodayTasks.length;

  // ─── Adherencia semanal (6 días previos por lectura puntual + hoy en vivo) ──
  const weekDates = useMemo(() => lastNDates(TODAY, 7), []);
  const [weekData, setWeekData] = useState<Record<string, TherapyPatientTask[]>>({});
  useEffect(() => {
    if (!selectedPatientId) { setWeekData({}); return; }
    let cancelled = false;
    fetchPatientTasksForDates(selectedPatientId, weekDates.slice(0, 6))
      .then(data => { if (!cancelled) setWeekData(data); })
      .catch(() => { if (!cancelled) setWeekData({}); });
    return () => { cancelled = true; };
  }, [selectedPatientId, weekDates]);

  /** Resumen done/total de un día de la tira (hoy sale de la suscripción en vivo). */
  const weekDaySummary = (date: string): { done: number; total: number } => {
    const list = date === TODAY ? selectedTodayTasks : (weekData[date] ?? []);
    return { done: list.filter(t => t.done).length, total: list.length };
  };

  // ─── Historial filtrado por fecha ────────────────────────────────────────────
  const [historyDate, setHistoryDate] = useState(TODAY);
  const [historyTasks, setHistoryTasks] = useState<TherapyPatientTask[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!selectedPatientId) { setHistoryTasks([]); return; }
    setLoadingHistory(true);
    return subscribeToPatientTasks(
      selectedPatientId,
      historyDate,
      (data) => { setHistoryTasks(data); setLoadingHistory(false); },
      (err) => { onSnapErr('historyTasks')(err); setLoadingHistory(false); },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, historyDate]);

  // ─── Operaciones pendientes ───────────────────────────────────────────────────
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const addPending    = (id: string) => setPendingIds(p => new Set(p).add(id));
  const removePending = (id: string) => setPendingIds(p => { const n = new Set(p); n.delete(id); return n; });

  // ─── Asignar / desasignar tarea al paciente (admin/TI) ───────────────────────
  const getTodayTask = (taskId: string) => selectedTodayTasks.find(t => t.taskId === taskId);

  const handleToggleAssign = async (task: TherapyTask) => {
    if (!canManage || !selectedPatient || pendingIds.has(task.id)) return;
    const existing = getTodayTask(task.id);
    addPending(task.id);
    try {
      if (existing) {
        await unassignPatientTask(existing.id);
      } else {
        await assignPatientTask({
          patientId:      selectedPatient.id,
          patientName:    selectedPatient.name,
          date:           TODAY,
          taskId:         task.id,
          taskName:       task.name,
          assignedByUid:  user?.uid ?? '',
          assignedByName: professionalName,
        });
      }
    } catch {
      showToast('No se pudo actualizar la asignación.', 'error');
    } finally {
      removePending(task.id);
    }
  };

  // ─── Tachar tarea como hecha (profesional) ───────────────────────────────────
  const handleToggleDone = async (pt: TherapyPatientTask) => {
    if (!canMark || pendingIds.has(pt.taskId)) return;
    addPending(pt.taskId);
    try {
      await togglePatientTaskDone({
        taskDocId:       pt.id,
        done:            pt.done,
        completedByUid:  user?.uid ?? '',
        completedByName: professionalName,
      });
    } catch {
      showToast('No se pudo actualizar la tarea.', 'error');
    } finally {
      removePending(pt.taskId);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
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

      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Terapia Diaria</h1>
          <p className="text-slate-500 text-sm mt-0.5 capitalize">{formatDate(TODAY)}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowTaskModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors shadow-sm"
          >
            <Settings size={15} />
            Gestionar tareas
          </button>
        )}
      </div>

      {/* ── KPIs del día ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Users size={16} className="text-blue-600" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pacientes hoy</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{kpis.patients}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <ListChecks size={16} className="text-emerald-600" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tareas completadas</p>
          </div>
          <p className="text-xl font-bold text-slate-800">
            {kpis.done} <span className="text-sm font-semibold text-slate-400">/ {kpis.total}</span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-violet-600" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Cumplimiento</p>
          </div>
          <p className={`text-xl font-bold ${
            kpis.pct === null ? 'text-slate-300'
            : kpis.pct >= 75  ? 'text-emerald-600'
            : kpis.pct >= 40  ? 'text-amber-600'
            : 'text-rose-500'
          }`}>
            {kpis.pct === null ? '—' : `${kpis.pct}%`}
          </p>
        </div>
      </div>

      {/* ── Layout principal: pacientes de hoy | detalle ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">

        {/* ── Columna izquierda: Pacientes de hoy + buscador ── */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            Pacientes de hoy
          </p>

          {patientsToday.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
              <ClipboardList size={24} className="text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                Nadie tiene tareas asignadas hoy.
              </p>
              {canManage && (
                <p className="text-xs text-slate-300 mt-1">
                  Busca un paciente abajo para asignarle tareas.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {patientsToday.map(p => {
                const isSelected = p.patientId === selectedPatientId;
                const complete   = p.done === p.total;
                const pct        = p.total > 0 ? (p.done / p.total) * 100 : 0;
                return (
                  <button
                    key={p.patientId}
                    type="button"
                    onClick={() => selectFromToday(p)}
                    className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>
                        {p.patientName}
                      </p>
                      <span className={`text-xs font-bold shrink-0 ${
                        complete ? 'text-emerald-600' : p.done > 0 ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        {complete && '✓ '}{p.done}/{p.total}
                      </span>
                    </div>
                    <div className={`mt-2 h-1 rounded-full overflow-hidden ${isSelected ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      <div
                        className={`h-1 rounded-full transition-all duration-300 ${
                          complete ? 'bg-emerald-500' : 'bg-amber-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Buscador — para pacientes que aún no están en la lista del día */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar otro paciente..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-dashed border-slate-300 focus:border-blue-500 focus:border-solid focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
            {showDropdown && filteredPatients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {filteredPatients.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectFromSearch(p)}
                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">DNI: {p.dni}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Columna derecha: detalle del paciente ── */}
        {!selectedPatient ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center">
            <UserSearch size={36} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">
              Selecciona un paciente de la lista para ver sus tareas.
            </p>
            <p className="text-xs text-slate-300 mt-1">
              O búscalo por nombre o DNI si aún no tiene tareas hoy.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">

              {/* Cabecera del paciente */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-xs font-bold text-blue-700">
                    {initials(selectedPatient.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{selectedPatient.name}</p>
                    {selectedPatient.dni && (
                      <p className="text-xs text-slate-400">DNI {selectedPatient.dni}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {assignedTodayCount > 0 && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      doneTodayCount === assignedTodayCount
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {doneTodayCount} de {assignedTodayCount} hechas
                    </span>
                  )}
                  {canManage && (
                    <button
                      onClick={() => setShowAssign(v => !v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                        showAssign
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      <Plus size={13} className={showAssign ? 'rotate-45 transition-transform' : 'transition-transform'} />
                      {showAssign ? 'Cerrar' : 'Asignar tareas'}
                    </button>
                  )}
                </div>
              </div>

              {/* Panel de asignación — colapsable, solo admin/TI */}
              {canManage && showAssign && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  {activeTasks.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-3">
                      No hay tareas activas en el catálogo. Créalas en "Gestionar tareas".
                    </p>
                  ) : (
                    <>
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Filtrar tareas..."
                          value={taskSearch}
                          onChange={e => setTaskSearch(e.target.value)}
                          className="w-full pl-8 pr-8 py-2 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white"
                        />
                        {taskSearch && (
                          <button
                            onClick={() => setTaskSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto max-h-56 space-y-1.5 pr-0.5">
                        {activeTasks.filter(t =>
                          !taskSearch.trim() || t.name.toLowerCase().includes(taskSearch.toLowerCase())
                        ).map(task => {
                          const pt        = getTodayTask(task.id);
                          const assigned  = Boolean(pt);
                          const isPending = pendingIds.has(task.id);
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => handleToggleAssign(task)}
                              disabled={isPending}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                                assigned ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-blue-200'
                              } ${isPending ? 'opacity-50' : ''}`}
                            >
                              <span className={`shrink-0 ${assigned ? 'text-blue-600' : 'text-slate-300'}`}>
                                {assigned ? <CheckSquare size={18} /> : <Square size={18} />}
                              </span>
                              <span className={`text-sm font-medium flex-1 ${assigned ? 'text-slate-800' : 'text-slate-500'}`}>
                                {task.name}
                              </span>
                              {pt?.done && (
                                <span className="text-xs font-semibold text-emerald-600 shrink-0">✓ Hecha</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tareas del día */}
              {selectedTodayTasks.length === 0 ? (
                <div className="py-6 text-center">
                  <ClipboardList size={26} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    {canManage
                      ? 'Este paciente no tiene tareas hoy. Usa "Asignar tareas" para agregarlas.'
                      : 'No hay tareas asignadas para este paciente hoy.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {selectedTodayTasks.map(pt => {
                      const isPending = pendingIds.has(pt.taskId);
                      return (
                        <button
                          key={pt.id}
                          type="button"
                          onClick={() => handleToggleDone(pt)}
                          disabled={isPending || !canMark}
                          className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                            pt.done
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-white border-slate-200'
                          } ${isPending ? 'opacity-50 pointer-events-none' : ''} ${
                            canMark && !pt.done ? 'hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer' : ''
                          } ${!canMark ? 'cursor-default' : ''}`}
                        >
                          <span className={`mt-0.5 shrink-0 ${pt.done ? 'text-emerald-500' : 'text-slate-300'}`}>
                            {pt.done ? <CheckSquare size={18} /> : <Square size={18} />}
                          </span>
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-3 flex-wrap">
                            <span className={`text-sm font-semibold ${pt.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              {pt.taskName}
                            </span>
                            {pt.done && pt.completedByName && (
                              <span className="text-xs text-emerald-600 shrink-0">
                                {pt.completedByName} · {formatTime(pt.completedAt!)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        doneTodayCount === assignedTodayCount ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${assignedTodayCount > 0 ? (doneTodayCount / assignedTodayCount) * 100 : 0}%` }}
                    />
                  </div>
                </>
              )}

              {/* Tira de adherencia — última semana */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Última semana</p>
                <div className="flex gap-1.5">
                  {weekDates.map(date => {
                    const { done, total } = weekDaySummary(date);
                    const isToday = date === TODAY;
                    let color = 'bg-slate-100 border border-slate-200';
                    if (total > 0) {
                      color = done === total
                        ? 'bg-emerald-500'
                        : done > 0
                          ? 'bg-amber-400'
                          : 'bg-amber-200';
                    }
                    return (
                      <div key={date} className="flex-1 text-center" title={total > 0 ? `${done}/${total} tareas` : 'Sin tareas'}>
                        <div className={`h-7 rounded-md ${color} ${isToday ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`} />
                        <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                          {isToday ? 'Hoy' : dayLetter(date)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-300 mt-1.5">
                  Verde: todo completado · ámbar: parcial · gris: sin tareas
                </p>
              </div>
            </div>

            {/* ── Historial con navegación de fecha ── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <History size={18} className="text-slate-500" />
                  Historial
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setHistoryDate(shiftDate(historyDate, -1))}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Día anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <input
                      type="date"
                      value={historyDate}
                      max={TODAY}
                      onChange={e => setHistoryDate(e.target.value)}
                      className="text-sm outline-none bg-transparent text-slate-700"
                    />
                  </div>
                  <button
                    onClick={() => setHistoryDate(shiftDate(historyDate, 1))}
                    disabled={historyDate >= TODAY}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    title="Día siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {loadingHistory ? (
                <p className="text-sm text-slate-400 py-2">Cargando...</p>
              ) : historyTasks.length === 0 ? (
                <div className="py-6 text-center">
                  <History size={24} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    {historyDate === TODAY
                      ? 'No hay tareas registradas para hoy.'
                      : `Sin registros para el ${formatDate(historyDate)}.`}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider capitalize">
                    {historyDate === TODAY ? 'Hoy' : formatDate(historyDate)}
                  </p>
                  <div className="space-y-2">
                    {historyTasks.map(pt => (
                      <div
                        key={pt.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                          pt.done ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        {pt.done
                          ? <CheckSquare size={15} className="text-emerald-500 shrink-0" />
                          : <Square size={15} className="text-slate-300 shrink-0" />
                        }
                        <span className={`text-sm flex-1 ${pt.done ? 'line-through text-slate-400' : 'text-slate-700 font-semibold'}`}>
                          {pt.taskName}
                        </span>
                        {pt.done && pt.completedByName ? (
                          <>
                            <span className="text-xs text-slate-400 shrink-0">{pt.completedByName}</span>
                            <span className="text-xs text-slate-300 shrink-0">{formatTime(pt.completedAt!)}</span>
                          </>
                        ) : (
                          <span className="text-xs text-amber-500 font-semibold shrink-0">Pendiente</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Gestionar tareas ── */}
      {showTaskModal && canManage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

            {/* Header modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList size={18} className="text-blue-600" />
                Gestionar tareas globales
              </h2>
              <button onClick={closeTaskModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* Input fijo — no forma parte del scroll */}
            <div className="px-5 pt-5 pb-3 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre de la tarea..."
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                />
                <button
                  onClick={handleAddTask}
                  disabled={!newTaskName.trim() || addingTask}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus size={15} />
                  Agregar
                </button>
              </div>
            </div>

            {/* Lista con scroll — máximo ~6 ítems visibles */}
            <div className="px-5 pb-5 overflow-y-auto max-h-72">
              <div className="space-y-2">
                {tasks.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">
                    Aún no hay tareas. Agrega la primera arriba.
                  </p>
                )}
                {tasks.map(task => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                      task.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                  >
                    <span className={`text-sm flex-1 ${task.active ? 'text-slate-700' : 'line-through text-slate-400'}`}>
                      {task.name}
                    </span>
                    <button
                      onClick={() => handleToggleTaskActive(task)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                        task.active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                      }`}
                    >
                      {task.active ? 'Activa' : 'Inactiva'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteTaskId(task.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                      title="Eliminar tarea del catálogo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de eliminación de tarea global */}
      {confirmDeleteTaskId && (
        <ConfirmModal
          message="¿Eliminar esta tarea del catálogo global? Dejará de estar disponible para todos los pacientes. Esta acción no se puede deshacer."
          onConfirm={handleConfirmDeleteTask}
          onCancel={() => setConfirmDeleteTaskId(null)}
        />
      )}
    </div>
  );
};

export default DailyTherapy;
