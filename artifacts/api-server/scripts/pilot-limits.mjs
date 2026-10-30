const API=process.env.API??'http://localhost:8080/api';
if(!['localhost','127.0.0.1'].includes(new URL(API).hostname))throw Error('Isolated localhost only');
const config=await fetch(API+'/config').then(r=>r.json());
if(config.paymentProvider!=='mock'||config.liveParticipantLimit!==26||config.liveRoomLimit!==1)throw Error('Expected isolated mock pilot configuration');
let checks=0; function check(label,value){if(!value)throw Error(label);checks++;console.log('✓ '+label);}
async function call(path,body,token){const r=await fetch(API+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();return {status:r.status,data};}
const t=(await call('/auth/signup',{role:'teacher',name:'مدرس اختبار',email:`pilot${Date.now()}@test.com`,password:'password123',subject:'physics'})).data;
const lecture={title:'حصة تجربة محدودة',subject:'physics',grade:'s3',startsAt:new Date(Date.now()+600000).toISOString(),durationMin:60,priceCents:0};
check('reject capacity above pilot limit',(await call('/lectures',{...lecture,capacity:26},t.token)).status===400);
const a=(await call('/lectures',lecture,t.token)).data; const b=(await call('/lectures',lecture,t.token)).data;
check('default capacity is 25 students',a.capacity===25&&b.capacity===25);
const outcomes=await Promise.all([a,b].map(l=>call(`/lectures/${l.id}/live/start`,{},t.token)));
check('one concurrent live start only',outcomes.filter(r=>r.status===200).length===1&&outcomes.filter(r=>r.status===400).length===1);
const winner=outcomes[0].status===200?a:b,other=winner.id===a.id?b:a;
check('starting same live lecture is idempotent',(await call(`/lectures/${winner.id}/live/start`,{},t.token)).status===200);
await call(`/lectures/${winner.id}/live/end`,{},t.token);
check('slot becomes available after ending',(await call(`/lectures/${other.id}/live/start`,{},t.token)).status===200);
await call(`/lectures/${other.id}/live/end`,{},t.token);
console.log(`${checks} pilot-limit checks passed`);
