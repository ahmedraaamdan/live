import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { db, initDb, usersTable, lecturesTable, bookingsTable, paymentsTable, walletEntriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { recordSale, releaseLectureFunds, reverseBooking, teacherBalances } from "./ledger";

test('repeated refunds of released funds never create a negative balance',async()=>{
  if(process.env.DATABASE_URL)throw Error('Ledger fixture must use a separate embedded database');
  const here=path.dirname(fileURLToPath(import.meta.url));
  const root=path.resolve(here,'../../../../tmp');
  await mkdir(root,{recursive:true});
  const dir=await mkdtemp(path.join(root,'ledger-test-'));
  try{
    await initDb({migrationsFolder:path.resolve(here,'../../../../lib/db/drizzle'),pgliteDir:dir});
    const [teacher,student]=await db.insert(usersTable).values([{role:'teacher',name:'مدرس اختبار',email:'ledger-t@test.invalid',passwordHash:'test-only'},{role:'student',name:'طالب اختبار',email:'ledger-s@test.invalid',passwordHash:'test-only'}]).returning();
    const [lecture]=await db.insert(lecturesTable).values({teacherId:teacher!.id,code:'LEDGER1',title:'حصة اختبار',subject:'physics',grade:'s3',startsAt:new Date(),durationMin:60,priceCents:10000,status:'ended'}).returning();
    const paymentId=randomUUID();
    const [booking]=await db.insert(bookingsTable).values({lectureId:lecture!.id,studentId:student!.id,status:'confirmed',pricePaidCents:10000,confirmedPaymentId:paymentId}).returning();
    const [payment]=await db.insert(paymentsTable).values({id:paymentId,bookingId:booking!.id,userId:student!.id,provider:'easykash',amountCents:10000,status:'succeeded'}).returning();
    await db.transaction(tx=>recordSale(tx,{lecture:lecture!,booking:booking!,payment:payment!}));
    await releaseLectureFunds(lecture!.id);
    assert.equal((await teacherBalances(teacher!.id)).availableCents,9000);
    await Promise.all([db.transaction(tx=>reverseBooking(tx,booking!.id,'اختبار',paymentId)),db.transaction(tx=>reverseBooking(tx,booking!.id,'إعادة الاختبار',paymentId))]);
    assert.equal((await teacherBalances(teacher!.id)).availableCents,0);
    const entries=await db.select().from(walletEntriesTable).where(eq(walletEntriesTable.paymentId,paymentId));
    assert.equal(entries.filter(e=>e.kind==='refund').length,2);
  }finally{
    if(db)await (db as unknown as {$client:{close:()=>Promise<void>}}).$client.close();
    const resolved=path.resolve(dir);assert.equal(path.dirname(resolved),root);assert.ok(path.basename(resolved).startsWith('ledger-test-'));
    await rm(resolved,{recursive:true,force:true});
  }
});
