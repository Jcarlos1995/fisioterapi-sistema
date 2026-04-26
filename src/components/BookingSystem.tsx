import React, { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Activity, Clock, User, Phone, CheckCircle, Mail, ArrowLeft, X, Lock, AlertCircle } from 'lucide-react';


const BookingSystem: React.FC = () => {
  // Ahora guardamos los slots ocupados con su therapyType
  const [bookedSlots, setBookedSlots] = useState<{ start: string; end: string; therapyType: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isBooked, setIsBooked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showResumen, setShowResumen] = useState(false);

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

  // ─── Mapa de ocupación: clave = inicio ISO del slot, valor = Set de servicios tomados ───
  // Normaliza una fecha ISO a clave de slot (redondeada a 30 min).
  const slotKey = (iso: string): string => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      // Redondear minutos hacia abajo a múltiplo de 30
      const minutes = d.getMinutes();
      d.setMinutes(minutes < 30 ? 0 : 30, 0, 0);
      return d.toISOString();
    } catch {
      return iso;
    }
  };

  const occupancyMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    bookedSlots.forEach(s => {
      const key = slotKey(s.start);
      if (!map.has(key)) map.set(key, new Set());
      if (s.therapyType) map.get(key)!.add(s.therapyType);
    });
    return map;
  }, [bookedSlots]);

  // Servicios tomados en el slot actualmente seleccionado
  const takenInSelectedSlot = useMemo(() => {
    if (!selectedSlot) return new Set<string>();
    return occupancyMap.get(slotKey(selectedSlot.startStr)) ?? new Set<string>();
  }, [selectedSlot, occupancyMap]);

  // Si el servicio seleccionado cae en ocupado al cambiar de slot, lo reseteamos
  // automáticamente al primero disponible.
  useEffect(() => {
    if (!selectedSlot) return;
    if (takenInSelectedSlot.has(formData.therapyType)) {
      const firstAvailable = therapyOptions.find(opt => !takenInSelectedSlot.has(opt));
      if (firstAvailable) {
        setFormData(prev => ({ ...prev, therapyType: firstAvailable }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot]);

  useEffect(() => {
    const fetchCitas = async () => {
      try {
        const functions       = getFunctions(undefined, 'us-central1');
        const getAvailability = httpsCallable<void, { slots: { start: string; end: string; therapyType: string }[] }>(functions, 'getAvailability');
        const result          = await getAvailability();
        setBookedSlots(result.data.slots || []);
      } catch (error) {
        console.error("Error cargando citas:", error);
      }
    };
    fetchCitas();
  }, []);

  // ─── Eventos de fondo ───────────────────────────────────────────────────
  // FullCalendar aplica "events" a celdas específicas (día × hora), por eso
  // los usamos para pintar la ocupación. slotLaneClassNames NO sirve porque
  // pinta filas de hora completas a través de todos los días.
  const events = useMemo(() => {
    const out: any[] = [];
    const total = therapyOptions.length;

    occupancyMap.forEach((services, key) => {
      const taken = services.size;
      if (taken === 0) return;

      // Color según nivel de ocupación
      let color: string;
      if (taken >= total)     color = '#fecaca'; // 5/5 — rojo
      else if (taken >= 4)    color = '#ffedd5'; // 4/5 — naranja
      else if (taken >= 2)    color = '#fefce8'; // 2-3/5 — amarillo
      else                    color = '#f0fdf4'; // 1/5 — verde suave

      const start = new Date(key);
      const end   = new Date(start.getTime() + 30 * 60 * 1000);
      out.push({
        title:     taken >= total ? 'Ocupado' : '',
        start:     start.toISOString(),
        end:       end.toISOString(),
        display:   'background' as const,
        color,
        id:        `occ-${key}`,
      });
    });
    return out;
  }, [occupancyMap, therapyOptions.length]);

  // Bloquear selección de slots 5/5
  const handleSelectAllow = (selectInfo: any): boolean => {
    // 1) No permitir seleccionar slots cuya hora de inicio ya pasó
    const startTime = new Date(selectInfo.startStr).getTime();
    if (startTime <= Date.now()) return false;

    // 2) No permitir slots totalmente ocupados (5/5 servicios)
    const key   = slotKey(selectInfo.startStr);
    const taken = occupancyMap.get(key)?.size ?? 0;
    return taken < therapyOptions.length;
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || isSubmitting) return;

    // Seguridad: el slot seleccionado no puede estar en el pasado (ej: el usuario dejó
    // la página abierta mucho tiempo y ese horario ya pasó).
    if (new Date(selectedSlot.startStr).getTime() <= Date.now()) {
      setSubmitError("El horario seleccionado ya pasó. Por favor elige uno nuevo.");
      setSelectedSlot(null);
      return;
    }

    // Seguridad adicional: si el servicio quedó marcado como ocupado por cambios en
    // tiempo real, no permitir el envío.
    if (takenInSelectedSlot.has(formData.therapyType)) {
      setSubmitError("El servicio seleccionado ya fue tomado por otro paciente. Por favor elige otro.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const functions     = getFunctions(undefined, 'us-central1');
      const createBooking = httpsCallable<object, { success: boolean }>(functions, 'createBooking');

      await createBooking({
        name:        formData.name,
        phone:       formData.phone,
        email:       formData.email,
        dni:         formData.dni,
        age:         formData.age,
        therapyType: formData.therapyType,
        startStr:    selectedSlot.startStr,
        endStr:      selectedSlot.endStr,
      });

      setIsBooked(true);
    } catch (error: any) {
      console.error("Error en registro de cita:", error);
      const msg: string = error?.message ?? '';
      if (msg.includes('already-exists') || msg.includes('Ya tienes')) {
        setSubmitError("Ya tienes una cita pendiente registrada. Contacta a la clínica si necesitas modificarla.");
      } else if (msg.includes('resource-exhausted') || msg.includes('Demasiados')) {
        setSubmitError("Demasiados intentos. Por favor espera una hora e intenta de nuevo.");
      } else {
        setSubmitError("Hubo un problema al guardar tu cita. Por favor, intenta de nuevo.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintResumen = () => {
    const fechaHora = selectedSlot
      ? new Date(selectedSlot.startStr).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })
      : '—';

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Comprobante de Cita</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; max-width: 520px; margin: auto; }
        .logo { font-size: 22px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
        .subtitle { font-size: 12px; color: #64748b; margin-bottom: 28px; }
        h2 { font-size: 18px; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .label { color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; }
        .value { font-size: 14px; font-weight: 600; text-align: right; }
        .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
      </style></head><body>
        <div class="logo">Fisioterapia Chepén</div>
        <div class="subtitle">Comprobante de Cita Médica</div>
        <h2>Datos del Agendamiento</h2>
        <div class="row"><span class="label">Paciente</span><span class="value">${formData.name}</span></div>
        <div class="row"><span class="label">DNI</span><span class="value">${formData.dni}</span></div>
        <div class="row"><span class="label">Teléfono</span><span class="value">${formData.phone}</span></div>
        <div class="row"><span class="label">Email</span><span class="value">${formData.email}</span></div>
        <div class="row"><span class="label">Servicio</span><span class="value">${formData.therapyType}</span></div>
        <div class="row"><span class="label">Fecha y Hora</span><span class="value">${fechaHora}</span></div>
        <div class="row"><span class="label">Estado</span><span class="value" style="color:#16a34a">✓ Programada</span></div>
        <div class="footer">Guarda este comprobante. Te contactaremos para confirmar tu cita.<br/>Fisioterapia Chepén — Chepén, La Libertad, Perú</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  if (isBooked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl text-center border border-green-100">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">¡Cita Registrada!</h2>
          <p className="text-slate-600 mt-2">Hola <strong>{formData.name}</strong>, tu solicitud ha sido enviada con éxito.</p>

          {/* Resumen / Comprobante */}
          <button
            onClick={() => setShowResumen(true)}
            className="mt-4 w-full border-2 border-blue-600 text-blue-600 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors"
          >
            Ver Resumen
          </button>
          <button
            onClick={() => window.location.href = LANDING_URL}
            className="mt-3 w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            Volver al Inicio
          </button>
        </div>

        {/* Modal resumen */}
        {showResumen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100">
              <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <h3 className="font-bold text-lg uppercase tracking-tight">Comprobante de Cita</h3>
                <button onClick={() => setShowResumen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-3">
                {[
                  { label: 'Paciente',    value: formData.name },
                  { label: 'DNI',         value: formData.dni },
                  { label: 'Teléfono',    value: formData.phone },
                  { label: 'Email',       value: formData.email },
                  { label: 'Servicio',    value: formData.therapyType },
                  { label: 'Fecha y Hora', value: selectedSlot ? new Date(selectedSlot.startStr).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' }) : '—' },
                  { label: 'Estado',      value: '✓ Programada' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                    <span className="text-sm font-semibold text-slate-800 text-right max-w-[60%]">{value}</span>
                  </div>
                ))}
                <p className="text-xs text-slate-400 text-center pt-2">Te contactaremos para confirmar tu cita.</p>
              </div>
              <div className="px-6 pb-6">
                <button
                  onClick={handlePrintResumen}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  Imprimir Comprobante
                </button>
              </div>
            </div>
          </div>
        )}
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
            <Activity size={24} />
            <h1 className="text-xl font-bold uppercase tracking-tight">Portal de Citas - Fisioterapi Chepén</h1>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 p-4 border-r border-slate-200">
            <FullCalendar
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              selectable={true}
              selectAllow={handleSelectAllow}
              slotMinTime="08:00:00"
              slotMaxTime="20:00:00"
              slotDuration="00:30:00"
              slotLabelInterval="00:30"
              allDaySlot={false}
              locale={esLocale}
              events={events}
              select={(info) => setSelectedSlot(info)}
              height="auto"
            />

            {/* Leyenda de colores de ocupación */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500 px-2">
              <span className="font-bold uppercase tracking-wider">Disponibilidad:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-white border border-slate-200" />
                Libre
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-green-50 border border-green-200" />
                1 servicio ocupado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-yellow-50 border border-yellow-200" />
                2–3 ocupados
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-200" />
                4 ocupados
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-red-200 border border-red-300 flex items-center justify-center">
                  <Lock size={7} className="text-red-600" />
                </span>
                Completo
              </span>
              <span className="flex items-center gap-1.5 opacity-50">
                <span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
                Día pasado
              </span>
            </div>

            {/* Estilos: cursor prohibido SOLO en días anteriores al actual */}
            <style>{`
              /* FullCalendar añade automáticamente .fc-day-past a las columnas de
                 días anteriores al actual. Sobre esas columnas atenuamos y marcamos
                 el cursor como no-permitido. El día actual (.fc-day-today) no se
                 toca, aunque algunas de sus horas ya hayan pasado. */
              .fc-day-past {
                opacity: 0.55;
              }
              .fc-day-past .fc-timegrid-col-frame,
              .fc-day-past .fc-timegrid-col-bg,
              .fc-day-past .fc-timegrid-col-events {
                cursor: not-allowed !important;
              }
            `}</style>
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
                      value={formData.therapyType}
                      onChange={e => setFormData({ ...formData, therapyType: e.target.value })}
                    >
                      {therapyOptions.map(opt => {
                        const ocupado = takenInSelectedSlot.has(opt);
                        return (
                          <option
                            key={opt}
                            value={opt}
                            disabled={ocupado}
                            style={ocupado ? { color: '#94a3b8', fontStyle: 'italic' } : undefined}
                          >
                            {opt}{ocupado ? ' — Ocupado' : ''}
                          </option>
                        );
                      })}
                    </select>

                    {/* Aviso si hay servicios no disponibles en este horario */}
                    {takenInSelectedSlot.size > 0 && takenInSelectedSlot.size < therapyOptions.length && (
                      <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] rounded-lg px-2.5 py-2">
                        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                        <span>
                          {takenInSelectedSlot.size} servicio{takenInSelectedSlot.size === 1 ? '' : 's'} ya
                          {takenInSelectedSlot.size === 1 ? ' está ocupado' : ' están ocupados'} en este horario.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {submitError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
                    {submitError}
                  </div>
                )}
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