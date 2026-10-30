import { Link } from 'wouter';
import { Apple, Globe, Smartphone } from 'lucide-react';
import { ContentPage } from '@/components/marketing/content-page';
import { FaqAccordion } from '@/components/marketing/faq-accordion';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { breadcrumbJsonLd } from '@/lib/structured-data';

const paymentFaq = [
  {
    id: 'payments',
    label: '',
    items: [
      { q: 'دفعت ولم تظهر الحصة، ماذا أفعل؟', a: 'تأكد من تسجيل الدخول بالحساب الذي استخدمته للدفع. إذا لم يظهر الحجز، أرسل تفاصيل العملية إلى فريقنا عبر صفحة «تواصل معنا».' },
      { q: 'هل يمكن استرداد قيمة الحصة؟', a: 'يمكن ذلك في الحالات المحددة في سياسة الاسترداد. راجع السياسة وتفاصيل حجزك قبل تقديم الطلب.' },
      { q: 'هل تختلف طريقة الدفع بين الهاتف والموقع؟', a: 'نعم. يجري الدفع داخل التطبيق عبر متجر التطبيقات، وعلى الموقع تظهر الوسائل المتاحة عند إتمام الحجز.' },
      { q: 'ماذا يحدث بعد الدفع؟', a: 'بعد تأكيد الدفع، تُضاف الحصة إلى قائمة «حصصي» في حسابك، مع تفاصيل الحجز والدخول.' },
    ],
  },
];

export default function Payments() {
  useSeo({
    title: routes.payments.title,
    description: routes.payments.description,
    path: routes.payments.path,
    jsonLd: breadcrumbJsonLd([{ label: 'الرئيسية', path: '/' }, { label: 'الدفع' }]),
  });

  return (
    <ContentPage
      eyebrow="الدفع والحجز"
      title="اعرف السعر قبل الحجز."
      subtitle="راجع سعر الحصة وموعدها، ثم أكمل الدفع. تجد تفاصيل الحجز في حسابك بعد تأكيد العملية."
      crumbs={[{ label: 'الرئيسية', path: '/' }, { label: 'الدفع' }]}
    >
      <div className="mp-payment-methods">
        <div className="mp-payment-card">
          <Smartphone size={22} />
          <h2>Android</h2>
          <p>تُعرض خيارات الدفع المتاحة داخل تطبيق Android عند إتمام الحجز عبر Google Play.</p>
        </div>
        <div className="mp-payment-card">
          <Apple size={22} />
          <h2>iPhone</h2>
          <p>تُعرض خيارات الدفع المتاحة داخل تطبيق iPhone عند إتمام الحجز عبر App Store.</p>
        </div>
        <div className="mp-payment-card">
          <Globe size={22} />
          <h2>الويب</h2>
          <p>تظهر وسائل الدفع المتاحة على الموقع أثناء إتمام الحجز. اختر الوسيلة المناسبة وراجع المبلغ قبل تأكيد العملية.</p>
        </div>
      </div>

      <div className="mp-prose">
        <h2>ماذا يحدث بعد الدفع؟</h2>
        <p>بعد تأكيد الدفع، تُضاف الحصة إلى قائمة حصصك. وإذا كانت حصة قادمة، يبقى حجزك محفوظًا حتى موعدها.</p>
        <h2>إذا تعذّر الدفع</h2>
        <p>إذا تعذّر الدفع، تحقّق من حالة العملية قبل المحاولة مجددًا. وإذا خُصم المبلغ ولم يظهر الحجز، تواصل معنا وأرفق تفاصيل الدفع لمراجعته.</p>
      </div>

      <FaqAccordion categories={paymentFaq} />

      <p className="mp-inline-link">
        تختلف أهلية الاسترداد بحسب حالة الحجز وموعد الطلب. <Link href={routes.refundPolicy.path}>اقرأ سياسة الاسترداد</Link>
      </p>
    </ContentPage>
  );
}
