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
  ChevronLeft,
  Activity,
  LogOut,
  BookOpen,
  KeyRound,
  ClipboardList,
  BadgeDollarSign,
  Radio,
} from 'lucide-react';

import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LANDING_URL } from '../config';
import logoFisioterapia from '../assets/logo-fisioterapia.png';

import Dashboard from '../modules/dashboard/Dashboard';
import { useAuth } from '../context/AuthContext';
import Login from '../modules/auth/Login';
import PatientsManager from '../modules/patients/PatientsManager';
import ProfessionalsManager from '../modules/professionals/ProfessionalsManager';
import ProductsManager from '../modules/products/ProductsManager';
import SessionsManager from '../modules/sessions/SessionsManager';
import BookingSystem from '../modules/booking/BookingSystem';
import Stories from '../modules/stories/Stories';
import ChangePasswordModal from '../modules/auth/ChangePasswordModal';
import PatientPortal from '../modules/portal/PatientPortal';
import { PatientAuthProvider } from '../context/PatientAuthContext';
import DailyTherapy from '../modules/daily-therapy/DailyTherapy';
import SalesArea from '../modules/sales/SalesArea';
import EventsManager from '../modules/events/EventsManager';

const App: React.FC = () => {
  const { user, loading, isTI, role } = useAuth();
  const isAdminOrTI = isTI || role === 'admin';
  const [isSidebarOpen,    setIsSidebarOpen]    = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace(LANDING_URL);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      window.location.replace(LANDING_URL);
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
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
      <Routes>
        {/* RUTA PÚBLICA */}
        <Route path="/agendar" element={<BookingSystem />} />
        <Route
          path="/portal"
          element={
            <PatientAuthProvider>
              <PatientPortal />
            </PatientAuthProvider>
          }
        />

        {/* RUTAS PROTEGIDAS */}
        <Route
          path="/*"
          element={
            !user ? (
              <Login />
            ) : (
              <div className="flex h-screen overflow-hidden bg-slate-50">

                {/* ── Overlay móvil (backdrop) ─────────────────────── */}
                {isMobileMenuOpen && (
                  <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={closeMobileMenu}
                  />
                )}

                {/* ── Sidebar ─────────────────────────────────────── */}
                <aside className={`
                  fixed lg:static inset-y-0 left-0 z-40
                  ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                  ${isSidebarOpen ? 'w-64' : 'lg:w-20 w-64'}
                  bg-white border-r border-slate-200 transition-all duration-300 flex flex-col shadow-xl lg:shadow-none
                `}>
                  {/* Logo */}
                  <div className="p-4 flex items-center justify-between">
                    {/* Botón ir a la landing — abre en nueva pestaña sin cerrar sesión */}
                    <a
                      href={LANDING_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver sitio web público"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                    >
                      <ChevronLeft size={22} />
                    </a>

                    {isSidebarOpen ? (
                      <img src={logoFisioterapia} alt="Fisioterapi Chepén" className="h-16 w-auto object-contain" />
                    ) : (
                      <div className="bg-blue-600 p-2 rounded-lg text-white hidden lg:flex">
                        <Activity size={24} />
                      </div>
                    )}

                    {/* Botón cerrar en móvil (dentro del drawer) */}
                    <button
                      onClick={closeMobileMenu}
                      className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <X size={20} />
                    </button>

                    {/* Spacer desktop para mantener el logo centrado cuando el sidebar está expandido */}
                    <div className="hidden lg:block w-7 shrink-0" />
                  </div>

                  {/* Navegación */}
                  <nav className="flex-1 mt-2 px-4 space-y-2 overflow-y-auto">
                    <SidebarItem to="/"            icon={<LayoutDashboard size={20} />} label="Dashboard"     expanded={isSidebarOpen} onNavClick={closeMobileMenu} />
                    <SidebarItem to="/patients"    icon={<Users size={20} />}           label="Pacientes"     expanded={isSidebarOpen} onNavClick={closeMobileMenu} />
                    <SidebarItem to="/professionals" icon={<UserSquare2 size={20} />}   label="Profesionales" expanded={isSidebarOpen} onNavClick={closeMobileMenu} />
                    <SidebarItem to="/products"    icon={<Package size={20} />}         label="Productos"     expanded={isSidebarOpen} onNavClick={closeMobileMenu} />
                    <SidebarItem to="/sessions"    icon={<CalendarDays size={20} />}    label="Sesiones"      expanded={isSidebarOpen} onNavClick={closeMobileMenu} />
                    <SidebarItem to="/stories"     icon={<BookOpen size={20} />}        label="Historias"     expanded={isSidebarOpen} onNavClick={closeMobileMenu} />
                    <SidebarItem to="/daily-therapy" icon={<ClipboardList size={20} />} label="Terapia Diaria" expanded={isSidebarOpen} onNavClick={closeMobileMenu} />
                    {isAdminOrTI && (
                      <SidebarItem to="/sales-area" icon={<BadgeDollarSign size={20} />} label="Área Reservada" expanded={isSidebarOpen} onNavClick={closeMobileMenu} />
                    )}
                    {isTI && (
                      <SidebarItem to="/events" icon={<Radio size={20} />} label="Eventos" expanded={isSidebarOpen} onNavClick={closeMobileMenu} />
                    )}
                  </nav>

                  {/* Footer del sidebar */}
                  <div className="px-4 py-2 space-y-1">
                    {isSidebarOpen && user?.email && (
                      <div className="px-3 py-2 mb-1">
                        <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">Sesión activa</p>
                        <p className="text-xs text-slate-600 font-semibold truncate">{user.email}</p>
                      </div>
                    )}

                    <button
                      onClick={() => { setIsChangePasswordOpen(true); closeMobileMenu(); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all ${!isSidebarOpen && 'lg:justify-center'}`}
                      title="Cambiar Contraseña"
                    >
                      <KeyRound size={20} />
                      {(isSidebarOpen) && <span className="font-medium">Cambiar Contraseña</span>}
                    </button>

                    <button
                      onClick={handleLogout}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-50 transition-all ${!isSidebarOpen && 'lg:justify-center'}`}
                      title="Cerrar Sesión"
                    >
                      <LogOut size={20} />
                      {(isSidebarOpen) && <span className="font-medium">Cerrar Sesión</span>}
                    </button>
                  </div>

                  {/* Toggle colapsar — solo visible en desktop */}
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="hidden lg:flex p-4 border-t border-slate-200 items-center justify-center hover:bg-slate-50 transition-colors"
                  >
                    {isSidebarOpen ? <X size={20} className="text-slate-500" /> : <Menu size={20} className="text-slate-500" />}
                  </button>
                </aside>

                {/* ── Área de contenido principal ─────────────────── */}
                <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                  {/* Barra superior — solo en móvil */}
                  <header className="lg:hidden bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shrink-0 z-20">
                    <button
                      onClick={() => setIsMobileMenuOpen(true)}
                      className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <Menu size={22} />
                    </button>
                    <img src={logoFisioterapia} alt="Fisioterapi" className="h-9 w-auto object-contain" />
                    <div className="w-10" /> {/* spacer para centrar logo */}
                  </header>

                  {/* Contenido de la ruta */}
                  <main className="flex-1 overflow-auto">
                    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                      <Routes>
                        <Route path="/"             element={<Dashboard />} />
                        <Route path="/patients"     element={<PatientsManager />} />
                        <Route path="/professionals" element={<ProfessionalsManager />} />
                        <Route path="/products"     element={<ProductsManager />} />
                        <Route path="/sessions"     element={<SessionsManager />} />
                        <Route path="/stories"      element={<Stories />} />
                        <Route path="/daily-therapy" element={<DailyTherapy />} />
                        <Route path="/sales-area"   element={<SalesArea />} />
                        <Route path="/events"       element={<EventsManager />} />
                      </Routes>
                    </div>
                  </main>
                </div>
              </div>
            )
          }
        />
      </Routes>
    </Router>
  );
};

const SidebarItem: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  expanded: boolean;
  onNavClick?: () => void;
}> = ({ to, icon, label, expanded, onNavClick }) => {
  const location = useLocation();
  const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      onClick={onNavClick}
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
