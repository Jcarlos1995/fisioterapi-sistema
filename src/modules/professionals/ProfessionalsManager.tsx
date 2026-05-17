import React, { useState, useEffect } from 'react';
import { UserSquare2, Plus, Trash2, Mail, Phone, Pencil, ShieldCheck, Users, WifiOff } from 'lucide-react';
import { SkeletonHeader, SkeletonProfessionalCards } from '../../shared/components/SkeletonLoader';
import { Professional, UserPermissions, DEFAULT_PERMISSIONS, ModulePermissions } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useEscKey from '../../shared/hooks/useEscKey';
import ConfirmModal from '../../shared/components/ConfirmModal';
import {
  subscribeToProfessionals, createProfessional, updateProfessional,
  deleteProfessional, fetchActiveUsers, setUserActive, setUserRole,
} from './professionalsService';

interface UserRoleDoc {
  uid:    string;
  email:  string;
  role:   string;
  active: boolean;
}

const EMPTY_FORM = { name: '', specialty: '', email: '', phone: '' };

/* ── Switch component ─────────────────────────────────────── */
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
    <span className="text-sm text-slate-600">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  </label>
);

/* ── Permission group for one module ─────────────────────── */
const PermissionGroup: React.FC<{
  label: string;
  value: ModulePermissions;
  onChange: (v: ModulePermissions) => void;
}> = ({ label, value, onChange }) => (
  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{label}</p>
    <Toggle label="Agregar"   checked={value.add}    onChange={v => onChange({ ...value, add: v })} />
    <Toggle label="Editar"    checked={value.edit}   onChange={v => onChange({ ...value, edit: v })} />
    <Toggle label="Eliminar"  checked={value.delete} onChange={v => onChange({ ...value, delete: v })} />
  </div>
);

const ProfessionalsManager: React.FC = () => {
  /* isViewer = usuario solo lectura; se mantiene el binding para restricciones futuras en esta vista */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- isViewer reservado (rol viewer)
  const { user, isViewer, isTI, permissions } = useAuth();
  const { showToast } = useToast();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProf, setNewProf] = useState(EMPTY_FORM);
  const [formPerms, setFormPerms] = useState<UserPermissions>(DEFAULT_PERMISSIONS);

  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserRoleDoc[]>([]);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);

  const closeModal      = () => { setIsModalOpen(false); setEditingId(null); setNewProf(EMPTY_FORM); setFormPerms(DEFAULT_PERMISSIONS); };
  const closeUsersModal = () => setIsUsersModalOpen(false);

  useEscKey(closeUsersModal, isUsersModalOpen);
  useEscKey(closeModal, isModalOpen && !isUsersModalOpen);

  useEffect(() => {
    const unsub = subscribeToProfessionals(
      (data) => { setLoadError(null); setIsLoading(false); setProfessionals(data); },
      (err) => {
        console.error('onSnapshot [professionals]:', err);
        setLoadError('No se pudieron cargar los profesionales. Verifica tu conexión e intenta de nuevo.');
      },
    );
    return () => unsub();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setNewProf(EMPTY_FORM);
    setFormPerms(DEFAULT_PERMISSIONS);
    setIsModalOpen(true);
  };

  const openEdit = (prof: Professional) => {
    setEditingId(prof.id);
    setNewProf({ name: prof.name, specialty: prof.specialty, email: prof.email, phone: prof.phone ?? '' });
    // Merge con DEFAULT_PERMISSIONS para que módulos nuevos (ej: dailyTherapy)
    // siempre tengan valores aunque el documento guardado sea más antiguo.
    const saved = prof.permissions;
    setFormPerms(saved ? { ...DEFAULT_PERMISSIONS, ...saved } : DEFAULT_PERMISSIONS);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProf.name || !newProf.specialty || !newProf.email || !newProf.phone) return;
    const payload = isTI ? { ...newProf, permissions: formPerms } : { ...newProf };
    try {
      if (editingId) {
        await updateProfessional(editingId, payload);
      } else {
        await createProfessional(payload as Omit<Professional, 'id'>);
      }
      setNewProf(EMPTY_FORM);
      setEditingId(null);
      setIsModalOpen(false);
      showToast();
    } catch (error) {
      console.error('Error al guardar profesional:', error);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => setConfirmDeleteId(id);

  const confirmDeleteProfessional = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    await deleteProfessional(id);
    showToast('Profesional eliminado');
  };

  const openUsersModal = async () => {
    const list = await fetchActiveUsers();
    list.sort((a, b) => a.email.localeCompare(b.email));
    setActiveUsers(list);
    setIsUsersModalOpen(true);
  };

  const handleToggleActive = async (uid: string, currentActive: boolean) => {
    if (uid === user?.uid) return;
    setTogglingUid(uid);
    try {
      await setUserActive(uid, !currentActive);
      setActiveUsers(prev =>
        prev.map(u => u.uid === uid ? { ...u, active: !currentActive } : u),
      );
      showToast(!currentActive ? 'Usuario activado' : 'Usuario desactivado');
    } finally {
      setTogglingUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de error de carga */}
      {loadError && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
          <WifiOff size={18} className="shrink-0" />
          <span>{loadError}</span>
          <button
            onClick={() => setLoadError(null)}
            className="ml-auto text-rose-400 hover:text-rose-600 transition-colors"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmModal
          message="¿Eliminar este profesional? Esta acción no se puede deshacer."
          onConfirm={confirmDeleteProfessional}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {isLoading ? (
        <div className="space-y-4">
          <SkeletonHeader />
          <SkeletonProfessionalCards rows={4} />
        </div>
      ) : <>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Equipo Profesional</h2>
          <p className="text-slate-500 text-sm">Gestiona los especialistas de la clínica</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {isTI && (
            <button
              onClick={openUsersModal}
              className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-200 transition-colors font-semibold text-sm"
            >
              <Users size={16} /> Usuarios Activos
            </button>
          )}
          {(isTI || permissions.professionals.add) && (
            <button
              onClick={openAdd}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-md text-sm"
            >
              <Plus size={18} /> Nuevo Especialista
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {professionals.map((prof) => (
          <div key={prof.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative group">
            {(isTI || permissions.professionals.edit || permissions.professionals.delete) && (
              <div className="absolute top-4 right-4 flex items-center gap-2">
                {(isTI || permissions.professionals.edit) && (
                  <button
                    onClick={() => openEdit(prof)}
                    className="text-slate-300 hover:text-blue-500 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {(isTI || permissions.professionals.delete) && (
                  <button
                    onClick={() => handleDelete(prof.id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                <UserSquare2 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{prof.name}</h3>
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{prof.specialty}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2"><Mail size={14} /> {prof.email}</div>
              {/* Solución al error .phone con casteo seguro */}
              <div className="flex items-center gap-2"><Phone size={14} /> {prof.phone ?? 'Sin teléfono'}</div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="px-8 pt-8 pb-4 shrink-0">
              <h3 className="text-xl font-bold text-slate-800">
                {editingId ? 'Editar Especialista' : 'Registrar Especialista'}
              </h3>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-8 overflow-y-auto flex-1 pb-2">

                {/* Layout horizontal: datos | permisos */}
                <div className={`flex flex-col sm:flex-row gap-6 sm:gap-8 ${isTI ? '' : 'max-w-sm'}`}>

                  {/* Columna izquierda — datos del profesional */}
                  <div className="flex flex-col gap-4 flex-1 min-w-0">
                    <input
                      placeholder="Nombre completo *"
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      value={newProf.name}
                      onChange={e => setNewProf({...newProf, name: e.target.value})}
                    />
                    <input
                      placeholder="Especialidad *"
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      value={newProf.specialty}
                      onChange={e => setNewProf({...newProf, specialty: e.target.value})}
                    />
                    <input
                      placeholder="Correo electrónico *"
                      type="email"
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      value={newProf.email}
                      onChange={e => setNewProf({...newProf, email: e.target.value})}
                    />
                    <input
                      placeholder="Teléfono *"
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      value={newProf.phone}
                      onChange={e => setNewProf({...newProf, phone: e.target.value})}
                    />
                  </div>

                  {/* Columna derecha — permisos (solo TI) */}
                  {isTI && (
                    <div className="flex-1 min-w-0 sm:border-l border-slate-100 sm:pl-8 border-t sm:border-t-0 pt-4 sm:pt-0">
                      <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck size={16} className="text-blue-500" />
                        <p className="text-sm font-bold text-slate-700">Permisos del sistema</p>
                      </div>
                      {/* Grid 2 columnas para los grupos */}
                      <div className="grid grid-cols-2 gap-3">
                  <PermissionGroup
                      label="Profesionales"
                      value={formPerms.professionals}
                      onChange={v => setFormPerms(p => ({ ...p, professionals: v }))}
                    />
                    <PermissionGroup
                      label="Pacientes"
                      value={formPerms.patients}
                      onChange={v => setFormPerms(p => ({ ...p, patients: v }))}
                    />
                    <PermissionGroup
                      label="Citas"
                      value={formPerms.appointments}
                      onChange={v => setFormPerms(p => ({ ...p, appointments: v }))}
                    />
                    <PermissionGroup
                      label="Productos"
                      value={formPerms.products}
                      onChange={v => setFormPerms(p => ({ ...p, products: v }))}
                    />
                    <PermissionGroup
                      label="Historias"
                      value={formPerms.stories}
                      onChange={v => setFormPerms(p => ({ ...p, stories: v }))}
                    />
                    <PermissionGroup
                      label="Terapia Diaria"
                      value={formPerms.dailyTherapy}
                      onChange={v => setFormPerms(p => ({ ...p, dailyTherapy: v }))}
                    />
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="px-8 py-5 shrink-0 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
                  {editingId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
      {/* ── Modal Usuarios Activos ──────────────────────────── */}
      {isUsersModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Gestión de Usuarios</h3>
                  <p className="text-xs text-slate-400">
                    {activeUsers.length} {activeUsers.length === 1 ? 'usuario registrado' : 'usuarios registrados'} en el sistema
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUsersModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                ✕
              </button>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
              {activeUsers.length === 0 ? (
                <p className="text-center text-slate-400 py-10 text-sm">No hay usuarios registrados</p>
              ) : activeUsers.map(u => {
                const isSelf    = u.uid === user?.uid;
                const roleColor = u.role === 'ti'       ? 'bg-purple-100 text-purple-700'
                                : u.role === 'admin'    ? 'bg-blue-100 text-blue-700'
                                : u.role === 'operador' ? 'bg-emerald-100 text-emerald-700'
                                :                         'bg-slate-100 text-slate-500';
                return (
                  <div key={u.uid} className={`flex items-center gap-4 px-6 py-4 transition-colors ${isSelf ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                    {/* Avatar inicial */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${u.active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                      {u.email[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate mb-1 ${u.active ? 'text-slate-800' : 'text-slate-400'}`}>
                        {u.email}
                        {isSelf && <span className="ml-2 text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">Tú</span>}
                      </p>
                      {isSelf ? (
                        <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${roleColor}`}>
                          {u.role}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={async e => {
                            const newRole = e.target.value;
                            await setUserRole(u.uid, newRole);
                            setActiveUsers(prev =>
                              prev.map(x => x.uid === u.uid ? { ...x, role: newRole } : x)
                            );
                            showToast('Rol actualizado');
                          }}
                          className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-transparent outline-none cursor-pointer ${
                            u.role === 'ti'       ? 'bg-purple-100 text-purple-700' :
                            u.role === 'admin'    ? 'bg-blue-100 text-blue-700'    :
                            u.role === 'operador' ? 'bg-emerald-100 text-emerald-700' :
                                                    'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <option value="ti">TI</option>
                          <option value="admin">Admin</option>
                          <option value="operador">Operador</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}
                    </div>

                    {/* Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={u.active}
                      disabled={isSelf || togglingUid === u.uid}
                      onClick={() => handleToggleActive(u.uid, u.active)}
                      title={isSelf ? 'No puedes desactivar tu propia sesión' : u.active ? 'Desactivar acceso' : 'Activar acceso'}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200
                        ${u.active ? 'bg-blue-600' : 'bg-slate-200'}
                        ${isSelf ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                        ${togglingUid === u.uid ? 'opacity-60' : ''}
                      `}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${u.active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setIsUsersModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
};

export default ProfessionalsManager;
