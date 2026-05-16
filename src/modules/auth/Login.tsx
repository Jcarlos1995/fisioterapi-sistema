import React, { useState } from 'react';
import { auth } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { LogIn, Activity, ArrowLeft } from 'lucide-react';
import { LANDING_URL } from '../../config';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Al loguearse, el AuthContext detectará el cambio automáticamente
    } catch (err: any) {
      console.error("Error de login:", err);
      const code = err?.code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Contraseña incorrecta. Verifica tus datos.');
      } else if (code === 'auth/user-not-found') {
        setError('No existe una cuenta con ese correo electrónico.');
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.');
      } else if (code === 'auth/user-disabled') {
        setError('Esta cuenta ha sido deshabilitada. Contacta al administrador.');
      } else if (code === 'auth/network-request-failed') {
        setError('Error de conexión. Verifica tu acceso a internet.');
      } else {
        setError('Error al iniciar sesión. Intenta de nuevo.');
      }
      // Limpiar la contraseña por seguridad tras un intento fallido
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">

      {/* Botón volver a la landing */}
      <a
        href={LANDING_URL}
        className="fixed top-5 left-5 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 hover:border-blue-200"
      >
        <ArrowLeft size={16} />
        Volver al inicio
      </a>

      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        {/* Cabecera del Login */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-2xl mb-4 shadow-lg shadow-blue-200">
            <Activity className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 text-center uppercase tracking-tight flex items-center justify-center gap-2">
              Fisioterapi Chepén <span className="text-red-500 text-3xl">❤️</span></h1>
          <p className="text-slate-500 text-sm mt-1">Ingresa para gestionar tu clínica</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="profesional@fisioterapi.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Mensaje de Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-lg font-medium animate-pulse">
              {error}
            </div>
          )}

          {/* Botón de Acción */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Verificando...
              </span>
            ) : (
              <>
                <LogIn size={18} /> Acceder al Sistema
              </>
            )}
          </button>
        </form>

        <p className="text-center text-slate-400 text-xs mt-8">
          &copy; 2026 Fisioterapi - Acceso Restringido
        </p>
      </div>
    </div>
  );
};

export default Login;
