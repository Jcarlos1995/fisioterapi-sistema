import React, { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit, ClipboardList, AlertTriangle, CheckCheck, WifiOff,
  CalendarDays, ListChecks, Globe, TrendingUp, TrendingDown,
  BadgeDollarSign, UserPlus, CalendarX, Package, CalendarRange, Bell, Lock,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { useDashboardData } from './hooks/useDashboardData';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonStatCards, SkeletonCharts } from '../../shared/components/SkeletonLoader';
import { subscribeToCancellationNotifications, markNotificationRead, CancellationNotification } from './dashboardService';
import { subscribeToTasksByDate, TherapyPatientTask } from '../daily-therapy/dailyTherapyService';
import { subscribeToPacks, Sale } from '../sales/salesService';

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Colores de la dona por estado — alineados con los badges del módulo Sesiones
const STATUS_COLORS: Record<string, string> = {
  Programada: '#f59e0b',
  Confirmada: '#3b82f6',
  Efectuada:  '#10b981',
  Pagada:     '#0f766e',
  Cancelada:  '#fb7185',
};

const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

/** Días que faltan hasta una fecha YYYY-MM-DD (Lima). */
function daysUntil(dateStr: string): number {
  const end = new Date(`${dateStr}T23:59:59-05:00`).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

/** Variación porcentual contra el período anterior (null si no hay base). */
function pctDelta(current: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function currency(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

/** Flecha de tendencia verde/roja con el porcentaje. */
const Delta: React.FC<{ value: number | null }> = ({ value }) => {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <p className={`text-xs font-semibold mt-1 flex items-center gap-1 ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {up ? '+' : ''}{value.toFixed(0)}%
    </p>
  );
};

const Dashboard: React.FC = () => {
  const { isTI, role, permissions } = useAuth();
  const { showToast } = useToast();
  const isAdminOrTI = isTI || role === 'admin';

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [showLoadError, setShowLoadError] = useState(true);
  const [analysis,      setAnalysis]      = useState<string | null>(null);
  const [loadingIA,     setLoadingIA]     = useState(false);
  const [cancellations, setCancellations] = useState<CancellationNotification[]>([]);

  const { stats, chartData, statusData, webPendingAppointments, loadError, isLoading } =
    useDashboardData(selectedMonth, isAdminOrTI);

  // Notificaciones de cancelación
  useEffect(() => {
    return subscribeToCancellationNotifications(
      (rows) => setCancellations(rows),
      (err) => console.error('[Dashboard] cancellationNotifications:', err),
    );
  }, []);

  // Terapia diaria de hoy (todos los pacientes)
  const [todayTasks, setTodayTasks] = useState<TherapyPatientTask[]>([]);
  useEffect(() => {
    return subscribeToTasksByDate(
      TODAY,
      (data) => setTodayTasks(data),
      (err) => console.error('[Dashboard] todayTasks:', err),
    );
  }, []);
  const therapyDone  = todayTasks.filter(t => t.done).length;
  const therapyTotal = todayTasks.length;
  const therapyPct   = therapyTotal > 0 ? Math.round((therapyDone / therapyTotal) * 100) : null;

  // Packs por vencer (solo admin/TI — el chip enlaza a Área Reservada)
  const [packs, setPacks] = useState<Sale[]>([]);
  useEffect(() => {
    if (!isAdminOrTI) return;
    return subscribeToPacks(setPacks, (err) => console.error('[Dashboard] packs:', err));
  }, [isAdminOrTI]);
  const expiringPacks = useMemo(() =>
    packs.filter(p =>
      p.validFrom && p.validTo && p.validFrom <= TODAY && p.validTo >= TODAY &&
      daysUntil(p.validTo) <= 7
    ).length,
    [packs]);

  // KPIs derivados del mes
  const prevMonthName  = MONTHS[(selectedMonth + 11) % 12];
  const revenueDelta   = stats.revenueMonth !== null ? pctDelta(stats.revenueMonth, stats.revenuePrev) : null;
  const sessionsDelta  = pctDelta(stats.monthDone, stats.prevMonthDone || null);
  const cancelRate     = stats.monthTotal > 0 ? Math.round((stats.monthCancelled / stats.monthTotal) * 100) : null;

  const generateAnalysis = async () => {
    setLoadingIA(true);
    setAnalysis(null);
    try {
      const revenueLine = stats.revenueMonth !== null
        ? `- Ingresos del mes: ${currency(stats.revenueMonth)}${stats.revenuePrev ? ` (mes anterior: ${currency(stats.revenuePrev)})` : ''}\n      `
        : '';
      const prompt = `Actúa como un consultor experto en gestión de clínicas de fisioterapia y rehabilitación.
      Analiza los siguientes indicadores de Fisioterapi Chepén para el mes de ${MONTHS[selectedMonth]}:
      ${revenueLine}- Sesiones realizadas en el mes: ${stats.monthDone} (mes anterior: ${stats.prevMonthDone})
      - Citas canceladas: ${stats.monthCancelled} de ${stats.monthTotal}${cancelRate !== null ? ` (${cancelRate}%)` : ''}
      - Pacientes nuevos del mes: ${stats.newPatientsMonth} (total registrados: ${stats.patients})
      - Inversión en inventario: ${currency(stats.inventoryValue)}
      - Alerta de stock: ${stats.lowStockItems} productos críticos.

      Proporciona un análisis ejecutivo breve de 3 puntos clave y una recomendación estratégica.`;

      const user = auth.currentUser;
      if (!user) throw new Error("No autenticado");
      const token = await user.getIdToken();

      const response = await fetch(
        "https://us-central1-fisiosystem-8c492.cloudfunctions.net/geminiProxy",
        {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ prompt }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Error desconocido");
      setAnalysis(data.text);
    } catch (error: any) {
      const msg: string = error?.message ?? '';
      if (msg.includes('503') || msg.includes('unavailable'))
        setAnalysis("El servicio de IA está con alta demanda. Espera unos segundos e inténtalo de nuevo.");
      else if (msg.includes('429') || msg.includes('resource-exhausted'))
        setAnalysis("Se alcanzó el límite de uso de la IA. Intenta de nuevo en unos minutos.");
      else
        setAnalysis("No se pudo conectar con el análisis IA. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setLoadingIA(false);
    }
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const tableRows = chartData.map(d => `
      <tr>
        <td style="padding:12px;border:1px solid #eee;">${d.name}</td>
        <td style="padding:12px;border:1px solid #eee;text-align:center;font-weight:bold;">${d.sesiones}</td>
      </tr>`).join('');
    printWindow.document.write(`
      <html><head><title>Reporte - ${MONTHS[selectedMonth]}</title>
      <style>body{font-family:'Segoe UI',sans-serif;padding:50px;color:#333}.header{border-block-end:2px solid #3b82f6;padding-block-end:10px;margin-block-end:20px}table{inline-size:100%;border-collapse:collapse}th{background:#f1f5f9;padding:12px;border:1px solid #cbd5e1;text-align:start}</style>
      </head><body>
        <div class="header"><h1>Reporte de Sesiones</h1><p>Mes: <strong>${MONTHS[selectedMonth]}</strong></p></div>
        <table><thead><tr><th>Especialista</th><th style="text-align:center">Sesiones</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const markAsRead = async (id: string) => {
    if (!(isTI || permissions.appointments.edit)) return;
    try {
      await markNotificationRead(id);
      showToast('Cancelación marcada como leída.');
    } catch {
      showToast('No se pudo marcar la notificación como leída.', 'error');
    }
  };

  return (
    <div className="space-y-6">

      {/* Banner de error de carga */}
      {loadError && showLoadError && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
          <WifiOff size={18} className="shrink-0" />
          <span>{loadError}</span>
          <button
            onClick={() => setShowLoadError(false)}
            className="ml-auto text-rose-400 hover:text-rose-600 transition-colors"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Cabecera ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 uppercase tracking-tight">Panel de Control</h1>
          <p className="text-slate-500 font-medium italic text-sm">Fisioterapia Chepén - Gestión de Salud</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="bg-white border border-slate-200 px-3 py-2 rounded-lg font-semibold text-slate-600 outline-none shadow-sm text-sm">
            {MONTHS.map((mes, i) => <option key={i} value={i}>{mes}</option>)}
          </select>
          <button onClick={handlePrintReport} className="bg-slate-800 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md hover:bg-slate-900 transition-all text-sm">
            <ClipboardList size={15} /> <span className="hidden sm:inline">Exportar</span>
          </button>
          <button onClick={generateAnalysis} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md hover:bg-blue-700 transition-all text-sm">
            <BrainCircuit size={15} /> {loadingIA ? "Analizando..." : <><span className="hidden sm:inline">Análisis </span>IA</>}
          </button>
        </div>
      </div>

      {isLoading ? <SkeletonStatCards /> : <>

      {/* ── HOY ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Hoy</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Link to="/sessions" className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-300 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <CalendarDays size={16} className="text-blue-600" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Citas de hoy</p>
            </div>
            <p className="text-xl font-bold text-slate-800">{stats.todayTotal}</p>
            <p className="text-xs text-slate-400 mt-1">
              {stats.todayConfirmed} confirmada{stats.todayConfirmed !== 1 ? 's' : ''}
              {stats.todayNext ? ` · próxima ${stats.todayNext}` : ''}
            </p>
          </Link>

          <Link to="/daily-therapy" className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-emerald-300 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <ListChecks size={16} className="text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Terapia diaria</p>
            </div>
            <p className="text-xl font-bold text-slate-800">
              {therapyDone} <span className="text-sm font-semibold text-slate-400">/ {therapyTotal}</span>
            </p>
            <p className={`text-xs font-semibold mt-1 ${
              therapyPct === null ? 'text-slate-300'
              : therapyPct >= 75  ? 'text-emerald-600'
              : therapyPct >= 40  ? 'text-amber-600'
              : 'text-rose-500'
            }`}>
              {therapyPct === null ? 'sin tareas asignadas' : `${therapyPct}% de cumplimiento`}
            </p>
          </Link>

          <Link to="/sessions" className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-violet-300 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Globe size={16} className="text-violet-600" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Reservas web</p>
            </div>
            <p className={`text-xl font-bold ${webPendingAppointments > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {webPendingAppointments}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {webPendingAppointments > 0 ? 'pendientes de confirmar' : 'todo confirmado'}
            </p>
          </Link>
        </div>
      </div>

      {/* ── MES ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          {MONTHS[selectedMonth]} · comparado con {prevMonthName}
        </p>
        <div className={`grid grid-cols-2 ${isAdminOrTI ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 sm:gap-4`}>
          {isAdminOrTI && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <BadgeDollarSign size={16} className="text-blue-600" />
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  Ingresos <Lock size={10} className="text-slate-300" />
                </p>
              </div>
              <p className="text-xl font-bold text-slate-800">{currency(stats.revenueMonth ?? 0)}</p>
              <Delta value={revenueDelta} />
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <CalendarDays size={16} className="text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Sesiones realizadas</p>
            </div>
            <p className="text-xl font-bold text-slate-800">{stats.monthDone}</p>
            <Delta value={sessionsDelta} />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <UserPlus size={16} className="text-violet-600" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pacientes nuevos</p>
            </div>
            <p className="text-xl font-bold text-slate-800">{stats.newPatientsMonth}</p>
            <p className="text-xs text-slate-400 mt-1">{stats.patients} en total</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                <CalendarX size={16} className="text-rose-500" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Cancelación</p>
            </div>
            <p className={`text-xl font-bold ${
              cancelRate === null ? 'text-slate-300'
              : cancelRate <= 10  ? 'text-emerald-600'
              : cancelRate <= 20  ? 'text-amber-600'
              : 'text-rose-500'
            }`}>
              {cancelRate === null ? '—' : `${cancelRate}%`}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {stats.monthCancelled} de {stats.monthTotal} cita{stats.monthTotal !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Alertas (chips) ── */}
      {(stats.lowStockItems > 0 || expiringPacks > 0 || cancellations.length > 0 || isAdminOrTI) && (
        <div className="flex flex-wrap gap-2">
          {stats.lowStockItems > 0 && (
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle size={13} />
              {stats.lowStockItems} producto{stats.lowStockItems !== 1 ? 's' : ''} con stock bajo
            </Link>
          )}
          {isAdminOrTI && expiringPacks > 0 && (
            <Link
              to="/sales-area"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
            >
              <CalendarRange size={13} />
              {expiringPacks} pack{expiringPacks !== 1 ? 's' : ''} por vencer
            </Link>
          )}
          {cancellations.length > 0 && (
            <a
              href="#cancelaciones"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
            >
              <Bell size={13} />
              {cancellations.length} cancelaci{cancellations.length !== 1 ? 'ones' : 'ón'} sin leer
            </a>
          )}
          {isAdminOrTI && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              <Package size={13} />
              Inventario: {currency(stats.inventoryValue)}
            </span>
          )}
        </div>
      )}
      </>}

      {/* ── Gráficas ── */}
      {isLoading ? <SkeletonCharts /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-700 mb-6">Sesiones realizadas por especialista · {MONTHS[selectedMonth]}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="sesiones" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
          <h3 className="font-bold text-slate-700 mb-6 self-start text-sm uppercase tracking-wider">
            Estados de sesiones · {MONTHS[selectedMonth]}
          </h3>
          {statusData.length === 0 ? (
            <p className="text-sm text-slate-400 py-12">Sin sesiones registradas este mes.</p>
          ) : (
            <>
              <PieChart width={250} height={200}>
                <Pie
                  data={statusData}
                  innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={4}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
              <div className="flex flex-wrap gap-3 mt-4 justify-center">
                {statusData.map(entry => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.name] ?? '#94a3b8' }} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>}

      {/* ── Cancelaciones recientes ── */}
      <div id="cancelaciones" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-700">Cancelaciones recientes</h3>
          <span className="text-xs font-bold bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full">
            {cancellations.length} pendientes
          </span>
        </div>

        {cancellations.length === 0 ? (
          <p className="text-sm text-slate-500">No hay cancelaciones pendientes de revisar.</p>
        ) : (
          <div className="space-y-3">
            {cancellations.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    PACIENTE: {item.patientName} ha cancelado su cita
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    {item.therapyType} - {item.sessionDate} {item.sessionTime}
                  </p>
                  {item.reason && (
                    <p className="text-xs text-slate-500 mt-1">Motivo: {item.reason}</p>
                  )}
                </div>
                {(isTI || permissions.appointments.edit) && (
                  <button
                    onClick={() => markAsRead(item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    <CheckCheck size={14} />
                    Marcar leído
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* ── Análisis IA ── */}
      {analysis && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl animate-in fade-in duration-700">
          <div className="flex items-center gap-3 mb-4 text-blue-400">
            <BrainCircuit size={24} />
            <h2 className="text-xl font-bold text-white">Análisis Estratégico IA</h2>
          </div>
          <p className="text-slate-300 leading-relaxed text-lg italic whitespace-pre-wrap">{analysis}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
