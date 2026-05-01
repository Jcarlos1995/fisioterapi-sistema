/**
 * Módulo de auditoría — Ley 29733 (Protección de Datos Personales - Perú)
 *
 * Registra quién accedió o modificó datos sensibles y cuándo.
 * Los logs se guardan en Firestore en la colección: auditLogs/
 *
 * Regla de diseño: writeAuditLog nunca lanza excepciones ni bloquea la
 * operación principal; si falla por red, lo registra en consola y sigue.
 */

import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'open_patient_detail'   // Alguien abrió el expediente de un paciente
  | 'create_patient'        // Nuevo paciente registrado
  | 'update_patient'        // Datos de paciente modificados
  | 'delete_patient'        // Paciente eliminado
  | 'create_session'        // Cita agendada
  | 'update_session_status' // Estado de cita cambiado
  | 'delete_session';       // Cita eliminada

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Escribe un registro de auditoría en Firestore.
 *
 * @param user        - Usuario Firebase autenticado (auth.currentUser)
 * @param action      - Tipo de acción realizada
 * @param targetId    - ID del documento afectado (paciente o sesión)
 * @param targetName  - Nombre legible del objetivo (opcional, mejora la legibilidad del log)
 * @param details     - Datos adicionales (ej: { oldStatus, newStatus })
 */
export const writeAuditLog = async (
  user: User,
  action: AuditAction,
  targetId: string,
  targetName?: string,
  details?: Record<string, unknown>,
): Promise<void> => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId:    user.uid,
      userEmail: user.email ?? 'desconocido',
      action,
      targetId,
      ...(targetName !== undefined && { targetName }),
      ...(details    !== undefined && { details }),
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // El fallo del log nunca debe interrumpir la operación clínica principal
    console.warn('[auditLog] No se pudo registrar la acción de auditoría:', err);
  }
};
