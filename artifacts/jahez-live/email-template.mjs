// GAHEZ email template — the one look every GAHEZ product sends with.
//
// Canonical copy lives in Gahez systems (api/email-template.mjs, served as
// gahez.space/api). This is Live's copy: don't edit it here; change the
// canonical file and copy it over, as Agent and the hub API do. Images are
// PNGs hosted on https://gahez.space/email/ (email clients don't render WebP
// or SVG).
//
//   import { renderEmail } from './email-template.mjs';
//   const { html, text } = renderEmail({
//     product: 'live',                 // gahez | agent | tools | live | academy | sticky
//     robot: 'phone',                  // hero | phone | desk | dance | null
//     preheader: 'استلمنا رسالتك…',     // inbox preview line
//     title: 'وصلتنا رسالتك',
//     intro: 'أهلاً أحمد، …',          // HTML allowed (escape user input yourself)
//     rows: [['الاسم', 'أحمد'], …],    // optional label/value table (values: HTML)
//     body: '<p>…</p>',                 // optional extra HTML
//     cta: { label: 'كلّمنا على واتساب', url: 'https://wa.me/…' },
//     secondary: { label: '…', url: '…' },   // optional text link under the button
//     note: 'وصلك الإيميل ده لأنك…',    // optional small print (why you got this)
//     lang: 'ar',                       // 'en' flips direction and footer copy
//   });

const ASSETS = (typeof process !== 'undefined' && process.env.EMAIL_ASSETS) || 'https://gahez.space/email';

export const PRODUCTS = {
  gahez:   { name: 'Gahez',          nameAr: 'جاهز',          url: 'https://gahez.space/',          accent: '#2563EB' },
  agent:   { name: 'Gahez Agent',    nameAr: 'Gahez Agent',   url: 'https://agent.gahez.space/',    accent: '#7C3AED' },
  tools:   { name: 'Gahez Tools',    nameAr: 'Gahez Tools',   url: 'https://tools.gahez.space/',    accent: '#0891B2' },
  live:    { name: 'Gahez Live',     nameAr: 'Gahez Live',    url: 'https://live.gahez.space/',     accent: '#E11D48' },
  academy: { name: 'Gahez Academy',  nameAr: 'Gahez Academy', url: 'https://academy.gahez.space/',  accent: '#059669' },
  sticky:  { name: 'Gahez Sticky',   nameAr: 'Gahez Sticky',  url: 'https://sticky.gahez.space/',   accent: '#D97706' },
};

const SOCIAL = [
  ['whatsapp',  'https://wa.me/201557947788',              'WhatsApp'],
  ['instagram', 'https://www.instagram.com/gahez.space/',  'Instagram'],
  ['tiktok',    'https://www.tiktok.com/@gahez.space',     'TikTok'],
  ['youtube',   'https://www.youtube.com/@GahezSpace',     'YouTube'],
  ['facebook',  'https://www.facebook.com/gahez.space',    'Facebook'],
];

const ROBOT_SIZE = { hero: [120, 207], phone: [140, 218], desk: [160, 224], dance: [140, 182] };

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FONT = "'Cairo','Segoe UI',Tahoma,Arial,sans-serif";
const INK = '#0F172A', SOFT = '#475569', MUTED = '#64748B', LINE = '#E2E8F0';

function button(cta, accent) {
  // "bulletproof" button: a table cell carries the colour, so Outlook keeps it
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto 4px">
    <tr><td align="center" bgcolor="${accent}" style="border-radius:12px;background:${accent};background-image:linear-gradient(135deg,${accent},#22D3EE)">
      <a href="${esc(cta.url)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${esc(cta.label)}</a>
    </td></tr>
  </table>`;
}

export function renderEmail(opts) {
  const lang = opts.lang === 'en' ? 'en' : 'ar';
  const rtl = lang === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const start = rtl ? 'right' : 'left';
  const end = rtl ? 'left' : 'right';
  const p = PRODUCTS[opts.product] || PRODUCTS.gahez;
  const accent = opts.accent || p.accent;
  const productName = rtl ? p.nameAr : p.name;
  const robot = opts.robot === null ? null : (opts.robot || 'hero');
  const [rw, rh] = ROBOT_SIZE[robot] || ROBOT_SIZE.hero;

  const rows = (opts.rows || []).filter(([, v]) => v !== undefined && v !== null && v !== '');
  const rowsHtml = rows.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;border:1px solid ${LINE};border-radius:14px;border-collapse:separate;overflow:hidden">
      ${rows.map(([k, v], i) => `
      <tr>
        <td style="padding:12px 16px;width:34%;font-family:${FONT};font-size:13px;color:${MUTED};vertical-align:top;text-align:${start};${i ? `border-top:1px solid ${LINE};` : ''}background:#F8FAFC">${esc(k)}</td>
        <td style="padding:12px 16px;font-family:${FONT};font-size:15px;font-weight:600;color:${INK};vertical-align:top;text-align:${start};${i ? `border-top:1px solid ${LINE};` : ''}word-break:break-word">${v}</td>
      </tr>`).join('')}
    </table>` : '';

  const productLinks = ['agent', 'tools', 'live', 'academy', 'sticky'].map((k) => {
    const q = PRODUCTS[k];
    return `<a href="${q.url}" target="_blank" style="display:inline-block;margin:4px 3px;padding:6px 12px;border-radius:999px;border:1px solid ${LINE};background:#ffffff;font-family:${FONT};font-size:12px;font-weight:700;color:${q.accent};text-decoration:none">${q.name}</a>`;
  }).join('');

  const socials = SOCIAL.map(([k, url, label]) =>
    `<a href="${url}" target="_blank" style="display:inline-block;margin:0 5px;text-decoration:none"><img src="${ASSETS}/social-${k}.png" width="34" height="34" alt="${label}" style="display:block;border:0;border-radius:50%"></a>`).join('');

  const t = rtl ? {
    tagline: 'منتجات بتعمل شغل حقيقي.',
    products: 'منتجات جاهز',
    help: 'محتاج مساعدة؟ ردّ على الإيميل ده، أو كلّمنا على واتساب.',
    rights: `© ${new Date().getFullYear()} جاهز — gahez.space`,
  } : {
    tagline: 'Products that do real work.',
    products: 'GAHEZ products',
    help: 'Need help? Just reply to this email, or message us on WhatsApp.',
    rights: `© ${new Date().getFullYear()} GAHEZ — gahez.space`,
  };

  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(opts.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:#EEF4FF}
  a{color:${accent}}
  @media (max-width:620px){ .shell{width:100%!important} .pad{padding-left:20px!important;padding-right:20px!important} .h1{font-size:23px!important} }
</style>
</head>
<body style="margin:0;padding:0;background:#EEF4FF">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(opts.preheader || '')}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEF4FF" style="background:#EEF4FF">
<tr><td align="center" style="padding:28px 12px">

  <table role="presentation" class="shell" width="600" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 18px 40px -24px rgba(29,78,216,.45)">

    <!-- header -->
    <tr><td bgcolor="#1D4ED8" style="background:#1D4ED8;background-image:linear-gradient(135deg,#1A3A9C 0%,#2563EB 55%,#22D3EE 100%);padding:22px 28px" class="pad">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="text-align:${start}"><a href="${p.url}" target="_blank"><img src="${ASSETS}/logo-white.png" width="130" height="32" alt="gahez" style="display:inline-block;border:0;height:32px;width:auto"></a></td>
          <td style="text-align:${end}"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);font-family:${FONT};font-size:13px;font-weight:700;color:#ffffff;white-space:nowrap">${esc(productName)}</span></td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="height:4px;line-height:4px;font-size:0;background:${accent}">&nbsp;</td></tr>

    <!-- hero -->
    <tr><td class="pad" style="padding:30px 36px 8px;text-align:center">
      ${robot ? `<img src="${ASSETS}/robot-${robot}.png" width="${rw}" height="${rh}" alt="" style="display:block;margin:0 auto 14px;border:0;width:${rw}px;height:auto">` : ''}
      <h1 class="h1" style="margin:0;font-family:${FONT};font-size:26px;line-height:1.35;font-weight:800;color:${INK}">${esc(opts.title)}</h1>
    </td></tr>

    <!-- content -->
    <tr><td class="pad" dir="${dir}" style="padding:10px 36px 30px;font-family:${FONT};font-size:16px;line-height:1.85;color:${SOFT};text-align:${start}">
      ${opts.intro ? `<p style="margin:10px 0 0">${opts.intro}</p>` : ''}
      ${rowsHtml}
      ${opts.body || ''}
      ${opts.cta ? button(opts.cta, accent) : ''}
      ${opts.secondary ? `<p style="margin:12px 0 0;text-align:center;font-size:14px"><a href="${esc(opts.secondary.url)}" target="_blank" style="color:${accent};font-weight:700;text-decoration:none">${esc(opts.secondary.label)}</a></p>` : ''}
    </td></tr>

    <!-- help strip -->
    <tr><td class="pad" style="padding:16px 36px;background:#F1F6FF;border-top:1px solid ${LINE};font-family:${FONT};font-size:14px;color:${SOFT};text-align:center">
      ${t.help} <a href="https://wa.me/201557947788" target="_blank" style="color:#16A34A;font-weight:700;text-decoration:none">WhatsApp</a>
    </td></tr>

    <!-- footer -->
    <tr><td class="pad" style="padding:24px 28px 26px;background:#0F172A;text-align:center">
      <a href="https://gahez.space/" target="_blank"><img src="${ASSETS}/logo-white.png" width="106" height="26" alt="gahez" style="display:inline-block;border:0;height:26px;width:auto"></a>
      <p style="margin:6px 0 14px;font-family:${FONT};font-size:13px;color:#94A3B8">${t.tagline}</p>
      <div style="margin:0 0 16px">${socials}</div>
      <p style="margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.3px;color:#64748B">${t.products}</p>
      <div style="margin:0 0 16px">${productLinks}</div>
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.8;color:#94A3B8">
        <a href="mailto:support@gahez.space" style="color:#CBD5E1;text-decoration:none">support@gahez.space</a> ·
        <a href="https://gahez.space/" style="color:#CBD5E1;text-decoration:none">gahez.space</a><br>
        ${opts.note ? `${opts.note}<br>` : ''}${t.rights}
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

  // plain-text twin (deliverability + clients that block HTML)
  const strip = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  const text = [
    `${productName}`,
    '',
    strip(opts.title),
    '',
    strip(opts.intro),
    ...rows.map(([k, v]) => `${k}: ${strip(v)}`),
    strip(opts.body),
    opts.cta ? `\n${opts.cta.label}: ${opts.cta.url}` : '',
    '',
    t.help.replace(/\s*$/, '') + ' https://wa.me/201557947788',
    '—',
    `${t.tagline} https://gahez.space/`,
  ].filter((x) => x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');

  return { html, text };
}
