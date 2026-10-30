import { useEffect,useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { CheckCircle2,Clock3,FileCheck2,Link2,LockKeyhole,Send } from 'lucide-react';
import { subjectLabel, teacherVerificationInputSchema,type TeacherVerificationDTO,type TeacherVerificationInput } from '@workspace/live-core';
import { api,errorMessage } from '@/lib/api';
import { useMe } from '@/lib/session';
import { MfaEnrollment } from '@/components/mfa-enrollment';
import { VerificationDocumentUpload } from '@/components/verification-documents';
import { QueryError } from '@/components/query-error';
import { ActionBar,Badge,Banner,Button,Card,Page,PageSpinner,TextArea,TextField,TopBar,toast } from '@/ui';
export const verificationLabels={not_submitted:'لم يُرسل بعد',pending:'قيد المراجعة',approved:'حساب موثّق',rejected:'لم يُقبل الطلب',needs_changes:'يحتاج إلى تعديل'};
export function TeacherVerification(){
 const me=useMe(),qc=useQueryClient(),[,navigate]=useLocation();
 const q=useQuery({queryKey:['teacher-verification'],queryFn:()=>api<TeacherVerificationDTO>('/teacher/verification')});
 const [form,setForm]=useState<TeacherVerificationInput>({fullName:me.user.name,phone:me.user.phone??'',subject:me.teacher?.subject?subjectLabel(me.teacher.subject):'',governorate:'',qualification:'',experienceYears:0,membershipNumber:'',frontDocumentId:'',backDocumentId:''});
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
 const state=q.data,ready=Boolean((state.security.google||state.security.facebook)&&state.security.mfaEnabled),locked=state.status==='pending'||state.status==='approved';
 const set=(key:keyof TeacherVerificationInput)=>(event:{target:{value:string}})=>setForm(current=>({...current,[key]:event.target.value}));
 return <><TopBar title="توثيق حساب المدرس" back/><Page className="verification-page"><section className="verification-intro"><p className="profile-eyebrow"><FileCheck2 size={18}/> نعرف من يعلّم طلابنا</p><h1>خطوتك الأولى، حساب موثّق.</h1><p>أكمل الربط وحماية الحساب، ثم أرسل بياناتك وصورتي الكارنيه. بعد الموافقة يمكنك إنشاء الحصص وبدء البث.</p><Badge tone={state.status==='approved'?'success':state.status==='rejected'?'error':'primary'}>{verificationLabels[state.status]}</Badge></section>
 {state.status==='pending'&&<Banner tone="info">طلبك قيد المراجعة. ستصلك نتيجة المراجعة في التنبيهات.</Banner>}{state.status==='approved'&&<Banner tone="success" action={<Button variant="text" onClick={()=>navigate('/t/lectures/new')}>أنشئ حصتك</Button>}>تمت الموافقة على حسابك. يمكنك الآن إنشاء الحصص وبدء البث.</Banner>}{state.note&&<Banner tone={state.status==='rejected'?'error':'warning'}><strong>ملاحظات المراجعة</strong><p className="whitespace-pre-wrap">{state.note}</p></Banner>}
 <Card className="mt-5 verification-security-block"><div className="verification-step-title"><Link2/><h2>اربط حسابًا تعرفه</h2></div><p>يكفي ربط Google أو فيسبوك. نطلب بيانات تسجيل الدخول الأساسية فقط.</p><div className="verification-social-options"><Button variant="tonal" disabled={!state.security.canManageSecurity||!state.security.googleConfigured||connecting!==null} onClick={()=>openConnectPopup('google')}>{connecting==='google'?'جاري الاتصال...':state.security.google?'✓ Google مرتبط':'ربط Google'}</Button><Button variant="tonal" disabled={!state.security.canManageSecurity||!state.security.facebookConfigured||connecting!==null} onClick={()=>openConnectPopup('facebook')}>{connecting==='facebook'?'جاري الاتصال...':state.security.facebook?'✓ فيسبوك مرتبط':'ربط فيسبوك'}</Button></div>{state.security.google&&<p className="text-body-sm" dir="ltr">{state.security.google.email}</p>}{state.security.facebook&&<p className="text-body-sm">{state.security.facebook.name}</p>}{!state.security.googleConfigured&&!state.security.facebookConfigured&&<Banner tone="info">تُجهّز الإدارة الربط الاجتماعي. يمكنك متابعة حماية الحساب الآن.</Banner>}{!state.security.canManageSecurity&&<p className="text-body-sm">يلزم الدخول المباشر بحساب المدرس لإتمام الربط.</p>}</Card>
 <Card className="mt-5"><MfaEnrollment security={state.security} onChange={refresh}/></Card>
 {ready||state.details?<Card className="mt-5"><div className="verification-step-title"><FileCheck2/><h2>بياناتك المهنية</h2></div><div className="verification-form"><TextField label="الاسم الكامل كما في الكارنيه" value={form.fullName} onChange={set('fullName')} disabled={locked} maxLength={150}/><div className="verification-two-columns"><TextField label="رقم الهاتف" type="tel" ltr value={form.phone} onChange={set('phone')} disabled={locked}/><TextField label="المحافظة" value={form.governorate} onChange={set('governorate')} disabled={locked}/></div><TextField label="التخصص أو المادة" value={form.subject} onChange={set('subject')} disabled={locked}/><TextField label="المؤهل والجامعة أو الجهة المانحة" value={form.qualification} onChange={set('qualification')} disabled={locked} maxLength={300}/><div className="verification-two-columns"><TextField label="سنوات الخبرة" type="number" min={0} max={70} inputMode="numeric" ltr value={form.experienceYears} onChange={e=>setForm(current=>({...current,experienceYears:Number(e.target.value)}))} disabled={locked}/><TextField label="رقم عضوية النقابة" value={form.membershipNumber} onChange={set('membershipNumber')} disabled={locked}/></div><div className="verification-private-note"><LockKeyhole size={18}/><p>صور الكارنيه خاصة بالتوثيق. يطّلع عليها المدرس والسوبر أدمن فقط، ولا تظهر في ملفك العام.</p></div><div className="verification-two-columns"><VerificationDocumentUpload label="الوجه الأمامي للكارنيه" value={form.frontDocumentId} disabled={locked} onChange={id=>setForm(current=>({...current,frontDocumentId:id}))} onBusyChange={busy=>setUploading(n=>Math.max(0,n+(busy?1:-1)))}/><VerificationDocumentUpload label="الوجه الخلفي للكارنيه" value={form.backDocumentId} disabled={locked} onChange={id=>setForm(current=>({...current,backDocumentId:id}))} onBusyChange={busy=>setUploading(n=>Math.max(0,n+(busy?1:-1)))}/></div>{error&&<Banner tone="error">{error}</Banner>}</div></Card>:<Card className="mt-5"><p>أكمل الربط والمصادقة الثنائية لفتح نموذج البيانات ورفع الكارنيه.</p></Card>}
 </Page>{ready&&!locked&&<ActionBar><Button block disabled={uploading>0} loading={send.isPending} onClick={submit}><Send/>{state.status==='not_submitted'?'إرسال طلب التوثيق':'إعادة إرسال الطلب'}</Button></ActionBar>}</>;
}
