import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  Users, 
  UserSquare2, 
  Package, 
  LayoutDashboard, 
  CalendarDays,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  LogOut,
  BookOpen // Añadido para un icono más descriptivo en Historias
} from 'lucide-react';

import { signOut } from 'firebase/auth';
import { auth } from './firebaseConfig';

import Dashboard from './components/Dashboard';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import PatientsManager from './components/PatientsManager';
import ProfessionalsManager from './components/ProfessionalsManager';
import ProductsManager from './components/ProductsManager';
import SessionsManager from './components/SessionsManager';
import BookingSystem from './components/BookingSystem';
import Stories from './components/Stories';

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = () => {
    try {
      window.location.replace('https://fisiochepen-oficial.web.app');
      signOut(auth).catch(err => console.error("Error background signout:", err));
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      window.location.href = 'https://fisiochepen-oficial.web.app';
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">Cargando sistema...</p>
      </div>
    </div>
  );

  return (
    <Router>
      <Routes>
        {/* RUTA PÚBLICA */}
        <Route path="/agendar" element={<BookingSystem />} />

        {/* RUTAS PROTEGIDAS */}
        <Route 
          path="/*" 
          element={
            !user ? (
              <Login />
            ) : (
              <div className="flex h-screen overflow-hidden bg-slate-50">
                {/* Sidebar */}
                <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20`}>
                  <div className="p-6 flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg text-white">
                      <span className="shrink-0"><Sparkles size={24} /></span>
                    </div>
                    {isSidebarOpen && <span className="font-bold text-xl text-slate-800 uppercase tracking-tight">FISIOTERAPI</span>}
                  </div>

                  <nav className="flex-1 mt-6 px-4 space-y-2 overflow-y-auto">
                    <SidebarItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" expanded={isSidebarOpen} />
                    <SidebarItem to="/patients" icon={<Users size={20} />} label="Pacientes" expanded={isSidebarOpen} />
                    <SidebarItem to="/professionals" icon={<UserSquare2 size={20} />} label="Profesionales" expanded={isSidebarOpen} />
                    <SidebarItem to="/products" icon={<Package size={20} />} label="Productos" expanded={isSidebarOpen} />
                    <SidebarItem to="/sessions" icon={<CalendarDays size={20} />} label="Sesiones" expanded={isSidebarOpen} />
                    {/* Cambiamos el icono a BookOpen para diferenciarlo del logo superior */}
                    <SidebarItem to="/stories" icon={<BookOpen size={20} />} label="Historias" expanded={isSidebarOpen} />
                  </nav>

                  <div className="px-4 py-2">
                    <button 
                      onClick={handleLogout}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-50 transition-all ${!isSidebarOpen && 'justify-center'}`}
                      title="Cerrar Sesión"
                    >
                      <LogOut size={20} />
                      {isSidebarOpen && <span className="font-medium">Cerrar Sesión</span>}
                    </button>
                  </div>

                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-4 border-t border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                  >
                    {isSidebarOpen ? <X size={20} className="text-slate-500" /> : <Menu size={20} className="text-slate-500" />}
                  </button>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                  <div className="p-8 max-w-7xl mx-auto">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/patients" element={<PatientsManager />} />
                      <Route path="/professionals" element={<ProfessionalsManager />} />
                      <Route path="/products" element={<ProductsManager />} />
                      <Route path="/sessions" element={<SessionsManager />} />
                      <Route path="/stories" element={<Stories />} />
                    </Routes>
                  </div>
                </main>
              </div>
            )
          } 
        />
      </Routes>
    </Router>
  );
};

const SidebarItem: React.FC<{ to: string; icon: React.ReactNode; label: string; expanded: boolean }> = ({ to, icon, label, expanded }) => {
  const location = useLocation();
  // Ajuste para que el Dashboard (/) sea el único activo en la raíz exacta
  const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <Link 
      to={to} 
      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
        isActive 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      <div className="shrink-0">{icon}</div>
      {expanded && <span className="font-medium whitespace-nowrap">{label}</span>}
      {expanded && isActive && <ChevronRight size={16} className="ml-auto" />}
    </Link>
  );
};

export default App;