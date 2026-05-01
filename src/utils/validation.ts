export const validateDni = (dni: string): { valid: boolean; error?: string } => {
  const cleaned = dni.trim();
  if (!cleaned) return { valid: false, error: 'El DNI es obligatorio' };
  if (!/^\d{8}$/.test(cleaned)) return { valid: false, error: 'El DNI debe tener 8 dígitos' };
  return { valid: true };
};

export const validateBirthDate = (date: string): { valid: boolean; error?: string } => {
  if (!date) return { valid: false, error: 'La fecha de nacimiento es obligatoria' };
  const formatOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!formatOk) return { valid: false, error: 'Fecha inválida' };

  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { valid: false, error: 'Fecha inválida' };

  // Comparar usando fechas locales en formato YYYY-MM-DD para evitar problemas de zona horaria
  const now = new Date();
  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  if (date > todayStr) return { valid: false, error: 'La fecha no puede ser futura' };

  const minDate = new Date(now.getFullYear() - 120, 0, 1);
  if (d < minDate) return { valid: false, error: 'Fecha fuera de rango' };

  return { valid: true };
};
