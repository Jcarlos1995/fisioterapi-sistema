import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center z-50">

      {/* Logo / Icono central con pulso */}
      <div className="relative flex items-center justify-center mb-10">
        {/* Anillos de pulso */}
        <span className="absolute inline-flex h-32 w-32 rounded-full bg-blue-500 opacity-20 animate-ping" style={{ animationDuration: '1.8s' }} />
        <span className="absolute inline-flex h-24 w-24 rounded-full bg-blue-400 opacity-20 animate-ping" style={{ animationDuration: '1.4s', animationDelay: '0.3s' }} />

        {/* Círculo con icono */}
        <div className="relative w-20 h-20 rounded-2xl bg-blue-600 shadow-2xl shadow-blue-500/40 flex items-center justify-center">
          {/* Cruz médica SVG */}
          <svg
            viewBox="0 0 24 24"
            className="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
      </div>

      {/* Nombre de la clínica */}
      <h1 className="text-white text-2xl font-bold tracking-tight mb-1">
        Fisioterapi Chepén
      </h1>
      <p className="text-blue-300 text-sm font-medium mb-10 tracking-widest uppercase">
        Sistema de Gestión
      </p>

      {/* Barra de carga animada */}
      <div className="w-56 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 rounded-full"
          style={{
            animation: 'loading-bar 1.6s ease-in-out infinite',
          }}
        />
      </div>

      <p className="text-blue-400/70 text-xs mt-4 tracking-widest">
        Verificando sesión...
      </p>

      <style>{`
        @keyframes loading-bar {
          0%   { width: 0%;   margin-left: 0%; }
          50%  { width: 70%;  margin-left: 15%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
