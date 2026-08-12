import React, { useEffect, useMemo, useState } from 'react';
import {
  Lock, Plus, Settings2, Wrench, Package, TrendingUp, TrendingDown, Search, X,
  BadgeDollarSign, User, CalendarRange, Trash2, WifiOff, AlertTriangle, Calendar,
  Activity, Stethoscope,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useEscKey from '../../shared/hooks/useEscKey';
import ConfirmModal from '../../shared/components/ConfirmModal';
import { Patient } from '../../types';
import {
  subscribeToSalesByMonth, subscribeToPacks, fetchMonthTotal,
  fetchServicePrices, saveServicePrices, deleteSale, createSale, Sale, SalePayload, SaleType,
} from './salesService';
import { subscribeToPatients } from '../patients/patientsService';
import { subscribeToProducts } from '../products/productsService';
import { fetchProfessionalByEmail } from '../professionals/professionalsService';
import { subscribeToTherapyTasks, TherapyTask } from '../daily-therapy/dailyTherapyService';
import {
  subscribeToCatalogItems, addCatalogItem, deleteCatalogItem,
  CatalogItem, CatalogKind,
} from './catalogService';
import { THERAPY_TYPES, INSTRUMENTS } from '../../constants';

interface PortalProduct {
  id: string;
  name: string;
  category?: string;
  price?: number;
  stock?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T12:00:00-05:00`).toLocaleDateString('es-PE', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return dateStr; }
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-PE', {
    month: 'long', year: 'numeric',
  });
}

function currency(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

/** Mes anterior a un monthKey YYYY-MM. */
function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Encabezado de día: "Miércoles 10 de junio" (con "Hoy · " si corresponde). */
function formatDayHeader(dateStr: string): string {
  try {
    const label = new Date(`${dateStr}T12:00:00-05:00`).toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
    return dateStr === TODAY ? `Hoy · ${label}` : capitalized;
  } catch { return dateStr; }
}

/** Fecha corta para rangos de packs: "1 jun". */
function formatShortDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T12:00:00-05:00`).toLocaleDateString('es-PE', {
      day: 'numeric', month: 'short',
    });
  } catch { return dateStr; }
}

/** Hora local de Lima desde un ISO string: "10:30 a. m.". */
function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('es-PE', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
    });
  } catch { return ''; }
}

/** Días que faltan (inclusive) hasta una fecha YYYY-MM-DD en horario de Lima. */
function daysUntil(dateStr: string): number {
  const end = new Date(`${dateStr}T23:59:59-05:00`).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

/** Iniciales del paciente para el avatar de la pestaña de packs. */
function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ─── Componente principal ─────────────────────────────────────────────────────

const SalesArea: React.FC = () => {
  const { user, isTI, role } = useAuth();
  const { showToast } = useToast();
  const canAccess = isTI || role === 'admin';
  const [loadError, setLoadError] = useState<string | null>(null);

  // Nombre del profesional logueado
  const [staffName, setStaffName] = useState('');
  useEffect(() => {
    if (!user?.email) return;
    fetchProfessionalByEmail(user.email)
      .then(name => setStaffName(name))
      .catch(() => setStaffName(user?.email ?? ''));
  }, [user?.email]);

  // ── Precios de servicios ─────────────────────────────────────────────────────
  const [servicePrices, setServicePrices] = useState<Record<string, number>>({});
  useEffect(() => {
    fetchServicePrices().then(prices => setServicePrices(prices));
  }, []);

  const onSnapErr = (label: string) => (err: Error) => {
    console.error(`onSnapshot [${label}]:`, err);
    setLoadError('No se pudieron cargar los datos. Verifica tu conexión e intenta de nuevo.');
  };

  // ── Tratamientos del catálogo (terapia diaria) — vendibles además de asignables ──
  const [therapyTasks, setTherapyTasks] = useState<TherapyTask[]>([]);
  useEffect(() => {
    return subscribeToTherapyTasks(
      (data) => setTherapyTasks(data),
      onSnapErr('therapyTasks'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Catálogo de ítems agregados desde el gestor de precios ──────────────────
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  useEffect(() => {
    return subscribeToCatalogItems(
      (data) => setCatalogItems(data),
      onSnapErr('catalogItems'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Servicios vendibles: 5 base + tratamientos de Terapia Diaria + catálogo (sin duplicar)
  const sellableServices = useMemo(() => {
    const seen = new Set<string>(THERAPY_TYPES);
    const extras: string[] = [];
    therapyTasks.filter(t => t.active).forEach(t => {
      if (!seen.has(t.name)) { seen.add(t.name); extras.push(t.name); }
    });
    catalogItems.filter(c => c.kind === 'service').forEach(c => {
      if (!seen.has(c.name)) { seen.add(c.name); extras.push(c.name); }
    });
    extras.sort((a, b) => a.localeCompare(b));
    return [...THERAPY_TYPES, ...extras];
  }, [therapyTasks, catalogItems]);

  // Instrumentos vendibles: 10 base + catálogo (sin duplicar)
  const sellableInstruments = useMemo(() => {
    const seen = new Set<string>(INSTRUMENTS);
    const extras = catalogItems
      .filter(c => c.kind === 'instrument' && !seen.has(c.name))
      .map(c => c.name)
      .sort((a, b) => a.localeCompare(b));
    return [...INSTRUMENTS, ...extras];
  }, [catalogItems]);

  // ── Productos ────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<PortalProduct[]>([]);
  useEffect(() => {
    return subscribeToProducts(
      (data) => setProducts(data.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, stock: p.stock }))),
      (err) => {
        console.error('subscribeToProducts:', err);
        setLoadError('No se pudieron cargar los productos. Verifica tu conexión.');
      },
    );
  }, []);

  // ── Pacientes ────────────────────────────────────────────────────────────────
  const [patients, setPatients] = useState<Patient[]>([]);
  useEffect(() => {
    return subscribeToPatients(
      (data) => { setLoadError(null); setPatients(data); },
      onSnapErr('patients'),
    );
  }, []);

  // ── Ventas del mes seleccionado (query filtrada en Firestore) ───────────────
  const [filterMonth, setFilterMonth] = useState(currentMonthKey());
  const [sales, setSales] = useState<Sale[]>([]);
  useEffect(() => {
    return subscribeToSalesByMonth(
      filterMonth,
      (data) => { setLoadError(null); setSales(data); },
      onSnapErr('sales'),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth]);

  // ── Total del mes anterior (para la comparación del KPI) ────────────────────
  const [prevTotal, setPrevTotal] = useState<number | null>(null);
  useEffect(() => {
    setPrevTotal(null);
    fetchMonthTotal(prevMonthKey(filterMonth))
      .then(setPrevTotal)
      .catch(() => setPrevTotal(null));
  }, [filterMonth]);

  // ── Packs (ventas con rango de vigencia) ────────────────────────────────────
  const [packs, setPacks] = useState<Sale[]>([]);
  useEffect(() => {
    return subscribeToPacks(setPacks, onSnapErr('packs'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePacks = useMemo(() =>
    packs
      .filter(p => p.validFrom && p.validTo && p.validFrom <= TODAY && p.validTo >= TODAY)
      .sort((a, b) => (a.validTo! < b.validTo! ? -1 : 1)),
    [packs]);

  const expiringPacks = useMemo(
    () => activePacks.filter(p => daysUntil(p.validTo!) <= 7),
    [activePacks],
  );

  // ── Filtros y pestañas ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState<'sales' | 'packs'>('sales');
  const [filterType, setFilterType]     = useState<'all' | SaleType>('all');
  const [patientSearch, setPatientSearch] = useState('');

  const filteredSales = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    return sales.filter(s => {
      const typeMatch   = filterType === 'all' || s.type === filterType;
      const searchMatch = !q || s.patientName.toLowerCase().includes(q);
      return typeMatch && searchMatch;
    });
  }, [sales, filterType, patientSearch]);

  // Ventas agrupadas por día — la query ya viene ordenada por fecha desc
  const salesByDay = useMemo(() => {
    const groups = new Map<string, Sale[]>();
    filteredSales.forEach(s => {
      const arr = groups.get(s.date) ?? [];
      arr.push(s);
      groups.set(s.date, arr);
    });
    return Array.from(groups.entries());
  }, [filteredSales]);

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  // Servicios e instrumentos son "atención" (no descuentan inventario), se agrupan
  // en el mismo KPI para mantener el cuadre: Total = atención + productos.
  const kpis = useMemo(() => {
    const attention = sales.filter(s => s.type === 'service' || s.type === 'instrument');
    const products  = sales.filter(s => s.type === 'product');
    return {
      total:           sales.reduce((sum, s) => sum + s.total, 0),
      serviceRevenue:  attention.reduce((sum, s) => sum + s.total, 0),
      productRevenue:  products.reduce((sum, s) => sum + s.total, 0),
      serviceCount:    attention.length,
      productCount:    products.length,
    };
  }, [sales]);

  // Variación % contra el mes anterior (null = sin datos para comparar)
  const monthDelta = useMemo(() => {
    if (prevTotal === null || prevTotal === 0) return null;
    return ((kpis.total - prevTotal) / prevTotal) * 100;
  }, [kpis.total, prevTotal]);

  // ── Modales ──────────────────────────────────────────────────────────────────
  const [showRegister, setShowRegister] = useState(false);
  const [showPrices, setShowPrices]     = useState(false);

  // ── Eliminar venta (solo TI) ─────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await deleteSale(id);
      showToast('Venta eliminada.');
    } catch {
      showToast('No se pudo eliminar la venta.', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <Lock size={28} className="text-slate-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-600">Acceso restringido</h2>
        <p className="text-sm text-slate-400 mt-1">Solo administradores pueden ver este módulo.</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
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

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Área Reservada</h1>
          <p className="text-slate-500 text-sm mt-0.5 capitalize">{formatMonthLabel(filterMonth)}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowPrices(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors shadow-sm"
          >
            <Settings2 size={15} />
            Precios
          </button>
          <button
            onClick={() => setShowRegister(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-sm shadow-blue-200"
          >
            <Plus size={15} />
            Registrar venta
          </button>
        </div>
      </div>

      {/* KPIs — montos en soles + comparación mensual + packs vigentes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total del mes con variación vs mes anterior */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <BadgeDollarSign size={16} className="text-blue-600" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total del mes</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{currency(kpis.total)}</p>
          {monthDelta !== null && (
            <p className={`text-xs font-semibold mt-1 flex items-center gap-1 ${
              monthDelta >= 0 ? 'text-emerald-600' : 'text-rose-500'
            }`}>
              {monthDelta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {monthDelta >= 0 ? '+' : ''}{monthDelta.toFixed(0)}% vs {formatMonthLabel(prevMonthKey(filterMonth)).split(' ')[0]}
            </p>
          )}
        </div>

        {/* Ingresos por servicios */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <Wrench size={16} className="text-violet-600" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Servicios</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{currency(kpis.serviceRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">{kpis.serviceCount} venta{kpis.serviceCount !== 1 ? 's' : ''}</p>
        </div>

        {/* Ingresos por productos */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Package size={16} className="text-amber-600" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Productos</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{currency(kpis.productRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">{kpis.productCount} venta{kpis.productCount !== 1 ? 's' : ''}</p>
        </div>

        {/* Packs vigentes */}
        <button
          onClick={() => setActiveTab('packs')}
          className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-violet-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <CalendarRange size={16} className="text-violet-600" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Packs vigentes</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{activePacks.length}</p>
          {expiringPacks.length > 0 ? (
            <p className="text-xs font-semibold text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle size={13} />
              {expiringPacks.length} vence{expiringPacks.length !== 1 ? 'n' : ''} pronto
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">activos hoy</p>
          )}
        </button>
      </div>

      {/* Pestañas: Ventas | Packs vigentes */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === 'sales'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Ventas
        </button>
        <button
          onClick={() => setActiveTab('packs')}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'packs'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Packs vigentes
          {activePacks.length > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === 'packs' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {activePacks.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'sales' ? (
        <>
          {/* Filtros: búsqueda por paciente, tipo y mes */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-44">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar paciente..."
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm shadow-sm"
              />
            </div>

            <div className="flex bg-slate-100 rounded-xl p-1 gap-1 flex-wrap">
              {([
                { key: 'all',        label: 'Todas' },
                { key: 'service',    label: 'Servicios' },
                { key: 'instrument', label: 'Instrumentos' },
                { key: 'product',    label: 'Productos' },
              ] as { key: typeof filterType; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilterType(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    filterType === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <input
                type="month"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="text-sm outline-none bg-transparent text-slate-700 font-medium"
              />
            </div>
          </div>

          {/* Lista de ventas agrupada por día con subtotal */}
          {salesByDay.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-14 text-center">
              <BadgeDollarSign size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">
                {patientSearch.trim()
                  ? 'No hay ventas que coincidan con la búsqueda.'
                  : 'No hay ventas registradas en este período.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {salesByDay.map(([day, daySales]) => (
                <div key={day}>
                  {/* Encabezado del día con subtotal */}
                  <div className="flex items-center justify-between px-1 mb-2">
                    <p className={`text-xs font-bold uppercase tracking-wide ${
                      day === TODAY ? 'text-blue-600' : 'text-slate-400'
                    }`}>
                      {formatDayHeader(day)}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      {currency(daySales.reduce((sum, s) => sum + s.total, 0))}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {daySales.map(sale => (
                      <div
                        key={sale.id}
                        className="bg-white border border-slate-100 rounded-2xl px-5 py-3.5 flex items-center gap-4 shadow-sm"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          sale.type === 'product' ? 'bg-amber-50'
                          : sale.type === 'instrument' ? 'bg-teal-50'
                          : 'bg-violet-50'
                        }`}>
                          {sale.type === 'product'
                            ? <Package size={18} className="text-amber-600" />
                            : sale.type === 'instrument'
                              ? <Activity size={18} className="text-teal-600" />
                              : <Wrench size={18} className="text-violet-600" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800 truncate">{sale.itemName}</p>
                            {sale.qty > 1 && <span className="text-xs text-slate-400 font-semibold">× {sale.qty}</span>}
                            {!sale.validOnlyToday && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                                Pack
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1"><User size={11} />{sale.patientName}</span>
                            {sale.createdByName && <span>registró {sale.createdByName}</span>}
                            {formatTime(sale.createdAt) && <span>{formatTime(sale.createdAt)}</span>}
                            {!sale.validOnlyToday && sale.validFrom && sale.validTo && (
                              <span className="flex items-center gap-1 text-violet-500 font-semibold">
                                <CalendarRange size={11} />
                                {formatShortDate(sale.validFrom)} → {formatShortDate(sale.validTo)}
                              </span>
                            )}
                          </div>
                          {sale.notes && (
                            <p className="text-xs text-slate-400 italic mt-0.5 truncate" title={sale.notes}>
                              {sale.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <p className="text-base font-bold text-slate-800">{currency(sale.total)}</p>
                          {isTI && (
                            <button
                              onClick={() => setConfirmDeleteId(sale.id)}
                              title="Eliminar venta"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Pestaña: Packs vigentes ─────────────────────────────────────────── */
        activePacks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-14 text-center">
            <CalendarRange size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">No hay packs vigentes en este momento.</p>
            <p className="text-slate-300 text-xs mt-1">
              Los packs se crean al registrar una venta de servicio con rango de fechas.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activePacks.map(pack => {
              const remaining = daysUntil(pack.validTo!);
              return (
                <div
                  key={pack.id}
                  className="bg-white border border-slate-100 rounded-2xl px-5 py-3.5 flex items-center gap-4 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-xs font-bold text-blue-700">
                    {initials(pack.patientName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {pack.patientName} — {pack.itemName}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatShortDate(pack.validFrom!)} → {formatShortDate(pack.validTo!)} · pagado {currency(pack.total)}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                    remaining <= 7
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {remaining <= 7 && remaining > 0
                      ? `Vence en ${remaining} día${remaining !== 1 ? 's' : ''}`
                      : remaining === 0
                        ? 'Vence hoy'
                        : `${remaining} días restantes`}
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Confirmación de eliminación (reemplaza window.confirm) */}
      {confirmDeleteId && (
        <ConfirmModal
          message="¿Eliminar esta venta? Esta acción no se puede deshacer."
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* ── Modal: Gestionar precios de servicios ─────────────────────────────── */}
      {showPrices && (
        <PricesModal
          prices={servicePrices}
          services={sellableServices}
          instruments={sellableInstruments}
          catalogItems={catalogItems}
          onClose={() => setShowPrices(false)}
          onAdd={async (name, kind) => {
            try {
              await addCatalogItem(name, kind);
              showToast(`${kind === 'service' ? 'Servicio' : 'Instrumento'} agregado.`);
            } catch {
              showToast('No se pudo agregar el ítem.', 'error');
            }
          }}
          onDelete={async (id) => {
            try {
              await deleteCatalogItem(id);
              showToast('Ítem eliminado del catálogo.');
            } catch {
              showToast('No se pudo eliminar el ítem.', 'error');
            }
          }}
          onSave={async (updated) => {
            try {
              await saveServicePrices(updated);
              setServicePrices(updated);
              showToast('Precios actualizados correctamente.');
              setShowPrices(false);
            } catch {
              showToast('No se pudieron guardar los precios.', 'error');
            }
          }}
        />
      )}

      {/* ── Modal: Registrar venta ────────────────────────────────────────────── */}
      {showRegister && (
        <RegisterSaleModal
          patients={patients}
          products={products}
          services={sellableServices}
          instruments={sellableInstruments}
          servicePrices={servicePrices}
          onClose={() => setShowRegister(false)}
          onSubmit={async (payload) => {
            try {
              await createSale(payload, user?.uid ?? '', staffName);
              showToast('Venta registrada correctamente.');
              setShowRegister(false);
            } catch {
              showToast('No se pudo registrar la venta.', 'error');
            }
          }}
        />
      )}
    </div>
  );
};

// ─── Modal: Gestionar precios ──────────────────────────────────────────────────

interface PricesModalProps {
  prices: Record<string, number>;
  services: readonly string[];
  instruments: readonly string[];
  catalogItems: CatalogItem[];
  onClose: () => void;
  onAdd: (name: string, kind: CatalogKind) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSave: (updated: Record<string, number>) => Promise<void>;
}

/** Fila reutilizable: nombre + input de precio (+ papelera si es eliminable). */
const PriceRow: React.FC<{
  name: string;
  value: number;
  isBase?: boolean;
  deletableId?: string;
  onChange: (v: number) => void;
  onDelete?: (id: string) => void;
}> = ({ name, value, isBase, deletableId, onChange, onDelete }) => (
  <div className="flex items-center gap-2">
    <span className="text-sm text-slate-700 flex-1 font-medium flex items-center gap-1.5 min-w-0">
      <span className="truncate">{name}</span>
      {isBase && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 uppercase shrink-0">base</span>
      )}
    </span>
    <div className="relative w-24 shrink-0">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">S/</span>
      <input
        type="number"
        min={0}
        step={0.5}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full pl-7 pr-2 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold text-slate-800"
      />
    </div>
    {deletableId && onDelete ? (
      <button
        type="button"
        onClick={() => onDelete(deletableId)}
        title="Quitar del catálogo"
        className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
      >
        <Trash2 size={15} />
      </button>
    ) : (
      <span className="w-7 shrink-0" />
    )}
  </div>
);

/** Fila para agregar un ítem nuevo a una columna. */
const AddRow: React.FC<{ kind: CatalogKind; onAdd: (name: string, kind: CatalogKind) => void }> = ({ kind, onAdd }) => {
  const [name, setName] = useState('');
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, kind);
    setName('');
  };
  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={kind === 'service' ? 'Nuevo servicio...' : 'Nuevo instrumento...'}
        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-dashed border-slate-300 focus:border-solid focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim()}
        className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold transition-colors disabled:opacity-40"
      >
        <Plus size={14} /> Agregar
      </button>
    </div>
  );
};

const PricesModal: React.FC<PricesModalProps> = ({
  prices, services, instruments, catalogItems, onClose, onAdd, onDelete, onSave,
}) => {
  const [local, setLocal] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEscKey(onClose, true);

  // Sincroniza los precios locales cuando cambian los ítems (al agregar uno nuevo)
  useEffect(() => {
    setLocal(prev => {
      const next = { ...prev };
      [...services, ...instruments].forEach(s => {
        if (next[s] === undefined) next[s] = prices[s] ?? 0;
      });
      return next;
    });
  }, [services, instruments, prices]);

  const setPrice = (name: string, v: number) => setLocal(p => ({ ...p, [name]: v }));

  // Mapa nombre → id de catálogo (para saber cuáles se pueden eliminar)
  const catalogIdByName = useMemo(() => {
    const m = new Map<string, string>();
    catalogItems.forEach(c => m.set(c.name, c.id));
    return m;
  }, [catalogItems]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(local);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Settings2 size={18} className="text-blue-600" />
            Gestionar precios y catálogo
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* Dos columnas: Servicios | Instrumentos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 overflow-y-auto">
          {/* Servicios */}
          <div className="px-5 py-4 sm:border-r border-slate-100">
            <p className="text-xs font-bold text-violet-600 uppercase tracking-wide flex items-center gap-1.5 mb-3">
              <Stethoscope size={14} />
              Servicios
            </p>
            <div className="space-y-2.5">
              {services.map(service => (
                <PriceRow
                  key={service}
                  name={service}
                  value={local[service] ?? 0}
                  isBase={(THERAPY_TYPES as readonly string[]).includes(service)}
                  deletableId={catalogIdByName.get(service)}
                  onChange={v => setPrice(service, v)}
                  onDelete={onDelete}
                />
              ))}
            </div>
            <AddRow kind="service" onAdd={onAdd} />
          </div>

          {/* Instrumentos */}
          <div className="px-5 py-4 bg-slate-50/60">
            <p className="text-xs font-bold text-teal-600 uppercase tracking-wide flex items-center gap-1.5 mb-3">
              <Activity size={14} />
              Instrumentos
            </p>
            <div className="space-y-2.5">
              {instruments.map(inst => (
                <PriceRow
                  key={inst}
                  name={inst}
                  value={local[inst] ?? 0}
                  isBase={(INSTRUMENTS as readonly string[]).includes(inst)}
                  deletableId={catalogIdByName.get(inst)}
                  onChange={v => setPrice(inst, v)}
                  onDelete={onDelete}
                />
              ))}
            </div>
            <AddRow kind="instrument" onAdd={onAdd} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Agrega servicios o instrumentos con "Agregar". Guarda para aplicar los precios.
          </p>
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar precios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Modal: Registrar venta ───────────────────────────────────────────────────

/** Solo los campos del paciente que el modal de venta necesita. */
interface SalePatient { id: string; name: string; dni: string; }

interface RegisterSaleModalProps {
  patients: SalePatient[];
  products: PortalProduct[];
  services: readonly string[];
  instruments: readonly string[];
  servicePrices: Record<string, number>;
  onClose: () => void;
  onSubmit: (payload: SalePayload) => Promise<void>;
}

const RegisterSaleModal: React.FC<RegisterSaleModalProps> = ({
  patients, products, services, instruments, servicePrices, onClose, onSubmit,
}) => {
  const [type, setType]           = useState<SaleType>('service');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<SalePatient | null>(null);
  const [showDropdown, setShowDropdown]       = useState(false);
  const [itemName, setItemName]   = useState('');
  const [itemId, setItemId]       = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [qty, setQty]             = useState(1);
  const [date, setDate]           = useState(TODAY);
  const [validOnlyToday, setValidOnlyToday] = useState(true);
  const [validFrom, setValidFrom] = useState(TODAY);
  const [validTo, setValidTo]     = useState(TODAY);
  const [notes, setNotes]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEscKey(onClose, true);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return [];
    const q = patientSearch.toLowerCase();
    return patients.filter(p =>
      p.name.toLowerCase().includes(q) || (p.dni || '').includes(q)
    ).slice(0, 6);
  }, [patients, patientSearch]);

  const total = unitPrice * qty;
  const canSubmit = selectedPatient && itemName && unitPrice > 0 && date;

  // Qué falta para poder registrar — se muestra junto al botón deshabilitado
  const missingItemLabel =
    type === 'product' ? 'Falta seleccionar el producto.'
    : type === 'instrument' ? 'Falta seleccionar el instrumento.'
    : 'Falta seleccionar el servicio.';
  const missingReason = !selectedPatient
    ? 'Falta seleccionar el paciente.'
    : !itemName
      ? missingItemLabel
      : unitPrice <= 0
        ? 'El precio debe ser mayor a 0.'
        : !date
          ? 'Falta la fecha.'
          : null;

  // Producto seleccionado y aviso de stock insuficiente
  const selectedProduct = type === 'product' && itemId
    ? products.find(p => p.id === itemId) ?? null
    : null;
  const stockShortage = selectedProduct !== null && qty > (selectedProduct.stock ?? 0);

  // Buscador propio de la lista de productos
  const [productSearch, setProductSearch] = useState('');
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  // Al cambiar tipo, limpiar selección de ítem
  const handleTypeChange = (t: SaleType) => {
    setType(t);
    setItemName('');
    setItemId('');
    setUnitPrice(0);
    setQty(1);
    setProductSearch('');
    // Resetear vigencia al cambiar de tipo
    setValidOnlyToday(true);
    setValidFrom(TODAY);
    setValidTo(TODAY);
  };

  // Servicios e instrumentos toman su precio del mismo mapa servicePrices
  const handleSelectService = (name: string) => {
    setItemName(name);
    setUnitPrice(servicePrices[name] ?? 0);
  };

  const handleSelectProduct = (p: PortalProduct) => {
    setItemName(p.name);
    setItemId(p.id);
    setUnitPrice(p.price ?? 0);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    await onSubmit({
      type,
      patientId:   selectedPatient!.id,
      patientName: selectedPatient!.name,
      itemName,
      itemId:      itemId || undefined,
      unitPrice,
      qty,
      total,
      date,
      validOnlyToday,
      validFrom: validOnlyToday ? undefined : validFrom,
      validTo:   validOnlyToday ? undefined : validTo,
      notes,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <BadgeDollarSign size={18} className="text-blue-600" />
            Registrar venta
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">

          {/* Tipo */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tipo de venta</p>
            <div className="flex gap-2">
              {([
                { key: 'service',    label: 'Servicio',    icon: <Wrench size={14} /> },
                { key: 'instrument', label: 'Instrumento', icon: <Activity size={14} /> },
                { key: 'product',    label: 'Producto',    icon: <Package size={14} /> },
              ] as { key: SaleType; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => handleTypeChange(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                    type === key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Paciente */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Paciente</p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nombre o DNI..."
                value={patientSearch}
                onChange={e => { setPatientSearch(e.target.value); setShowDropdown(true); if (!e.target.value) setSelectedPatient(null); }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              />
              {showDropdown && filteredPatients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {filteredPatients.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPatient(p); setPatientSearch(p.name); setShowDropdown(false); }}
                      className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                    >
                      <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400">DNI: {p.dni}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedPatient && (
              <div className="mt-2 flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-xl">
                <User size={12} className="shrink-0" />
                <span className="font-semibold">{selectedPatient.name}</span>
                <span className="text-blue-400">· DNI {selectedPatient.dni}</span>
              </div>
            )}
          </div>

          {/* Selección de ítem */}
          {type === 'service' || type === 'instrument' ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {type === 'instrument' ? 'Instrumento' : 'Servicio'}
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-0.5">
                {(type === 'instrument' ? instruments : services).map(name => {
                  const selected = itemName === name;
                  const accent = type === 'instrument'
                    ? (selected ? 'border-teal-400 bg-teal-50 text-teal-700' : '')
                    : (selected ? 'border-violet-400 bg-violet-50 text-violet-700' : '');
                  return (
                    <button
                      key={name}
                      onClick={() => handleSelectService(name)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        selected ? accent : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block truncate">{name}</span>
                      {(servicePrices[name] ?? 0) > 0 && (
                        <span className="text-xs text-slate-400 font-semibold">S/ {servicePrices[name].toFixed(2)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Producto</p>

              {/* Buscador de productos */}
              <div className="relative mb-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {filteredProducts.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-3">
                    No hay productos que coincidan con "{productSearch}".
                  </p>
                )}
                {filteredProducts.map(p => {
                  const stock = p.stock ?? 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all flex items-center justify-between ${
                        itemId === p.id
                          ? 'border-amber-400 bg-amber-50 text-amber-800'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium truncate">{p.name}</span>
                      <span className="text-xs font-semibold shrink-0 ml-2 flex items-center gap-2">
                        {p.price != null && <span className="text-slate-400">S/ {p.price.toFixed(2)}</span>}
                        <span className={stock < 5 ? 'text-rose-500 flex items-center gap-0.5' : 'text-slate-400'}>
                          {stock < 5 && <AlertTriangle size={11} />}
                          stock: {stock}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Precio, cantidad, fecha */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Precio (S/)</p>
              <input
                type="number"
                min={0}
                step={0.5}
                value={unitPrice}
                onChange={e => setUnitPrice(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Cantidad</p>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fecha</p>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              />
            </div>
          </div>

          {/* Aviso de stock insuficiente — no bloquea, el stock nunca baja de 0 */}
          {stockShortage && selectedProduct && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2.5 rounded-xl text-xs font-medium">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                Solo hay <strong>{selectedProduct.stock ?? 0}</strong> en stock de "{selectedProduct.name}" —
                esta venta dejará el inventario en 0. Puedes registrarla de todos modos si tienes el producto en mano.
              </span>
            </div>
          )}

          {/* Vigencia — solo aplica para servicios */}
          {type === 'service' && <div className="space-y-3">
            {/* Checkbox "Válida solo hoy" */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setValidOnlyToday(v => !v)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
                  validOnlyToday
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-white border-slate-300'
                }`}
              >
                {validOnlyToday && (
                  <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="1.5,6 4.5,9 10.5,3" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-semibold text-slate-700">Válida solo hoy</span>
              <span className="text-xs text-slate-400">(sesión única)</span>
            </label>

            {/* Rango de fechas para packs — visible cuando el check está desmarcado */}
            {!validOnlyToday && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-violet-600 uppercase tracking-wide flex items-center gap-1.5">
                  <CalendarRange size={13} />
                  Vigencia del pack
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Fecha inicio</p>
                    <input
                      type="date"
                      value={validFrom}
                      onChange={e => setValidFrom(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-violet-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Fecha fin</p>
                    <input
                      type="date"
                      value={validTo}
                      min={validFrom}
                      onChange={e => setValidTo(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-violet-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-violet-500">
                  El paciente tiene sesiones prepagadas dentro de este rango de fechas.
                </p>
              </div>
            )}
          </div>}

          {/* Notas */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notas (opcional)</p>
            <input
              type="text"
              placeholder="Ej. Sesión doble, descuento, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
            />
          </div>

          {/* Total */}
          {unitPrice > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-semibold">Total a registrar</span>
              <span className="text-xl font-bold text-slate-800">{currency(total)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          {/* Motivo por el que el botón está deshabilitado */}
          {missingReason ? (
            <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5 min-w-0">
              <AlertTriangle size={13} className="shrink-0" />
              <span className="truncate">{missingReason}</span>
            </p>
          ) : <span />}
          <div className="flex gap-2 shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Guardando...' : 'Registrar venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesArea;
