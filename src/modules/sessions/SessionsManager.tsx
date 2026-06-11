import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, UserSquare2, AlertTriangle, WifiOff,
  ChevronLeft, ChevronRight, CalendarDays, Search, X,
  MessageCircle, Calendar, History,
} from 'lucide-react';
import { Session, Patient, Professional } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useEscKey from '../../shared/hooks/useEscKey';
import ConfirmModal from '../../shared/components/ConfirmModal';
import { isToday, shouldAutoCreateSale, shouldWarnOnLeave, statusBadgeClass } from '../../shared/utils/session';
import { SkeletonHeader, SkeletonSessionCards } from '../../shared/components/SkeletonLoader';
import {
  subscribeToUpcomingSessions, subscribeToSessionsByMonth,
  fetchServicePrices, saleExistsForSession,
  createAutoSale, updateSessionStatus, createSession, deleteSession,
} from './sessionsService';
import { subscribeToPatients } from '../patients/patientsService';
import { subscribeToProfessionals, fetchProfessionalByEmail } from '../professionals/professionalsService';
import { THERAPY_TYPES } from '../../constants';

// ─── Tipos locales ─────────────────────────────────────────────────────────────

interface PendingChange {
  session: Session;
  newStatus: Session['status'];
  hasSale: boolean;
}

type AgendaTab = 'agenda' | 'history';

// ─── Constantes y helpers ─────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

const STATUS_FILTERS = [
  { label: 'Todas',      value: 'all' },
  { label: 'Programada', value: 'Programada' },
  { label: 'Confirmada', value: 'Confirmada' },
  { label: 'Efectuada',  value: 'Efectuada' },
  { label: 'Pagada',     value: 'Pagada' },
  { label: 'Cancelada',  value: 'Cancelada' },
] as const;

type StatusFilter = typeof STATUS_FILTERS[number]['value'];

function currentMonthKey(): string {
  return TODAY.substring(0, 7);
}

/** Suma días a una fecha YYYY-MM-DD. */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** "jueves 12 de junio" */
function formatDayLong(dateStr: string): string {
  try {
    return new Date(`${dateStr}T12:00:00-05:00`).toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  } catch { return dateStr; }
}

/** Encabezado de grupo: "Hoy · jueves 12 de junio", "Mañana · ...", o el día capitalizado. */
function dayHeader(dateStr: string): string {
  const label = formatDayLong(dateStr);
  if (dateStr === TODAY) return `Hoy · ${label}`;
  if (dateStr === shiftDate(TODAY, 1)) return `Mañana · ${label}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-PE', {
    month: 'long', year: 'numeric',
  });
}

/** Link de WhatsApp con recordatorio de cita prellenado. */
function waReminderLink(phone: string, patientName: string, session: Session): string {
  const digits = phone.replace(/\D/g, '');
  const full = digits.length === 9 ? `51${digits}` : digits;
  const firstName = patientName.split(' ')[0];
  const dayLabel = session.date === TODAY
    ? 'hoy'
    : session.date === shiftDate(TODAY, 1)
      ? `mañana ${formatDayLong(session.date)}`
      : `el ${formatDayLong(session.date)}`;
  const msg = `Hola ${firstName}, te recordamos tu cita de ${session.therapyType} ${dayLabel} a las ${session.time} en Fisioterapi Chepén (Av. Manuel Seoane 259). Por favor confirma tu asistencia. ¡Gracias!`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const SessionsManager: React.FC = () => {
  const { user, isTI, permissions } = useAuth();
  const { showToast } = useToast();

  const [activeTab,    setActiveTab]    = useState<AgendaTab>('agenda');
  const [historyMonth, setHistoryMonth] = useState(currentMonthKey());

  const [sessions,      setSessions]      = useState<Session[]>([]);
  const [patients,      setPatients]      = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [servicePrices, setServicePrices] = useState<Record<string, number>>({});
  const [staffName,     setStaffName]     = useState('');

  const [loadError,       setLoadError]       = useState<string | null>(null);
  const [isLoading,       setIsLoading]       = useState(true);
  const [statusFilter,    setStatusFilter]    = useState<StatusFilter>('all');
  const [patientSearch,   setPatientSearch]   = useState('');
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

  // Buscador de paciente dentro del modal
  const [modalPatientSearch, setModalPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const onErr = (label: string) => (err: Error) => {
    console.error(`onSnapshot [${label}]:`, err);
    setLoadError('No se pudieron cargar los datos. Verifica tu conexión e intenta de nuevo.');
  };

  // ── Sesiones: la suscripción depende de la pestaña activa ───────────────────
  useEffect(() => {
    setIsLoading(true);
    const onData = (data: Session[]) => {
      setLoadError(null);
      setIsLoading(false);
      setSessions(data);
    };
    return activeTab === 'agenda'
      ? subscribeToUpcomingSessions(TODAY, onData, onErr('sessions-agenda'))
      : subscribeToSessionsByMonth(historyMonth, onData, onErr('sessions-history'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, historyMonth]);

  // ── Pacientes y profesionales ────────────────────────────────────────────────
  useEffect(() => {
    const unsubPatients = subscribeToPatients(
      (data) => setPatients(data),
      onErr('patients'),
    );
    const unsubProfessionals = subscribeToProfessionals(
      (data) => setProfessionals(data),
      onErr('professionals'),
    );
    return () => { unsubPatients(); unsubProfessionals(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Precios de servicios (para la venta automática)
  useEffect(() => {
    fetchServicePrices().then(setServicePrices);
  }, []);

  // Nombre del profesional logueado
  useEffect(() => {
    if (!user?.email) return;
    fetchProfessionalByEmail(user.email)
      .then(name => setStaffName(name))
      .catch(() => setStaffName(user.email!));
  }, [user?.email]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getPatientName  = (id: string) => patients.find(p => p.id === id)?.name || 'Paciente no encontrado';
  const getPatientPhone = (id: string) => patients.find(p => p.id === id)?.phone || '';
  const getProfName     = (id: string) => professionals.find(p => p.id === id)?.name || 'Especialista no encontrado';

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

  // ── Crear sesión ─────────────────────────────────────────────────────────────
  const closeModal = () => {
    setIsModalOpen(false);
    setFormError(null);
    setModalPatientSearch('');
    setShowPatientDropdown(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSession.patientId || !newSession.professionalId) {
      setFormError('Por favor selecciona un paciente y un profesional.');
      return;
    }
    if (!newSession.date) { setFormError('Por favor selecciona una fecha.'); return; }
    if (!newSession.time) { setFormError('Por favor selecciona una hora.'); return; }
    if (newSession.time < '08:00' || newSession.time > '20:00') {
      setFormError('El horario de atención es de 08:00 a 20:00.');
      return;
    }
    setFormError(null);
    try {
      const patientName = patients.find(p => p.id === newSession.patientId)?.name;
      await createSession(newSession, user, patientName);
      closeModal();
      setNewSession({ patientId: '', professionalId: '', date: '', time: '', therapyType: '', status: 'Programada', notes: '' });
      showToast('Cita agendada');
    } catch (error) {
      console.error('Error al agendar sesión:', error);
    }
  };

  // Aviso de conflicto: mismo profesional, misma fecha y hora (no bloquea)
  const scheduleConflict = useMemo(() => {
    if (!newSession.professionalId || !newSession.date || !newSession.time) return null;
    const clash = sessions.find(s =>
      s.professionalId === newSession.professionalId &&
      s.date === newSession.date &&
      s.time === newSession.time &&
      s.status !== 'Cancelada'
    );
    return clash ? getPatientName(clash.patientId) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSession.professionalId, newSession.date, newSession.time, sessions, patients]);

  // Pacientes filtrados para el dropdown del modal
  const modalFilteredPatients = useMemo(() => {
    if (!modalPatientSearch.trim()) return [];
    const q = modalPatientSearch.toLowerCase();
    return patients
      .filter(p => p.name.toLowerCase().includes(q) || (p.dni || '').includes(q))
      .slice(0, 6);
  }, [patients, modalPatientSearch]);

  const selectedModalPatient = patients.find(p => p.id === newSession.patientId) ?? null;

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

  // ── Filtrado, ordenamiento, agrupación y paginación ──────────────────────────
  const filtered = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    const base = sessions.filter(s =>
      (statusFilter === 'all' || s.status === statusFilter) &&
      (!term || getPatientName(s.patientId).toLowerCase().includes(term))
    );
    // Agenda: cronológico ascendente (hoy → mañana → ...)
    // Historial: descendente (lo más reciente primero)
    return [...base].sort((a, b) => {
      const keyA = `${a.date}${a.time}`;
      const keyB = `${b.date}${b.time}`;
      return activeTab === 'agenda' ? keyA.localeCompare(keyB) : keyB.localeCompare(keyA);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, statusFilter, patientSearch, activeTab, patients]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  // La agenda se muestra completa (acotada por naturaleza); el historial se pagina
  const visible    = activeTab === 'agenda'
    ? filtered
    : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Agrupar por día (el orden ya viene resuelto)
  const groupedByDay = useMemo(() => {
    const groups = new Map<string, Session[]>();
    visible.forEach(s => {
      const arr = groups.get(s.date) ?? [];
      arr.push(s);
      groups.set(s.date, arr);
    });
    return Array.from(groups.entries());
  }, [visible]);

  const changeFilter = (f: StatusFilter) => { setStatusFilter(f); setCurrentPage(1); };
  const changeTab = (tab: AgendaTab) => {
    setActiveTab(tab);
    setStatusFilter('all');
    setPatientSearch('');
    setCurrentPage(1);
  };

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

      {/* Pestañas: Agenda | Historial */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200">
        <div className="flex gap-1">
          <button
            onClick={() => changeTab('agenda')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === 'agenda'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar size={15} />
            Agenda
            {activeTab === 'agenda' && !isLoading && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                {filtered.length}
              </span>
            )}
          </button>
          <button
            onClick={() => changeTab('history')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <History size={15} />
            Historial
          </button>
        </div>

        {/* Selector de mes — solo en historial */}
        {activeTab === 'history' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm mb-1">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <input
              type="month"
              value={historyMonth}
              max={currentMonthKey()}
              onChange={e => { setHistoryMonth(e.target.value); setCurrentPage(1); }}
              className="text-sm outline-none bg-transparent text-slate-700 font-medium"
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonHeader />
          <SkeletonSessionCards rows={8} />
        </div>
      ) : <>

      {/* Buscador + filtros por estado */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar paciente..."
            value={patientSearch}
            onChange={e => { setPatientSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
              <span className={`ml-1.5 ${statusFilter === f.value ? 'opacity-80' : 'opacity-60'}`}>
                ({f.value === 'all' ? sessions.length : sessions.filter(s => s.status === f.value).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista agrupada por día */}
      {groupedByDay.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <CalendarDays size={32} className="text-indigo-300" />
          </div>
          <div>
            <p className="font-semibold text-slate-600">
              {patientSearch.trim()
                ? 'No hay citas que coincidan con la búsqueda.'
                : activeTab === 'agenda'
                  ? statusFilter === 'all' ? 'No hay citas próximas' : `No hay citas próximas con estado "${statusFilter}"`
                  : `Sin citas en ${formatMonthLabel(historyMonth)}`}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {activeTab === 'agenda'
                ? 'Usa el botón "Agendar Cita" para crear una nueva.'
                : 'Prueba con otro mes o cambia los filtros.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDay.map(([day, daySessions]) => {
            const esHoy = isToday(day);
            return (
              <div key={day}>
                {/* Encabezado del día */}
                <div className="flex items-center justify-between px-1 mb-2">
                  <p className={`text-xs font-bold uppercase tracking-wide ${esHoy ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {dayHeader(day)}
                  </p>
                  <p className="text-xs font-semibold text-slate-400">
                    {daySessions.length} cita{daySessions.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-2">
                  {daySessions.map((session) => {
                    const phone = getPatientPhone(session.patientId);
                    const patientName = getPatientName(session.patientId);
                    const canRemind = phone && (session.status === 'Programada' || session.status === 'Confirmada');
                    return (
                      <div
                        key={session.id}
                        className={`bg-white px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 shadow-sm transition-all rounded-2xl border ${
                          esHoy
                            ? 'border-indigo-200 border-l-4 border-l-indigo-500'
                            : 'border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        {/* Hora */}
                        <div className="text-center shrink-0 sm:min-w-14">
                          <p className={`text-base font-bold ${esHoy ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {session.time}
                          </p>
                          <p className="text-[10px] text-slate-300 font-semibold">30 min</p>
                        </div>

                        {/* Paciente + detalle */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            {patientName}
                            {session.type === 'online-booking' && (
                              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 uppercase align-middle">
                                Web
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-500">{session.therapyType}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1"><UserSquare2 size={11} />{getProfName(session.professionalId)}</span>
                            {session.notes && <span className="italic truncate max-w-44" title={session.notes}>· "{session.notes}"</span>}
                          </p>
                        </div>

                        {/* Estado + acciones */}
                        <div className="flex items-center gap-2 shrink-0">
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

                          {canRemind && (
                            <a
                              href={waReminderLink(phone, patientName, session)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Enviar recordatorio por WhatsApp"
                              className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors"
                            >
                              <MessageCircle size={17} />
                            </a>
                          )}

                          {(isTI || permissions.appointments.delete) && (
                            <button onClick={() => handleDelete(session.id)} className="text-slate-300 hover:text-rose-500 p-2 transition-colors" title="Eliminar cita">
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginación — solo historial */}
      {activeTab === 'history' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-slate-400 font-medium">
            {filtered.length} citas · página {safePage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Modal nueva cita */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-6">Nueva Cita</h3>
            <form onSubmit={handleAdd} className="space-y-4">

              {/* Paciente — buscador con dropdown */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Paciente</label>
                <div className="relative mt-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o DNI..."
                    value={modalPatientSearch}
                    onChange={e => {
                      setModalPatientSearch(e.target.value);
                      setShowPatientDropdown(true);
                      if (!e.target.value) setNewSession({ ...newSession, patientId: '' });
                    }}
                    onFocus={() => setShowPatientDropdown(true)}
                    className="w-full pl-9 pr-4 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                  {showPatientDropdown && modalFilteredPatients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {modalFilteredPatients.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setNewSession({ ...newSession, patientId: p.id });
                            setModalPatientSearch(p.name);
                            setShowPatientDropdown(false);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400">DNI: {p.dni}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedModalPatient && (
                  <div className="mt-2 flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl">
                    <span className="font-semibold">{selectedModalPatient.name}</span>
                    <span className="text-indigo-400">· DNI {selectedModalPatient.dni}</span>
                  </div>
                )}
              </div>

              {/* Profesional */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Profesional</label>
                <select
                  className="w-full p-3 mt-1 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  value={newSession.professionalId}
                  onChange={e => setNewSession({ ...newSession, professionalId: e.target.value })}
                  required
                >
                  <option value="">Seleccionar Profesional</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Fecha y hora */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Fecha</label>
                  <input
                    required
                    type="date"
                    className="w-full p-3 mt-1 rounded-xl border border-slate-200"
                    value={newSession.date}
                    onChange={e => setNewSession({ ...newSession, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Hora (08:00–20:00)</label>
                  <input
                    required
                    type="time"
                    min="08:00"
                    max="20:00"
                    step={1800}
                    className="w-full p-3 mt-1 rounded-xl border border-slate-200"
                    value={newSession.time}
                    onChange={e => setNewSession({ ...newSession, time: e.target.value })}
                  />
                </div>
              </div>

              {/* Aviso de conflicto de horario */}
              {scheduleConflict && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2.5 rounded-xl text-xs font-medium">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    {getProfName(newSession.professionalId)} ya tiene una cita con{' '}
                    <strong>{scheduleConflict}</strong> el {newSession.date} a las {newSession.time}.
                    Puedes agendar de todos modos si es intencional.
                  </span>
                </div>
              )}

              {/* Tipo de terapia */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tipo de Terapia</label>
                <select
                  className="w-full p-3 mt-1 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                  value={newSession.therapyType}
                  onChange={e => setNewSession({ ...newSession, therapyType: e.target.value })}
                  required
                >
                  <option value="">Seleccionar Terapia</option>
                  {THERAPY_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <textarea
                placeholder="Notas adicionales..."
                className="w-full p-3 rounded-xl border border-slate-200 h-24 outline-none focus:ring-2 focus:ring-indigo-500"
                value={newSession.notes}
                onChange={e => setNewSession({ ...newSession, notes: e.target.value })}
              />
              {formError && <p className="text-xs text-rose-500 font-medium">{formError}</p>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 py-3 text-slate-500 font-bold">Cancelar</button>
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
