import { Router } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, securityChallengesTable, sessionsTable, userSecurityTable, usersTable } from "@workspace/db";
import { bearer, requireRole, sha256 } from "../lib/auth";
import { requireDirectAccount } from "../lib/teacher-verification";
import { authorizationUrl, brokerState, exchangeIdentity, providerConfig, validBrokerState, type SocialProvider } from "../lib/social-identity";
import { badRequest, param } from "../lib/http";
import { openSecret, sealSecret } from "../lib/two-factor";
import { env } from "../lib/env";
const router=Router();
function provider(value: unknown): SocialProvider { if(value!=="google"&&value!=="facebook")throw badRequest("مزود الربط غير متاح");return value; }
router.post("/teacher/verification/social/:provider/start",async(req,res)=>{
 const user=requireRole(req,"teacher");requireDirectAccount(req);const service=provider(req.params.provider),config=providerConfig(service);
 if(!config.clientId||!config.secret)throw badRequest("ربط هذا الحساب غير مهيأ بعد. تواصل مع الإدارة.");
 const state=brokerState(service,config.secret),nonce=randomBytes(32).toString("hex"),verifier=randomBytes(48).toString("base64url");
 await db.delete(securityChallengesTable).where(and(eq(securityChallengesTable.userId,user.id),eq(securityChallengesTable.purpose,`link_${service}`)));
 await db.insert(securityChallengesTable).values({tokenHash:sha256(state),userId:user.id,purpose:`link_${service}`,sessionHash:sha256(bearer(req)!),payloadEnc:sealSecret(JSON.stringify({nonce,verifier}),"oauth"),expiresAt:new Date(Date.now()+600000)});
 res.cookie(`gl_link_${service}`,nonce,{httpOnly:true,secure:env.isProd,sameSite:"lax",path:`/api/auth/social/${service}`,maxAge:600000});
 res.json({url:authorizationUrl(service,state,nonce,verifier)});
});
router.get("/auth/social/:provider/callback",async(req,res)=>{
 const service=provider(req.params.provider),config=providerConfig(service),state=param(req.query.state as string);
 const finish=(status:string)=>res.redirect(303,`${env.appUrl}/t/verification?social=${status}`);
 if(!config.secret||!validBrokerState(state,service,config.secret))return void finish("invalid");
 const pending=await db.query.securityChallengesTable.findFirst({where:and(eq(securityChallengesTable.tokenHash,sha256(state)),eq(securityChallengesTable.purpose,`link_${service}`),gt(securityChallengesTable.expiresAt,new Date()))});
 if(!pending?.payloadEnc)return void finish("expired");
 let payload:{nonce:string;verifier:string};try{payload=JSON.parse(openSecret(pending.payloadEnc,"oauth"));}catch{return void finish("invalid");}
 const cookie=(req.headers.cookie??"").split(";").map(value=>value.trim()).find(value=>value.startsWith(`gl_link_${service}=`))?.slice(`gl_link_${service}=`.length)??"";
 if(!cookie||!timingSafeEqual(Buffer.from(sha256(cookie)),Buffer.from(sha256(payload.nonce))))return void finish("invalid");
 const [consumed]=await db.delete(securityChallengesTable).where(and(eq(securityChallengesTable.tokenHash,pending.tokenHash),gt(securityChallengesTable.expiresAt,new Date()))).returning();
 if(!consumed)return void finish("expired");
 res.clearCookie(`gl_link_${service}`,{httpOnly:true,secure:env.isProd,sameSite:"lax",path:`/api/auth/social/${service}`});
 const session=await db.query.sessionsTable.findFirst({where:and(eq(sessionsTable.tokenHash,pending.sessionHash??""),eq(sessionsTable.userId,pending.userId),gt(sessionsTable.expiresAt,new Date()))});
 const user=await db.query.usersTable.findFirst({where:eq(usersTable.id,pending.userId)});
 if(!session||session.actorTokenHash||!user||user.suspended||user.role!=="teacher")return void finish("expired");
 if(req.query.error)return void finish("cancelled");
 const code=param(req.query.code as string);if(!code||code.length>4096||!pending.payloadEnc)return void finish("invalid");
 try{
  const identity=await exchangeIdentity(service,code,payload.nonce,payload.verifier);
  const fields=service==="google"?{googleSubject:identity.subject,googleEmail:identity.email}:{facebookSubject:identity.subject,facebookName:identity.name,facebookEmail:identity.email||null};
  // Unique provider subjects stop one social identity from linking to several teacher accounts.
  await db.insert(userSecurityTable).values({userId:user.id,...fields}).onConflictDoUpdate({target:userSecurityTable.userId,set:fields});
  return void finish("linked");
 }catch{return void finish("failed");}
});
export default router;
