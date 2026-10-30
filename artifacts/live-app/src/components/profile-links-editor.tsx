import type { Dispatch, SetStateAction } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ProfileLink } from '@workspace/live-core';
import { Button, Select, TextField } from '@/ui';
import { MediaUpload } from './media-upload';
import { detectPlatform, PLATFORMS, PlatformIcon, type PlatformKey } from './social-icons';

export type LinkDraft = ProfileLink & { _key: string };
export const linkDraft = (link: ProfileLink): LinkDraft => ({ ...link, _key: crypto.randomUUID() });

export function ProfileLinksEditor({
  links,
  onChange,
  certificates = false,
  onBusyChange,
}: {
  links: LinkDraft[];
  onChange: Dispatch<SetStateAction<LinkDraft[]>>;
  certificates?: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const update = (key: string, patch: Partial<ProfileLink>) =>
    onChange(current => current.map(link => (link._key === key ? { ...link, ...patch } : link)));

  const handlePlatformChange = (key: string, platformKey: PlatformKey) => {
    const platform = PLATFORMS.find(p => p.key === platformKey);
    if (!platform) return;
    if (platformKey === 'other') {
      update(key, { label: '' });
    } else {
      update(key, { label: platform.label });
    }
  };

  return (
    <section className="profile-links-editor">
      <h3 className="text-title-lg">{certificates ? 'الشهادات والمؤهلات' : 'روابطك ومواقع التواصل'}</h3>
      <p className="text-body-sm text-on-surface-variant">
        {certificates ? 'أضف رابط الشهادة أو ارفع صورتها أو ملف PDF.' : 'اختر المنصة وضع رابط حسابك أو قناتك.'}{' '}
        تظهر للطلاب في ملفك العام بعد الحفظ.
      </p>

      {links.map((link, index) => {
        const platformKey = detectPlatform(link.label, link.url);
        const currentPlatform = PLATFORMS.find(p => p.key === platformKey) ?? PLATFORMS[PLATFORMS.length - 1]!;
        const isCustomName = platformKey === 'other' || !PLATFORMS.some(p => p.key !== 'other' && p.label === link.label);

        return (
          <div className="profile-link-row" key={link._key}>
            {certificates ? (
              <div className="flex items-end gap-2">
                <TextField
                  containerClassName="min-w-0 flex-1"
                  label={`اسم الشهادة ${index + 1}`}
                  value={link.label}
                  maxLength={100}
                  onChange={e => update(link._key, { label: e.target.value })}
                  placeholder="بكالوريوس العلوم التربوية"
                />
                <Button
                  type="button"
                  variant="danger-text"
                  size="sm"
                  aria-label={`حذف ${link.label || 'الشهادة'}`}
                  onClick={() => onChange(current => current.filter(item => item._key !== link._key))}
                >
                  <Trash2 />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 items-end gap-2">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface-container-high">
                      <PlatformIcon platform={platformKey} size={24} />
                    </div>
                    <Select
                      containerClassName="min-w-0 flex-1"
                      label={`المنصة ${index + 1}`}
                      value={platformKey}
                      options={PLATFORMS.map(p => ({ value: p.key, label: p.label }))}
                      onChange={e => handlePlatformChange(link._key, e.target.value as PlatformKey)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="danger-text"
                    size="sm"
                    aria-label={`حذف ${link.label || 'الرابط'}`}
                    onClick={() => onChange(current => current.filter(item => item._key !== link._key))}
                  >
                    <Trash2 />
                  </Button>
                </div>

                {isCustomName && (
                  <TextField
                    label="اسم مخصص للمنصة أو الرابط"
                    value={link.label}
                    maxLength={100}
                    onChange={e => update(link._key, { label: e.target.value })}
                    placeholder="مثال: صفحتي الرسمية، بودكاست..."
                  />
                )}
              </div>
            )}

            <TextField
              label={certificates ? 'رابط الشهادة' : 'الرابط'}
              type="url"
              ltr
              value={link.url}
              placeholder={certificates ? 'https://...' : currentPlatform.placeholder}
              onChange={e => update(link._key, { url: e.target.value, kind: 'link' })}
            />

            {certificates && (
              <MediaUpload
                purpose="certificate"
                value={link.url || null}
                imagePreview={link.kind === 'image'}
                onBusyChange={onBusyChange}
                onChange={(url, mime) =>
                  update(link._key, {
                    url: url ?? '',
                    kind: mime?.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'document' : 'link',
                  })
                }
              />
            )}
          </div>
        );
      })}

      {links.length < (certificates ? 12 : 8) && (
        <Button
          type="button"
          variant="tonal"
          size="sm"
          onClick={() =>
            onChange(current => [
              ...current,
              linkDraft(certificates ? { label: '', url: '', kind: 'link' } : { label: 'فيسبوك', url: '', kind: 'link' }),
            ])
          }
        >
          <Plus /> {certificates ? 'إضافة شهادة' : 'إضافة منصة أو رابط'}
        </Button>
      )}
    </section>
  );
}
