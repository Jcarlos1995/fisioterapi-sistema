import { DEFAULT_PERMISSIONS, FULL_PERMISSIONS, UserPermissions } from '../types';

// ─── Lógica de gate de permisos (AuthContext + JSX gates del panel) ───────────
// Replica el patrón: { (isTI || permissions.mod.action) && <button> }
function canPerformAction(
  isTI: boolean,
  isViewer: boolean,
  permissions: UserPermissions,
  module: keyof UserPermissions,
  action: 'add' | 'edit' | 'delete',
): boolean {
  if (isTI) return true;
  if (isViewer) return false;
  return permissions[module][action];
}

describe('DEFAULT_PERMISSIONS', () => {
  const modules = ['professionals', 'patients', 'appointments', 'products', 'stories'] as const;

  it('deniega todas las acciones por defecto', () => {
    modules.forEach(mod => {
      expect(DEFAULT_PERMISSIONS[mod].add).toBe(false);
      expect(DEFAULT_PERMISSIONS[mod].edit).toBe(false);
      expect(DEFAULT_PERMISSIONS[mod].delete).toBe(false);
    });
  });
});

describe('FULL_PERMISSIONS', () => {
  const modules = ['professionals', 'patients', 'appointments', 'products', 'stories'] as const;

  it('permite todas las acciones en todos los módulos', () => {
    modules.forEach(mod => {
      expect(FULL_PERMISSIONS[mod].add).toBe(true);
      expect(FULL_PERMISSIONS[mod].edit).toBe(true);
      expect(FULL_PERMISSIONS[mod].delete).toBe(true);
    });
  });
});

describe('UserPermissions shape', () => {
  it('DEFAULT_PERMISSIONS tiene exactamente los módulos esperados', () => {
    const keys = Object.keys(DEFAULT_PERMISSIONS) as (keyof UserPermissions)[];
    expect(keys).toEqual(expect.arrayContaining(['professionals', 'patients', 'appointments', 'products', 'stories']));
    expect(keys).toHaveLength(5);
  });
});

// ─── canPerformAction: lógica de gate de roles ────────────────────────────────
describe('canPerformAction — rol TI (bypass total)', () => {
  const modules = ['professionals', 'patients', 'appointments', 'products', 'stories'] as const;
  const actions = ['add', 'edit', 'delete'] as const;

  it('permite cualquier acción con DEFAULT_PERMISSIONS cuando isTI', () => {
    modules.forEach(mod => {
      actions.forEach(act => {
        expect(canPerformAction(true, false, DEFAULT_PERMISSIONS, mod, act)).toBe(true);
      });
    });
  });
});

describe('canPerformAction — rol viewer (solo lectura)', () => {
  const modules = ['professionals', 'patients', 'appointments', 'products', 'stories'] as const;
  const actions = ['add', 'edit', 'delete'] as const;

  it('deniega cualquier acción incluso con FULL_PERMISSIONS cuando isViewer', () => {
    modules.forEach(mod => {
      actions.forEach(act => {
        expect(canPerformAction(false, true, FULL_PERMISSIONS, mod, act)).toBe(false);
      });
    });
  });
});

describe('canPerformAction — operador (sigue sus permisos)', () => {
  it('permite acciones cuando tiene FULL_PERMISSIONS', () => {
    expect(canPerformAction(false, false, FULL_PERMISSIONS, 'patients', 'add')).toBe(true);
    expect(canPerformAction(false, false, FULL_PERMISSIONS, 'appointments', 'delete')).toBe(true);
  });

  it('deniega acciones cuando tiene DEFAULT_PERMISSIONS', () => {
    expect(canPerformAction(false, false, DEFAULT_PERMISSIONS, 'patients', 'add')).toBe(false);
    expect(canPerformAction(false, false, DEFAULT_PERMISSIONS, 'products', 'edit')).toBe(false);
  });

  it('respeta permisos granulares mezclados', () => {
    const mixed: UserPermissions = {
      ...DEFAULT_PERMISSIONS,
      patients: { add: true, edit: false, delete: false },
      appointments: { add: false, edit: true, delete: false },
    };
    expect(canPerformAction(false, false, mixed, 'patients', 'add')).toBe(true);
    expect(canPerformAction(false, false, mixed, 'patients', 'edit')).toBe(false);
    expect(canPerformAction(false, false, mixed, 'appointments', 'edit')).toBe(true);
    expect(canPerformAction(false, false, mixed, 'appointments', 'delete')).toBe(false);
    expect(canPerformAction(false, false, mixed, 'professionals', 'add')).toBe(false);
  });
});

describe('canPerformAction — rol null (sin rol asignado)', () => {
  it('deniega todo con DEFAULT_PERMISSIONS (igual que viewer sin flag)', () => {
    // role === null: isTI=false, isViewer=false, permissions=DEFAULT_PERMISSIONS
    expect(canPerformAction(false, false, DEFAULT_PERMISSIONS, 'products', 'delete')).toBe(false);
    expect(canPerformAction(false, false, DEFAULT_PERMISSIONS, 'stories', 'add')).toBe(false);
  });
});
