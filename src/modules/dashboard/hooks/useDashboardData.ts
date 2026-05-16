import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, onSnapshot, query, where, getCountFromServer } from 'firebase/firestore';
import { Professional } from '../../../types';

export interface DashboardStats {
  patients:       number;
  professionals:  number;
  doneSessions:   number;
  totalSessions:  number;
  inventoryValue: number;
  lowStockItems:  number;
}

export interface ChartEntry {
  name:     string;
  sesiones: number;
}

export const useDashboardData = (selectedMonth: number) => {
  const [stats, setStats] = useState<DashboardStats>({
    patients: 0, professionals: 0, doneSessions: 0,
    totalSessions: 0, inventoryValue: 0, lowStockItems: 0,
  });
  const [chartData, setChartData]                       = useState<ChartEntry[]>([]);
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

    const fetchData = async () => {
      try {
        const [
          pCount,
          profSnap,
          chartSnap,
          doneCount,
          confirmedCount,
          scheduledCount,
          paidCount,
        ] = await Promise.all([
          getCountFromServer(collection(db, 'patients')),
          getDocs(collection(db, 'professionals')),
          getDocs(query(collection(db, 'sessions'), where('yearMonth', '==', yearMonth))),
          getCountFromServer(query(collection(db, 'sessions'), where('status', '==', 'Efectuada'))),
          getCountFromServer(query(collection(db, 'sessions'), where('status', '==', 'Confirmada'))),
          getCountFromServer(query(collection(db, 'sessions'), where('status', '==', 'Programada'))),
          getCountFromServer(query(collection(db, 'sessions'), where('status', '==', 'Pagada'))),
        ]);

        const professionals = profSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Professional[];
        const monthSessions = chartSnap.docs.map(d => d.data());

        const barData: ChartEntry[] = professionals.map((pro) => ({
          name: pro.name ? pro.name.split(' ')[0] : 'Sin nombre',
          sesiones: monthSessions.filter(
            s => s.professionalId === pro.id && s.status?.toLowerCase() === 'efectuada'
          ).length,
        }));

        if (cancelled) return;
        setLoadError(null);
        setIsLoading(false);
        setStats(prev => ({
          ...prev,
          patients:      pCount.data().count,
          professionals: profSnap.size,
          doneSessions:  doneCount.data().count,
          totalSessions: doneCount.data().count + confirmedCount.data().count + scheduledCount.data().count + paidCount.data().count,
        }));
        setChartData(barData);
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
  }, [selectedMonth]);

  return { stats, chartData, webPendingAppointments, loadError, isLoading };
};
