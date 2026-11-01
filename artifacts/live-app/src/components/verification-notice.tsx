import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { FileCheck2 } from 'lucide-react';
import type { TeacherVerificationDTO,VerificationQueueDTO } from '@workspace/live-core';
import { api } from '@/lib/api';
import { useMe } from '@/lib/session';
import { Banner,Button } from '@/ui';
export function useTeacherVerification(){return useQuery({queryKey:['teacher-verification'],queryFn:()=>api<TeacherVerificationDTO>('/teacher/verification')});}
export function VerificationNotice(){const q=useTeacherVerification(),[,navigate]=useLocation();if(!q.data||q.data.status==='approved')return null;return <Banner tone={q.data.status==='rejected'?'error':'info'} className="mb-5"><div className="flex flex-wrap items-center gap-3"><FileCheck2/><p className="min-w-0 flex-1 text-body-sm">{q.data.status==='pending'?'طلب توثيقك قيد المراجعة. تقدر تعمل حصص مجانية باللينك لحد الموافقة.':q.data.status==='needs_changes'?'طلب التوثيق يحتاج إلى تعديل. راجع الملاحظات وأعد إرساله.':'جرّب حصة مجانية باللينك دلوقتي. وثّق حسابك عشان تفتح الحصص المدفوعة.'}</p><Button variant="tonal" size="sm" onClick={()=>navigate('/t/verification')}>توثيق الحساب</Button></div></Banner>;}
export function VerificationQueueLink(){const me=useMe(),[,navigate]=useLocation();const q=useQuery({queryKey:['verification-pending'],queryFn:()=>api<VerificationQueueDTO>('/admin/teacher-verifications?status=pending'),enabled:Boolean(me.isSuperAdmin),refetchInterval:30000});if(!me.isSuperAdmin)return null;return <Button variant="tonal" onClick={()=>navigate('/admin/teacher-verifications')}><FileCheck2/>طلبات توثيق المدرسين{q.data&&<span className="font-num">({q.data.counts.pending})</span>}</Button>;}
