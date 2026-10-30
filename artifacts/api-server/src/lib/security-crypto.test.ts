import test from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { base32, newTotpSecret, totp, totpStep, sealSecret, openSecret, sealPrivateDocument, openPrivateDocument, newRecoveryCodes, recoveryDigest } from "./two-factor";
import { brokerState, validBrokerState, verifyGoogleIdentity } from "./social-identity";

test("TOTP matches RFC 6238 and rejects replayed time steps", () => {
 const secret=base32(Buffer.from("12345678901234567890"));
 for(const [seconds,expected] of [[59,"94287082"],[1111111109,"07081804"],[1111111111,"14050471"],[1234567890,"89005924"],[2000000000,"69279037"],[20000000000,"65353130"]] as const) assert.equal(totp(secret,Math.floor(seconds/30),8),expected);
 const now=1730000000000,step=Math.floor(now/30000),code=totp(secret,step);
 assert.equal(totpStep(secret,code,-1,now),step);assert.equal(totpStep(secret,code,step,now),null);assert.equal(totpStep(secret,"12345",-1,now),null);
});
test("security secrets and identity images are authenticated and purpose-bound",()=>{
 const secret=newTotpSecret(),sealed=sealSecret(secret);assert.equal(openSecret(sealed),secret);assert.ok(!sealed.includes(secret));assert.throws(()=>openSecret(sealed,"oauth"));
 const photo=Buffer.from("private membership card bytes"),encrypted=sealPrivateDocument(photo,"owner-document-a");assert.deepEqual(openPrivateDocument(encrypted,"owner-document-a"),photo);assert.ok(!encrypted.includes(photo));assert.throws(()=>openPrivateDocument(encrypted,"another-document"));encrypted[encrypted.length-1]!^=1;assert.throws(()=>openPrivateDocument(encrypted,"owner-document-a"));
 const codes=newRecoveryCodes();assert.equal(new Set(codes.map(recoveryDigest)).size,10);assert.equal(recoveryDigest(codes[0]!),recoveryDigest(codes[0]!.toLowerCase().replaceAll("-","")));
});
test("OAuth broker state is signed, short-lived and bound to its provider",()=>{
 const state=brokerState("google","fixture-secret");assert.equal(validBrokerState(state,"google","fixture-secret"),true);assert.equal(validBrokerState(state,"facebook","fixture-secret"),false);assert.equal(validBrokerState(state,"google","other-secret"),false);assert.equal(validBrokerState(state.slice(0,-1)+(state.endsWith("0")?"1":"0"),"google","fixture-secret"),false);assert.equal(validBrokerState(brokerState("google","fixture-secret",undefined,Math.floor(Date.now()/1000)-1),"google","fixture-secret"),false);
});
test("Google identity verification checks signature, audience, expiry and nonce",async()=>{
 const {publicKey,privateKey}=await generateKeyPair("RS256"),jwk=await exportJWK(publicKey),keys=createLocalJWKSet({keys:[{...jwk,kid:"fixture",alg:"RS256"}]});
 const sign=(payload:Record<string,unknown>,aud="fixture-client",expires="5m")=>new SignJWT(payload).setProtectedHeader({alg:"RS256",kid:"fixture"}).setIssuer("https://accounts.google.com").setAudience(aud).setSubject("google-fixture-user").setIssuedAt().setExpirationTime(expires).sign(privateKey);
 const token=await sign({nonce:"expected",email:"teacher@example.com",email_verified:true});assert.equal((await verifyGoogleIdentity(token,"fixture-client","expected",keys)).subject,"google-fixture-user");
 await assert.rejects(verifyGoogleIdentity(token,"other-client","expected",keys));await assert.rejects(verifyGoogleIdentity(token,"fixture-client","wrong-nonce",keys));await assert.rejects(verifyGoogleIdentity(await sign({nonce:"expected",email:"teacher@example.com",email_verified:false}),"fixture-client","expected",keys));await assert.rejects(verifyGoogleIdentity(await sign({nonce:"expected",email:"teacher@example.com",email_verified:true},"fixture-client","-1m"),"fixture-client","expected",keys));
});
