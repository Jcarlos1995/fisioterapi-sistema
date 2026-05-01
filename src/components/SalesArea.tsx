import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy,
  addDoc, doc, getDoc, setDoc, getDocs, deleteDoc,
} from 'firebase/firestore';
import {
  Lock, Plus, Settings2, Wrench, Package,
  TrendingUp, Search, X, ChevronDown, BadgeDollarSign, User, CalendarRange, Trash2,
} from 'lucide-react';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useEscKey from '../hooks/useEscKey';
import { Patient } from '../types';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Sale {
  id: string;
  type: 'service' | 'product';
  patientId: string;
  patientName: string;
  itemName: string;
  itemId?: string;
  unitPrice: number;
  qty: number;
  total: number;
  date: string;             // YYYY-MM-DD — fecha de pago
  sessionId?: string;       // referencia a la sesión que originó la venta
  validOnlyToday: boolean;  // true = sesión única, false = pack con rango
  validFrom?: string;       // YYYY-MM-DD — inicio de vigencia del pack
  validTo?: string;         // YYYY-MM-DD — fin de vigencia del pack
  notes?: string;
  createdAt: string;
  createdByUid: string;
  createdByName: string;
}

interface TherapyTask {
  id: string;
  name: string;
  active: boolean;
}

interface PortalProduct {
  id: string;
  name: string;
  category?: string;
  price?: number;
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

// ─── Componente principal ─────────────────────────────────────────────────────

const SalesArea: React.FC = () => {
  const { user, isTI, role } = useAuth();
  const { showToast } = useToast();
  const canAccess = isTI || role === 'admin';

  // Nombre del profesional logueado
  const [staffName, setStaffName] = useState('');
  useEffect(() => {
    if (!user?.email) return;
    getDocs(query(collection(db, 'professionals')))
      .then(snap => {
        const match = snap.docs.find(d => (d.data() as any).email === user.email);
        setStaffName(match ? (match.data() as any).name || user.email! : user.email!);
      })
      .catch(() => setStaffName(user?.email ?? ''));
  }, [user?.email]);

  // ── Precios de servicios ─────────────────────────────────────────────────────
  const [servicePrices, setServicePrices] = useState<Record<string, number>>({});
  useEffect(() => {
    getDoc(doc(db, 'servicePrices', 'default')).then(snap => {
      if (snap.exists()) setServicePrices(snap.data() as Record<string, number>);
    });
  }, []);

  // ── Tareas globales (servicios del catálogo) ─────────────────────────────────
  const [therapyTasks, setTherapyTasks] = useState<TherapyTask[]>([]);
  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'therapyTasks'), orderBy('createdAt', 'desc')),
      snap => setTherapyTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as TherapyTask)))
    );
  }, []);
  const activeTasks = therapyTasks.filter(t => t.active);

  // ── Productos ────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<PortalProduct[]>([]);
  useEffect(() => {
    getDocs(query(collection(db, 'products'), orderBy('name'))).then(snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PortalProduct)));
    });
  }, []);

  // ── Pacientes ────────────────────────────────────────────────────────────────
  const [patients, setPatients] = useState<Patient[]>([]);
  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'patients'), orderBy('name')),
      snap => setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient)))
    );
  }, []);

  // ── Ventas ───────────────────────────────────────────────────────────────────
  const [sales, setSales] = useState<Sale[]>([]);
  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'sales'), orderBy('date', 'desc'), orderBy('createdAt', 'desc')),
      snap => setSales(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)))
    );
  }, []);

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const [filterType, setFilterType] = useState<'all' | 'service' | 'product'>('all');
  const [filterMonth, setFilterMonth] = useState(currentMonthKey());

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const monthMatch = s.date.startsWith(filterMonth);
      const typeMatch  = filterType === 'all' || s.type === filterType;
      return monthMatch && typeMatch;
    });
  }, [sales, filterMonth, filterType]);

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const monthSales = sales.filter(s => s.date.startsWith(filterMonth));
    return {
      total:    monthSales.reduce((sum, s) => sum + s.total, 0),
      services: monthSales.filter(s => s.type === 'service').length,
      products: monthSales.filter(s => s.type === 'product').length,
      count:    monthSales.length,
    };
  }, [sales, filterMonth]);

  // ── Modales ──────────────────────────────────────────────────────────────────
  const [showRegister, setShowRegister] = useState(false);
  const [showPrices, setShowPrices]     = useState(false);

  // ── Eliminar venta (solo TI) ─────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const handleDeleteSale = async (id: string) => {
    if (!window.confirm('¿Eliminar esta venta? Esta acción no se puede deshacer.')) return;
    try {
      await deleteDoc(doc(db, 'sales', id));
      showToast('Venta eliminada.');
    } catch {
      showToast('No se pudo eliminar la venta.', 'error');
    } finally {
      setDeletingId(null);
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

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total del mes', value: currency(kpis.total), icon: <TrendingUp size={20} className="text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Ventas totales', value: String(kpis.count), icon: <BadgeDollarSign size={20} className="text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Servicios',     value: String(kpis.services), icon: <Wrench size={20} className="text-violet-600" />, bg: 'bg-violet-50' },
          { label: 'Productos',     value: String(kpis.products), icon: <Package size={20} className="text-amber-600" />, bg: 'bg-amber-50' },
        ].map(({ label, value, icon, bg }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Tipo */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {([
            { key: 'all',     label: 'Todas' },
            { key: 'service', label: 'Servicios' },
            { key: 'product', label: 'Productos' },
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

        {/* Mes */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="text-sm outline-none bg-transparent text-slate-700 font-medium"
          />
        </div>
      </div>

      {/* Lista de ventas */}
      <div className="space-y-3">
        {filteredSales.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-14 text-center">
            <BadgeDollarSign size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">No hay ventas registradas en este período.</p>
          </div>
        ) : (
          filteredSales.map(sale => (
            <div
              key={sale.id}
              className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm"
            >
              {/* Ícono tipo */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                sale.type === 'service' ? 'bg-violet-50' : 'bg-amber-50'
              }`}>
                {sale.type === 'service'
                  ? <Wrench size={18} className="text-violet-600" />
                  : <Package size={18} className="text-amber-600" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    sale.type === 'service' ? 'bg-violet-50 text-violet-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {sale.type === 'service' ? 'Servicio' : 'Producto'}
                  </span>
                  {!sale.validOnlyToday && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      Pack
                    </span>
                  )}
                  <p className="text-sm font-bold text-slate-800 truncate">{sale.itemName}</p>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1"><User size={11} />{sale.patientName}</span>
                  <span>{formatDate(sale.date)}</span>
                  {sale.qty > 1 && <span>× {sale.qty}</span>}
                  {/* Vigencia del pack */}
                  {!sale.validOnlyToday && sale.validFrom && sale.validTo && (
                    <span className="flex items-center gap-1 text-violet-500 font-semibold">
                      <CalendarRange size={11} />
                      {sale.validFrom} → {sale.validTo}
                    </span>
                  )}
                  {sale.notes && <span className="italic truncate max-w-40">{sale.notes}</span>}
                </div>
              </div>

              {/* Total + eliminar */}
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-lg font-bold text-slate-800">{currency(sale.total)}</p>
                {isTI && (
                  <button
                    onClick={() => handleDeleteSale(sale.id)}
                    disabled={deletingId === sale.id}
                    title="Eliminar venta"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Modal: Gestionar precios de servicios ─────────────────────────────── */}
      {showPrices && (
        <PricesModal
          prices={servicePrices}
          tasks={activeTasks}
          onClose={() => setShowPrices(false)}
          onSave={async (updated) => {
            try {
              await setDoc(doc(db, 'servicePrices', 'default'), updated);
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
          therapyTasks={activeTasks}
          servicePrices={servicePrices}
          onClose={() => setShowRegister(false)}
          onSubmit={async (payload) => {
            try {
              await addDoc(collection(db, 'sales'), {
                ...payload,
                createdAt:     new Date().toISOString(),
                createdByUid:  user?.uid ?? '',
                createdByName: staffName,
              });
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
  tasks: TherapyTask[];
  onClose: () => void;
  onSave: (updated: Record<string, number>) => Promise<void>;
}

const PricesModal: React.FC<PricesModalProps> = ({ prices, tasks, onClose, onSave }) => {
  const [local, setLocal] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    tasks.forEach(t => { init[t.name] = prices[t.name] ?? 0; });
    return init;
  });
  const [saving, setSaving] = useState(false);

  useEscKey(onClose, true);

  const handleSave = async () => {
    setSaving(true);
    await onSave(local);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Settings2 size={18} className="text-blue-600" />
            Precio por servicio
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              No hay tareas en el catálogo. Agrégalas desde "Gestionar tareas".
            </p>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3">
                <span className="text-sm text-slate-700 flex-1 font-medium">{task.name}</span>
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">S/</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={local[task.name] ?? 0}
                    onChange={e => setLocal(p => ({ ...p, [task.name]: Number(e.target.value) }))}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
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
  );
};

// ─── Modal: Registrar venta ───────────────────────────────────────────────────

interface SalePayload {
  type: 'service' | 'product';
  patientId: string;
  patientName: string;
  itemName: string;
  itemId?: string;
  unitPrice: number;
  qty: number;
  total: number;
  date: string;
  validOnlyToday: boolean;
  validFrom?: string;
  validTo?: string;
  notes: string;
}

interface RegisterSaleModalProps {
  patients: Patient[];
  products: PortalProduct[];
  therapyTasks: TherapyTask[];
  servicePrices: Record<string, number>;
  onClose: () => void;
  onSubmit: (payload: SalePayload) => Promise<void>;
}

const RegisterSaleModal: React.FC<RegisterSaleModalProps> = ({
  patients, products, therapyTasks, servicePrices, onClose, onSubmit,
}) => {
  const [type, setType]           = useState<'service' | 'product'>('service');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
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

  // Al cambiar tipo, limpiar selección de ítem
  const handleTypeChange = (t: 'service' | 'product') => {
    setType(t);
    setItemName('');
    setItemId('');
    setUnitPrice(0);
    setQty(1);
    // Resetear vigencia al cambiar de tipo
    setValidOnlyToday(true);
    setValidFrom(TODAY);
    setValidTo(TODAY);
  };

  const handleSelectService = (therapy: string) => {
    setItemName(therapy);
    setUnitPrice(servicePrices[therapy] ?? 0);
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
                { key: 'service', label: 'Servicio', icon: <Wrench size={14} /> },
                { key: 'product', label: 'Producto', icon: <Package size={14} /> },
              ] as { key: 'service' | 'product'; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => handleTypeChange(key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
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
          {type === 'service' ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Servicio</p>
              {therapyTasks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-xl">
                  No hay tareas en el catálogo. Agrégalas desde "Gestionar tareas".
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-0.5">
                  {therapyTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleSelectService(task.name)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        itemName === task.name
                          ? 'border-violet-400 bg-violet-50 text-violet-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block truncate">{task.name}</span>
                      {(servicePrices[task.name] ?? 0) > 0 && (
                        <span className="text-xs text-slate-400 font-semibold">S/ {servicePrices[task.name].toFixed(2)}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Producto</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {products.map(p => (
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
                    {p.price != null && <span className="text-xs text-slate-400 font-semibold shrink-0 ml-2">S/ {p.price.toFixed(2)}</span>}
                  </button>
                ))}
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
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
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
  );
};

export default SalesArea;
