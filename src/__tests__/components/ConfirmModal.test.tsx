import { render, screen, fireEvent } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import ConfirmModal from '../../shared/components/ConfirmModal';

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
// Componente puramente presentacional — no necesita mocks de Firebase.

describe('ConfirmModal — estructura', () => {
  it('muestra el mensaje recibido como prop', () => {
    render(<ConfirmModal message="¿Eliminar este paciente?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('¿Eliminar este paciente?')).toBeInTheDocument();
  });

  it('muestra el título "Confirmar acción"', () => {
    render(<ConfirmModal message="test" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Confirmar acción')).toBeInTheDocument();
  });

  it('muestra el botón Eliminar', () => {
    render(<ConfirmModal message="test" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Eliminar')).toBeInTheDocument();
  });

  it('muestra el botón Cancelar', () => {
    render(<ConfirmModal message="test" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });
});

describe('ConfirmModal — interacciones', () => {
  const onConfirm = vi.fn();
  const onCancel  = vi.fn();

  beforeEach(() => { vi.clearAllMocks(); });

  it('llama onConfirm al hacer clic en Eliminar', () => {
    render(<ConfirmModal message="test" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Eliminar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('llama onCancel al hacer clic en Cancelar', () => {
    render(<ConfirmModal message="test" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Eliminar NO llama onCancel', () => {
    render(<ConfirmModal message="test" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Eliminar'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Cancelar NO llama onConfirm', () => {
    render(<ConfirmModal message="test" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cada clic llama al handler exactamente una vez', () => {
    render(<ConfirmModal message="test" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Eliminar'));
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
