import React, { useState, useEffect } from 'react';
import { Story } from '../../types';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { fetchStories, uploadStoryBlob, saveStory, deleteStory } from './storiesService';
import { BookOpen, Plus, Trash2, HeartPulse, Loader2, Calendar, Image as ImageIcon, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../shared/components/ConfirmModal';

const Stories: React.FC = () => {
  const { isTI, permissions } = useAuth();
  const { showToast } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; imageUrl?: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    diagnosis: '',
    text: '',
    date: ''
  });

  useEffect(() => {
    loadStories();
  }, []);

  // Limpiar la URL de previsualización para evitar fugas de memoria
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const loadStories = async () => {
    try {
      const data = await fetchStories();
      setStories(data);
    } catch (e) {
      console.error('Error al traer historias:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setImageError("La imagen es muy pesada. Por favor elige una de menos de 5MB.");
        e.target.value = "";
        return;
      }
      setImageError(null);
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setImageFile(null);
      setPreviewUrl(null);
    }
  };

  const compressToBlob = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Compresión fallida')), 'image/jpeg', 0.7);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let imageUrl = "";

      if (imageFile) {
        const blob = await compressToBlob(imageFile);
        imageUrl = await uploadStoryBlob(blob, imageFile.name);
      }

      await saveStory({
        patientName: formData.name,
        diagnosis:   formData.diagnosis,
        testimony:   formData.text,
        displayDate: formData.date,
        imageUrl,
      });

      setFormData({ name: '', diagnosis: '', text: '', date: '' });
      setImageFile(null);
      setPreviewUrl(null);
      void loadStories();
      showToast('Historia publicada');
    } catch (e: any) {
      console.error("Error al guardar:", e);
      const msg: string = e?.code ?? e?.message ?? 'Error desconocido';
      if (msg.includes('storage/unauthorized') || msg.includes('storage/unknown')) {
        showToast("Error de Storage: verifica las reglas de Firebase.", 'error');
      } else if (msg.includes('storage')) {
        showToast(`Error al subir la imagen: ${msg}`, 'error');
      } else {
        showToast(`Error al guardar la historia: ${msg}`, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, imageUrl?: string) => {
    setConfirmDelete({ id, imageUrl });
  };

  const confirmDeleteStory = async () => {
    if (!confirmDelete) return;
    const { id, imageUrl } = confirmDelete;
    setConfirmDelete(null);
    await deleteStory(id);
    if (imageUrl && imageUrl.startsWith('https://firebasestorage')) {
      try { await deleteObject(ref(storage, imageUrl)); } catch { /* ya eliminado */ }
    }
    void loadStories();
    showToast('Historia eliminada');
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Fecha no definida';
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-sans">
      {confirmDelete && (
        <ConfirmModal
          message="¿Eliminar esta historia? Esta acción no se puede deshacer."
          onConfirm={confirmDeleteStory}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 uppercase tracking-tight">Historias que Inspiran</h1>
        <p className="text-slate-500 font-medium italic">Gestiona los testimonios con fotos reales de pacientes</p>
      </div>

      <div className={`grid grid-cols-1 ${(isTI || permissions.stories.add) ? 'lg:grid-cols-3' : ''} gap-8`}>
        {(isTI || permissions.stories.add) && <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit sticky top-8">
          <div className="flex items-center gap-2 mb-6 text-emerald-600">
            <Plus size={20} />
            <h2 className="font-bold uppercase text-sm tracking-wider">Nueva Historia</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Paciente</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 ring-emerald-100" placeholder="Nombre completo" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Foto del Paciente</label>

              {/* Previsualización si existe imagen */}
              {imageError && <p className="text-xs text-rose-500 mt-1 mb-1">{imageError}</p>}
              {previewUrl ? (
                <div className="relative mt-1 mb-2 group">
                  <img src={previewUrl} className="w-full h-32 object-cover rounded-xl border border-slate-200" alt="Preview" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setPreviewUrl(null); }}
                    className="absolute top-2 right-2 bg-rose-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="mt-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all text-slate-500">
                  <ImageIcon size={20} />
                  <span className="text-xs font-medium">Elegir foto...</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Mes y Año del Caso</label>
              <input required type="month" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 ring-emerald-100" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Diagnóstico / Caso</label>
              <input required type="text" value={formData.diagnosis} placeholder="Ej: Recuperación de ACV" onChange={e => setFormData({...formData, diagnosis: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 ring-emerald-100" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Testimonio</label>
              <textarea required rows={4} value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 ring-emerald-100" placeholder="Relata la experiencia del paciente..." />
            </div>

            <button disabled={saving} className={`w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}>
              {saving ? <Loader2 className="animate-spin" /> : <BookOpen size={18} />} {saving ? 'Procesando...' : 'Publicar en Web'}
            </button>
          </form>
        </div>}

        <div className={`${(isTI || permissions.stories.add) ? 'lg:col-span-2' : ''} space-y-4`}>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" size={40} /></div>
          ) : stories.length === 0 ? (
            <p className="text-center text-slate-400 py-10">No hay historias publicadas aún.</p>
          ) : stories.map(story => (
            <div key={story.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start group hover:shadow-md transition-all">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-emerald-50 flex-shrink-0 border border-emerald-100">
                  {story.imageUrl ? (
                    <img loading="lazy" src={story.imageUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-emerald-600"><HeartPulse size={24} /></div>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-lg leading-tight">{story.patientName}</h3>
                  <div className="flex items-center gap-1 text-slate-400 mb-1">
                    <Calendar size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{formatDisplayDate(story.displayDate)}</span>
                  </div>
                  <p className="text-emerald-600 text-xs font-bold uppercase mb-2">{story.diagnosis}</p>
                  <p className="text-slate-600 italic text-sm leading-relaxed border-l-4 border-emerald-100 pl-3">
                    "{story.testimony}"
                  </p>
                </div>
              </div>
              {(isTI || permissions.stories.delete) && (
                <button onClick={() => handleDelete(story.id!, story.imageUrl)} className="text-slate-200 hover:text-rose-500 transition-colors p-2">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Stories;
