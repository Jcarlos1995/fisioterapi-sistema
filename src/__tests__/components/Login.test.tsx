import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, Mock } from 'vitest';
import * as firebaseAuth from 'firebase/auth';
import Login from '../../modules/auth/Login';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../lib/firebase', () => ({
  auth: {}, db: {}, functions: {}, storage: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
}));

vi.mock('../../config', () => ({
  LANDING_URL: 'https://test.web.app',
}));

// ─── Helper ──────────────────────────────────────────────────────────────────

const mockSignIn = () => firebaseAuth.signInWithEmailAndPassword as Mock;

const fillAndSubmit = (email = 'test@test.com', password = '123456') => {
  fireEvent.change(screen.getByPlaceholderText(/profesional@fisioterapi/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: /Acceder al Sistema/i }));
};

const throwFirebase = (code: string) => {
  mockSignIn().mockRejectedValueOnce({ code });
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Login — estructura inicial', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('muestra el nombre de la clínica', () => {
    render(<Login />);
    expect(screen.getByText(/Fisioterapi Chepén/i)).toBeInTheDocument();
  });

  it('muestra el label de correo electrónico', () => {
    render(<Login />);
    expect(screen.getByText(/Correo Electrónico/i)).toBeInTheDocument();
  });

  it('muestra el label de contraseña', () => {
    render(<Login />);
    expect(screen.getByText(/Contraseña/i)).toBeInTheDocument();
  });

  it('muestra el botón de acceso habilitado por defecto', () => {
    render(<Login />);
    const btn = screen.getByRole('button', { name: /Acceder al Sistema/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('no muestra mensaje de error al renderizar', () => {
    render(<Login />);
    expect(screen.queryByText(/contraseña incorrecta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no existe una cuenta/i)).not.toBeInTheDocument();
  });
});

describe('Login — mensajes de error de Firebase', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('auth/invalid-credential → contraseña incorrecta', async () => {
    throwFirebase('auth/invalid-credential');
    render(<Login />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/contraseña incorrecta/i)).toBeInTheDocument()
    );
  });

  it('auth/wrong-password → contraseña incorrecta', async () => {
    throwFirebase('auth/wrong-password');
    render(<Login />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/contraseña incorrecta/i)).toBeInTheDocument()
    );
  });

  it('auth/user-not-found → no existe cuenta', async () => {
    throwFirebase('auth/user-not-found');
    render(<Login />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/no existe una cuenta/i)).toBeInTheDocument()
    );
  });

  it('auth/too-many-requests → demasiados intentos', async () => {
    throwFirebase('auth/too-many-requests');
    render(<Login />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/demasiados intentos/i)).toBeInTheDocument()
    );
  });

  it('auth/user-disabled → cuenta deshabilitada', async () => {
    throwFirebase('auth/user-disabled');
    render(<Login />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/deshabilitada/i)).toBeInTheDocument()
    );
  });

  it('auth/network-request-failed → error de conexión', async () => {
    throwFirebase('auth/network-request-failed');
    render(<Login />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/error de conexión/i)).toBeInTheDocument()
    );
  });

  it('código desconocido → mensaje genérico', async () => {
    throwFirebase('auth/unknown-code');
    render(<Login />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/error al iniciar sesión/i)).toBeInTheDocument()
    );
  });

  it('limpia la contraseña después de un error', async () => {
    throwFirebase('auth/invalid-credential');
    render(<Login />);
    fillAndSubmit('a@a.com', 'secreto');
    await waitFor(() =>
      expect(screen.getByText(/contraseña incorrecta/i)).toBeInTheDocument()
    );
    const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
    expect(passwordInput.value).toBe('');
  });
});

describe('Login — estado de carga', () => {
  it('muestra "Verificando..." mientras está cargando', async () => {
    (firebaseAuth.signInWithEmailAndPassword as Mock).mockReturnValueOnce(
      new Promise(() => {}) // promesa que nunca resuelve
    );
    render(<Login />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/Verificando/i)).toBeInTheDocument()
    );
  });

  it('el botón queda deshabilitado durante la carga', async () => {
    (firebaseAuth.signInWithEmailAndPassword as Mock).mockReturnValueOnce(
      new Promise(() => {})
    );
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => {
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
    });
  });
});
