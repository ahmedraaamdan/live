/**
 * live.gahez.space: the built marketing site plus two form endpoints.
 *
 * Static files come from dist/public, where generate-seo-html.mjs has
 * already written an index.html per route, so a crawler gets each page's own
 * title and description without running JavaScript.
 *
 * POST /api/waitlist takes the pre-launch form and POST /api/contact the
 * contact page's form. Each emails the team the details (reply-to the
 * visitor) and sends the visitor an acknowledgement, both over Zoho SMTP
 * from support@gahez.space (the only From address Zoho accepts), so every
 * Gahez product's leads land in the same inbox. Every email is rendered
 * with the shared GAHEZ template (email-template.mjs, a copy of the one in
 * Gahez systems), as HTML plus a plain-text twin.
 *
 * One dependency, nodemailer (itself dependency-free), for SMTP; the rest is
 * Node's own http server.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { esc, renderEmail } from './email-template.mjs';

const ROOT = fileURLToPath(new URL('./dist/public/', import.meta.url));
const PORT = Number(process.env.PORT || 3000);
// SMTP_* come from /srv/live/.env (never committed). Zoho: smtp.zoho.com,
// 465 with implicit TLS, and From must be the authenticated mailbox.
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SUPPORT_EMAIL = 'support@gahez.space';
const MAIL_FROM = process.env.MAIL_FROM || `Gahez جاهز <${SUPPORT_EMAIL}>`;
const LEAD_TO = (process.env.LEAD_TO || SUPPORT_EMAIL).split(',').map((s) => s.trim()).filter(Boolean);
const MAIL_READY = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const ROLE_LABELS = { student: 'طالب', teacher: 'مدرس', parent: 'ولي أمر' };

// ------------------------------------------------------------------ static

async function fileAt(path) {
  try {
    const info = await stat(path);
    return info.isFile() ? path : null;
  } catch {
    return null;
  }
}

async function resolveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const target = normalize(join(ROOT, decoded));
  // Nothing outside dist/public, whatever the URL says: join() has already
  // resolved any "..", so a target that escaped no longer starts with ROOT.
  const base = ROOT.endsWith(sep) ? ROOT : ROOT + sep;
  if (!(target + sep).startsWith(base)) return null;
  if (decoded.endsWith('/')) return fileAt(join(target, 'index.html'));
  return (await fileAt(target)) ?? (await fileAt(join(target, 'index.html')));
}

function cacheFor(path) {
  // Vite fingerprints everything under /assets, so it can be kept for good.
  if (path.includes(`${sep}assets${sep}`)) return 'public, max-age=31536000, immutable';
  if (path.endsWith('.html')) return 'no-cache';
  return 'public, max-age=3600';
}

const NOT_FOUND_PAGE = join(ROOT, '404', 'index.html');

async function serveStatic(req, res, urlPath) {
  const found = await resolveStatic(urlPath);
  // An unknown path gets the generated 404 page (noindex, no canonical) with
  // a 404 status: the app still boots on it and the router shows its
  // not-found page, and crawlers learn the page does not exist.
  const missing = !found || found === NOT_FOUND_PAGE;
  const path = missing ? ((await fileAt(NOT_FOUND_PAGE)) ?? join(ROOT, 'index.html')) : found;
  const body = await readFile(path);
  res.writeHead(missing ? 404 : 200, {
    'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': missing ? 'no-cache' : cacheFor(path),
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

// --------------------------------------------------------------- redirects

/** Old paths that moved. Exact match, after trailing-slash removal. */
const MOVED = { '/browse': '/classes', '/index.html': '/' };

/**
 * One canonical URL per page, answered with a single 301: no trailing slash
 * (except the root), and moved paths sent to their new home. The query
 * string is kept.
 */
function redirectFor(url) {
  let path = url.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '') || '/';
  path = MOVED[path] ?? path;
  if (path === url.pathname) return null;
  // Never emit "//host": a browser reads that as another site.
  return path.replace(/^\/{2,}/, '/') + url.search;
}

// ------------------------------------------------------------------- forms

// The acknowledgement goes to whatever address is typed, so without a limit
// the forms would let anyone mail anyone from our domain. Five a device per
// ten minutes, shared by both forms, is plenty for a person and useless for
// a spammer.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const attempts = new Map();

function allowed(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    attempts.set(ip, recent);
    return false;
  }
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 10000) attempts.clear();
  return true;
}

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store' });
  res.end(text);
}

function readBody(req, limit = 8 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let transport = null;
function mailer() {
  transport ??= nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  return transport;
}

async function sendEmail({ to, replyTo, subject, html, text }) {
  await mailer().sendMail({ from: MAIL_FROM, to, replyTo, subject, html, text });
}

const LIVE_URL = 'https://live.gahez.space/';
const INSTAGRAM_URL = 'https://www.instagram.com/gahez.space/';

/**
 * wa.me wants the full international number in digits only. Egyptian
 * numbers are usually typed locally (01xxxxxxxxx), so those get the 20
 * country code; anything else is taken as already international.
 */
function whatsappLink(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (/^01\d{9}$/.test(digits)) digits = `2${digits}`;
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

/**
 * The team's reply button: WhatsApp when the visitor left a usable number,
 * otherwise an email back to them.
 */
function replyCta(email, phone, subject) {
  const wa = whatsappLink(phone);
  if (wa) return { cta: { label: 'ردّ على واتساب', url: wa }, secondary: { label: `أو ابعت إيميل لـ ${email}`, url: `mailto:${email}` } };
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
  return { cta: { label: 'ردّ بالإيميل', url: mailto } };
}

const contactRows = (name, email, phone) => [
  ['الاسم', esc(name)],
  ['الإيميل', `<a href="mailto:${esc(email)}" style="color:#E11D48;text-decoration:none">${esc(email)}</a>`],
  ['الموبايل', phone ? `<span dir="ltr">${esc(phone)}</span>` : '—'],
];
const TEAM_NOTE = 'وصلك الإيميل ده لأن حد ملا فورم على live.gahez.space. ردّك على الإيميل هيروح للزائر مباشرة.';

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
}

/**
 * The checks both forms share: rate limit, JSON body, honeypot, a name and a
 * valid email, and mail being configured. Returns the cleaned input, or null
 * once it has answered the request itself.
 */
async function intake(req, res, label, bodyLimit) {
  if (!allowed(clientIp(req))) {
    json(res, 429, { success: false, error: 'rate_limited' });
    return null;
  }
  let data;
  try {
    data = JSON.parse(await readBody(req, bodyLimit));
  } catch {
    json(res, 400, { success: false, error: 'bad_request' });
    return null;
  }
  if (!data || typeof data !== 'object') {
    json(res, 400, { success: false, error: 'bad_request' });
    return null;
  }
  // A bot filled the hidden field: pretend it worked, send nothing.
  if (data._gotcha) {
    json(res, 200, { success: true });
    return null;
  }
  const name = oneLine(data.name).slice(0, 120);
  const email = String(data.email ?? '').trim().slice(0, 200);
  const phone = oneLine(data.phone).slice(0, 40);
  if (!name || !EMAIL_RE.test(email)) {
    json(res, 422, { success: false, error: 'validation' });
    return null;
  }
  if (!MAIL_READY) {
    console.error(`${label}: SMTP_HOST / SMTP_USER / SMTP_PASS are not set`);
    json(res, 503, { success: false, error: 'not_configured' });
    return null;
  }
  return { data, name, email, phone };
}

/** The lead to the team, then the acknowledgement to the visitor. */
async function deliver(res, label, lead, ack) {
  try {
    await sendEmail(lead);
    await sendEmail(ack);
  } catch (error) {
    console.error(`${label}: send failed`, error instanceof Error ? error.message : error);
    json(res, 502, { success: false, error: 'send_failed' });
    return false;
  }
  json(res, 200, { success: true });
  return true;
}

async function waitlist(req, res) {
  const input = await intake(req, res, 'waitlist');
  if (!input) return;
  const { data, name, email, phone } = input;
  const role = ROLE_LABELS[data.role] ? data.role : 'student';

  const notify = renderEmail({
    product: 'live',
    robot: 'desk',
    preheader: `${name} (${ROLE_LABELS[role]}) حجز مكانه في قايمة انتظار Gahez Live.`,
    title: 'طلب انتظار جديد على Gahez Live',
    intro: `<strong>${esc(name)}</strong> لسه حاجز مكانه في قايمة الانتظار. دي بياناته:`,
    rows: [...contactRows(name, email, phone), ['نوع الحساب', ROLE_LABELS[role]], ['المنتج', 'Gahez Live']],
    ...replyCta(email, phone, 'مكانك في Gahez Live محجوز'),
    note: TEAM_NOTE,
  });
  const ack = renderEmail({
    product: 'live',
    robot: 'dance',
    preheader: 'مكانك في Gahez Live محجوز، وهنبعتلك أول ما التسجيل يفتح يوم 1 يناير 2027.',
    title: 'مكانك محجوز! 🎉',
    intro: `أهلاً ${esc(name)}، مكانك في <strong>Gahez Live</strong> اتحجز خلاص. التسجيل بيفتح يوم الإطلاق، <strong>1 يناير 2027</strong>، وهنبعتلك على الإيميل ده أول ما يفتح.`,
    body: '<p style="margin:14px 0 0">لحد ما نفتح، تابعنا على إنستجرام عشان تشوف الجديد أول بأول. وعندك أي سؤال؟ ردّ على الإيميل ده على طول.</p>',
    cta: { label: 'تابعنا على إنستجرام', url: INSTAGRAM_URL },
    secondary: { label: 'live.gahez.space', url: LIVE_URL },
    note: 'وصلك الإيميل ده لأنك سجّلت في قايمة انتظار Gahez Live.',
  });

  const sent = await deliver(
    res,
    'waitlist',
    { to: LEAD_TO, replyTo: email, subject: `انتظار Gahez Live — ${name}`, ...notify },
    { to: [email], replyTo: SUPPORT_EMAIL, subject: 'مكانك محجوز — جاهز Live', ...ack },
  );
  if (sent) console.log(`waitlist: ${role} joined`);
}

async function contact(req, res) {
  // A message can run to a few thousand Arabic characters (2 bytes each).
  const input = await intake(req, res, 'contact', 32 * 1024);
  if (!input) return;
  const { data, name, email, phone } = input;
  const subject = oneLine(data.subject).slice(0, 200);
  const message = String(data.message ?? '').trim().slice(0, 5000);
  if (!subject || !message) return json(res, 422, { success: false, error: 'validation' });

  const notify = renderEmail({
    product: 'live',
    robot: 'desk',
    preheader: `${name}: ${subject}`,
    title: 'رسالة جديدة من صفحة التواصل',
    intro: `<strong>${esc(name)}</strong> بعت رسالة من صفحة التواصل على Gahez Live:`,
    rows: [
      ...contactRows(name, email, phone),
      ['الموضوع', esc(subject)],
      ['الرسالة', `<div style="font-weight:400;white-space:pre-wrap;line-height:1.8">${esc(message)}</div>`],
      ['المنتج', 'Gahez Live'],
    ],
    ...replyCta(email, phone, `Re: ${subject}`),
    note: TEAM_NOTE,
  });
  const ack = renderEmail({
    product: 'live',
    robot: 'phone',
    preheader: `وصلتنا رسالتك بخصوص «${subject}»، وهنرد عليك في أقرب وقت.`,
    title: 'وصلتنا رسالتك',
    intro: `أهلاً ${esc(name)}، وصلتنا رسالتك بخصوص «${esc(subject)}»، وهنراجعها ونرد عليك في أقرب وقت.`,
    body: '<p style="margin:14px 0 0">لو حابب تضيف حاجة، ردّ على الإيميل ده على طول. ولو مستعجل، كلّمنا على واتساب.</p>',
    cta: { label: 'كلّمنا على واتساب', url: 'https://wa.me/201557947788' },
    secondary: { label: 'ارجع لـ live.gahez.space', url: LIVE_URL },
    note: 'وصلك الإيميل ده لأنك بعتلنا رسالة من صفحة التواصل على Gahez Live.',
  });

  const sent = await deliver(
    res,
    'contact',
    { to: LEAD_TO, replyTo: email, subject: `تواصل Gahez Live — ${name}: ${subject}`, ...notify },
    { to: [email], replyTo: SUPPORT_EMAIL, subject: 'وصلتنا رسالتك — جاهز Live', ...ack },
  );
  if (sent) console.log('contact: message received');
}

// ------------------------------------------------------------------ server

const FORMS = { '/api/waitlist': waitlist, '/api/contact': contact };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/healthz') return json(res, 200, { ok: true });
    const form = FORMS[url.pathname];
    if (form) {
      if (req.method !== 'POST') return json(res, 405, { success: false, error: 'method' });
      return await form(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method' });
    const location = redirectFor(url);
    if (location) {
      res.writeHead(301, { Location: location, 'Cache-Control': 'public, max-age=3600' });
      return res.end();
    }
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error('request failed', error);
    if (!res.headersSent) json(res, 500, { error: 'server' });
    else res.end();
  }
}).listen(PORT, '0.0.0.0', () => console.log(`live on :${PORT}`));
