import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { Patient, Professional } from '../types';
import { db } from '../firebaseConfig'; 
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useEscKey from '../hooks/useEscKey';
import ConfirmModal from './ConfirmModal';

const PatientsManager: React.FC = () => {
  const { isTI, permissions } = useAuth();
  const { showToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<Partial<Patient>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  useEscKey(() => setIsModalOpen(false), isModalOpen);

  useEffect(() => {
    const unsubPatients = onSnapshot(collection(db, "patients"), (snapshot) => {
      const patientsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Patient[];
      setPatients(patientsData);
    });

    const unsubProfs = onSnapshot(collection(db, "professionals"), (snapshot) => {
      const profsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Professional[];
      setProfessionals(profsData);
    });

    return () => {
      unsubPatients();
      unsubProfs();
    };
  }, []);

  const term = searchTerm.toLowerCase();
  const filtered = patients.filter(p =>
    (p.name?.toLowerCase() ?? '').includes(term) ||
    (p.email?.toLowerCase() ?? '').includes(term)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentPatient.id) {
        // 1. Actualizar los datos del paciente sin enviar el campo id
        const { id: _id, createdAt: _createdAt, ...patientData } = currentPatient as Patient;
        const patientRef = doc(db, "patients", currentPatient.id);
        await updateDoc(patientRef, patientData);

        // 2. ACTUALIZACIÓN EN CASCADA: Actualizar profesional en la colección 'sessions'
        if (currentPatient.professionalId) {
          const sessionsRef = collection(db, "sessions");
          const q = query(sessionsRef, where("patientId", "==", currentPatient.id));
          const querySnapshot = await getDocs(q);

          // Creamos una promesa por cada sesión encontrada para actualizar el profesional
          const updatePromises = querySnapshot.docs.map(sessionDoc => 
            updateDoc(doc(db, "sessions", sessionDoc.id), {
              professionalId: currentPatient.professionalId
            })
          );
          
          await Promise.all(updatePromises);
          console.log(`Sincronización completa: ${updatePromises.length} sesiones actualizadas.`);
        }
      } else {
        // Crear nuevo paciente
        await addDoc(collection(db, "patients"), {
          ...currentPatient,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setCurrentPatient({});
      showToast();
    } catch (error) {
      console.error("Error en Firebase:", error);
      showToast("Error al procesar la solicitud", 'error');
    }
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);

  const confirmDeletePatient = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await deleteDoc(doc(db, "patients", id));
      showToast('Paciente eliminado');
    } catch (error) {
      console.error("Error al eliminar:", error);
      showToast('Error al eliminar el paciente', 'error');
    }
  };

  const getProfName = (id?: string) => {
    return professionals.find(p => p.id === id)?.name || 'No asignado';
  };

  return (
    <div className="space-y-6">
      {confirmDeleteId && (
        <ConfirmModal
          message="¿Eliminar este paciente? Esta acción no se puede deshacer."
          onConfirm={confirmDeletePatient}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
          <p className="text-slate-500">Administra el registro de tus pacientes</p>
        </div>
        {(isTI || permissions.patients.add) && (
          <button 
            onClick={() => { setCurrentPatient({}); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus size={20} /> Nuevo Paciente
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search size={20} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o email..." 
            className="flex-1 outline-none text-slate-900 bg-transparent font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Nombre</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">DNI</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Edad</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Especialista</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(patient => (
                <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{patient.name}</td>
                  <td className="px-6 py-4 text-slate-600">{patient.dni || '---'}</td>
                  <td className="px-6 py-4 text-slate-600">{patient.age ? `${patient.age} años` : '---'}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
                      {getProfName(patient.professionalId)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {(isTI || permissions.patients.edit) && (
                      <button onClick={() => { setCurrentPatient(patient); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit2 size={18} />
                      </button>
                    )}
                    {(isTI || permissions.patients.delete) && (
                      <button onClick={() => handleDelete(patient.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{currentPatient.id ? 'Editar Paciente' : 'Nuevo Paciente'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <input 
                placeholder="Nombre Completo"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                value={currentPatient.name || ''}
                onChange={(e) => setCurrentPatient({...currentPatient, name: e.target.value})}
              />

              <select 
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                value={currentPatient.professionalId || ''}
                onChange={(e) => setCurrentPatient({...currentPatient, professionalId: e.target.value})}
              >
                <option value="">Seleccionar Especialista...</option>
                {professionals.map(pro => (
                  <option key={pro.id} value={pro.id}>{pro.name}</option>
                ))}
              </select>

              <input 
                placeholder="Email"
                type="email"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                value={currentPatient.email || ''}
                onChange={(e) => setCurrentPatient({...currentPatient, email: e.target.value})}
              />

              <div className="grid grid-cols-2 gap-4">
                <input 
                  placeholder="DNI / Documento"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  value={currentPatient.dni || ''}
                  onChange={(e) => setCurrentPatient({...currentPatient, dni: e.target.value})}
                />
                <input 
                  placeholder="Edad"
                  type="number"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  value={currentPatient.age || ''}
                  onChange={(e) => setCurrentPatient({...currentPatient, age: parseInt(e.target.value) || 0})}
                />
              </div>

              <input 
                placeholder="Teléfono"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                value={currentPatient.phone || ''}
                onChange={(e) => setCurrentPatient({...currentPatient, phone: e.target.value})}
              />

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsManager;