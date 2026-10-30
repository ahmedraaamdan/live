import type { Dispatch, SetStateAction } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ProfileLink } from '@workspace/live-core';
import { Button, TextField } from '@/ui';
import { MediaUpload } from './media-upload';
export type LinkDraft = ProfileLink & { _key: string };
export const linkDraft = (link: ProfileLink): LinkDraft => ({ ...link, _key: crypto.randomUUID() });
export function ProfileLinksEditor({ links, onChange, certificates = false, onBusyChange }: { links: LinkDraft[]; onChange: Dispatch<SetStateAction<LinkDraft[]>>; certificates?: boolean; onBusyChange: (busy: boolean) => void }) {
  const update = (key: string, patch: Partial<ProfileLink>) => onChange(current => current.map(link => link._key === key ? { ...link, ...patch } : link));
  return <section className="profile-links-editor">
    <h3 className="text-title-lg">{certificates ? 'الشهادات والمؤهلات' : 'روابطك ومواقع التواصل'}</h3>
    <p className="text-body-sm text-on-surface-variant">{certificates ? 'أضف رابط الشهادة أو ارفع صورتها أو ملف PDF.' : 'أضف صفحتك أو قناتك أو موقعك.'} تظهر للطلاب في ملفك العام بعد الحفظ.</p>
    {links.map((link, index) => <div className="profile-link-row" key={link._key}>
      <div className="flex items-end gap-2"><TextField containerClassName="min-w-0 flex-1" label={certificates ? `اسم الشهادة ${index + 1}` : `اسم الرابط ${index + 1}`} value={link.label} maxLength={100} onChange={e => update(link._key, { label: e.target.value })} placeholder={certificates ? 'بكالوريوس العلوم' : 'قناتي على YouTube'} /><Button type="button" variant="danger-text" size="sm" aria-label={`حذف ${link.label || 'الرابط'}`} onClick={() => onChange(current => current.filter(item => item._key !== link._key))}><Trash2 /></Button></div>
      <TextField label={certificates ? 'رابط الشهادة' : 'الرابط'} type="url" ltr value={link.url} placeholder="https://" onChange={e => update(link._key, { url: e.target.value, kind: 'link' })} />
      {certificates && <MediaUpload purpose="certificate" value={link.url || null} imagePreview={link.kind === 'image'} onBusyChange={onBusyChange} onChange={(url, mime) => update(link._key, { url: url ?? '', kind: mime?.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'document' : 'link' })} />}
    </div>)}
    {links.length < (certificates ? 12 : 8) && <Button type="button" variant="tonal" size="sm" onClick={() => onChange(current => [...current, linkDraft({ label: '', url: '', kind: 'link' })])}><Plus /> {certificates ? 'إضافة شهادة' : 'إضافة رابط'}</Button>}
  </section>;
}
