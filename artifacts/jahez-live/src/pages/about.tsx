import { Link } from 'wouter';
import { ContentPage } from '@/components/marketing/content-page';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { breadcrumbJsonLd } from '@/lib/structured-data';

export default function About() {
  useSeo({
    title: routes.about.title,
    description: routes.about.description,
    path: routes.about.path,
    jsonLd: breadcrumbJsonLd([{ label: 'الرئيسية', path: '/' }, { label: 'عن جاهز Live' }]),
  });

  return (
    <ContentPage
      eyebrow="عن جاهز Live"
      title="التعلّم يبدأ بمدرس يفهم سؤالك."
      crumbs={[{ label: 'الرئيسية', path: '/' }, { label: 'عن جاهز Live' }]}
    >
      <div className="mp-prose">
        <h2>الفكرة</h2>
        <p>يجمع جاهز Live الطلاب والمدرسين في حصص مباشرة عبر الإنترنت. تختار ما تريد تعلّمه، وتتعرّف إلى من يدرّسه، وتحجز موعدك من مكانك.</p>

        <h2>لماذا الحصص المباشرة؟</h2>
        <p>لأن السؤال جزء من التعلّم. في الحصة المباشرة، يمكنك أن تطلب توضيحًا، وتناقش الإجابة، وتتابع الشرح مع المدرس خطوة بخطوة.</p>

        <h2>ما الذي تجده هنا؟</h2>
        <p>نضع تفاصيل الحصة أمامك: موضوعها، ومدرسها، وموعدها، وسعرها. وتساعدك ملفات المدرسين وتقييمات الطلاب على المقارنة قبل الحجز.</p>

        <h2>دور التكنولوجيا</h2>
        <p>نريد أن يكون ترتيب الحصة سهلًا للطالب والمدرس؛ من عرض التفاصيل والحجز إلى الحضور ومتابعة المواعيد.</p>

        <h2>كيف نطوّر المنصة؟</h2>
        <p>نطوّر جاهز Live بالاستماع إلى من يستخدمه. ملاحظات الطلاب والمدرسين تساعدنا على تحسين تجربة الحصص اليومية.</p>
      </div>

      <p className="mp-inline-link">
        هل تريد البدء؟ <Link href={routes.classes.path}>تصفح الحصص</Link> أو <Link href={routes.forTeachers.path}>انضم كمدرس</Link>.
      </p>
    </ContentPage>
  );
}
