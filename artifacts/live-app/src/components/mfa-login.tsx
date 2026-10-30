import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import type { AuthResult } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { Banner, Button, TextField } from '@/ui';
export function MfaLogin({ challenge, onAuthenticated, onBack }: { challenge: string; onAuthenticated: (result: AuthResult) => void; onBack: () => void }) {
 const [code,setCode]=useState(''),[recovery,setRecovery]=useState(false);
 const verify=useMutation({mutationFn:()=>api<AuthResult>('/auth/mfa',{body:{challenge,code}}),onSuccess:onAuthenticated});
 return <form className="flex flex-col gap-5" onSubmit={event=>{event.preventDefault();verify.mutate();}}><div className="flex gap-3 text-body-md"><ShieldCheck className="shrink-0 text-primary"/><p>{recovery?'أدخل أحد رموز الاسترداد المحفوظة لديك. يُستخدم كل رمز مرة واحدة.':'افتح تطبيق المصادقة وأدخل الرمز الظاهر لإكمال الدخول.'}</p></div>{verify.isError&&<Banner tone="error">{errorMessage(verify.error)}</Banner>}<TextField label={recovery?'رمز الاسترداد':'رمز المصادقة'} autoComplete="one-time-code" inputMode={recovery?'text':'numeric'} ltr value={code} onChange={e=>setCode(e.target.value)} maxLength={recovery?24:6} autoFocus/><Button type="submit" block loading={verify.isPending} disabled={!code.trim()}>تأكيد الدخول</Button><Button type="button" variant="text" onClick={()=>{setRecovery(v=>!v);setCode('');verify.reset();}}>{recovery?'استخدام تطبيق المصادقة':'استخدام رمز استرداد'}</Button><Button type="button" variant="text" onClick={onBack}>العودة إلى كلمة المرور</Button></form>;
}
