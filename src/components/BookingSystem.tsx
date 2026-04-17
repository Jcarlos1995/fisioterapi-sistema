import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, query, where, limit, updateDoc, doc } from 'firebase/firestore';
import { Sparkles, Clock, User, Phone, CheckCircle, Mail, ArrowLeft } from 'lucide-react';

interface FirebaseSession {
  date: string;
  endDate?: string;
  patientName?: string;
}

const BookingSystem: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isBooked, setIsBooked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    phone: '', 
    email: '', 
    dni: '', 
    age: '',
    therapyType: 'Fisioterapia' 
  });

  const therapyOptions = [
    "Fisioterapia",
    "Quiropraxia",
    "Rehabilitación Post-Operatoria",
    "Masaje Terapéutico",
    "Terapia Deportiva"
  ];

  // URL de tu landing page
  const LANDING_URL = 'https://fisiochepen-oficial.web.app';

  useEffect(() => {
    const fetchCitas = async () => {
      try {
        const q = collection(db, 'sessions');
        const querySnapshot = await getDocs(q);
        const bookedEvents = querySnapshot.docs.map(doc => {
          const data = doc.data() as FirebaseSession;
          return {
            title: 'Ocupado',
            start: data.date,
            end: data.endDate || data.date,
            display: 'background' as const,
            color: '#ffcccc'
          };
        });
        setEvents(bookedEvents);
      } catch (error) {
        console.error("Error cargando citas:", error);
      }
    };
    fetchCitas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Buscar paciente existente por DNI
      const dniQuery = query(
        collection(db, 'patients'),
        where('dni', '==', formData.dni.trim()),
        limit(1)
      );
      const dniSnapshot = await getDocs(dniQuery);

      let patientId: string;

      if (!dniSnapshot.empty) {
        // Paciente ya existe → reusar su ID y actualizar datos de contacto
        const existingDoc = dniSnapshot.docs[0];
        patientId = existingDoc.id;
        await updateDoc(doc(db, 'patients', patientId), {
          name:  formData.name,
          email: formData.email,
          phone: formData.phone,
          age:   parseInt(formData.age) || 0,
        });
      } else {
        // Paciente nuevo → crear registro
        const newPatientRef = await addDoc(collection(db, 'patients'), {
          name:           formData.name,
          email:          formData.email,
          phone:          formData.phone,
          dni:            formData.dni.trim(),
          age:            parseInt(formData.age) || 0,
          professionalId: '',
          createdAt:      new Date().toISOString(),
        });
        patientId = newPatientRef.id;
      }

      await addDoc(collection(db, 'sessions'), {
        patientId,
        professionalId: '',
        date:        selectedSlot.startStr.split('T')[0],
        time:        selectedSlot.startStr.split('T')[1].substring(0, 5),
        endDate:     selectedSlot.endStr,
        therapyType: formData.therapyType,
        status:      'Programada',
        type:        'online-booking',
        notes:       `Registro web automático. DNI: ${formData.dni.trim()}`,
        createdAt:   new Date().toISOString(),
      });

      setIsBooked(true);
    } catch (error) {
      console.error("Error en registro de cita:", error);
      alert("Hubo un problema al guardar tu cita. Por favor, intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isBooked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl text-center border border-green-100">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">¡Cita Registrada!</h2>
          <p className="text-slate-600 mt-2">Hola <strong>{formData.name}</strong>, tu solicitud ha sido enviada con éxito.</p>
          <button 
            onClick={() => window.location.href = LANDING_URL} 
            className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-bold"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* CABECERA ACTUALIZADA CON URL ABSOLUTA */}
        <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.location.href = LANDING_URL} 
              className="p-2 hover:bg-white/20 rounded-full transition-colors mr-1 flex items-center justify-center"
              title="Volver al inicio"
            >
              <ArrowLeft size={24} />
            </button>
            <Sparkles />
            <h1 className="text-xl font-bold uppercase tracking-tight">Portal de Citas - Fisioterapia</h1>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 p-4 border-r border-slate-200">
            <FullCalendar
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              selectable={true}
              slotMinTime="08:00:00"
              slotMaxTime="20:00:00"
              allDaySlot={false}
              locale={esLocale}
              events={events}
              select={(info) => setSelectedSlot(info)}
              height="auto"
            />
          </div>

          <div className="p-6 bg-slate-50/30">
            {selectedSlot ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="text-blue-800 text-xs font-bold uppercase tracking-wider">Fecha y Hora:</p>
                  <p className="text-blue-600 font-bold">{new Date(selectedSlot.startStr).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre Completo</label>
                    <div className="relative"><User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                      <input required className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">DNI</label>
                      <input required className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Edad</label>
                      <input required type="number" className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp / Celular</label>
                    <div className="relative"><Phone className="absolute left-3 top-2.5 text-slate-400" size={16} />
                      <input required type="tel" className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                    <div className="relative"><Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
                      <input required type="email" className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Servicio Requerido</label>
                    <select 
                      className="w-full px-4 py-2 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                      value={formData.therapyType} onChange={e => setFormData({...formData, therapyType: e.target.value})}
                    >
                      {therapyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all mt-4 uppercase tracking-widest text-sm text-white flex items-center justify-center gap-2 ${
                    isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Guardando...
                    </>
                  ) : 'Confirmar Agendamiento'}
                </button>
              </form>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-10">
                <Clock size={48} className="opacity-10 mb-4" />
                <p className="text-sm font-medium px-6">Selecciona un horario en el calendario para completar tus datos.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingSystem;