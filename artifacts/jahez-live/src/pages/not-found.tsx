import { Link } from 'wouter';
import { Compass, House } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="not-found-shell fade-up" dir="rtl">
      <span className="not-found-icon"><Compass size={26} /></span>
      <p className="not-found-eyebrow">404</p>
      <h1 className="not-found-title">هذه الصفحة غير موجودة</h1>
      <p className="not-found-copy">قد يكون الرابط قد تغيّر أو لم تعد الصفحة متاحة. يمكنك متابعة التصفح من الرئيسية.</p>
      <Link href="/" className="button-primary" data-testid="link-notfound-home">
        <House size={16} /> العودة إلى الرئيسية
      </Link>
    </div>
  );
}
