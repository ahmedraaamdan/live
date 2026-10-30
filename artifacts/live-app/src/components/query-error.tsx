import { errorMessage } from '@/lib/api';
import { Banner, Button } from '@/ui';
export function QueryError({ error, retry }: { error: unknown; retry: () => unknown }) {
  return <div role="alert" className="mb-5"><Banner tone="error">{errorMessage(error)}<Button variant="text" onClick={() => void retry()}>إعادة المحاولة</Button></Banner></div>;
}
