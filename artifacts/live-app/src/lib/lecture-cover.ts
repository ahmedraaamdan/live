const coverBySubject = new Map<string, string>([
  ['math', 'math'],
  ['physics', 'physics'],
  ['science', 'science'],
  ['chemistry', 'science'],
  ['biology', 'science'],
  ['arabic', 'languages'],
  ['english', 'languages'],
  ['french', 'languages'],
  ['german', 'languages'],
  ['history', 'humanities'],
  ['geography', 'humanities'],
  ['social_studies', 'humanities'],
  ['social', 'humanities'],
]);

export function lectureCover(subject: string, uploaded?: string | null): string {
  if (uploaded) return uploaded;
  const template = coverBySubject.get(subject) ?? 'general';
  return `${import.meta.env.BASE_URL}images/lesson-covers/${template}.webp`;
}
