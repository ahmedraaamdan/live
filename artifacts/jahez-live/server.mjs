/**
 * live.gahez.space: the built marketing site plus one endpoint.
 *
 * Static files come from dist/public, where generate-seo-html.mjs has
 * already written an index.html per route, so a crawler gets each page's own
 * title and description without running JavaScript.
 *
 * POST /api/waitlist takes the pre-launch form. Like gahez.space's
 * /api/submit it emails the team the details and sends the person an
 * acknowledgement, both through Resend from noreply@gahez.space, so every
 * Gahez product's leads land in the same inbox.
 *
 * No dependencies: Node's own http server and fetch.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./dist/public/', import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || 'Gahez جاهز <noreply@gahez.space>';
const LEAD_TO = (process.env.LEAD_TO || 'sales@gahez.space,info@gahez.space').split(',').map((s) => s.trim()).filter(Boolean);

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

// ---------------------------------------------------------------- waitlist

// The acknowledgement goes to whatever address is typed, so without a limit
// the form would let anyone mail anyone from our domain. Five a device per
// ten minutes is plenty for a person and useless for a spammer.
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

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function sendEmail(payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text().catch(() => '')}`);
}

function shell(title, rows) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f3f7ff;padding:24px" dir="rtl">
  <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e5eaf2;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2563EB,#22D3EE);padding:18px 22px;color:#fff;font-size:18px;font-weight:800">${title}</div>
    ${rows}
  </div>
</div>`;
}

async function waitlist(req, res) {
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
  if (!allowed(ip)) return json(res, 429, { success: false, error: 'rate_limited' });

  let data;
  try {
    data = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { success: false, error: 'bad_request' });
  }
  if (data._gotcha) return json(res, 200, { success: true });

  const name = String(data.name ?? '').trim().slice(0, 120);
  const email = String(data.email ?? '').trim().slice(0, 200);
  const phone = String(data.phone ?? '').trim().slice(0, 40);
  const role = ROLE_LABELS[data.role] ? data.role : 'student';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(res, 422, { success: false, error: 'validation' });
  if (!RESEND_API_KEY) {
    console.error('waitlist: RESEND_API_KEY is not set');
    return json(res, 503, { success: false, error: 'not_configured' });
  }

  const row = (label, value, shaded) =>
    `<tr${shaded ? ' style="background:#f8fafc"' : ''}><td style="padding:12px 22px;color:#64748b;width:130px">${label}</td><td style="padding:12px 22px;font-weight:700">${value}</td></tr>`;
  const notify = shell(
    'طلب انتظار جديد — Gahez Live',
    `<table style="width:100%;border-collapse:collapse;font-size:15px;color:#0f172a">
      ${row('الاسم', esc(name))}
      ${row('الإيميل', `<a href="mailto:${esc(email)}">${esc(email)}</a>`, true)}
      ${row('الموبايل', `<span dir="ltr">${esc(phone) || '—'}</span>`)}
      ${row('نوع الحساب', ROLE_LABELS[role], true)}
      ${row('المنتج', 'Gahez Live')}
    </table>
    <div style="padding:14px 22px;color:#94a3b8;font-size:12px;border-top:1px solid #eef2f7">ردّ على الإيميل ده عشان تكلّمه مباشرة.</div>`,
  );
  const ack = shell(
    'Gahez Live',
    `<div style="padding:24px;color:#0f172a;font-size:15px;line-height:1.9">
      <p>أهلاً ${esc(name)}،</p>
      <p>مكانك في <strong>جاهز Live</strong> محجوز 🎉 التسجيل بيفتح يوم الإطلاق، <strong>1 يناير 2027</strong>، وهنبعتلك على الإيميل ده أول ما يفتح.</p>
      <p style="color:#64748b">عندك سؤال؟ ردّ على الإيميل ده على طول.</p>
      <p style="margin-top:24px">— فريق جاهز<br><a href="https://live.gahez.space" style="color:#2563EB">live.gahez.space</a></p>
    </div>`,
  );

  try {
    await sendEmail({ from: MAIL_FROM, to: LEAD_TO, reply_to: email, subject: `انتظار Gahez Live — ${name}`, html: notify });
    await sendEmail({ from: MAIL_FROM, to: [email], reply_to: 'info@gahez.space', subject: 'مكانك محجوز — جاهز Live', html: ack });
  } catch (error) {
    console.error('waitlist: send failed', error instanceof Error ? error.message : error);
    return json(res, 502, { success: false, error: 'send_failed' });
  }
  console.log(`waitlist: ${role} joined`);
  return json(res, 200, { success: true });
}

// ------------------------------------------------------------------ server

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/healthz') return json(res, 200, { ok: true });
    if (url.pathname === '/api/waitlist') {
      if (req.method !== 'POST') return json(res, 405, { success: false, error: 'method' });
      return await waitlist(req, res);
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
