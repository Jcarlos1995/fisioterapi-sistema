import React, { useState, useEffect } from 'react';
import { UserSquare2, Plus, Trash2, Mail, Phone } from 'lucide-react';
import { Professional } from '../types';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';

const ProfessionalsManager: React.FC = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProf, setNewProf] = useState({
    name: '',
    specialty: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'professionals'), (snapshot) => {
      const profsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Professional[];
      setProfessionals(profsData);
    });
    return () => unsub();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProf.name) return;
    try {
      await addDoc(collection(db, 'professionals'), newProf);
      setNewProf({ name: '', specialty: '', email: '', phone: '' });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error al añadir profesional:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar este profesional?')) {
      await deleteDoc(doc(db, 'professionals', id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Equipo Profesional</h2>
          <p className="text-slate-500 text-sm">Gestiona los especialistas de la clínica</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus size={20} /> Nuevo Especialista
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {professionals.map((prof) => (
          <div key={prof.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative group">
            <button 
              onClick={() => handleDelete(prof.id)}
              className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"
            >
              <Trash2 size={18} />
            </button>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                <UserSquare2 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{prof.name}</h3>
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{prof.specialty}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2"><Mail size={14} /> {prof.email}</div>
              {/* Solución al error .phone con casteo seguro */}
              <div className="flex items-center gap-2"><Phone size={14} /> {(prof as any).phone || 'Sin teléfono'}</div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-slate-800">Registrar Especialista</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <input 
                placeholder="Nombre completo" 
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                value={newProf.name}
                onChange={e => setNewProf({...newProf, name: e.target.value})}
              />
              <input 
                placeholder="Especialidad" 
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                value={newProf.specialty}
                onChange={e => setNewProf({...newProf, specialty: e.target.value})}
              />
              <input 
                placeholder="Correo electrónico" 
                type="email"
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                value={newProf.email}
                onChange={e => setNewProf({...newProf, email: e.target.value})}
              />
              <input 
                placeholder="Teléfono" 
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                value={newProf.phone}
                onChange={e => setNewProf({...newProf, phone: e.target.value})}
              />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl text-slate-600 font-semibold">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalsManager;