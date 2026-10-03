import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export interface FaqCategory {
  id: string;
  label: string;
  items: { q: string; a: string }[];
}

export function FaqAccordion({ categories }: { categories: FaqCategory[] }) {
  return (
    <div className="faq-categories">
      {categories.map((cat) => (
        <div key={cat.id} className="faq-category">
          {cat.label && <h2 className="faq-category-title">{cat.label}</h2>}
          <Accordion type="single" collapsible className="w-full">
            {cat.items.map((item, i) => (
              <AccordionItem key={i} value={`${cat.id}-${i}`} data-testid={`faq-item-${cat.id}-${i}`}>
                <AccordionTrigger className="text-base font-bold">{item.q}</AccordionTrigger>
                {/* forceMount keeps closed answers in the DOM (hidden), so the
                    prerendered HTML carries every answer, not just the questions. */}
                <AccordionContent forceMount className="text-muted-foreground leading-8">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  );
}
