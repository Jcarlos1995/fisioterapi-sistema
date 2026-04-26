import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';

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

  useEffect(() => {
    let cancelled = false;

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      let totalValue   = 0;
      let criticalItems = 0;
      snapshot.forEach(doc => {
        const { price, stock } = doc.data();
        totalValue    += (Number(price) || 0) * (Number(stock) || 0);
        if ((Number(stock) || 0) < 5) criticalItems++;
      });
      setStats(prev => ({ ...prev, inventoryValue: totalValue, lowStockItems: criticalItems }));
    });

    const unsubWebCitas = onSnapshot(
      query(collection(db, 'sessions'), where('type', '==', 'online-booking'), where('status', '==', 'Programada')),
      (snapshot) => setWebPendingAppointments(snapshot.size)
    );

    const fetchData = async () => {
      try {
        const [pSnap, proSnap, sessSnap] = await Promise.all([
          getDocs(collection(db, 'patients')),
          getDocs(collection(db, 'professionals')),
          getDocs(collection(db, 'sessions')),
        ]);

        const sessions      = sessSnap.docs.map(d => d.data());
        const professionals = proSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

        const count = (status: string) => sessions.filter(s => s.status?.toLowerCase() === status).length;

        const barData: ChartEntry[] = professionals.map((pro) => ({
          name: pro.name ? pro.name.split(' ')[0] : 'Sin nombre',
          sesiones: sessions.filter((s: any) => {
            if (!s.date) return false;
            return (
              s.professionalId === pro.id &&
              s.status?.toLowerCase() === 'efectuada' &&
              new Date(s.date).getMonth() === selectedMonth
            );
          }).length,
        }));

        if (cancelled) return;
        setStats(prev => ({
          ...prev,
          patients:      pSnap.size,
          professionals: proSnap.size,
          doneSessions:  count('efectuada'),
          totalSessions: count('efectuada') + count('confirmada') + count('programada') + count('pagada'),
        }));
        setChartData(barData);
      } catch (error) {
        if (!cancelled) console.error("Error cargando datos del dashboard:", error);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
      unsubProducts();
      unsubWebCitas();
    };
  }, [selectedMonth]);

  return { stats, chartData, webPendingAppointments };
};
