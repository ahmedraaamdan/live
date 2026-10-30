import type { TeacherProfileDTO } from '@workspace/live-core';
import { subjectLabel } from '@workspace/live-core';
import { G_PATH, G_BAR } from '@/ui/logo';

export const teacherProfileUrl = (id: string, appUrl?: string) => new URL(`/teachers/${id}`, appUrl || window.location.origin).href;
/** A story-sized raster made on the device. No third-party image or QR service receives profile data. */
export async function renderTeacherShareCard(profile: TeacherProfileDTO, url: string): Promise<Blob> {
  await document.fonts.ready;
  await Promise.all([document.fonts.load('64px Lalezar'), document.fonts.load('32px "Readex Pro"')]);
  const QRCode = await import('qrcode');
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
  const c = canvas.getContext('2d'); if (!c) throw new Error('تعذر إنشاء كارت المشاركة');
  const cream = '#fbf7ef', ink = '#201b19', red = '#e11d48';
  const box = (x: number, y: number, w: number, h: number, r: number, fill: string, shadow = false) => {
    if (shadow) { c.fillStyle = ink; c.beginPath(); c.roundRect(x + 12, y + 14, w, h, r); c.fill(); }
    c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); c.strokeStyle = ink; c.lineWidth = 4; c.stroke();
  };
  const text = (value: string, x: number, y: number, size: number, color = ink, display = false, align: CanvasTextAlign = 'center', maxWidth = 880) => {
    c.direction = 'rtl'; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = color;
    let fontSize = size;
    do { c.font = `${display ? '400' : '500'} ${fontSize}px ${display ? 'Lalezar' : '"Readex Pro"'},sans-serif`; if (c.measureText(value).width <= maxWidth || fontSize <= 24) break; fontSize -= 2; } while (fontSize > 0);
    let fitted = value;
    while (c.measureText(fitted).width > maxWidth && fitted.length > 2) fitted = fitted.slice(0, -2).trimEnd() + '…';
    c.fillText(fitted, x, y);
  };
  c.fillStyle = cream; c.fillRect(0, 0, 1080, 1920);
  c.strokeStyle = '#e11d4817'; c.lineWidth = 2;
  for (let x = 36; x < 1080; x += 72) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 1920); c.stroke(); }
  for (let y = 24; y < 1920; y += 72) { c.beginPath(); c.moveTo(0, y); c.lineTo(1080, y); c.stroke(); }
  c.save(); c.translate(96, 92); c.scale(.23, .23); c.fillStyle = red; c.fill(new Path2D(G_PATH));
  const polygon = G_BAR.split(' ').map(Number); c.beginPath(); for (let i = 0; i < polygon.length; i += 2) i ? c.lineTo(polygon[i]!, polygon[i + 1]!) : c.moveTo(polygon[i]!, polygon[i + 1]!); c.closePath(); c.fill(); c.restore();
  c.direction = 'ltr'; c.textAlign = 'left'; c.fillStyle = ink; c.font = '700 47px "Space Grotesk",sans-serif'; c.fillText('Gahez', 220, 139);
  box(386, 100, 101, 54, 10, red); text('Live', 436, 129, 30, '#ffffff');
  box(690, 96, 294, 60, 30, '#ffffff'); text('حصص مباشرة أونلاين', 837, 127, 26);
  text('تعرّف على مدرسك.', 540, 245, 76, ink, true);
  c.fillStyle = red; c.beginPath(); c.arc(551, 486, 174, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(535, 470, 174, 0, Math.PI * 2); c.fill();
  let hasImage = false;
  if (profile.teacher.avatarUrl) {
    try {
      const response = await fetch(profile.teacher.avatarUrl, { mode: 'cors', credentials: 'omit', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('image');
      const blob = await response.blob(); const imageUrl = URL.createObjectURL(blob);
      try { const image = new Image(); image.src = imageUrl; await image.decode(); const side = Math.min(image.naturalWidth, image.naturalHeight); c.save(); c.beginPath(); c.arc(535, 470, 170, 0, Math.PI * 2); c.clip(); c.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 365, 300, 340, 340); c.restore(); hasImage = true; } finally { URL.revokeObjectURL(imageUrl); }
    } catch { /* A third-party avatar without CORS falls back to initials; export stays downloadable. */ }
  }
  if (!hasImage) text(profile.teacher.name.replace(/^(أ\.|د\.|م\.|Mr\.|Ms\.|Dr\.)\s*/i, '').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join(' '), 535, 470, 100, red, true);
  c.strokeStyle = ink; c.lineWidth = 4; c.beginPath(); c.arc(535, 470, 174, 0, Math.PI * 2); c.stroke();
  text(profile.teacher.name, 540, 735, 94, ink, true);
  text(profile.teacher.headline || 'نلتقي في الحصة. ونفهمها معًا.', 540, 825, 35);
  box(270, 880, 540, 76, 38, red); text(profile.teacher.subject ? subjectLabel(profile.teacher.subject) : 'تعلّم مباشر، خطوة بخطوة', 540, 920, 40, '#ffffff', true);
  box(96, 1000, 888, 220, 34, '#ffffff', true);
  if (profile.rating.positivePercent !== null) {
    text(`${profile.rating.positivePercent}%`, 540, 1075, 100, red, true);
    text(`تقييم إيجابي · ${profile.rating.total} تقييم · ${profile.rating.raters} طالب`, 540, 1165, 32);
  } else { text('بانتظار أول تقييم', 540, 1080, 65, red, true); text('شاهد ملف المدرس وتعرّف إلى حصصه.', 540, 1165, 32); }
  text('امسح الرمز. وخذ خطوتك الأولى.', 540, 1285, 55, ink, true);
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { width: 276, margin: 4, errorCorrectionLevel: 'M', color: { dark: ink, light: '#ffffff' } });
  box(384, 1340, 312, 312, 24, '#ffffff', true); c.drawImage(qr, 402, 1358, 276, 276);
  text(new URL(url).host, 540, 1730, 30);
  text(`التقييم حتى ${new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date())}`, 540, 1800, 24, '#70675e');
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('تعذر حفظ الصورة')), 'image/png'));
}
