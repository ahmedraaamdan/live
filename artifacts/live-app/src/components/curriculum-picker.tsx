import { useMemo } from 'react';
import {
  CURRICULUMS,
  getCurriculum,
  getAllGradesForCurriculum,
  getTracksForGrade,
  getSubjectsFor,
} from '@workspace/live-core';
import { Select } from '@/ui';

export interface CurriculumPickerProps {
  curriculum: string;
  onCurriculumChange: (curriculumId: string) => void;
  grade: string;
  onGradeChange: (gradeKey: string) => void;
  track?: string;
  onTrackChange?: (trackKey: string) => void;
  subject?: string;
  onSubjectChange?: (subjectKey: string) => void;
  showSubject?: boolean;
  filterCountry?: string;
  disabled?: boolean;
  errors?: {
    curriculum?: string | null;
    grade?: string | null;
    track?: string | null;
    subject?: string | null;
  };
}

export function CurriculumPicker({
  curriculum,
  onCurriculumChange,
  grade,
  onGradeChange,
  track = '',
  onTrackChange,
  subject = '',
  onSubjectChange,
  showSubject = true,
  disabled = false,
  errors,
}: CurriculumPickerProps) {
  const currentCurriculum = useMemo(() => getCurriculum(curriculum), [curriculum]);

  const curriculumOptions = useMemo(
    () =>
      CURRICULUMS.map((c) => ({
        value: c.id,
        label: `${c.name}`,
      })),
    []
  );

  const gradeOptions = useMemo(() => {
    return currentCurriculum.stages.flatMap((stage) => [
      // Stage header or flat list
      ...stage.grades.map((g) => ({
        value: g.key,
        label: `${g.label} (${stage.name})`,
      })),
    ]);
  }, [currentCurriculum]);

  const availableTracks = useMemo(() => {
    if (!grade) return [];
    return getTracksForGrade(curriculum, grade);
  }, [curriculum, grade]);

  const trackOptions = useMemo(() => {
    return availableTracks.map((t) => ({
      value: t.key,
      label: t.label,
    }));
  }, [availableTracks]);

  const subjectOptions = useMemo(() => {
    const list = getSubjectsFor(curriculum, grade || undefined, track || undefined);
    return list.map((s) => ({
      value: s.key,
      label: s.label,
    }));
  }, [curriculum, grade, track]);

  const handleCurriculumChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCurriculum = e.target.value;
    onCurriculumChange(nextCurriculum);

    // Auto-select first grade or clear
    const grades = getAllGradesForCurriculum(nextCurriculum);
    const nextGrade = grades[0]?.key ?? '';
    onGradeChange(nextGrade);

    if (onTrackChange) {
      const tracks = getTracksForGrade(nextCurriculum, nextGrade);
      onTrackChange(tracks[0]?.key ?? '');
    }

    if (onSubjectChange && showSubject) {
      const subs = getSubjectsFor(nextCurriculum, nextGrade);
      onSubjectChange(subs[0]?.key ?? '');
    }
  };

  const handleGradeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextGrade = e.target.value;
    onGradeChange(nextGrade);

    if (onTrackChange) {
      const tracks = getTracksForGrade(curriculum, nextGrade);
      onTrackChange(tracks[0]?.key ?? '');
    }

    if (onSubjectChange && showSubject) {
      const subs = getSubjectsFor(curriculum, nextGrade);
      if (!subs.some((s) => s.key === subject)) {
        onSubjectChange(subs[0]?.key ?? '');
      }
    }
  };

  const handleTrackChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTrack = e.target.value;
    onTrackChange?.(nextTrack);

    if (onSubjectChange && showSubject) {
      const subs = getSubjectsFor(curriculum, grade, nextTrack);
      if (!subs.some((s) => s.key === subject)) {
        onSubjectChange(subs[0]?.key ?? '');
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. اختيار المنهج الدراسي */}
      <Select
        label="المنهج الدراسي / النظام التعليمي"
        options={curriculumOptions}
        value={curriculum}
        onChange={handleCurriculumChange}
        error={errors?.curriculum}
        disabled={disabled}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 2. اختيار الصف أو المستوى */}
        <Select
          label="الصف الدراسي / المستوى"
          options={gradeOptions}
          value={grade}
          onChange={handleGradeChange}
          placeholder="اختر الصف أو المستوى"
          error={errors?.grade}
          disabled={disabled}
        />

        {/* 3. اختيار الشعبة أو المسار التخصصي (إن وجد) */}
        {availableTracks.length > 0 && onTrackChange && (
          <Select
            label="المسار / التخصص"
            options={trackOptions}
            value={track}
            onChange={handleTrackChange}
            error={errors?.track}
            disabled={disabled}
          />
        )}

        {/* 4. اختيار المادة */}
        {showSubject && onSubjectChange && (
          <Select
            label="المادة الدراسية"
            options={subjectOptions}
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="اختر المادة"
            error={errors?.subject}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
