import { useRef, useState } from 'react';
import { Camera, ExternalLink, FileImage, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { errorMessage, uploadFile } from '@/lib/api';
import { Button, toast } from '@/ui';

export async function prepareImage(file: File, maxSide: number) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر تجهيز الصورة');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('تعذر قراءة الصورة. استخدم JPEG أو PNG.')), 'image/jpeg', .88));
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally { URL.revokeObjectURL(url); }
}
export function MediaUpload({ value, onChange, purpose = 'cover', imagePreview = true, onBusyChange }: { value: string | null; onChange: (url: string | null, mime?: string) => void; purpose?: 'avatar' | 'cover' | 'certificate'; imagePreview?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const label = purpose === 'avatar' ? 'الصورة الشخصية' : purpose === 'cover' ? 'غلاف الحصة' : 'ملف الشهادة';
  const choose = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true); onBusyChange?.(true);
    try {
      if (file.size > (file.type.startsWith('image/') ? 25 : 12) * 1024 * 1024) throw new Error('الملف كبير جدًا. اختر صورة أصغر أو PDF حتى 12 ميغابايت.');
      const prepared = file.type.startsWith('image/') ? await prepareImage(file, purpose === 'avatar' ? 600 : purpose === 'cover' ? 1800 : 2400) : file;
      const uploaded = await uploadFile(prepared);
      onChange(uploaded.url, uploaded.mime);
      toast('رُفع الملف. احفظ التغييرات لنشره.');
    } catch (error) { toast(errorMessage(error)); }
    finally { setBusy(false); onBusyChange?.(false); if (input.current) input.current.value = ''; }
  };
  return <div className={`profile-media profile-media-${purpose}`} aria-busy={busy}>
    <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label={`رفع ${label}`} accept={`image/png,image/jpeg,image/webp,image/heic,image/heif${purpose === 'certificate' ? ',application/pdf' : ''}`} onChange={e => void choose(e.target.files?.[0])} />
    {value && imagePreview && <img className="profile-media-preview" src={value} alt={label} loading="lazy" />}
    {!value && <div className="profile-media-placeholder" aria-hidden="true">{purpose === 'avatar' ? <Camera /> : <ImagePlus />}</div>}
    <div className="profile-media-actions">
      <Button type="button" variant="tonal" size="sm" loading={busy} onClick={() => input.current?.click()}><FileImage /> {value ? 'تغيير الملف' : `رفع ${label}`}</Button>
      {value && <><a href={value} target="_blank" rel="noopener noreferrer" className="profile-file-link"><ExternalLink size={16} /> فتح</a><Button type="button" variant="danger-text" size="sm" disabled={busy} onClick={() => onChange(null)} aria-label={`إزالة ${label}`}><Trash2 /></Button></>}
      {busy && <span className="text-body-sm" role="status">جارٍ تجهيز الملف ورفعه…</span>}
    </div>
    {purpose === 'cover' && <p className="text-body-sm text-on-surface-variant">صورة أفقية تناسب الحصة. تُضغط تلقائيًا لسرعة العرض على الهاتف.</p>}
  </div>;
}
