import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserSquare2, 
  Package, 
  Sparkles, 
  BrainCircuit, 
  Activity, 
  Calendar, 
  ClipboardList, 
  AlertTriangle, 
  X,
  BellRing, 
  ArrowRight 
} from 'lucide-react'; 
import { db } from '../firebaseConfig';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'; 
import { getFunctions, httpsCallable } from 'firebase/functions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [showStockAlert, setShowStockAlert] = useState(true);
  const [stats, setStats] = useState({ 
    patients: 0, 
    professionals: 0, 
    doneSessions: 0, 
    totalSessions: 0, 
    inventoryValue: 0,
    lowStockItems: 0 
  });
  const [webPendingAppointments, setWebPendingAppointments] = useState(0); 
  const [chartData, setChartData] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingIA, setLoadingIA] = useState(false);

  const COLORS = ['#10b981', '#3b82f6', '#6366f1', '#f59e0b'];

  useEffect(() => {
    let cancelled = false;

    // Escuchar cambios en productos (Stock)
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      let totalValue = 0;
      let criticalItems = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        const precio = Number(data.price) || 0;
        const stock = Number(data.stock) || 0;
        totalValue += precio * stock;
        if (stock < 5) criticalItems++; 
      });
      setStats(prev => ({ ...prev, inventoryValue: totalValue, lowStockItems: criticalItems }));
      if (criticalItems > 0) setShowStockAlert(true);
    });

    // Escuchar cambios en citas WEB
    const webQuery = query(
      collection(db, 'sessions'), 
      where('type', '==', 'online-booking'),
      where('status', '==', 'Programada') 
    );
    const unsubWebCitas = onSnapshot(webQuery, (snapshot) => {
      setWebPendingAppointments(snapshot.size);
    });

    const fetchData = async () => {
      try {
        const [pSnap, proSnap, sessSnap] = await Promise.all([
          getDocs(collection(db, 'patients')),
          getDocs(collection(db, 'professionals')),
          getDocs(collection(db, 'sessions'))
        ]);

        const sessions = sessSnap.docs.map(d => d.data());
        const professionals = proSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const efectuadas = sessions.filter(s => s.status?.toLowerCase() === 'efectuada').length;
        const confirmadas = sessions.filter(s => s.status?.toLowerCase() === 'confirmada').length;
        const programadas = sessions.filter(s => s.status?.toLowerCase() === 'programada').length;
        const pagadas     = sessions.filter(s => s.status?.toLowerCase() === 'pagada').length;

        const barData = professionals.map((pro: any) => {
          const conteoEfectuadas = sessions.filter((s: any) => {
            if (!s.date) return false;
            const sessionDate = new Date(s.date);
            return (
              s.professionalId === pro.id && 
              s.status?.toLowerCase() === 'efectuada' &&
              sessionDate.getMonth() === selectedMonth
            );
          }).length;

          return {
            name: pro.name ? pro.name.split(' ')[0] : 'Sin nombre',
            sesiones: conteoEfectuadas
          };
        });

        if (cancelled) return;
        setStats(prev => ({
          ...prev,
          patients: pSnap.size,
          professionals: proSnap.size,
          doneSessions: efectuadas,
          totalSessions: efectuadas + confirmadas + programadas + pagadas,
        }));
        setChartData(barData);
      } catch (error) {
        if (!cancelled) console.error("Error cargando datos:", error);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
      unsubProducts();
      unsubWebCitas();
    }; 
  }, [selectedMonth]);

  
  const generateAnalysis = async () => {
    setLoadingIA(true);
    setAnalysis(null);
    try {
      const prompt = `Actúa como un consultor experto en gestión de clínicas de fisioterapia y rehabilitación. 
      Analiza los siguientes indicadores de Fisioterapi Chepén:
      - Pacientes registrados: ${stats.patients}
      - Especialistas activos: ${stats.professionals}
      - Sesiones totales acumuladas: ${stats.totalSessions}
      - Inversión en inventario: S/ ${stats.inventoryValue}
      - Alerta de stock: ${stats.lowStockItems} productos críticos.
      
      Proporciona un análisis ejecutivo breve de 3 puntos clave y una recomendación estratégica.`;

      const functions   = getFunctions(undefined, "us-central1");
      const geminiProxy = httpsCallable<{ prompt: string }, { text: string }>(functions, "geminiProxy");
      const result      = await geminiProxy({ prompt });
      setAnalysis(result.data.text);

    } catch (error: any) {
      console.error("Error en el análisis inteligente:", error);
      const msg: string = error?.message ?? '';
      if (msg.includes('503') || msg.includes('unavailable')) {
        setAnalysis("El servicio de IA está con alta demanda en este momento. Espera unos segundos e inténtalo de nuevo.");
      } else if (msg.includes('429') || msg.includes('resource-exhausted')) {
        setAnalysis("Se alcanzó el límite de uso de la IA. Intenta de nuevo en unos minutos.");
      } else {
        setAnalysis("No se pudo conectar con el análisis IA. Verifica tu conexión e intenta de nuevo.");
      }
    } finally {
      setLoadingIA(false);
    }
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const nombreMes = meses[selectedMonth];
    const tableRows = chartData.map(data => `
      <tr>
        <td style="padding: 12px; border: 1px solid #eee;">${data.name}</td>
        <td style="padding: 12px; border: 1px solid #eee; text-align: center; font-weight: bold;">${data.sesiones}</td>
      </tr>
    `).join('');

    printWindow.document.write(`<html><head><title>Reporte - ${nombreMes}</title><style>body { font-family: 'Segoe UI', sans-serif; padding: 50px; color: #333; } .header { border-block-end: 2px solid #3b82f6; padding-block-end: 10px; margin-block-end: 20px; } table { inline-size: 100%; border-collapse: collapse; } th { background: #f1f5f9; padding: 12px; border: 1px solid #cbd5e1; text-align: start; }</style></head><body><div class="header"><h1>Reporte de Sesiones</h1><p>Mes: <strong>${nombreMes}</strong></p></div><table><thead><tr><th>Especialista</th><th style="text-align: center;">Sesiones</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      
      {/* --- ALERTA DE CITAS NUEVAS (WEB) --- */}
      {webPendingAppointments > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-5 rounded-r-2xl shadow-sm flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-full text-amber-600">
              <BellRing size={24} />
            </div>
            <div>
              <h3 className="text-amber-900 font-bold">¡Tienes {webPendingAppointments} citas programadas desde la Web!</h3>
              <p className="text-amber-700 text-sm">Revisa la lista de sesiones para asignar especialistas.</p>
            </div>
          </div>
          <Link 
            to="/sessions" 
            className="bg-amber-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-amber-700 transition-all flex items-center gap-2 shadow-md"
          >
            Revisar <ArrowRight size={18} />
          </Link>
        </div>
      )}

      {/* --- ALERTA DE STOCK CRÍTICO --- */}
      {stats.lowStockItems > 0 && showStockAlert && (
        <div className="bg-rose-600 text-white px-6 py-4 rounded-2xl shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-rose-500 p-2 rounded-xl">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="font-bold text-lg">Alerta de Inventario</p>
              <p className="text-sm opacity-90">Hay {stats.lowStockItems} productos con stock bajo.</p>
            </div>
          </div>
          <button onClick={() => setShowStockAlert(false)} className="p-2 hover:bg-rose-700 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 uppercase tracking-tight">Panel de Control</h1>
          <p className="text-slate-500 font-medium italic">Fisioterapia Chepén - Gestión de Salud</p>
        </div>

        <div className="flex gap-3 items-center">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-white border border-slate-200 px-3 py-2 rounded-lg font-semibold text-slate-600 outline-none shadow-sm">
            {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((mes, index) => (
              <option key={index} value={index}>{mes}</option>
            ))}
          </select>
          <button onClick={handlePrintReport} className="bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md hover:bg-slate-900 transition-all">
            <ClipboardList size={16} /> Exportar
          </button>
          <button onClick={generateAnalysis} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md hover:bg-blue-700 transition-all">
            <Sparkles size={16} /> {loadingIA ? "Analizando..." : "Análisis IA"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard icon={<Users className="text-blue-600"/>} label="Pacientes" value={stats.patients} />
        <StatCard icon={<UserSquare2 className="text-emerald-600"/>} label="Profesionales" value={stats.professionals} />
        <StatCard icon={<Calendar className="text-orange-500"/>} label="Efectuadas" value={stats.doneSessions} />
        <StatCard icon={<Activity className="text-indigo-600"/>} label="Total Sesiones" value={stats.totalSessions} />
        <StatCard 
          icon={<Package className={stats.lowStockItems > 0 ? "text-rose-600 animate-bounce" : "text-slate-600"}/>} 
          label="Valor Inventario" 
          value={`S/ ${stats.inventoryValue.toFixed(2)}`} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-700 mb-6">Sesiones Efectuadas por Especialista</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="sesiones" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
          <h3 className="font-bold text-slate-700 mb-6 self-start text-sm uppercase tracking-wider">Estado de Sesiones</h3>
          <PieChart width={250} height={200}>
            <Pie 
              data={[
                {name: 'Efectuadas', value: stats.doneSessions}, 
                {name: 'Pendientes/Otras', value: Math.max(0, stats.totalSessions - stats.doneSessions)}
              ]} 
              innerRadius={60} 
              outerRadius={80} 
              dataKey="value"
              paddingAngle={5}
            >
              {COLORS.map((color, i) => <Cell key={i} fill={color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Efectuadas</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-full"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Otras</span></div>
          </div>
        </div>
      </div>

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

const StatCard = ({ icon, label, value }: any) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
    <div className="bg-slate-50 w-10 h-10 rounded-lg flex items-center justify-center">{icon}</div>
    <div>
      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-tight">{label}</p>
      <p className="text-xl font-black text-slate-800">{value}</p>
    </div>
  </div>
);

export default Dashboard;