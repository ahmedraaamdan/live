import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Check, GraduationCap, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_GRADES, DEFAULT_SUBJECTS, setCatalog, type CatalogDTO, type CatalogItem } from '@workspace/live-core';
import { QueryError } from '@/components/query-error';
import { api, errorMessage } from '@/lib/api';
import { useCatalog } from '@/lib/catalog';
import { Badge, Banner, Button, Card, IconButton, List, ListItem, Page, PageSpinner, SectionHeader, Segmented, Sheet, TextField, TopBar, toast } from '@/ui';

type Kind = 'subjects' | 'grades';

function makeKey(rawKey: string, label: string, existingKeys: Set<string>, prefix: string): string {
  const cleaned = rawKey.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  if (cleaned && !existingKeys.has(cleaned)) return cleaned.slice(0, 40);
  const asciiFromLabel = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const base = (cleaned || asciiFromLabel || prefix).slice(0, 32);
  if (!existingKeys.has(base)) return base;
  let counter = 2;
  while (existingKeys.has(`${base}_${counter}`)) counter++;
  return `${base}_${counter}`;
}

export function AdminCatalog() {
  const qc = useQueryClient();
  const { subjects, grades, isLoading, isError, error, refetch } = useCatalog();
  const [tab, setTab] = useState<Kind>('subjects');
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ kind: Kind; item: CatalogItem; label: string } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: Kind; item: CatalogItem } | null>(null);
  const [confirmReset, setConfirmReset] = useState<Kind | null>(null);

  const save = useMutation({
    mutationFn: (body: CatalogDTO) => api<CatalogDTO>('/admin/catalog', { method: 'PUT', body }),
    onSuccess: (data) => {
      setCatalog(data);
      qc.setQueryData(['catalog'], data);
      void qc.invalidateQueries({ queryKey: ['catalog'] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast('حُفظت التعديلات');
    },
    onError: (e) => toast(errorMessage(e)),
  });

  if (isLoading) return <PageSpinner />;
  if (isError) return <><TopBar title="الصفوف والمواد" large /><Page><QueryError error={error} retry={refetch} /></Page></>;

  const activeItems = tab === 'subjects' ? subjects : grades;
  const itemNoun = tab === 'subjects' ? 'المادة' : 'الصف';

  const commitList = (kind: Kind, nextList: CatalogItem[]) => {
    save.mutate({
      subjects: kind === 'subjects' ? nextList : subjects,
      grades: kind === 'grades' ? nextList : grades,
    });
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (label.length < 2) {
      setFormError(`اكتب اسم ${itemNoun} (حرفين على الأقل)`);
      return;
    }
    if (activeItems.some((it) => it.label === label)) {
      setFormError(`هذا الاسم موجود بالفعل في القائمة`);
      return;
    }
    const existingKeys = new Set(activeItems.map((it) => it.key));
    if (newKey.trim() && !/^[a-z0-9_-]+$/i.test(newKey.trim())) {
      setFormError('الكود الاختياري يقبل حروف إنجليزي وأرقام وشرطة فقط');
      return;
    }
    if (newKey.trim() && existingKeys.has(newKey.trim().toLowerCase())) {
      setFormError('هذا الكود مستخدم بالفعل');
      return;
    }
    const key = makeKey(newKey, label, existingKeys, tab === 'subjects' ? 'subject' : 'grade');
    const nextItem: CatalogItem = { key, label };
    const otherIndex = activeItems.findIndex((it) => it.key === 'other');
    const nextList =
      otherIndex >= 0
        ? [...activeItems.slice(0, otherIndex), nextItem, ...activeItems.slice(otherIndex)]
        : [...activeItems, nextItem];
    setFormError(null);
    setNewLabel('');
    setNewKey('');
    commitList(tab, nextList);
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= activeItems.length) return;
    const nextList = [...activeItems];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(target, 0, moved!);
    commitList(tab, nextList);
  };

  const handleEditSave = () => {
    if (!editing) return;
    const label = editing.label.trim();
    if (label.length < 2) {
      toast('اكتب الاسم بالعربي (حرفين على الأقل)');
      return;
    }
    const source = editing.kind === 'subjects' ? subjects : grades;
    const nextList = source.map((it) => (it.key === editing.item.key ? { ...it, label } : it));
    setEditing(null);
    commitList(editing.kind, nextList);
  };

  const handleDeleteConfirm = () => {
    if (!deleting) return;
    const source = deleting.kind === 'subjects' ? subjects : grades;
    if (source.length <= 1) {
      toast('لا يمكن حذف آخر عنصر في القائمة');
      setDeleting(null);
      return;
    }
    const nextList = source.filter((it) => it.key !== deleting.item.key);
    const kind = deleting.kind;
    setDeleting(null);
    commitList(kind, nextList);
  };

  const handleResetConfirm = () => {
    if (!confirmReset) return;
    const kind = confirmReset;
    const nextList = (kind === 'subjects' ? DEFAULT_SUBJECTS : DEFAULT_GRADES).map((it) => ({ ...it }));
    setConfirmReset(null);
    commitList(kind, nextList);
  };

  return (
    <>
      <TopBar title="الصفوف والمواد" large subtitle="إدارة المواد والمراحل الدراسية المتاحة للمدرسين والطلاب" />
      <Page wide>
        <div className="mb-6 max-w-md">
          <Segmented
            ariaLabel="اختيار القائمة"
            value={tab}
            onChange={(v) => {
              setTab(v);
              setFormError(null);
            }}
            options={[
              { value: 'subjects', label: `المواد (${subjects.length})`, icon: <BookOpen /> },
              { value: 'grades', label: `الصفوف (${grades.length})`, icon: <GraduationCap /> },
            ]}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
          <Card className="flex flex-col gap-4">
            <SectionHeader title={tab === 'subjects' ? 'إضافة مادة جديدة' : 'إضافة صف دراسي جديد'} className="mb-0" />
            <form onSubmit={handleAdd} className="flex flex-col gap-4" noValidate>
              {formError && <Banner tone="error">{formError}</Banner>}
              <TextField
                label={`اسم ${itemNoun} بالعربي`}
                placeholder={tab === 'subjects' ? 'مثال: دراسات اجتماعية، تربية وطنية' : 'مثال: أولى ابتدائي، تمهيدي'}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                maxLength={60}
              />
              <TextField
                label="الكود التعريفي (اختياري)"
                placeholder={tab === 'subjects' ? 'social_studies' : 'p1'}
                hint="اتركه فارغًا لإنشائه تلقائيًا، أو اكتب كودًا بحروف إنجليزية"
                ltr
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                maxLength={40}
              />
              <Button type="submit" block loading={save.isPending}>
                <Plus /> {tab === 'subjects' ? 'إضافة المادة' : 'إضافة الصف'}
              </Button>
            </form>
          </Card>

          <section className="min-w-0">
            <SectionHeader
              title={tab === 'subjects' ? `قائمة المواد الدراسية (${subjects.length})` : `قائمة الصفوف الدراسية (${grades.length})`}
              action={
                <Button variant="text" size="sm" disabled={save.isPending} onClick={() => setConfirmReset(tab)}>
                  <RotateCcw /> استعادة الافتراضي
                </Button>
              }
            />
            <List>
              {activeItems.map((item, idx) => (
                <ListItem
                  key={item.key}
                  leading={
                    <Badge tone="primary" className="font-num min-w-7 justify-center">
                      {idx + 1}
                    </Badge>
                  }
                  title={item.label}
                  subtitle={
                    <span className="font-num text-xs text-on-surface-variant" dir="ltr">
                      {item.key}
                    </span>
                  }
                  trailing={
                    <div className="flex items-center gap-1">
                      <IconButton
                        size="sm"
                        label={`تحريك ${item.label} لأعلى`}
                        disabled={idx === 0 || save.isPending}
                        onClick={() => handleMove(idx, -1)}
                      >
                        <ArrowUp />
                      </IconButton>
                      <IconButton
                        size="sm"
                        label={`تحريك ${item.label} لأسفل`}
                        disabled={idx === activeItems.length - 1 || save.isPending}
                        onClick={() => handleMove(idx, 1)}
                      >
                        <ArrowDown />
                      </IconButton>
                      <IconButton
                        size="sm"
                        label={`تعديل ${item.label}`}
                        disabled={save.isPending}
                        onClick={() => setEditing({ kind: tab, item, label: item.label })}
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton
                        size="sm"
                        label={`حذف ${item.label}`}
                        disabled={activeItems.length <= 1 || save.isPending}
                        onClick={() => setDeleting({ kind: tab, item })}
                      >
                        <Trash2 className="text-error" />
                      </IconButton>
                    </div>
                  }
                />
              ))}
            </List>
          </section>
        </div>
      </Page>

      <Sheet
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? `تعديل ${editing.kind === 'subjects' ? 'المادة' : 'الصف'}` : ''}
        description={editing ? `الكود التعريفي: ${editing.item.key}` : undefined}
        footer={
          <>
            <Button variant="tonal" onClick={() => setEditing(null)}>
              إلغاء
            </Button>
            <Button loading={save.isPending} onClick={handleEditSave}>
              <Check /> حفظ التعديل
            </Button>
          </>
        }
      >
        {editing && (
          <TextField
            label="الاسم بالعربي"
            value={editing.label}
            onChange={(e) => setEditing({ ...editing, label: e.target.value })}
            maxLength={60}
            autoFocus
          />
        )}
      </Sheet>

      <Sheet
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `حذف «${deleting.item.label}»؟` : ''}
        description="سيختفي هذا الخيار من قوائم الاختيار الجديدة، مع بقاء الحصص والحسابات السابقة كما هي."
        footer={
          <>
            <Button variant="tonal" onClick={() => setDeleting(null)}>
              إلغاء
            </Button>
            <Button variant="danger" loading={save.isPending} onClick={handleDeleteConfirm}>
              <Trash2 /> حذف
            </Button>
          </>
        }
      >
        <div />
      </Sheet>

      <Sheet
        open={Boolean(confirmReset)}
        onOpenChange={(open) => !open && setConfirmReset(null)}
        title={confirmReset === 'subjects' ? 'استعادة قائمة المواد الافتراضية؟' : 'استعادة قائمة الصفوف الافتراضية؟'}
        description="سيُعاد ضبط القائمة إلى الإعدادات الافتراضية للمنصة."
        footer={
          <>
            <Button variant="tonal" onClick={() => setConfirmReset(null)}>
              إلغاء
            </Button>
            <Button loading={save.isPending} onClick={handleResetConfirm}>
              <RotateCcw /> استعادة الافتراضي
            </Button>
          </>
        }
      >
        <div />
      </Sheet>
    </>
  );
}
