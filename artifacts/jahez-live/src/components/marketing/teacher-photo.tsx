export function teacherPhotoUrl(id: string): string {
  return `${import.meta.env.BASE_URL}images/teachers/${id}.webp`;
}

export function TeacherPhoto({
  id,
  name,
  className = "",
}: {
  id: string;
  name: string;
  className?: string;
}) {
  return (
    <img
      src={teacherPhotoUrl(id)}
      alt={`صورة توضيحية لشخصية ${name}`}
      className={className}
      width={640}
      height={640}
      loading="lazy"
      decoding="async"
    />
  );
}
