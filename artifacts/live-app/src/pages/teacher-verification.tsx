import { useEffect,useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { CalendarPlus,Copy,FileCheck2,Link2,LockKeyhole,Send } from 'lucide-react';
import { VERIFICATION_DOCUMENT_LABELS,subjectLabel, teacherVerificationInputSchema,type TeacherVerificationDTO,type TeacherVerificationInput,type VerificationDocumentType } from '@workspace/live-core';
import { api,errorMessage } from '@/lib/api';
import { inAppBrowserName } from '@/lib/in-app-browser';
import { useMe } from '@/lib/session';
import { MfaEnrollment } from '@/components/mfa-enrollment';
import { VerificationDocumentUpload } from '@/components/verification-documents';
import { QueryError } from '@/components/query-error';
import { ActionBar,Badge,Banner,Button,Card,Page,PageSpinner,Select,TextField,TopBar,toast } from '@/ui';
export const verificationLabels={not_submitted:'لم يُرسل بعد',pending:'قيد المراجعة',approved:'حساب موثّق',rejected:'لم يُقبل الطلب',needs_changes:'يحتاج إلى تعديل'};
export function TeacherVerification(){
 const me=useMe(),qc=useQueryClient(),[,navigate]=useLocation();
 const q=useQuery({queryKey:['teacher-verification'],queryFn:()=>api<TeacherVerificationDTO>('/teacher/verification')});
 const [form,setForm]=useState<TeacherVerificationInput>({fullName:me.user.name,phone:me.user.phone??'',subject:me.teacher?.subject?subjectLabel(me.teacher.subject):'',governorate:'',qualification:'',experienceYears:0,documentType:'national_id',membershipNumber:'',pageUrl:'',frontDocumentId:'',backDocumentId:''});
 const [uploading,setUploading]=useState(0),[error,setError]=useState('');
 const [connecting,setConnecting]=useState<'google'|'facebook'|null>(null);
 const refresh=()=>{qc.invalidateQueries({queryKey:['teacher-verification']});qc.invalidateQueries({queryKey:['teacher-profile',me.user.id]});};
 useEffect(()=>{if(q.data?.details)setForm(q.data.details);},[q.data?.submittedAt]);
 useEffect(()=>{
  const result=new URLSearchParams(window.location.search).get('social');
  if(!result)return;
  if(window.opener&&!window.opener.closed){
   try{
    window.opener.postMessage({type:'social_linked',result},window.location.origin);
    window.close();
    return;
   }catch{}
  }
  toast(result==='linked'?'رُبط الحساب بنجاح':result==='cancelled'?'أُلغي الربط. يمكنك المحاولة مجددًا.':'تعذر إكمال الربط. ابدأ المحاولة مجددًا.');
  navigate('/t/verification',{replace:true});
 },[]);
 useEffect(()=>{
  const onMessage=(e:MessageEvent)=>{
   if(e.origin!==window.location.origin||e.data?.type!=='social_linked')return;
   const result=e.data.result;
   toast(result==='linked'?'رُبط الحساب بنجاح':result==='cancelled'?'أُلغي الربط. يمكنك المحاولة مجددًا.':'تعذر إكمال الربط. ابدأ المحاولة مجددًا.');
   refresh();
  };
  window.addEventListener('message',onMessage);
  return ()=>window.removeEventListener('message',onMessage);
 },[]);
 const openConnectPopup=async(provider:'google'|'facebook')=>{
  setConnecting(provider);
  const w=600,h=700;
  const l=Math.max(0,window.screenX+(window.outerWidth-w)/2);
  const t=Math.max(0,window.screenY+(window.outerHeight-h)/2);
  const popup=window.open('about:blank',`gahez_link_${provider}`,`width=${w},height=${h},left=${l},top=${t},status=no,menubar=no,toolbar=no`);
  try{
   const res=await api<{url:string}>(`/teacher/verification/social/${provider}/start`,{body:{}});
   if(popup&&!popup.closed){
    popup.location.href=res.url;
    const interval=setInterval(()=>{
     if(!popup||popup.closed){
      clearInterval(interval);
      setConnecting(null);
      refresh();
     }
    },1000);
   }else{
    window.location.assign(res.url);
   }
  }catch(err){
   if(popup&&!popup.closed)popup.close();
   toast(errorMessage(err));
   setConnecting(null);
  }
 };
 const send=useMutation({mutationFn:()=>api<TeacherVerificationDTO>('/teacher/verification/submit',{body:form}),onSuccess:data=>{qc.setQueryData(['teacher-verification'],data);toast('أُرسل طلبك إلى المراجعة');},onError:error=>setError(errorMessage(error))});
 const submit=()=>{const parsed=teacherVerificationInputSchema.safeParse(form);if(!parsed.success){setError(parsed.error.issues[0]?.message??'راجع بياناتك');return;}setError('');send.mutate();};
 if(q.isPending)return <><TopBar title="توثيق حساب المدرس" back/><Page><PageSpinner/></Page></>;
 if(q.isError)return <><TopBar title="توثيق حساب المدرس" back/><Page><QueryError error={q.error} retry={q.refetch}/></Page></>;
 const state=q.data,locked=state.status==='pending'||state.status==='approved',inApp=inAppBrowserName();
 const noun=form.documentType==='national_id'?'للبطاقة':'للكارنيه';
 const copyLink=()=>{navigator.clipboard.writeText(window.location.href).then(()=>toast('اتنسخ اللينك. افتحه في Chrome أو Safari.'),()=>toast('انسخ اللينك من شريط العنوان.'));};
 const set=(key:keyof TeacherVerificationInput)=>(event:{target:{value:string}})=>setForm(current=>({...current,[key]:event.target.value}));
 return <><TopBar title="توثيق حساب المدرس" back/><Page className="verification-page"><section className="verification-intro"><p className="profile-eyebrow"><FileCheck2 size={18}/> نعرف من يعلّم طلابنا</p><h1>وثّق حسابك وافتح الحصص المدفوعة.</h1><p>الحصة المجانية باللينك متاحة لك دلوقتي من غير توثيق. لما توثّق تقدر تعمل حصص مدفوعة وتظهر في الرئيسية.</p><Badge tone={state.status==='approved'?'success':state.status==='rejected'?'error':'primary'}>{verificationLabels[state.status]}</Badge></section>
 {state.status==='pending'&&<Banner tone="info">طلبك قيد المراجعة. ستصلك نتيجة المراجعة في التنبيهات.</Banner>}{state.status==='approved'&&<Banner tone="success" action={<Button variant="text" onClick={()=>navigate('/t/lectures/new')}>أنشئ حصتك</Button>}>تمت الموافقة على حسابك. تقدر تعمل حصص مدفوعة وتظهر في الرئيسية.</Banner>}{state.note&&<Banner tone={state.status==='rejected'?'error':'warning'}><strong>ملاحظات المراجعة</strong><p className="whitespace-pre-wrap">{state.note}</p></Banner>}
 {state.status!=='approved'&&<Button variant="tonal" onClick={()=>navigate('/t/lectures/new')}><CalendarPlus/>جرّب حصة مجانية الأول</Button>}
 <Card className="mt-5"><div className="verification-step-title"><FileCheck2/><h2>بياناتك</h2></div><div className="verification-form"><TextField label="الاسم الكامل كما في المستند" value={form.fullName} onChange={set('fullName')} disabled={locked} maxLength={150}/><div className="verification-two-columns"><TextField label="رقم الهاتف" type="tel" ltr value={form.phone} onChange={set('phone')} disabled={locked}/><TextField label="المحافظة" value={form.governorate} onChange={set('governorate')} disabled={locked}/></div><TextField label="التخصص أو المادة" value={form.subject} onChange={set('subject')} disabled={locked}/><TextField label="لينك صفحتك أو قناتك (اختياري)" hint="فيسبوك أو يوتيوب أو أي صفحة بتدرّس عليها. بيسرّع المراجعة." ltr value={form.pageUrl} onChange={set('pageUrl')} disabled={locked} maxLength={300}/><div className="verification-two-columns"><TextField label="المؤهل (اختياري)" value={form.qualification} onChange={set('qualification')} disabled={locked} maxLength={300}/><TextField label="سنوات الخبرة (اختياري)" type="number" min={0} max={70} inputMode="numeric" ltr value={form.experienceYears} onChange={e=>setForm(current=>({...current,experienceYears:Number(e.target.value)}))} disabled={locked}/></div><Select label="المستند اللي هترفعه" value={form.documentType} onChange={event=>setForm(current=>({...current,documentType:event.target.value as VerificationDocumentType}))} disabled={locked} options={(Object.keys(VERIFICATION_DOCUMENT_LABELS) as VerificationDocumentType[]).map(value=>({value,label:VERIFICATION_DOCUMENT_LABELS[value]}))}/>{form.documentType==='syndicate_card'&&<TextField label="رقم عضوية النقابة (اختياري)" value={form.membershipNumber} onChange={set('membershipNumber')} disabled={locked}/>}<div className="verification-private-note"><LockKeyhole size={18}/><p>الصور خاصة بالتوثيق ومشفّرة. يطّلع عليها المدرس والسوبر أدمن فقط، ولا تظهر في ملفك العام.</p></div><div className="verification-two-columns"><VerificationDocumentUpload label={`الوجه الأمامي ${noun}`} value={form.frontDocumentId} disabled={locked} onChange={id=>setForm(current=>({...current,frontDocumentId:id}))} onBusyChange={busy=>setUploading(n=>Math.max(0,n+(busy?1:-1)))}/><VerificationDocumentUpload label={`الوجه الخلفي ${noun}`} value={form.backDocumentId} disabled={locked} onChange={id=>setForm(current=>({...current,backDocumentId:id}))} onBusyChange={busy=>setUploading(n=>Math.max(0,n+(busy?1:-1)))}/></div>{error&&<Banner tone="error">{error}</Banner>}</div></Card>
 <Card className="mt-5"><p className="mb-3 text-body-sm text-on-surface-variant">المصادقة الثنائية مش مطلوبة دلوقتي. هتحتاجها قبل أول سحب بس، عشان محدش غيرك يسحب فلوسك.</p><MfaEnrollment security={state.security} onChange={refresh}/></Card>
 <Card className="mt-5 verification-security-block"><div className="verification-step-title"><Link2/><h2>اربط حساب (اختياري)</h2></div><p>ربط Google أو فيسبوك بيسهّل مراجعة طلبك، ومش شرط لأي حاجة.</p>{inApp&&<Banner tone="warning" action={<Button variant="text" size="sm" onClick={copyLink}><Copy/>انسخ اللينك</Button>}>إنت فاتح الصفحة من جوه {inApp}، وGoogle مش بتسمح بالربط من هنا. افتحها في Chrome أو Safari لو عايز تربط.</Banner>}<div className="verification-social-options"><Button variant="tonal" disabled={!state.security.canManageSecurity||!state.security.googleConfigured||connecting!==null||Boolean(inApp)} onClick={()=>openConnectPopup('google')}>{connecting==='google'?'جاري الاتصال...':state.security.google?'✓ Google مرتبط':'ربط Google'}</Button><Button variant="tonal" disabled={!state.security.canManageSecurity||!state.security.facebookConfigured||connecting!==null} onClick={()=>openConnectPopup('facebook')}>{connecting==='facebook'?'جاري الاتصال...':state.security.facebook?'✓ فيسبوك مرتبط':'ربط فيسبوك'}</Button></div>{state.security.google&&<p className="text-body-sm" dir="ltr">{state.security.google.email}</p>}{state.security.facebook&&<p className="text-body-sm">{state.security.facebook.name}</p>}{!state.security.canManageSecurity&&<p className="text-body-sm">يلزم الدخول المباشر بحساب المدرس لإتمام الربط.</p>}</Card>
 </Page>{!locked&&<ActionBar><Button block disabled={uploading>0} loading={send.isPending} onClick={submit}><Send/>{state.status==='not_submitted'?'إرسال طلب التوثيق':'إعادة إرسال الطلب'}</Button></ActionBar>}</>;
}
