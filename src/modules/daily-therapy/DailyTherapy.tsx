import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, query, where, orderBy,
  addDoc, deleteDoc, doc, getDocs, updateDoc,
} from 'firebase/firestore';
import {
  CheckSquare, Square, ClipboardList, Search, Plus, X,
  Settings, History, User, Trash2, Calendar, WifiOff,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useEscKey from '../../shared/hooks/useEscKey';
import { Patient } from '../../types';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface TherapyTask {
  id: string;
  name: string;
  order: number;
  active: boolean;
  createdAt: string;
}

interface TherapyPatientTask {
  id: string;
  patientId: string;
  patientName: string;
  date: string;            // YYYY-MM-DD
  taskId: string;
  taskName: string;
  assignedAt: string;
  assignedByUid: string;
  assignedByName: string;
  done: boolean;
  completedAt?: string;
  completedByUid?: string;
  completedByName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

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
    getDocs(query(collection(db, 'professionals'), where('email', '==', user.email)))
      .then(snap => {
        setProfessionalName(
          snap.empty
            ? (user.email ?? '')
            : ((snap.docs[0].data() as { name?: string }).name || user.email || '')
        );
      })
      .catch(() => setProfessionalName(user?.email ?? ''));
  }, [user?.email]);

  // ─── Plantilla global de tareas ──────────────────────────────────────────────
  const [tasks, setTasks] = useState<TherapyTask[]>([]);
  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'therapyTasks'), orderBy('createdAt', 'desc')),
      snap => { setLoadError(null); setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as TherapyTask))); },
      onSnapErr('therapyTasks'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const activeTasks = tasks.filter(t => t.active);

  // ─── Modal gestionar tareas ──────────────────────────────────────────────────
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const closeTaskModal = () => { setShowTaskModal(false); setNewTaskName(''); };
  useEscKey(closeTaskModal, showTaskModal);

  const handleAddTask = async () => {
    const name = newTaskName.trim();
    if (!name || addingTask) return;
    setAddingTask(true);
    try {
      const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) : 0;
      await addDoc(collection(db, 'therapyTasks'), {
        name, order: maxOrder + 1, active: true,
        createdAt: new Date().toISOString(),
      });
      setNewTaskName('');
    } catch {
      showToast('No se pudo agregar la tarea.', 'error');
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTaskActive = async (task: TherapyTask) => {
    try {
      await updateDoc(doc(db, 'therapyTasks', task.id), { active: !task.active });
    } catch {
      showToast('No se pudo actualizar la tarea.', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'therapyTasks', taskId));
      showToast('Tarea eliminada.');
    } catch {
      showToast('No se pudo eliminar la tarea.', 'error');
    }
  };

  // ─── Búsqueda dentro de "Asignar tareas para hoy" ───────────────────────────
  const [taskSearch, setTaskSearch] = useState('');

  // ─── Búsqueda de paciente ────────────────────────────────────────────────────
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'patients'), orderBy('name')),
      snap => setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient))),
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

  // ─── Tareas de HOY del paciente (live) ──────────────────────────────────────
  const [todayTasks, setTodayTasks] = useState<TherapyPatientTask[]>([]);

  useEffect(() => {
    if (!selectedPatientId) { setTodayTasks([]); return; }
    return onSnapshot(
      query(
        collection(db, 'therapyPatientTasks'),
        where('patientId', '==', selectedPatientId),
        where('date', '==', TODAY)
      ),
      snap => setTodayTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as TherapyPatientTask))),
      onSnapErr('todayTasks'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId]);

  // ─── Historial filtrado por fecha ────────────────────────────────────────────
  const [historyDate, setHistoryDate] = useState(TODAY);
  const [historyTasks, setHistoryTasks] = useState<TherapyPatientTask[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!selectedPatientId) { setHistoryTasks([]); return; }
    setLoadingHistory(true);
    return onSnapshot(
      query(
        collection(db, 'therapyPatientTasks'),
        where('patientId', '==', selectedPatientId),
        where('date', '==', historyDate)
      ),
      snap => {
        setHistoryTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as TherapyPatientTask)));
        setLoadingHistory(false);
      },
      (err) => { onSnapErr('historyTasks')(err); setLoadingHistory(false); },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, historyDate]);

  // ─── Operaciones pendientes ───────────────────────────────────────────────────
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const addPending    = (id: string) => setPendingIds(p => new Set(p).add(id));
  const removePending = (id: string) => setPendingIds(p => { const n = new Set(p); n.delete(id); return n; });

  // ─── Asignar / desasignar tarea al paciente (admin/TI) ───────────────────────
  const getTodayTask = (taskId: string) => todayTasks.find(t => t.taskId === taskId);

  const handleToggleAssign = async (task: TherapyTask) => {
    if (!canManage || !selectedPatient || pendingIds.has(task.id)) return;
    const existing = getTodayTask(task.id);
    addPending(task.id);
    try {
      if (existing) {
        await deleteDoc(doc(db, 'therapyPatientTasks', existing.id));
      } else {
        await addDoc(collection(db, 'therapyPatientTasks'), {
          patientId:      selectedPatient.id,
          patientName:    selectedPatient.name,
          date:           TODAY,
          taskId:         task.id,
          taskName:       task.name,
          assignedAt:     new Date().toISOString(),
          assignedByUid:  user?.uid ?? '',
          assignedByName: professionalName,
          done:           false,
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
      if (pt.done) {
        await updateDoc(doc(db, 'therapyPatientTasks', pt.id), {
          done: false, completedAt: null, completedByUid: null, completedByName: null,
        });
      } else {
        await updateDoc(doc(db, 'therapyPatientTasks', pt.id), {
          done:            true,
          completedAt:     new Date().toISOString(),
          completedByUid:  user?.uid ?? '',
          completedByName: professionalName,
        });
      }
    } catch {
      showToast('No se pudo actualizar la tarea.', 'error');
    } finally {
      removePending(pt.taskId);
    }
  };

  const doneTodayCount     = todayTasks.filter(t => t.done).length;
  const assignedTodayCount = todayTasks.length;

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
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                      title="Eliminar tarea"
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

      {/* ── Buscador de paciente ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Seleccionar paciente</label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSelectedPatient(null); setShowDropdown(false); setTodayTasks([]); }}
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
                  onClick={() => { setSelectedPatient(p); setSearchQuery(p.name); setShowDropdown(false); setHistoryDate(TODAY); }}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                >
                  <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">DNI: {p.dni}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedPatient && (
          <div className="mt-3 flex items-center gap-2 text-sm bg-blue-50 border border-blue-100 text-blue-700 px-3 py-2 rounded-xl">
            <User size={14} className="shrink-0" />
            <span className="font-semibold">{selectedPatient.name}</span>
            <span className="text-blue-400">·</span>
            <span className="text-blue-500 text-xs">DNI {selectedPatient.dni}</span>
          </div>
        )}
      </div>

      {/* ── Asignar tareas del día (solo admin/TI) ── */}
      {selectedPatient && canManage && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          {/* Cabecera */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-600" />
              Asignar tareas para hoy
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
              {assignedTodayCount} asignadas
            </span>
          </div>

          {activeTasks.length === 0 ? (
            <div className="py-8 text-center">
              <ClipboardList size={28} className="text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                No hay tareas activas. Créalas en "Gestionar tareas".
              </p>
            </div>
          ) : (
            <>
              {/* Buscador */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filtrar tareas..."
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
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

              {/* Lista scrolleable (~5 ítems) */}
              <div className="overflow-y-auto max-h-60 space-y-2 pr-0.5">
              {activeTasks.filter(t =>
                !taskSearch.trim() || t.name.toLowerCase().includes(taskSearch.toLowerCase())
              ).map(task => {
                const pt        = getTodayTask(task.id);
                const assigned  = Boolean(pt);
                const isPending = pendingIds.has(task.id);

                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      assigned ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
                    } ${isPending ? 'opacity-50' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleAssign(task)}
                      disabled={isPending}
                      className={`shrink-0 transition-colors ${
                        assigned ? 'text-blue-600' : 'text-slate-300 hover:text-blue-400'
                      }`}
                    >
                      {assigned ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                    <span className={`text-sm font-semibold flex-1 ${assigned ? 'text-slate-800' : 'text-slate-400'}`}>
                      {task.name}
                    </span>
                    {pt?.done && (
                      <span className="text-xs font-semibold text-green-600 shrink-0 bg-green-50 px-2 py-0.5 rounded-lg">
                        ✓ Hecho
                      </span>
                    )}
                    {assigned && !pt?.done && (
                      <span className="text-xs text-amber-500 font-semibold shrink-0">Pendiente</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                      title="Eliminar tarea"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tareas del día — vista del profesional ── */}
      {selectedPatient && canMark && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <CheckSquare size={18} className="text-green-600" />
              Tareas del día
            </h2>
            {assignedTodayCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                {doneTodayCount} / {assignedTodayCount}
              </span>
            )}
          </div>

          {todayTasks.length === 0 ? (
            <div className="py-8 text-center">
              <ClipboardList size={28} className="text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                {canManage
                  ? 'Asigna tareas en la sección de arriba para que aparezcan aquí.'
                  : 'No hay tareas asignadas para este paciente hoy.'}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {todayTasks.map(pt => {
                  const isPending = pendingIds.has(pt.taskId);
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => handleToggleDone(pt)}
                      disabled={isPending}
                      className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                        pt.done
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                      } ${isPending ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                    >
                      <span className={`mt-0.5 shrink-0 transition-colors ${pt.done ? 'text-green-500' : 'text-slate-300'}`}>
                        {pt.done ? <CheckSquare size={18} /> : <Square size={18} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold block ${pt.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {pt.taskName}
                        </span>
                        {pt.done && pt.completedByName && (
                          <span className="text-xs text-green-600 mt-0.5 block">
                            ✓ {pt.completedByName} · {formatTime(pt.completedAt!)}
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
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${assignedTodayCount > 0 ? (doneTodayCount / assignedTodayCount) * 100 : 0}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Historial con filtro de fecha ── */}
      {selectedPatient && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <History size={18} className="text-slate-500" />
              Historial
            </h2>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={historyDate}
                onChange={e => setHistoryDate(e.target.value)}
                className="text-sm outline-none bg-transparent text-slate-700"
              />
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
                      pt.done ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    {pt.done
                      ? <CheckSquare size={15} className="text-green-500 shrink-0" />
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
      )}
    </div>
  );
};

export default DailyTherapy;
