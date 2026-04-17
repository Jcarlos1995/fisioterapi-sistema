import { THERAPY_TYPES } from '../constants';
import React, { useState, useEffect } from 'react';
import { CalendarDays, Plus, Trash2, Clock, UserSquare2 } from 'lucide-react';
import { Session, Patient, Professional } from '../types';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useEscKey from '../hooks/useEscKey';

const SessionsManager: React.FC = () => {
  const { isTI, permissions } = useAuth();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  useEscKey(() => setIsModalOpen(false), isModalOpen);

  const [newSession, setNewSession] = useState({
    patientId: '',
    professionalId: '',
    date: '',
    time: '',
    therapyType: '',
    status: 'Programada' as Session['status'],
    notes: ''
  });

  // Función para detectar si la sesión es hoy
  const isToday = (dateString: string) => {
    const today = new Date();
    const sessionDate = new Date(dateString + 'T00:00:00'); // Forzamos formato local
    
    return (
      sessionDate.getDate() === today.getDate() &&
      sessionDate.getMonth() === today.getMonth() &&
      sessionDate.getFullYear() === today.getFullYear()
    );
  };

  useEffect(() => {
    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
    });
    const unsubPatients = onSnapshot(collection(db, 'patients'), (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    });
    const unsubProfessionals = onSnapshot(collection(db, 'professionals'), (snapshot) => {
      setProfessionals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professional)));
    });

    return () => {
      unsubSessions();
      unsubPatients();
      unsubProfessionals();
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSession.patientId || !newSession.professionalId) {
      alert("Por favor selecciona un paciente y un profesional");
      return;
    }
    if (!newSession.date) {
      alert("Por favor selecciona una fecha para la cita");
      return;
    }
    if (!newSession.time) {
      alert("Por favor selecciona una hora para la cita");
      return;
    }

    try {
      await addDoc(collection(db, 'sessions'), newSession);
      setIsModalOpen(false);
      setNewSession({
        patientId: '', professionalId: '', date: '', time: '',
        therapyType: '', status: 'Programada', notes: ''
      });
      showToast('Cita agendada');
    } catch (error) {
      console.error("Error al agendar sesión:", error);
    }
  };

  const updateStatus = async (id: string, newStatus: Session['status']) => {
    try {
      await updateDoc(doc(db, 'sessions', id), { status: newStatus });
      showToast();
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      alert("No se pudo actualizar el estado. Verifica tu conexión e inténtalo de nuevo.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar esta cita?')) {
      await deleteDoc(doc(db, 'sessions', id));
      showToast('Cita eliminada');
    }
  };

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name || 'Paciente no encontrado';
  const getProfName = (id: string) => professionals.find(p => p.id === id)?.name || 'Especialista no encontrado';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Agenda de Sesiones</h2>
          <p className="text-slate-500 text-sm">Control de citas y tratamientos</p>
        </div>
        {(isTI || permissions.appointments.add) && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold"
          >
            <Plus size={20} /> Agendar Cita
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sessions.map((session) => {
          const esHoy = isToday(session.date);
          
          return (
            <div 
              key={session.id} 
              className={`relative bg-white p-5 rounded-2xl border-2 transition-all duration-300 flex flex-wrap items-center justify-between gap-4 shadow-sm ${
                esHoy ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-200 animate-in fade-in zoom-in-95' : 'border-slate-100'
              }`}
            >
              {/* Etiqueta flotante para citas de hoy */}
              {esHoy && (
                <div className="absolute -top-3 left-6 bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-md">
                  Cita para Hoy
                </div>
              )}

              <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                <div className={`${esHoy ? 'bg-rose-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-600'} p-3 rounded-full transition-colors`}>
                  <CalendarDays size={24} />
                </div>
                <div>
                  <h4 className={`font-bold ${esHoy ? 'text-rose-900' : 'text-slate-800'}`}>
                    {getPatientName(session.patientId)}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium uppercase tracking-wider">
                    <UserSquare2 size={12} /> {getProfName(session.professionalId)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div className={`flex items-center gap-2 font-medium ${esHoy ? 'text-rose-700' : 'text-slate-600'}`}>
                  <Clock size={16} /> {session.date} - {session.time}
                </div>
                <div className={`font-bold px-3 py-1 rounded-lg ${esHoy ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                  {session.therapyType}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!(isTI || permissions.appointments.edit) ? (
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-sm ${
                    session.status === 'Pagada'    ? 'bg-emerald-100 text-emerald-700' :
                    session.status === 'Efectuada' ? 'bg-green-100 text-green-700' :
                    session.status === 'Confirmada'? 'bg-blue-100 text-blue-700' :
                                                     'bg-amber-100 text-amber-700'
                  }`}>
                    {session.status}
                  </span>
                ) : (
                  <select 
                    value={session.status}
                    onChange={(e) => updateStatus(session.id, e.target.value as Session['status'])}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border-none cursor-pointer shadow-sm ${
                      session.status === 'Pagada'    ? 'bg-emerald-100 text-emerald-700' :
                      session.status === 'Efectuada' ? 'bg-green-100 text-green-700' :
                      session.status === 'Confirmada'? 'bg-blue-100 text-blue-700' :
                                                       'bg-amber-100 text-amber-700'
                    }`}
                  >
                    <option value="Programada">Programada</option>
                    <option value="Confirmada">Confirmada</option>
                    <option value="Efectuada">Efectuada</option>
                    <option value="Pagada">Pagada</option>
                  </select>
                )}
                {(isTI || permissions.appointments.delete) && (
                  <button onClick={() => handleDelete(session.id)} className="text-slate-300 hover:text-rose-500 p-2 transition-colors">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal permanece igual para no alterar variables ni estructura */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-6">Nueva Cita</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select 
                  className="w-full p-3 rounded-xl border border-slate-200"
                  onChange={e => setNewSession({...newSession, patientId: e.target.value})}
                  required
                >
                  <option value="">Seleccionar Paciente</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select 
                  className="w-full p-3 rounded-xl border border-slate-200"
                  onChange={e => setNewSession({...newSession, professionalId: e.target.value})}
                  required
                >
                  <option value="">Seleccionar Profesional</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input required type="date" className="w-full p-3 rounded-xl border border-slate-200" onChange={e => setNewSession({...newSession, date: e.target.value})} />
                <input required type="time" className="w-full p-3 rounded-xl border border-slate-200" onChange={e => setNewSession({...newSession, time: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tipo de Terapia</label>
                <select 
                  className="w-full p-3 mt-1 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                  value={newSession.therapyType}
                  onChange={e => setNewSession({...newSession, therapyType: e.target.value})}
                  required
                >
                  <option value="">Seleccionar Terapia</option>
                  {THERAPY_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <textarea 
                placeholder="Notas adicionales..." 
                className="w-full p-3 rounded-xl border border-slate-200 h-24 outline-none focus:ring-2 focus:ring-indigo-500"
                onChange={e => setNewSession({...newSession, notes: e.target.value})}
              />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100">Agendar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsManager;