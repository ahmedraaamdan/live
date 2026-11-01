import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import type { VerificationDocumentDTO } from '@workspace/live-core';
import { API_BASE, getToken, errorMessage } from '@/lib/api';
import { Button, toast } from '@/ui';
import { prepareImage } from './media-upload';
export function PrivateDocumentImage({ id, label }: { id: string; label: string }) {
 const [url,setUrl]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{let cancelled=false,objectUrl='';const controller=new AbortController();setUrl('');setError(false);fetch(`${API_BASE}/api/teacher/verification/documents/${id}`,{headers:{Authorization:`Bearer ${getToken()}`},signal:controller.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('الصورة غير متاحة');const blob=await response.blob();if(!cancelled){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(()=>{if(!cancelled)setError(true);});return()=>{cancelled=true;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[id]);
 return error?<p className="text-error text-body-sm">تعذر تحميل الصورة. حدّث الصفحة للمحاولة مجددًا.</p>:url?<a href={url} target="_blank" rel="noopener noreferrer" className="verification-private-image"><img src={url} alt={label}/><span>فتح الصورة بالحجم الكامل</span></a>:<div className="skeleton h-40 rounded-xl" role="status" aria-label="تحميل الصورة الخاصة"/>;
}
export function VerificationDocumentUpload({ value,onChange,label,disabled,onBusyChange }: {value:string;onChange:(id:string)=>void;label:string;disabled?:boolean;onBusyChange:(value:boolean)=>void}) {
 const input=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false);
 const choose=async(file:File|undefined)=>{if(!file||busy)return;setBusy(true);onBusyChange(true);try{if(file.size>25*1024*1024)throw new Error('اختر صورة أصغر من 25 ميغابايت');const photo=await prepareImage(file,2000);const response=await fetch(`${API_BASE}/api/teacher/verification/documents`,{method:'POST',headers:{Authorization:`Bearer ${getToken()}`,'Content-Type':photo.type,'X-Filename':encodeURIComponent(photo.name)},body:photo,signal:AbortSignal.timeout(60000)});const data=await response.json() as VerificationDocumentDTO&{error?:string};if(!response.ok)throw new Error(data.error??'تعذر رفع الصورة');onChange(data.id);toast('رُفعت صورة التوثيق الخاصة');}catch(error){toast(errorMessage(error));}finally{setBusy(false);onBusyChange(false);if(input.current)input.current.value='';}};
 return <div className="verification-document"><h3>{label}</h3>{value?<PrivateDocumentImage id={value} label={label}/>:<div className="verification-document-placeholder"><Camera/><p>صورة واضحة يظهر فيها المستند كاملًا</p></div>}<input ref={input} className="sr-only" tabIndex={-1} type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" aria-label={`رفع ${label}`} onChange={event=>void choose(event.target.files?.[0])}/>{!disabled&&<Button type="button" variant="tonal" block loading={busy} onClick={()=>input.current?.click()}><ImagePlus/>{value?'تغيير الصورة':'رفع الصورة'}</Button>}</div>;
}
