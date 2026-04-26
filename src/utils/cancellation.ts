import { SessionStatus } from '../types';

export interface CancellationResult {
  cancelable: boolean;
  message?: string;
}

export const getCancellationEligibility = (
  status: SessionStatus,
  sessionDate: string,
  sessionTime: string,
  nowMs: number = Date.now()
): CancellationResult => {
  if (status !== 'Programada' && status !== 'Confirmada') {
    return { cancelable: false, message: 'Esta cita ya no admite cancelación.' };
  }

  const date = new Date(`${sessionDate}T${sessionTime}:00`);
  if (Number.isNaN(date.getTime())) {
    return { cancelable: false, message: 'La cita tiene fecha u hora inválida.' };
  }

  const diffMs = date.getTime() - nowMs;
  if (diffMs <= 0) {
    return { cancelable: false, message: 'Solo puedes cancelar citas futuras.' };
  }

  const minAdvanceMs = 2 * 60 * 60 * 1000;
  if (diffMs < minAdvanceMs) {
    return {
      cancelable: false,
      message: 'Las cancelaciones requieren mínimo 2 horas de anticipación. Llama a la clínica.',
    };
  }

  return { cancelable: true };
};
