import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, onSnapshot, query, where, getCountFromServer } from 'firebase/firestore';
import { Professional, Session } from '../../../types';
import { fetchMonthTotal } from '../../sales/salesService';

export interface DashboardStats {
  // Globales
  patients:       number;
  inventoryValue: number;
  lowStockItems:  number;
  // Mes seleccionado (con comparación contra el mes anterior)
  monthDone:        number;
  monthCancelled:   number;
  monthTotal:       number;
  prevMonthDone:    number;
  newPatientsMonth: number;
  revenueMonth:     number | null; // null = no solicitado (rol sin acceso)
  revenuePrev:      number | null;
  // Hoy
  todayTotal:     number;
  todayConfirmed: number;
  todayNext:      string | null; // HH:mm de la próxima cita de hoy
}

export interface ChartEntry  { name: string; sesiones: number; }
export interface StatusEntry { name: string; value: number; }

// Fecha y hora actuales en zona horaria de Lima
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

function nowTimeLima(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
  });
}

/** Mes anterior a un yearMonth YYYY-MM. */
function prevYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Primer día del mes siguiente a un yearMonth (para rangos de createdAt). */
function nextMonthStart(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const STATUS_ORDER: Session['status'][] = [
  'Programada', 'Confirmada', 'Efectuada', 'Pagada', 'Cancelada',
];

export const useDashboardData = (selectedMonth: number, includeRevenue: boolean) => {
  const [stats, setStats] = useState<DashboardStats>({
    patients: 0, inventoryValue: 0, lowStockItems: 0,
    monthDone: 0, monthCancelled: 0, monthTotal: 0, prevMonthDone: 0,
    newPatientsMonth: 0, revenueMonth: null, revenuePrev: null,
    todayTotal: 0, todayConfirmed: 0, todayNext: null,
  });
  const [chartData, setChartData]   = useState<ChartEntry[]>([]);
  const [statusData, setStatusData] = useState<StatusEntry[]>([]);
  const [webPendingAppointments, setWebPendingAppointments] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const onSnapErr = (label: string) => (err: Error) => {
      console.error(`onSnapshot [${label}]:`, err);
      if (!cancelled) setLoadError('No se pudieron cargar algunos datos del panel. Verifica tu conexión.');
    };

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        let totalValue    = 0;
        let criticalItems = 0;
        snapshot.forEach(doc => {
          const { price, stock } = doc.data();
          totalValue    += (Number(price) || 0) * (Number(stock) || 0);
          if ((Number(stock) || 0) < 5) criticalItems++;
        });
        setStats(prev => ({ ...prev, inventoryValue: totalValue, lowStockItems: criticalItems }));
      },
      onSnapErr('products'),
    );

    const unsubWebCitas = onSnapshot(
      query(collection(db, 'sessions'), where('type', '==', 'online-booking'), where('status', '==', 'Programada')),
      (snapshot) => setWebPendingAppointments(snapshot.size),
      onSnapErr('sessions-web'),
    );

    const year      = new Date().getFullYear();
    const yearMonth = `${year}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const prevYM    = prevYearMonth(yearMonth);

    const fetchData = async () => {
      try {
        const [
          pCount,
          profSnap,
          monthSnap,
          prevDoneCount,
          prevPaidCount,
          newPatientsCount,
          todaySnap,
          revenueMonth,
          revenuePrev,
        ] = await Promise.all([
          getCountFromServer(collection(db, 'patients')),
          getDocs(collection(db, 'professionals')),
          getDocs(query(collection(db, 'sessions'), where('yearMonth', '==', yearMonth))),
          getCountFromServer(query(
            collection(db, 'sessions'),
            where('yearMonth', '==', prevYM),
            where('status', '==', 'Efectuada'),
          )),
          getCountFromServer(query(
            collection(db, 'sessions'),
            where('yearMonth', '==', prevYM),
            where('status', '==', 'Pagada'),
          )),
          getCountFromServer(query(
            collection(db, 'patients'),
            where('createdAt', '>=', `${yearMonth}-01`),
            where('createdAt', '<', nextMonthStart(yearMonth)),
          )),
          getDocs(query(collection(db, 'sessions'), where('date', '==', TODAY))),
          includeRevenue ? fetchMonthTotal(yearMonth) : Promise.resolve(null),
          includeRevenue ? fetchMonthTotal(prevYM)    : Promise.resolve(null),
        ]);

        const professionals = profSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Professional[];
        const monthSessions = monthSnap.docs.map(d => d.data() as Session);

        // Barras: sesiones realizadas (Efectuada o Pagada) por especialista en el mes
        const barData: ChartEntry[] = professionals.map((pro) => ({
          name: pro.name ? pro.name.split(' ')[0] : 'Sin nombre',
          sesiones: monthSessions.filter(
            s => s.professionalId === pro.id &&
              ['efectuada', 'pagada'].includes(s.status?.toLowerCase() ?? '')
          ).length,
        }));

        // Dona: distribución de estados DEL MES (no histórica)
        const distribution: StatusEntry[] = STATUS_ORDER
          .map(status => ({
            name:  status,
            value: monthSessions.filter(s => s.status === status).length,
          }))
          .filter(e => e.value > 0);

        // KPIs del mes
        const monthDone      = monthSessions.filter(s => s.status === 'Efectuada' || s.status === 'Pagada').length;
        const monthCancelled = monthSessions.filter(s => s.status === 'Cancelada').length;

        // Hoy: total, confirmadas y próxima cita pendiente
        const todaySessions  = todaySnap.docs.map(d => d.data() as Session);
        const activeToday    = todaySessions.filter(s => s.status !== 'Cancelada');
        const todayConfirmed = activeToday.filter(s => s.status === 'Confirmada').length;
        const now = nowTimeLima();
        const todayNext = activeToday
          .filter(s => (s.status === 'Programada' || s.status === 'Confirmada') && s.time >= now)
          .map(s => s.time)
          .sort()[0] ?? null;

        if (cancelled) return;
        setLoadError(null);
        setIsLoading(false);
        setStats(prev => ({
          ...prev,
          patients:         pCount.data().count,
          monthDone,
          monthCancelled,
          monthTotal:       monthSessions.length,
          prevMonthDone:    prevDoneCount.data().count + prevPaidCount.data().count,
          newPatientsMonth: newPatientsCount.data().count,
          revenueMonth,
          revenuePrev,
          todayTotal:       activeToday.length,
          todayConfirmed,
          todayNext,
        }));
        setChartData(barData);
        setStatusData(distribution);
      } catch (error) {
        if (!cancelled) {
          console.error("Error cargando datos del dashboard:", error);
          setLoadError('No se pudieron cargar los datos del panel. Verifica tu conexión e intenta de nuevo.');
          setIsLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
      unsubProducts();
      unsubWebCitas();
    };
  }, [selectedMonth, includeRevenue]);

  return { stats, chartData, statusData, webPendingAppointments, loadError, isLoading };
};
