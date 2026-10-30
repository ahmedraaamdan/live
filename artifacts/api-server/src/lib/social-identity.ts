import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { env } from "./env";
export type SocialProvider = "google" | "facebook";
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export function providerConfig(provider: SocialProvider) {
  const clientId = provider === "google" ? env.security.googleClientId : env.security.facebookAppId;
  const secret = provider === "google" ? env.security.googleClientSecret : env.security.facebookAppSecret;
  const path = provider === "google" ? "/api/integrations/google/callback" : "/api/connect/facebook/callback";
  return { clientId, secret, redirectUri: env.security.brokerUrl ? new URL(path, env.security.brokerUrl).href : `${env.apiUrl}/api/auth/social/${provider}/callback` };
}
export function brokerState(provider: SocialProvider, secret: string, nonce = randomBytes(32).toString("hex"), expires = Math.floor(Date.now() / 1000) + 600) {
  const unsigned = `glive.v1.${provider}.${expires}.${nonce}`;
  return `${unsigned}.${createHmac("sha256", secret).update(`gahez-live-broker\0${unsigned}`).digest("hex")}`;
}
export function validBrokerState(value: string, provider: SocialProvider, secret: string) {
  const match = /^glive\.v1\.(google|facebook)\.(\d{10})\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(value);
  if (!match || match[1] !== provider || Number(match[2]) <= Date.now() / 1000 || Number(match[2]) > Date.now() / 1000 + 610) return false;
  const expected = brokerState(provider, secret, match[3]!, Number(match[2]));
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
export function authorizationUrl(provider: SocialProvider, state: string, nonce: string, verifier: string) {
  const config = providerConfig(provider);
  const url = new URL(provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : `https://www.facebook.com/${env.security.facebookVersion}/dialog/oauth`);
  for (const [key, value] of Object.entries({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", state, scope: provider === "google" ? "openid email profile" : "public_profile,email" })) url.searchParams.set(key, value);
  if (provider === "google") { url.searchParams.set("nonce", nonce); url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url")); url.searchParams.set("code_challenge_method", "S256"); url.searchParams.set("prompt", "select_account"); }
  if (provider === "facebook" && env.security.facebookConfigId) {
    url.searchParams.delete("scope");
    url.searchParams.set("config_id", env.security.facebookConfigId);
  }
  return url.href;
}
export async function verifyGoogleIdentity(token: string, clientId: string, nonce: string, keys: JWTVerifyGetKey = googleKeys) {
  const { payload } = await jwtVerify(token, keys, { audience: clientId, issuer: ["https://accounts.google.com", "accounts.google.com"], algorithms: ["RS256"] });
  if (payload.nonce !== nonce || payload.email_verified !== true || typeof payload.email !== "string" || !payload.sub || payload.sub.length > 255) throw new Error("Invalid Google identity");
  return { subject: payload.sub, email: payload.email.toLowerCase(), name: typeof payload.name === "string" ? payload.name : "" };
}
export async function exchangeIdentity(provider: SocialProvider, code: string, nonce: string, verifier: string) {
  const config = providerConfig(provider);
  if (provider === "google") {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.secret, code, redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: verifier }), signal: AbortSignal.timeout(15000) });
    const data = await response.json() as { id_token?: string };
    if (!response.ok || !data.id_token) throw new Error("Google exchange failed");
    return verifyGoogleIdentity(data.id_token, config.clientId, nonce);
  }
  const graph = `https://graph.facebook.com/${env.security.facebookVersion}`;
  const exchange = await fetch(`${graph}/oauth/access_token`, { method: "POST", body: new URLSearchParams({ client_id: config.clientId, client_secret: config.secret, code, redirect_uri: config.redirectUri }), signal: AbortSignal.timeout(15000) });
  const token = await exchange.json() as { access_token?: string };
  if (!exchange.ok || !token.access_token) throw new Error("Facebook exchange failed");
  const debugUrl = new URL(`${graph}/debug_token`); debugUrl.searchParams.set("input_token", token.access_token); debugUrl.searchParams.set("access_token", `${config.clientId}|${config.secret}`);
  const debug = await fetch(debugUrl, { signal: AbortSignal.timeout(15000) });
  const details = await debug.json() as { data?: { is_valid?: boolean; app_id?: string; user_id?: string; expires_at?: number; type?: string } };
  const d = details.data;
  if (!debug.ok || !d?.is_valid || String(d.app_id) !== config.clientId || d.type !== "USER" || !d.user_id || (d.expires_at ?? 0) <= Date.now() / 1000) throw new Error("Invalid Facebook identity");
  const meUrl = new URL(`${graph}/me`); meUrl.searchParams.set("fields", "id,name,email"); meUrl.searchParams.set("access_token", token.access_token); meUrl.searchParams.set("appsecret_proof", createHmac("sha256", config.secret).update(token.access_token).digest("hex"));
  const response = await fetch(meUrl, { signal: AbortSignal.timeout(15000) });
  const me = await response.json() as { id?: string; name?: string; email?: string };
  if (!response.ok || me.id !== d.user_id) throw new Error("Facebook identity mismatch");
  return { subject: me.id!, name: me.name ?? "", email: me.email ?? "" };
}
