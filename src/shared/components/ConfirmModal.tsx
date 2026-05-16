import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  message:   string;
  onConfirm: () => void;
  onCancel:  () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-rose-100 p-2 rounded-xl">
          <AlertTriangle size={20} className="text-rose-600" />
        </div>
        <h3 className="font-bold text-slate-800">Confirmar acción</h3>
      </div>
      <p className="text-slate-600 text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors"
        >
          Eliminar
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmModal;
