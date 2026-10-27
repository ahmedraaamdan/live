import { Compass } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button, EmptyState } from '@/ui';

export function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <EmptyState
        icon={<Compass />}
        title="الصفحة دي مش موجودة"
        body="ممكن اللينك اتغير أو اتكتب غلط."
        action={
          <Button size="lg" onClick={() => navigate('/', { replace: true })}>
            ارجع للرئيسية
          </Button>
        }
      />
    </div>
  );
}
