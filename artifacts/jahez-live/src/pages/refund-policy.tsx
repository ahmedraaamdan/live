import { Link } from 'wouter';
import { ContentPage } from '@/components/marketing/content-page';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { breadcrumbJsonLd } from '@/lib/structured-data';

export default function RefundPolicy() {
  useSeo({
    title: routes.refundPolicy.title,
    description: routes.refundPolicy.description,
    path: routes.refundPolicy.path,
    jsonLd: breadcrumbJsonLd([{ label: 'الرئيسية', path: '/' }, { label: 'سياسة الاسترداد' }]),
  });

  return (
    <ContentPage
      title="سياسة الاسترداد"
      subtitle="حالات استرداد قيمة الحصة وخطوات تقديم الطلب."
      crumbs={[{ label: 'الرئيسية', path: '/' }, { label: 'سياسة الاسترداد' }]}
    >
      <div className="mp-prose">
        <h2>إذا أُلغيت الحصة</h2>
        <p>إذا ألغى المدرس الحصة قبل موعدها، يصلك إشعار بالإلغاء، ونتابع مع مزود الدفع رد قيمتها بالكامل إلى وسيلة الدفع الأصلية. تتم مراجعة الرد قبل تنفيذه، لذلك قد يستغرق بعض الوقت.</p>

        <h2>إذا تعذّر الحضور بسبب مشكلة في المنصة</h2>
        <p>إذا منعتك مشكلة تقنية في المنصة من حضور حصتك المحجوزة، يمكنك إرسال طلب استرداد عبر صفحة «تواصل معنا» لمراجعة الحالة.</p>

        <h2>إلغاء الحجز قبل موعد الحصة</h2>
        <p>إلغاء الحجز من داخل الحساب غير متاح حاليًا. إذا أردت إلغاء حجزك قبل موعد الحصة، تواصل معنا عبر صفحة «تواصل معنا» لمراجعة طلبك.</p>

        <h2>بعد بداية الحصة أو انتهائها</h2>
        <p>الحصص التي بدأت أو انتهت، والحصص التي شاهدت إعادتها، غير مؤهلة للاسترداد، باستثناء حالات تُراجع كل منها على حدة.</p>

        <h2>مدة معالجة الاسترداد</h2>
        <p>بعد الموافقة على الطلب، يُعاد المبلغ إلى وسيلة الدفع الأصلية. تختلف مدة المعالجة بحسب مزود الدفع ووسيلة الدفع.</p>

        <h2>طلب استرداد</h2>
        <p>لطلب الاسترداد، تواصل معنا عبر <Link href={routes.contact.path}>صفحة "تواصل معنا"</Link> وحدد اسم الحصة وتاريخ الحجز.</p>
      </div>
    </ContentPage>
  );
}
