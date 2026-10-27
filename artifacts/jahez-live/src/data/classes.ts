/**
 * Sample/demo content for the marketing site's discovery surfaces. This is
 * illustrative data (not real students/teachers) used to show how discovery
 * looks and feels — it intentionally is not wired to any backend yet (see
 * artifacts/api-server for the real API). Swap this file for real data
 * fetching once the marketing site talks to that API.
 */

export type ClassStatus = 'live' | 'upcoming';

export interface ClassItem {
  id: string;
  title: string;
  teacher: string;
  teacherId: string;
  initials: string;
  avatar: 'avatar-a' | 'avatar-b' | 'avatar-c' | 'avatar-d';
  subject: string;
  grade: string;
  rating: string;
  viewers?: string;
  status: ClassStatus;
  theme: 'thumb-coral' | 'thumb-ink' | 'thumb-sun' | 'thumb-mint';
  equation: string;
  caption: string;
  price: string;
  date?: string;
  time?: string;
  day?: string;
}

export const classes: ClassItem[] = [
  { id: 'limits', title: 'النهايات ببساطة: كيف تفكر فيها قبل أن تحسبها؟', teacher: 'أ. نورة العتيبي', teacherId: 'noura', initials: 'نع', avatar: 'avatar-a', subject: 'رياضيات', grade: 'ثالث ثانوي', rating: '4.9', viewers: '342', status: 'live', theme: 'thumb-coral', equation: 'x → ∞', caption: 'THE BIG IDEA', price: '49 ج.م' },
  { id: 'chemistry', title: 'التفاعلات الكيميائية: من المعادلة إلى التجربة', teacher: 'د. يزن الحربي', teacherId: 'yazan', initials: 'يح', avatar: 'avatar-b', subject: 'كيمياء', grade: 'ثاني ثانوي', rating: '4.8', viewers: '218', status: 'live', theme: 'thumb-ink', equation: 'H₂O', caption: 'LET IT REACT', price: '39 ج.م' },
  { id: 'writing', title: 'اكتب إجابة تترك أثراً في ورقة الاختبار', teacher: 'أ. ليان الشريف', teacherId: 'layan', initials: 'لش', avatar: 'avatar-c', subject: 'لغة عربية', grade: 'أول ثانوي', rating: '4.9', viewers: '97', status: 'live', theme: 'thumb-sun', equation: '« ! »', caption: 'MAKE IT CLEAR', price: '29 ج.م' },
  { id: 'physics', title: 'الحركة الدائرية: السرعة التي لا تتوقف', teacher: 'أ. فهد السبيعي', teacherId: 'fahad', initials: 'فس', avatar: 'avatar-d', subject: 'فيزياء', grade: 'ثالث ثانوي', rating: '4.7', status: 'upcoming', theme: 'thumb-mint', equation: 'F = ma', caption: 'COMING SOON', price: '49 ج.م', date: 'الخميس، 21 مارس', time: '07:30 م', day: '21' },
  { id: 'grammar', title: 'النحو من الصفر: الجملة التي تفهمها من أول مرة', teacher: 'أ. سارة القحطاني', teacherId: 'sara', initials: 'سق', avatar: 'avatar-a', subject: 'لغة عربية', grade: 'ثاني متوسط', rating: '4.9', status: 'upcoming', theme: 'thumb-coral', equation: 'مبتدأ + خبر', caption: 'SAVE THE DATE', price: '25 ج.م', date: 'السبت، 23 مارس', time: '05:00 م', day: '23' },
  { id: 'calculus', title: 'التكامل كمساحة: الدرس الذي يكمل الصورة', teacher: 'د. مازن الدوسري', teacherId: 'mazen', initials: 'مد', avatar: 'avatar-b', subject: 'رياضيات', grade: 'ثالث ثانوي', rating: '4.8', status: 'upcoming', theme: 'thumb-ink', equation: '∫ f(x)', caption: 'PREMIERE', price: '49 ج.م', date: 'الأحد، 24 مارس', time: '08:00 م', day: '24' },
  { id: 'english', title: 'Speak with confidence: من الفكرة إلى المحادثة', teacher: 'أ. ريم النجار', teacherId: 'reem', initials: 'رن', avatar: 'avatar-c', subject: 'لغة إنجليزية', grade: 'جميع المراحل', rating: '4.9', status: 'upcoming', theme: 'thumb-sun', equation: 'say it', caption: 'PREMIERE', price: '35 ج.م', date: 'الإثنين، 25 مارس', time: '06:30 م', day: '25' },
];

export const liveClasses = classes.filter((c) => c.status === 'live');
export const upcomingClasses = classes.filter((c) => c.status === 'upcoming');

export interface TeacherItem {
  id: string;
  name: string;
  subject: string;
  specialty: string;
  initials: string;
  avatar: 'avatar-a' | 'avatar-b' | 'avatar-c' | 'avatar-d';
  rating: string;
  ratingCount: string;
  followers: string;
  classCount: string;
  verified: boolean;
}

export const teachers: TeacherItem[] = [
  { id: 'noura', name: 'أ. نورة العتيبي', subject: 'رياضيات', specialty: 'رياضيات • 12.4k متابع', initials: 'نع', avatar: 'avatar-a', rating: '4.9', ratingCount: '612', followers: '12.4k', classCount: '48', verified: true },
  { id: 'yazan', name: 'د. يزن الحربي', subject: 'كيمياء', specialty: 'كيمياء • 8.7k متابع', initials: 'يح', avatar: 'avatar-b', rating: '4.8', ratingCount: '389', followers: '8.7k', classCount: '31', verified: true },
  { id: 'layan', name: 'أ. ليان الشريف', subject: 'لغة عربية', specialty: 'لغة عربية • 6.2k متابع', initials: 'لش', avatar: 'avatar-c', rating: '4.9', ratingCount: '201', followers: '6.2k', classCount: '22', verified: true },
  { id: 'fahad', name: 'أ. فهد السبيعي', subject: 'فيزياء', specialty: 'فيزياء • 4.1k متابع', initials: 'فس', avatar: 'avatar-d', rating: '4.7', ratingCount: '154', followers: '4.1k', classCount: '19', verified: false },
  { id: 'sara', name: 'أ. سارة القحطاني', subject: 'لغة عربية', specialty: 'لغة عربية • 3.6k متابع', initials: 'سق', avatar: 'avatar-a', rating: '4.9', ratingCount: '133', followers: '3.6k', classCount: '15', verified: false },
  { id: 'mazen', name: 'د. مازن الدوسري', subject: 'رياضيات', specialty: 'رياضيات • 9.8k متابع', initials: 'مد', avatar: 'avatar-b', rating: '4.8', ratingCount: '340', followers: '9.8k', classCount: '27', verified: true },
];

export const subjects = ['الكل', 'رياضيات', 'فيزياء', 'كيمياء', 'لغة عربية', 'لغة إنجليزية'];
