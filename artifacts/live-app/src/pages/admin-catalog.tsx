import { useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  BookOpen,
  Building2,
  Check,
  Coins,
  Globe,
  GraduationCap,
  Layers,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CURRENCIES,
  CURRICULUMS,
  DEFAULT_CURRENCIES,
  DEFAULT_CURRICULUMS,
  DEFAULT_GRADES,
  DEFAULT_SUBJECTS,
  setCatalog,
  type CatalogDTO,
  type CatalogItem,
  type CurriculumConfig,
  type CurrencyConfig,
} from '@workspace/live-core';
import { QueryError } from '@/components/query-error';
import { api, errorMessage } from '@/lib/api';
import { useCatalog } from '@/lib/catalog';
import {
  ActionMenu,
  Badge,
  Banner,
  Button,
  Card,
  IconButton,
  List,
  ListItem,
  Page,
  PageSpinner,
  SectionHeader,
  Segmented,
  Select,
  Sheet,
  TextField,
  TopBar,
  toast,
} from '@/ui';

type AdminTab = 'curriculums' | 'curriculum_items' | 'currencies' | 'general';
type LegacyKind = 'subjects' | 'grades';

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
  const { subjects, grades, curriculums, currencies, isLoading, isError, error, refetch } = useCatalog();

  const [activeTab, setActiveTab] = useState<AdminTab>('curriculums');

  // Selected curriculum in "مواد وصفوف المنهج"
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string>('egypt_general');

  // State for Add Curriculum
  const [newCurriculum, setNewCurriculum] = useState({ name: '', id: '', country: 'EG', description: '' });
  const [curriculumError, setCurriculumError] = useState<string | null>(null);

  // State for Add Subject/Grade to a Curriculum
  const [newCurriculumSubject, setNewCurriculumSubject] = useState({ label: '', key: '' });
  const [newCurriculumGrade, setNewCurriculumGrade] = useState({ label: '', key: '' });
  const [curriculumItemError, setCurriculumItemError] = useState<string | null>(null);

  // State for Add/Edit Currency
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '', minPaid: '20', minPayout: '50' });
  const [currencyError, setCurrencyError] = useState<string | null>(null);

  // Legacy tab state (general subjects / grades)
  const [legacyTab, setLegacyTab] = useState<LegacyKind>('subjects');
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ kind: LegacyKind; item: CatalogItem; label: string } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: LegacyKind; item: CatalogItem } | null>(null);

  const save = useMutation({
    mutationFn: (body: CatalogDTO) => api<CatalogDTO>('/admin/catalog', { method: 'PUT', body }),
    onSuccess: (data) => {
      setCatalog(data);
      qc.setQueryData(['catalog'], data);
      void qc.invalidateQueries({ queryKey: ['catalog'] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast('حُفظت التعديلات بنجاح');
    },
    onError: (e) => toast(errorMessage(e)),
  });

  if (isLoading) return <PageSpinner />;
  if (isError) return <><TopBar title="إدارة المناهج والعملات والمواد" large /><Page><QueryError error={error} retry={refetch} /></Page></>;

  const currentCurriculumList = curriculums.length > 0 ? curriculums : CURRICULUMS;
  const currentCurrencyList = currencies.length > 0 ? currencies : CURRENCIES;
  const activeCurriculum = currentCurriculumList.find((c) => c.id === selectedCurriculumId) ?? currentCurriculumList[0];

  const persistCatalog = (nextCurriculums?: CurriculumConfig[], nextCurrencies?: CurrencyConfig[], nextSubjects?: CatalogItem[], nextGrades?: CatalogItem[]) => {
    save.mutate({
      subjects: nextSubjects ?? subjects,
      grades: nextGrades ?? grades,
      curriculums: nextCurriculums ?? currentCurriculumList,
      currencies: nextCurrencies ?? currentCurrencyList,
    });
  };

  /* -------------------------------------------------------------------------- */
  /*                            1. إدارة المناهج                                */
  /* -------------------------------------------------------------------------- */
  const handleAddCurriculum = (e: FormEvent) => {
    e.preventDefault();
    const name = newCurriculum.name.trim();
    if (name.length < 2) { setCurriculumError('أدخل اسم المنهج (حرفين على الأقل)'); return; }
    const id = newCurriculum.id.trim().toLowerCase() || makeKey('', name, new Set(currentCurriculumList.map((c) => c.id)), 'curr');
    if (currentCurriculumList.some((c) => c.id === id)) { setCurriculumError('كود المنهج مستخدم بالفعل'); return; }

    const created: CurriculumConfig = {
      id,
      name,
      country: newCurriculum.country.trim().toUpperCase() || 'ALL',
      description: newCurriculum.description.trim() || `منهج ${name}`,
      stages: [
        {
          id: `${id}_stage_1`,
          name: 'المرحلة الأساسية',
          grades: [{ key: `${id}_g1`, label: 'الصف الأول' }],
        },
      ],
      subjects: [
        { key: `${id}_arabic`, label: 'لغة عربية' },
        { key: `${id}_math`, label: 'رياضيات' },
      ],
    };

    const nextList = [...currentCurriculumList, created];
    setCurriculumError(null);
    setNewCurriculum({ name: '', id: '', country: 'EG', description: '' });
    persistCatalog(nextList);
    setSelectedCurriculumId(created.id);
  };

  const handleDeleteCurriculum = (curriculumId: string) => {
    if (currentCurriculumList.length <= 1) { toast('لا يمكن حذف كل المناهج'); return; }
    const nextList = currentCurriculumList.filter((c) => c.id !== curriculumId);
    persistCatalog(nextList);
    if (selectedCurriculumId === curriculumId) {
      setSelectedCurriculumId(nextList[0]?.id ?? '');
    }
    toast('تم حذف المنهج');
  };

  /* -------------------------------------------------------------------------- */
  /*                      2. إدارة مواد وصفوف المنهج                           */
  /* -------------------------------------------------------------------------- */
  const handleAddSubjectToCurriculum = (e: FormEvent) => {
    e.preventDefault();
    if (!activeCurriculum) return;
    const label = newCurriculumSubject.label.trim();
    if (label.length < 2) { setCurriculumItemError('أدخل اسم المادة (حرفين على الأقل)'); return; }
    const key = newCurriculumSubject.key.trim().toLowerCase() || makeKey('', label, new Set(activeCurriculum.subjects.map((s) => s.key)), 'sub');

    if (activeCurriculum.subjects.some((s) => s.key === key)) {
      setCurriculumItemError('هذه المادة موجودة بالفعل في هذا المنهج'); return;
    }

    const updatedCurriculum: CurriculumConfig = {
      ...activeCurriculum,
      subjects: [...activeCurriculum.subjects, { key, label }],
    };

    const nextList = currentCurriculumList.map((c) => (c.id === activeCurriculum.id ? updatedCurriculum : c));
    setCurriculumItemError(null);
    setNewCurriculumSubject({ label: '', key: '' });
    persistCatalog(nextList);
  };

  const handleDeleteSubjectFromCurriculum = (subKey: string) => {
    if (!activeCurriculum) return;
    if (activeCurriculum.subjects.length <= 1) { toast('يجب إبقاء مادة واحدة على الأقل'); return; }
    const updatedCurriculum: CurriculumConfig = {
      ...activeCurriculum,
      subjects: activeCurriculum.subjects.filter((s) => s.key !== subKey),
    };
    const nextList = currentCurriculumList.map((c) => (c.id === activeCurriculum.id ? updatedCurriculum : c));
    persistCatalog(nextList);
    toast('تمت إزالة المادة من المنهج');
  };

  const handleAddGradeToCurriculum = (e: FormEvent) => {
    e.preventDefault();
    if (!activeCurriculum) return;
    const label = newCurriculumGrade.label.trim();
    if (label.length < 2) { setCurriculumItemError('أدخل اسم الصف (حرفين على الأقل)'); return; }
    const key = newCurriculumGrade.key.trim().toLowerCase() || makeKey('', label, new Set(activeCurriculum.stages.flatMap((s) => s.grades.map((g) => g.key))), 'gr');

    const firstStage = activeCurriculum.stages[0] || { id: 'default', name: 'المرحلة الدراسية', grades: [] };
    const updatedFirstStage = {
      ...firstStage,
      grades: [...firstStage.grades, { key, label }],
    };

    const updatedCurriculum: CurriculumConfig = {
      ...activeCurriculum,
      stages: activeCurriculum.stages.length > 0 ? [updatedFirstStage, ...activeCurriculum.stages.slice(1)] : [updatedFirstStage],
    };

    const nextList = currentCurriculumList.map((c) => (c.id === activeCurriculum.id ? updatedCurriculum : c));
    setCurriculumItemError(null);
    setNewCurriculumGrade({ label: '', key: '' });
    persistCatalog(nextList);
  };

  /* -------------------------------------------------------------------------- */
  /*                            3. إدارة العملات                                */
  /* -------------------------------------------------------------------------- */
  const handleAddCurrency = (e: FormEvent) => {
    e.preventDefault();
    const code = newCurrency.code.trim().toUpperCase();
    const name = newCurrency.name.trim();
    const symbol = newCurrency.symbol.trim() || code;
    if (!code || code.length < 3) { setCurrencyError('أدخل كود العملة (3 أحرف إنجليزية مثل USD)'); return; }
    if (!name) { setCurrencyError('أدخل اسم العملة بالعربي'); return; }
    if (currentCurrencyList.some((c) => c.code === code)) { setCurrencyError('هذه العملة مضافة بالفعل'); return; }

    const minPaid = Math.round(Number(newCurrency.minPaid || 1) * 100);
    const minPayout = Math.round(Number(newCurrency.minPayout || 5) * 100);

    const created: CurrencyConfig = {
      code,
      name,
      symbol,
      minPaidPriceCents: minPaid,
      minPayoutCents: minPayout,
    };

    const nextList = [...currentCurrencyList, created];
    setCurrencyError(null);
    setNewCurrency({ code: '', name: '', symbol: '', minPaid: '20', minPayout: '50' });
    persistCatalog(undefined, nextList);
  };

  const handleDeleteCurrency = (code: string) => {
    if (currentCurrencyList.length <= 1) { toast('لا يمكن حذف كل العملات'); return; }
    if (code === 'EGP') { toast('لا يمكن حذف الجنيه المصري كعملة أساسية'); return; }
    const nextList = currentCurrencyList.filter((c) => c.code !== code);
    persistCatalog(undefined, nextList);
    toast('تم حذف العملة');
  };

  /* -------------------------------------------------------------------------- */
  /*                          4. الكتالوج العام المسطح                          */
  /* -------------------------------------------------------------------------- */
  const activeItems = legacyTab === 'subjects' ? subjects : grades;
  const itemNoun = legacyTab === 'subjects' ? 'المادة' : 'الصف';

  const commitLegacyList = (kind: LegacyKind, nextList: CatalogItem[]) => {
    persistCatalog(
      undefined,
      undefined,
      kind === 'subjects' ? nextList : subjects,
      kind === 'grades' ? nextList : grades
    );
  };

  const handleAddLegacy = (e: FormEvent) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (label.length < 2) { setFormError(`اكتب اسم ${itemNoun} (حرفين على الأقل)`); return; }
    if (activeItems.some((it) => it.label === label)) { setFormError('هذا الاسم موجود بالفعل في القائمة'); return; }
    const existingKeys = new Set(activeItems.map((it) => it.key));
    const key = makeKey(newKey, label, existingKeys, legacyTab === 'subjects' ? 'subject' : 'grade');
    const nextItem: CatalogItem = { key, label };
    const nextList = [...activeItems, nextItem];
    setFormError(null);
    setNewLabel('');
    setNewKey('');
    commitLegacyList(legacyTab, nextList);
  };

  const handleMoveLegacy = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= activeItems.length) return;
    const nextList = [...activeItems];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(target, 0, moved!);
    commitLegacyList(legacyTab, nextList);
  };

  return (
    <>
      <TopBar title="المناهج والمواد والعملات" large subtitle="التحكم الكامل بأنظمة التعليم والمواد والصفوف والعملات في المنصة" />
      <Page wide>
        {/* التبويبات الرئيسية */}
        <div className="mb-6 flex overflow-x-auto pb-2 scrollbar-none">
          <Segmented
            ariaLabel="التحكم بالكتالوج"
            value={activeTab}
            onChange={(v) => setActiveTab(v)}
            options={[
              { value: 'curriculums', label: `المناهج والأنظمة (${currentCurriculumList.length})`, icon: <Building2 /> },
              { value: 'curriculum_items', label: 'مواد وصفوف المنهج', icon: <BookOpen /> },
              { value: 'currencies', label: `العملات والتسعير (${currentCurrencyList.length})`, icon: <Coins /> },
              { value: 'general', label: 'الكتالوج العام', icon: <Layers /> },
            ]}
          />
        </div>

        {/* ========================================================================= */}
        {/*                           تبويب 1: المناهج الدراسية                       */}
        {/* ========================================================================= */}
        {activeTab === 'curriculums' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
            {/* نموذج إضافة منهج جديد */}
            <Card className="flex flex-col gap-4">
              <SectionHeader title="إضافة منهج دراسي جديد" className="mb-0" />
              <form onSubmit={handleAddCurriculum} className="flex flex-col gap-4" noValidate>
                {curriculumError && <Banner tone="error">{curriculumError}</Banner>}
                <TextField
                  label="اسم المنهج بالعربي"
                  placeholder="مثال: المنهج البحريني، البكالوريا الدولية"
                  value={newCurriculum.name}
                  onChange={(e) => setNewCurriculum({ ...newCurriculum, name: e.target.value })}
                />
                <TextField
                  label="كود المنهج (إنجليزي)"
                  placeholder="bahrain_general"
                  ltr
                  value={newCurriculum.id}
                  onChange={(e) => setNewCurriculum({ ...newCurriculum, id: e.target.value })}
                  hint="اتركه فارغاً لإنشائه تلقائياً"
                />
                <TextField
                  label="كود الدولة (حرفين)"
                  placeholder="BH أو QA أو EG أو ALL"
                  ltr
                  maxLength={5}
                  value={newCurriculum.country}
                  onChange={(e) => setNewCurriculum({ ...newCurriculum, country: e.target.value })}
                />
                <TextField
                  label="وصف المنهج"
                  placeholder="مناهج وزارة التربية والتعليم الرسمية..."
                  value={newCurriculum.description}
                  onChange={(e) => setNewCurriculum({ ...newCurriculum, description: e.target.value })}
                />
                <Button type="submit" block loading={save.isPending}>
                  <Plus /> إضافة المنهج الدراسي
                </Button>
              </form>
            </Card>

            {/* قائمة المناهج المعتمدة */}
            <section className="min-w-0">
              <SectionHeader
                title={`المناهج والأنظمة المعتمدة (${currentCurriculumList.length})`}
                action={
                  <Button
                    variant="text"
                    size="sm"
                    disabled={save.isPending}
                    onClick={() => {
                      persistCatalog(DEFAULT_CURRICULUMS);
                      toast('تمت استعادة المناهج الافتراضية');
                    }}
                  >
                    <RotateCcw /> استعادة الافتراضي
                  </Button>
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {currentCurriculumList.map((cur) => (
                  <Card key={cur.id} className="flex flex-col justify-between gap-3 p-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-title-md">{cur.name}</span>
                        <Badge tone="primary">{cur.country}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-body-sm text-on-surface-variant">{cur.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-caption text-on-surface-variant">
                        <span className="rounded bg-surface-container-high px-2 py-0.5">
                          {cur.stages.length} مراحل
                        </span>
                        <span className="rounded bg-surface-container-high px-2 py-0.5">
                          {cur.stages.flatMap((s) => s.grades).length} صفوف
                        </span>
                        <span className="rounded bg-surface-container-high px-2 py-0.5">
                          {cur.subjects.length} مواد
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-outline-variant/30 pt-3">
                      <Button
                        variant="tonal"
                        size="sm"
                        onClick={() => {
                          setSelectedCurriculumId(cur.id);
                          setActiveTab('curriculum_items');
                        }}
                      >
                        <BookOpen /> تعديل مواده وصفوفه
                      </Button>
                      <IconButton
                        size="sm"
                        label="حذف المنهج"
                        disabled={save.isPending || currentCurriculumList.length <= 1}
                        onClick={() => handleDeleteCurriculum(cur.id)}
                      >
                        <Trash2 className="text-error" />
                      </IconButton>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/*                       تبويب 2: مواد وصفوف المنهج                          */}
        {/* ========================================================================= */}
        {activeTab === 'curriculum_items' && (
          <div className="flex flex-col gap-6">
            {/* اختيار المنهج النشط */}
            <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="text-label-md text-on-surface-variant">المنهج الدراسي الحالي:</span>
                <h3 className="text-title-lg font-bold">{activeCurriculum?.name}</h3>
              </div>
              <div className="w-full md:w-72">
                <Select
                  value={selectedCurriculumId}
                  onChange={(e) => setSelectedCurriculumId(e.target.value)}
                  options={currentCurriculumList.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.country})`,
                  }))}
                />
              </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* قسم المواد التابعة لهذا المنهج */}
              <div className="flex flex-col gap-4">
                <Card className="flex flex-col gap-4">
                  <SectionHeader title={`إضافة مادة لـ (${activeCurriculum?.name})`} className="mb-0" />
                  <form onSubmit={handleAddSubjectToCurriculum} className="flex flex-col gap-3" noValidate>
                    {curriculumItemError && <Banner tone="error">{curriculumItemError}</Banner>}
                    <TextField
                      label="اسم المادة بالعربي"
                      placeholder="مثال: الأحياء وعلم البيئة، التجويد النظري"
                      value={newCurriculumSubject.label}
                      onChange={(e) => setNewCurriculumSubject({ ...newCurriculumSubject, label: e.target.value })}
                    />
                    <TextField
                      label="الكود التعريفي (اختياري)"
                      placeholder="biology"
                      ltr
                      value={newCurriculumSubject.key}
                      onChange={(e) => setNewCurriculumSubject({ ...newCurriculumSubject, key: e.target.value })}
                    />
                    <Button type="submit" block loading={save.isPending}>
                      <Plus /> إضافة المادة للمنهج
                    </Button>
                  </form>
                </Card>

                <Card>
                  <SectionHeader title={`مواد هذا المنهج (${activeCurriculum?.subjects.length})`} />
                  <List>
                    {activeCurriculum?.subjects.map((sub, idx) => (
                      <ListItem
                        key={sub.key}
                        leading={<Badge tone="primary">{idx + 1}</Badge>}
                        title={sub.label}
                        subtitle={<span dir="ltr" className="text-caption text-on-surface-variant font-num">{sub.key}</span>}
                        trailing={
                          <IconButton
                            size="sm"
                            label="حذف المادة"
                            disabled={save.isPending || activeCurriculum.subjects.length <= 1}
                            onClick={() => handleDeleteSubjectFromCurriculum(sub.key)}
                          >
                            <Trash2 className="text-error" />
                          </IconButton>
                        }
                      />
                    ))}
                  </List>
                </Card>
              </div>

              {/* قسم المراحل والصفوف التابعة لهذا المنهج */}
              <div className="flex flex-col gap-4">
                <Card className="flex flex-col gap-4">
                  <SectionHeader title="إضافة صف دراسي لهذا المنهج" className="mb-0" />
                  <form onSubmit={handleAddGradeToCurriculum} className="flex flex-col gap-3" noValidate>
                    <TextField
                      label="اسم الصف الدراسي بالعربي"
                      placeholder="مثال: الصف الحادي عشر، أولى متوسط"
                      value={newCurriculumGrade.label}
                      onChange={(e) => setNewCurriculumGrade({ ...newCurriculumGrade, label: e.target.value })}
                    />
                    <TextField
                      label="الكود التعريفي (اختياري)"
                      placeholder="g11"
                      ltr
                      value={newCurriculumGrade.key}
                      onChange={(e) => setNewCurriculumGrade({ ...newCurriculumGrade, key: e.target.value })}
                    />
                    <Button type="submit" block loading={save.isPending}>
                      <Plus /> إضافة الصف للمنهج
                    </Button>
                  </form>
                </Card>

                <Card>
                  <SectionHeader title="المراحل والصفوف الحالية" />
                  <div className="flex flex-col gap-4">
                    {activeCurriculum?.stages.map((stage) => (
                      <div key={stage.id} className="rounded-lg border border-outline-variant/40 p-3">
                        <span className="font-bold text-title-sm text-primary">{stage.name}</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {stage.grades.map((gr) => (
                            <Badge key={gr.key} tone="outline" className="text-body-sm">
                              {gr.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/*                            تبويب 3: العملات والتسعير                      */}
        {/* ========================================================================= */}
        {activeTab === 'currencies' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
            <Card className="flex flex-col gap-4">
              <SectionHeader title="إضافة عملة جديدة" className="mb-0" />
              <form onSubmit={handleAddCurrency} className="flex flex-col gap-4" noValidate>
                {currencyError && <Banner tone="error">{currencyError}</Banner>}
                <TextField
                  label="كود العملة الدولي (3 أحرف)"
                  placeholder="KWD أو USD أو EUR"
                  ltr
                  maxLength={5}
                  value={newCurrency.code}
                  onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value })}
                />
                <TextField
                  label="اسم العملة بالعربي"
                  placeholder="دينار كويتي، يورو..."
                  value={newCurrency.name}
                  onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                />
                <TextField
                  label="الرمز المعروض"
                  placeholder="د.ك أو € أو $"
                  value={newCurrency.symbol}
                  onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="أقل سعر حصة"
                    type="number"
                    value={newCurrency.minPaid}
                    onChange={(e) => setNewCurrency({ ...newCurrency, minPaid: e.target.value })}
                  />
                  <TextField
                    label="أقل سحب للمعلم"
                    type="number"
                    value={newCurrency.minPayout}
                    onChange={(e) => setNewCurrency({ ...newCurrency, minPayout: e.target.value })}
                  />
                </div>
                <Button type="submit" block loading={save.isPending}>
                  <Plus /> إضافة العملة
                </Button>
              </form>
            </Card>

            <section className="min-w-0">
              <SectionHeader
                title={`العملات المدعومة في المنصة (${currentCurrencyList.length})`}
                action={
                  <Button
                    variant="text"
                    size="sm"
                    disabled={save.isPending}
                    onClick={() => {
                      persistCatalog(undefined, DEFAULT_CURRENCIES);
                      toast('تمت استعادة العملات الافتراضية');
                    }}
                  >
                    <RotateCcw /> استعادة الافتراضي
                  </Button>
                }
              />
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {currentCurrencyList.map((curr) => (
                  <Card key={curr.code} className="flex flex-col justify-between p-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-title-lg font-num" dir="ltr">{curr.code}</span>
                        <Badge tone="secondary" className="font-bold">{curr.symbol}</Badge>
                      </div>
                      <p className="mt-1 text-title-sm">{curr.name}</p>
                      <div className="mt-3 flex flex-col gap-1 text-caption text-on-surface-variant font-num">
                        <span>أقل سعر حصة: {curr.minPaidPriceCents / 100} {curr.symbol}</span>
                        <span>أقل سحب للمعلم: {curr.minPayoutCents / 100} {curr.symbol}</span>
                      </div>
                    </div>
                    {curr.code !== 'EGP' && (
                      <div className="mt-3 border-t border-outline-variant/30 pt-2 text-end">
                        <Button
                          variant="text"
                          size="sm"
                          disabled={save.isPending}
                          onClick={() => handleDeleteCurrency(curr.code)}
                        >
                          <Trash2 className="text-error" /> حذف العملة
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/*                       تبويب 4: الكتالوج العام القديم                       */}
        {/* ========================================================================= */}
        {activeTab === 'general' && (
          <div>
            <div className="mb-6 max-w-md">
              <Segmented
                ariaLabel="اختيار القائمة العامة"
                value={legacyTab}
                onChange={(v) => {
                  setLegacyTab(v);
                  setFormError(null);
                }}
                options={[
                  { value: 'subjects', label: `المواد العامة (${subjects.length})`, icon: <BookOpen /> },
                  { value: 'grades', label: `الصفوف العامة (${grades.length})`, icon: <GraduationCap /> },
                ]}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
              <Card className="flex flex-col gap-4">
                <SectionHeader title={legacyTab === 'subjects' ? 'إضافة مادة عامة' : 'إضافة صف عام'} className="mb-0" />
                <form onSubmit={handleAddLegacy} className="flex flex-col gap-4" noValidate>
                  {formError && <Banner tone="error">{formError}</Banner>}
                  <TextField
                    label={`اسم ${itemNoun} بالعربي`}
                    placeholder="مثال: تربية وطنية، أولى ابتدائي"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                  <TextField
                    label="الكود التعريفي (اختياري)"
                    placeholder="code"
                    ltr
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                  <Button type="submit" block loading={save.isPending}>
                    <Plus /> إضافة
                  </Button>
                </form>
              </Card>

              <section className="min-w-0">
                <SectionHeader
                  title={legacyTab === 'subjects' ? `قائمة المواد العامة (${subjects.length})` : `قائمة الصفوف العامة (${grades.length})`}
                  action={
                    <Button
                      variant="text"
                      size="sm"
                      disabled={save.isPending}
                      onClick={() => {
                        commitLegacyList(legacyTab, (legacyTab === 'subjects' ? DEFAULT_SUBJECTS : DEFAULT_GRADES).map((it) => ({ ...it })));
                      }}
                    >
                      <RotateCcw /> استعادة الافتراضي
                    </Button>
                  }
                />
                <List>
                  {activeItems.map((item, idx) => (
                    <ListItem
                      key={item.key}
                      leading={<Badge tone="primary">{idx + 1}</Badge>}
                      title={item.label}
                      subtitle={<span className="font-num text-xs text-on-surface-variant" dir="ltr">{item.key}</span>}
                      trailing={
                        <div className="flex items-center gap-1">
                          <IconButton
                            size="sm"
                            label="تحريك لأعلى"
                            disabled={idx === 0 || save.isPending}
                            onClick={() => handleMoveLegacy(idx, -1)}
                          >
                            <ArrowUp />
                          </IconButton>
                          <IconButton
                            size="sm"
                            label="تحريك لأسفل"
                            disabled={idx === activeItems.length - 1 || save.isPending}
                            onClick={() => handleMoveLegacy(idx, 1)}
                          >
                            <ArrowDown />
                          </IconButton>
                          <IconButton
                            size="sm"
                            label="حذف"
                            disabled={activeItems.length <= 1 || save.isPending}
                            onClick={() => commitLegacyList(legacyTab, activeItems.filter((it) => it.key !== item.key))}
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
          </div>
        )}
      </Page>
    </>
  );
}
