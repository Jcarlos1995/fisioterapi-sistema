import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Plus, Trash2, Clock, UserSquare2, AlertTriangle, WifiOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { Session, Patient, Professional } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useEscKey from '../../shared/hooks/useEscKey';
import ConfirmModal from '../../shared/components/ConfirmModal';
import { isToday, shouldAutoCreateSale, shouldWarnOnLeave, statusBadgeClass } from '../../shared/utils/session';
import { SkeletonHeader, SkeletonSessionCards } from '../../shared/components/SkeletonLoader';
import {
  subscribeToSessions, fetchServicePrices, saleExistsForSession,
  createAutoSale, updateSessionStatus, createSession, deleteSession,
} from './sessionsService';
import { subscribeToPatients } from '../patients/patientsService';
import { subscribeToProfessionals } from '../professionals/professionalsService';
import { onSnapshot, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// ─── Tipos locales ─────────────────────────────────────────────────────────────

interface PendingChange {
  session: Session;
  newStatus: Session['status'];
  hasSale: boolean;
}

interface TherapyTask {
  id: string;
  name: string;
  active: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

const STATUS_FILTERS = [
  { label: 'Todas',      value: 'all' },
  { label: 'Programada', value: 'Programada' },
  { label: 'Confirmada', value: 'Confirmada' },
  { label: 'Efectuada',  value: 'Efectuada' },
  { label: 'Pagada',     value: 'Pagada' },
  { label: 'Cancelada',  value: 'Cancelada' },
] as const;

type StatusFilter = typeof STATUS_FILTERS[number]['value'];

// ─── Componente ───────────────────────────────────────────────────────────────

const SessionsManager: React.FC = () => {
  const { user, isTI, permissions } = useAuth();
  const { showToast } = useToast();

  const [sessions,      setSessions]      = useState<Session[]>([]);
  const [patients,      setPatients]      = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [therapyTasks,  setTherapyTasks]  = useState<TherapyTask[]>([]);
  const [servicePrices, setServicePrices] = useState<Record<string, number>>({});
  const [staffName,     setStaffName]     = useState('');

  const [loadError,       setLoadError]       = useState<string | null>(null);
  const [isLoading,       setIsLoading]       = useState(true);
  const [statusFilter,    setStatusFilter]    = useState<StatusFilter>('all');
  const [currentPage,     setCurrentPage]     = useState(1);
  const [isModalOpen,     setIsModalOpen]     = useState(false);
  const [formError,       setFormError]       = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Cambio de estado pendiente de confirmación (cuando sesión ya tiene venta)
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  useEscKey(() => { setIsModalOpen(false); setFormError(null); }, isModalOpen);

  const [newSession, setNewSession] = useState({
    patientId: '',
    professionalId: '',
    date: '',
    time: '',
    therapyType: '',
    status: 'Programada' as Session['status'],
    notes: '',
  });

  // ── Carga de datos ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onErr = (label: string) => (err: Error) => {
      console.error(`onSnapshot [${label}]:`, err);
      setLoadError('No se pudieron cargar los datos. Verifica tu conexión e intenta de nuevo.');
    };

    const unsubSessions      = subscribeToSessions(
      (data) => { setLoadError(null); setIsLoading(false); setSessions(data); },
      onErr('sessions'),
    );
    const unsubPatients      = subscribeToPatients(
      (data) => setPatients(data),
      onErr('patients'),
    );
    const unsubProfessionals = subscribeToProfessionals(
      (data) => setProfessionals(data),
      onErr('professionals'),
    );
    // therapyTasks no tiene servicio propio aún — onSnapshot directo provisional
    const unsubTasks = onSnapshot(
      collection(db, 'therapyTasks'),
      (snap) => setTherapyTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }) as TherapyTask)),
      onErr('therapyTasks'),
    );

    return () => { unsubSessions(); unsubPatients(); unsubProfessionals(); unsubTasks(); };
  }, []);

  // Precios de servicios
  useEffect(() => {
    fetchServicePrices().then(setServicePrices);
  }, []);

  // Nombre del profesional logueado
  useEffect(() => {
    if (!user?.email) return;
    const email = user.email;
    getDocs(query(collection(db, 'professionals'), where('email', '==', email)))
      .then(snap => setStaffName(snap.empty ? email : ((snap.docs[0].data() as Pick<Professional, 'name'>).name || email)))
      .catch(() => setStaffName(email));
  }, [user?.email]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name || 'Paciente no encontrado';
  const getProfName    = (id: string) => professionals.find(p => p.id === id)?.name || 'Especialista no encontrado';

  /** Verifica si ya existe una venta ligada a esta sesión */
  const checkSaleExists = (sessionId: string) => saleExistsForSession(sessionId);

  // ── Cambio de estado ─────────────────────────────────────────────────────────
  const updateStatus = async (session: Session, newStatus: Session['status']) => {
    const currentStatus = session.status;
    if (currentStatus === newStatus) return;

    try {
      // ① Saliendo de 'Pagada' → verificar si tiene venta registrada
      if (shouldWarnOnLeave(currentStatus)) {
        const hasSale = await checkSaleExists(session.id);
        if (hasSale) {
          setPendingChange({ session, newStatus, hasSale: true });
          return; // espera confirmación del usuario
        }
      }

      // ② Entrando a 'Pagada' → crear venta automática si no existe
      if (shouldAutoCreateSale(currentStatus, newStatus)) {
        const alreadyHasSale = await checkSaleExists(session.id);
        if (!alreadyHasSale) {
          await createAutoSale({ session, patients, servicePrices, user, staffName });
          showToast('Venta registrada automáticamente en Área Reservada.');
        }
      }

      const patientName = patients.find(p => p.id === session.patientId)?.name;
      await updateSessionStatus(session.id, newStatus, user, patientName, currentStatus);
      showToast();
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      showToast('No se pudo actualizar el estado.', 'error');
    }
  };

  /** Confirma el cambio de estado aunque la sesión tenga venta registrada */
  const confirmPendingChange = async () => {
    if (!pendingChange) return;
    const { session, newStatus } = pendingChange;
    setPendingChange(null);
    try {
      const patientName = patients.find(p => p.id === session.patientId)?.name;
      await updateSessionStatus(session.id, newStatus, user, patientName, session.status);
      showToast('Estado actualizado. La venta permanece registrada en Área Reservada.');
    } catch {
      showToast('No se pudo actualizar el estado.', 'error');
    }
  };

  // ── Agregar sesión ───────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSession.patientId || !newSession.professionalId) {
      setFormError('Por favor selecciona un paciente y un profesional.');
      return;
    }
    if (!newSession.date) { setFormError('Por favor selecciona una fecha.'); return; }
    if (!newSession.time) { setFormError('Por favor selecciona una hora.'); return; }
    setFormError(null);
    try {
      const patientName = patients.find(p => p.id === newSession.patientId)?.name;
      await createSession(newSession, user, patientName);
      setIsModalOpen(false);
      setNewSession({ patientId: '', professionalId: '', date: '', time: '', therapyType: '', status: 'Programada', notes: '' });
      showToast('Cita agendada');
    } catch (error) {
      console.error('Error al agendar sesión:', error);
    }
  };

  // ── Eliminar sesión ──────────────────────────────────────────────────────────
  const handleDelete = (id: string) => setConfirmDeleteId(id);
  const confirmDeleteSession = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    const session = sessions.find(s => s.id === id);
    setConfirmDeleteId(null);
    const patientName = patients.find(p => p.id === session?.patientId)?.name;
    await deleteSession(id, user, patientName, { date: session?.date, therapyType: session?.therapyType });
    showToast('Cita eliminada');
  };

  // ── Filtrado, ordenamiento y paginación ──────────────────────────────────────
  const filtered = useMemo(() => {
    const base = statusFilter === 'all'
      ? sessions
      : sessions.filter(s => s.status === statusFilter);
    // Ordenar: hoy primero, luego más recientes
    return [...base].sort((a, b) => {
      const aHoy = isToday(a.date) ? 0 : 1;
      const bHoy = isToday(b.date) ? 0 : 1;
      if (aHoy !== bHoy) return aHoy - bHoy;
      return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
    });
  }, [sessions, statusFilter]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(currentPage, totalPages);
  const paginated   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const changeFilter = (f: StatusFilter) => { setStatusFilter(f); setCurrentPage(1); };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Modal confirmar eliminación */}
      {confirmDeleteId && (
        <ConfirmModal
          message="¿Eliminar esta cita? Esta acción no se puede deshacer."
          onConfirm={confirmDeleteSession}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* ── Modal: advertencia venta ya registrada ── */}
      {pendingChange && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Venta ya registrada</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Esta sesión ya tiene una venta registrada en el Área Reservada.
                  ¿Seguro que deseas cambiar el estado a{' '}
                  <strong className="text-slate-700">"{pendingChange.newStatus}"</strong>?
                  La venta <strong>no se eliminará</strong> automáticamente.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPendingChange(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPendingChange}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
              >
                Sí, cambiar estado
              </button>
            </div>
          </div>
        </div>
      )}

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

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonHeader />
          <SkeletonSessionCards rows={8} />
        </div>
      ) : <>
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Agenda de Sesiones</h2>
          <p className="text-slate-500 text-sm">Control de citas y tratamientos</p>
        </div>
        {(isTI || permissions.appointments.add) && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold self-start sm:self-auto"
          >
            <Plus size={20} /> Agendar Cita
          </button>
        )}
      </div>

      {/* Contenedor principal con marco */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Filtros por estado */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => changeFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                statusFilter === f.value
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {f.label}
              {f.value !== 'all' && (
                <span className={`ml-1.5 ${statusFilter === f.value ? 'opacity-80' : 'opacity-60'}`}>
                  ({sessions.filter(s => s.status === f.value).length})
                </span>
              )}
              {f.value === 'all' && (
                <span className={`ml-1.5 ${statusFilter === f.value ? 'opacity-80' : 'opacity-60'}`}>
                  ({sessions.length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista de sesiones */}
        <div className="p-4 space-y-3 min-h-[320px]">
          {paginated.length === 0 ? (
            /* Estado vacío */
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                <CalendarDays size={32} className="text-indigo-300" />
              </div>
              <div>
                <p className="font-semibold text-slate-600">
                  {statusFilter === 'all' ? 'No hay citas registradas' : `No hay citas con estado "${statusFilter}"`}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {statusFilter === 'all'
                    ? 'Usa el botón "Agendar Cita" para crear la primera.'
                    : 'Prueba cambiando el filtro de estado.'}
                </p>
              </div>
            </div>
          ) : (
            paginated.map((session) => {
              const esHoy = isToday(session.date);
              return (
                <div
                  key={session.id}
                  className={`relative p-4 sm:p-5 rounded-xl border-2 transition-all duration-300 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 ${
                    esHoy
                      ? 'border-rose-400 bg-rose-50/40 ring-1 ring-rose-200'
                      : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
                  }`}
                >
                  {esHoy && (
                    <div className="absolute -top-3 left-5 bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-md">
                      Cita para Hoy
                    </div>
                  )}

                  <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                    <div className={`${esHoy ? 'bg-rose-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-600'} p-3 rounded-full transition-colors shrink-0`}>
                      <CalendarDays size={22} />
                    </div>
                    <div>
                      <h4 className={`font-bold ${esHoy ? 'text-rose-900' : 'text-slate-800'}`}>
                        {getPatientName(session.patientId)}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium uppercase tracking-wider mt-0.5">
                        <UserSquare2 size={11} /> {getProfName(session.professionalId)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className={`flex items-center gap-2 font-medium ${esHoy ? 'text-rose-700' : 'text-slate-600'}`}>
                      <Clock size={15} /> {session.date} · {session.time}
                    </div>
                    <div className={`font-bold px-3 py-1 rounded-lg text-xs ${esHoy ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                      {session.therapyType}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {!(isTI || permissions.appointments.edit) ? (
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-sm ${statusBadgeClass(session.status)}`}>
                        {session.status}
                      </span>
                    ) : (
                      <select
                        value={session.status}
                        onChange={e => updateStatus(session, e.target.value as Session['status'])}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border-none cursor-pointer shadow-sm ${statusBadgeClass(session.status)}`}
                      >
                        <option value="Programada">Programada</option>
                        <option value="Confirmada">Confirmada</option>
                        <option value="Efectuada">Efectuada</option>
                        <option value="Pagada">Pagada</option>
                        <option value="Cancelada">Cancelada</option>
                      </select>
                    )}
                    {(isTI || permissions.appointments.delete) && (
                      <button onClick={() => handleDelete(session.id)} className="text-slate-300 hover:text-rose-500 p-2 transition-colors">
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400 font-medium">
              {filtered.length} citas · página {safePage} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                    p === safePage
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal nueva cita */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-6">Nueva Cita</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  className="w-full p-3 rounded-xl border border-slate-200"
                  onChange={e => setNewSession({ ...newSession, patientId: e.target.value })}
                  required
                >
                  <option value="">Seleccionar Paciente</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                  className="w-full p-3 rounded-xl border border-slate-200"
                  onChange={e => setNewSession({ ...newSession, professionalId: e.target.value })}
                  required
                >
                  <option value="">Seleccionar Profesional</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input required type="date" className="w-full p-3 rounded-xl border border-slate-200" onChange={e => setNewSession({ ...newSession, date: e.target.value })} />
                <input required type="time" className="w-full p-3 rounded-xl border border-slate-200" onChange={e => setNewSession({ ...newSession, time: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tipo de Terapia</label>
                <select
                  className="w-full p-3 mt-1 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                  value={newSession.therapyType}
                  onChange={e => setNewSession({ ...newSession, therapyType: e.target.value })}
                  required
                >
                  <option value="">Seleccionar Terapia</option>
                  {therapyTasks.filter(t => t.active).map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <textarea
                placeholder="Notas adicionales..."
                className="w-full p-3 rounded-xl border border-slate-200 h-24 outline-none focus:ring-2 focus:ring-indigo-500"
                onChange={e => setNewSession({ ...newSession, notes: e.target.value })}
              />
              {formError && <p className="text-xs text-rose-500 font-medium">{formError}</p>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setFormError(null); }} className="flex-1 py-3 text-slate-500 font-bold">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100">Agendar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>}
    </div>
  );
};

export default SessionsManager;
