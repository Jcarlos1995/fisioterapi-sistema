import React, { useState } from 'react';
import { X } from 'lucide-react';
import useEscKey from '../../hooks/useEscKey';
import { validateBirthDate, validateDni } from '../../utils/validation';

interface RegisterPatientModalProps {
  initialDni: string;
  initialBirthDate: string;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    dni: string;
    birthDate: string;
    age: number;
    phone: string;
  }) => Promise<void>;
}

const RegisterPatientModal: React.FC<RegisterPatientModalProps> = ({
  initialDni,
  initialBirthDate,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [dni, setDni] = useState(initialDni);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEscKey(onClose, true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dniValidation = validateDni(dni);
    const birthValidation = validateBirthDate(birthDate);
    if (!name.trim()) return;
    if (!dniValidation.valid || !birthValidation.valid) return;
    const parsedAge = Number(age);
    if (!Number.isFinite(parsedAge) || parsedAge <= 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        dni: dni.trim(),
        birthDate: birthDate.trim(),
        age: parsedAge,
        phone: phone.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Registro de paciente</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <input
            type="text"
            placeholder="Nombre completo"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-200"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder="DNI"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-200"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
            required
          />
          <input
            type="date"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-200"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
          <input
            type="number"
            min={1}
            max={120}
            placeholder="Edad"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-200"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Teléfono"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-200"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60"
            >
              {submitting ? 'Registrando...' : 'Registrarme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPatientModal;
