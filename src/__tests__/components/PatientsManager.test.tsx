import { render, screen } from '@testing-library/react';
import { vi, Mock } from 'vitest';
import * as AuthContext from '../../context/AuthContext';
import * as Firestore from 'firebase/firestore';
import { DEFAULT_PERMISSIONS, FULL_PERMISSIONS, UserPermissions } from '../../types';
import PatientsManager from '../../modules/patients/PatientsManager';

// ─── Mocks globales ───────────────────────────────────────────────────────────

vi.mock('../../lib/firebase', () => ({
  db: {}, auth: {}, functions: {}, storage: {},
}));

// onSnapshot llama inmediatamente al callback con lista vacía y devuelve unsub
vi.mock('firebase/firestore', () => ({
  collection:  vi.fn(),
  onSnapshot:  vi.fn((_, cb) => { cb({ docs: [] }); return () => {}; }),
  addDoc:      vi.fn(),
  deleteDoc:   vi.fn(),
  updateDoc:   vi.fn(),
  doc:         vi.fn(),
  getDocs:     vi.fn(),
  query:       vi.fn(),
  where:       vi.fn(),
  getDoc:      vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../shared/hooks/useEscKey', () => ({
  default: vi.fn(),
}));

// ─── Helper: configura el rol del usuario en el mock ─────────────────────────

const mockAuth = (isTI: boolean, isViewer: boolean, permissions: UserPermissions) => {
  (AuthContext.useAuth as Mock).mockReturnValue({
    isTI, isViewer, permissions,
    user: { uid: 'test-uid', email: 'test@test.com' },
    role: isTI ? 'ti' : isViewer ? 'viewer' : 'operador',
    loading: false,
  });
};

// ─── Tests: estructura básica ─────────────────────────────────────────────────

describe('PatientsManager — estructura', () => {
  beforeEach(() => { mockAuth(true, false, FULL_PERMISSIONS); });

  it('muestra el título "Pacientes"', () => {
    render(<PatientsManager />);
    expect(screen.getByText('Pacientes')).toBeInTheDocument();
  });

  it('muestra el buscador', () => {
    render(<PatientsManager />);
    expect(screen.getByPlaceholderText(/buscar por nombre o dni/i)).toBeInTheDocument();
  });

  it('muestra el contador de pacientes y el estado vacío', () => {
    render(<PatientsManager />);
    expect(screen.getByText(/0 pacientes/i)).toBeInTheDocument();
    expect(screen.getByText(/aún no hay pacientes registrados/i)).toBeInTheDocument();
  });
});

// ─── Tests: gate de permiso "add" (botón Nuevo Paciente) ─────────────────────

describe('PatientsManager — gate de permiso add', () => {
  it('rol TI → muestra "Nuevo Paciente"', () => {
    mockAuth(true, false, DEFAULT_PERMISSIONS);
    render(<PatientsManager />);
    expect(screen.getByText('Nuevo Paciente')).toBeInTheDocument();
  });

  it('rol viewer → NO muestra "Nuevo Paciente"', () => {
    mockAuth(false, true, DEFAULT_PERMISSIONS);
    render(<PatientsManager />);
    expect(screen.queryByText('Nuevo Paciente')).not.toBeInTheDocument();
  });

  it('operador sin permiso add → NO muestra "Nuevo Paciente"', () => {
    mockAuth(false, false, DEFAULT_PERMISSIONS);
    render(<PatientsManager />);
    expect(screen.queryByText('Nuevo Paciente')).not.toBeInTheDocument();
  });

  it('operador CON permiso add → muestra "Nuevo Paciente"', () => {
    const perms: UserPermissions = {
      ...DEFAULT_PERMISSIONS,
      patients: { add: true, edit: false, delete: false },
    };
    mockAuth(false, false, perms);
    render(<PatientsManager />);
    expect(screen.getByText('Nuevo Paciente')).toBeInTheDocument();
  });
});

// ─── Tests: gate de permisos edit y delete con datos reales ──────────────────

describe('PatientsManager — gates edit y delete con paciente en lista', () => {
  const mockPatient = {
    id: 'pac-001',
    name: 'Juan Perez',
    dni: '12345678',
    age: 35,
    phone: '999999999',
    professionalId: '',
  };

  beforeEach(() => {
    // Reemplaza onSnapshot para devolver un paciente real la primera vez (patients)
    // y lista vacía la segunda (professionals)
    let call = 0;
    (Firestore.onSnapshot as Mock).mockImplementation((_: unknown, cb: (snap: { docs: { id: string; data: () => typeof mockPatient }[] }) => void) => {
      call++;
      cb({ docs: call === 1 ? [{ id: mockPatient.id, data: () => mockPatient }] : [] });
      return () => {};
    });
  });

  it('rol TI → muestra botones de editar y eliminar por cada paciente', () => {
    mockAuth(true, false, FULL_PERMISSIONS);
    render(<PatientsManager />);
    // lucide-react renderiza SVG, verificamos que los botones de acción existen
    const actionButtons = screen.getAllByRole('button');
    // Al menos: Nuevo Paciente + editar + eliminar
    expect(actionButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('rol viewer → NO muestra botones de editar ni eliminar', () => {
    mockAuth(false, true, DEFAULT_PERMISSIONS);
    render(<PatientsManager />);
    // Sin "Nuevo Paciente" y sin botones de acción por fila
    expect(screen.queryByText('Nuevo Paciente')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button').length).toBe(0);
  });

  it('operador con perms edit=true, delete=false → solo editar visible', () => {
    const perms: UserPermissions = {
      ...DEFAULT_PERMISSIONS,
      patients: { add: false, edit: true, delete: false },
    };
    mockAuth(false, false, perms);
    render(<PatientsManager />);
    // Solo hay 1 botón de acción (editar) — sin "Nuevo Paciente" ni eliminar
    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBe(1);
  });

  it('muestra el nombre del paciente en la tabla', () => {
    mockAuth(true, false, FULL_PERMISSIONS);
    render(<PatientsManager />);
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
  });

  it('muestra el DNI del paciente en la tabla', () => {
    mockAuth(true, false, FULL_PERMISSIONS);
    render(<PatientsManager />);
    expect(screen.getByText('12345678')).toBeInTheDocument();
  });
});
