import { api } from '@/lib/api';
import { Component, type ReactNode } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

/** Last line of defence: a crashed screen shows a way back instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[GahezLive] screen crashed', error);
    void api('/client-errors', { body: { message: error.message.slice(0, 400), stack: (error.stack ?? '').replace(/\?[^\s)]+/g, '').slice(0, 2000), path: window.location.pathname.slice(0, 160) } }).catch(() => undefined);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const updated = /dynamically imported|loading chunk|module script|css chunk|failed to fetch module/i.test(this.state.error.message);
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-error-container text-on-error-container">
            <TriangleAlert className="size-8" />
          </div>
          <h1 className="mt-5 text-headline-sm">{updated ? 'يوجد تحديث للتطبيق' : 'تعذر عرض هذه الصفحة'}</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">{updated ? 'تعذر تحميل جزء من الواجهة بعد تحديث التطبيق. أعد تحميل الصفحة لاستكمال الاستخدام.' : 'أعد فتح الصفحة. إذا استمرت المشكلة، تواصل مع support@gahez.space.'}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="state-layer press mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-label-lg text-on-primary"
          >
            <RotateCcw className="size-5" /> افتح تاني
          </button>
        </div>
      </div>
    );
  }
}
