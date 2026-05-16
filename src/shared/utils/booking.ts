// ─── Utilidades puras del sistema de reservas ────────────────────────────────
// Extraídas de BookingSystem.tsx para poder testearlas de forma aislada.

export interface BookedSlot {
  start: string;
  end: string;
  therapyType: string;
}

/**
 * Normaliza un timestamp ISO al inicio del slot de 30 min que lo contiene.
 * Minutos 0-29  → :00
 * Minutos 30-59 → :30
 */
export const slotKey = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const minutes = d.getMinutes();
    d.setMinutes(minutes < 30 ? 0 : 30, 0, 0);
    return d.toISOString();
  } catch {
    return iso;
  }
};

/**
 * Construye el mapa de ocupación a partir de los slots reservados.
 * Clave: ISO normalizado del inicio del slot
 * Valor: Set de servicios (therapyType) tomados en ese slot
 */
export const buildOccupancyMap = (bookedSlots: BookedSlot[]): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  bookedSlots.forEach(s => {
    const key = slotKey(s.start);
    if (!map.has(key)) map.set(key, new Set());
    if (s.therapyType) map.get(key)!.add(s.therapyType);
  });
  return map;
};

/**
 * Determina si un slot puede ser seleccionado por el usuario.
 * Bloquea slots pasados y slots completamente llenos (totalServices/totalServices).
 */
export const isSlotAllowed = (
  startStr: string,
  occupancyMap: Map<string, Set<string>>,
  totalServices: number,
  nowMs: number = Date.now(),
): boolean => {
  const startTime = new Date(startStr).getTime();
  if (startTime <= nowMs) return false;
  const taken = occupancyMap.get(slotKey(startStr))?.size ?? 0;
  return taken < totalServices;
};

/**
 * Devuelve el color de fondo para un slot según su nivel de ocupación.
 * 1/total  → verde suave
 * 2-3/total → amarillo
 * 4/total  → naranja
 * 5/total  → rojo (lleno)
 */
export const occupancyColor = (taken: number, total: number): string => {
  if (taken >= total) return '#fecaca'; // lleno — rojo
  if (taken >= 4)     return '#ffedd5'; // 4/5  — naranja
  if (taken >= 2)     return '#fefce8'; // 2-3  — amarillo
  return '#f0fdf4';                      // 1    — verde suave
};

/**
 * Mapea el mensaje de error de Firebase a texto amigable para el usuario.
 */
export const mapBookingError = (errorMessage: string): string => {
  if (errorMessage.includes('already-exists') || errorMessage.includes('Ya tienes')) {
    return 'Ya tienes una cita pendiente registrada. Contacta a la clínica si necesitas modificarla.';
  }
  if (errorMessage.includes('resource-exhausted') || errorMessage.includes('Demasiados')) {
    return 'Demasiados intentos. Por favor espera una hora e intenta de nuevo.';
  }
  return 'Hubo un problema al guardar tu cita. Por favor, intenta de nuevo.';
};
