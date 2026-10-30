import { Link } from 'wouter';
import { ContentPage } from '@/components/marketing/content-page';
import { FaqAccordion } from '@/components/marketing/faq-accordion';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/structured-data';
import { faqCategories } from '@/data/faq';

export default function Faq() {
  useSeo({
    title: routes.faq.title,
    description: routes.faq.description,
    path: routes.faq.path,
    jsonLd: [
      breadcrumbJsonLd([{ label: 'الرئيسية', path: '/' }, { label: 'الأسئلة الشائعة' }]),
      faqJsonLd(faqCategories),
    ],
  });

  return (
    <ContentPage
      eyebrow="مركز المساعدة"
      title="الأسئلة الشائعة"
      subtitle="إجابات عن أسئلة الطلاب والمدرسين حول الحجز والحضور والحسابات."
      crumbs={[{ label: 'الرئيسية', path: '/' }, { label: 'الأسئلة الشائعة' }]}
    >
      <FaqAccordion categories={faqCategories} />
      <p className="mp-inline-link">
        لم تجد إجابة لسؤالك؟ <Link href={routes.contact.path}>تواصل معنا</Link>
      </p>
    </ContentPage>
  );
}
