import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const {outputFiles}=await build({entryPoints:['../../tmp/agent-live-oauth-bridge.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {liveOAuthDestination}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const secret='fixture-secret';let checks=0;
for(const provider of ['google','facebook']){const unsigned=`glive.v1.${provider}.${Math.floor(Date.now()/1000)+600}.${'a'.repeat(64)}`;const state=unsigned+'.'+createHmac('sha256',secret).update('gahez-live-broker\0'+unsigned).digest('hex');const input=new URL('https://agent.gahez.space/callback');input.searchParams.set('state',state);input.searchParams.set('code','one-use-fixture-code');input.searchParams.set('returnTo','https://untrusted.example');const target=new URL(liveOAuthDestination(input.href,provider,secret));assert.equal(target.origin,'https://app.live.gahez.space');assert.equal(target.pathname,`/api/auth/social/${provider}/callback`);assert.equal(target.searchParams.get('returnTo'),null);checks+=3;assert.throws(()=>liveOAuthDestination(input.href,provider,'wrong-secret'));checks++;}
assert.equal(liveOAuthDestination('https://agent.gahez.space/callback?state=ordinary-agent-state','google',secret),null);checks++;console.log(`${checks} shared OAuth bridge checks passed`);
