const API=process.env.API??'http://localhost:8080/api';
if(!['localhost','127.0.0.1'].includes(new URL(API).hostname))throw Error('Isolated localhost only');
const config=await fetch(API+'/config').then(r=>r.json());
if(config.paymentProvider!=='paymob'||config.paymentConfigured||config.liveConfigured)throw Error('Expected isolated unconfigured production integration');
async function call(path,body,token){const r=await fetch(API+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
const stamp=Date.now();const t=(await call('/auth/signup',{role:'teacher',name:'مدرس اختبار',email:`t${stamp}@test.com`,password:'password123',subject:'physics'})).data;const s=(await call('/auth/signup',{role:'student',name:'طالب اختبار',email:`s${stamp}@test.com`,password:'password123',grade:'s3'})).data;
const l=(await call('/lectures',{title:'حصة غير جاهزة للدفع',subject:'physics',grade:'s3',startsAt:new Date(Date.now()+600000).toISOString(),durationMin:60,priceCents:10000},t.token)).data;
if((await call(`/lectures/${l.id}/book`,{},s.token)).data.code!=='payments_unavailable')throw Error('Paid booking should fail before reserving a seat');
if((await call(`/lectures/${l.id}`,null,s.token)).data.booking!==null)throw Error('No unpaid hold should be created');
if((await call(`/lectures/${l.id}/live/start`,{},t.token)).data.code!=='live_unavailable')throw Error('Unconfigured live start should fail');
if((await call(`/lectures/${l.id}`,null,t.token)).data.status!=='scheduled')throw Error('Failed live start must not mark lecture live');
console.log('4 integration-readiness checks passed');
