import type { SVGProps } from 'react';
import { Globe, Link2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type PlatformKey =
  | 'facebook'
  | 'youtube'
  | 'tiktok'
  | 'telegram'
  | 'whatsapp'
  | 'instagram'
  | 'linkedin'
  | 'x'
  | 'website'
  | 'other';

export interface PlatformDef {
  key: PlatformKey;
  label: string;
  placeholder: string;
  hostPatterns: string[];
}

export const PLATFORMS: PlatformDef[] = [
  { key: 'facebook', label: 'فيسبوك', placeholder: 'https://facebook.com/username', hostPatterns: ['facebook.com', 'fb.com', 'fb.me'] },
  { key: 'youtube', label: 'يوتيوب', placeholder: 'https://youtube.com/@channel', hostPatterns: ['youtube.com', 'youtu.be'] },
  { key: 'tiktok', label: 'تيك توك', placeholder: 'https://tiktok.com/@username', hostPatterns: ['tiktok.com'] },
  { key: 'telegram', label: 'تليجرام', placeholder: 'https://t.me/channel', hostPatterns: ['t.me', 'telegram.me', 'telegram.org'] },
  { key: 'whatsapp', label: 'واتساب', placeholder: 'https://wa.me/2010...', hostPatterns: ['wa.me', 'whatsapp.com'] },
  { key: 'instagram', label: 'إنستغرام', placeholder: 'https://instagram.com/username', hostPatterns: ['instagram.com', 'instagr.am'] },
  { key: 'linkedin', label: 'لينكد إن', placeholder: 'https://linkedin.com/in/username', hostPatterns: ['linkedin.com'] },
  { key: 'x', label: 'إكس (تويتر)', placeholder: 'https://x.com/username', hostPatterns: ['x.com', 'twitter.com'] },
  { key: 'website', label: 'موقع إلكتروني', placeholder: 'https://yoursite.com', hostPatterns: [] },
  { key: 'other', label: 'أخرى (مخصص)', placeholder: 'https://...', hostPatterns: [] },
];

export function detectPlatform(label?: string, url?: string): PlatformKey {
  const normLabel = (label ?? '').toLowerCase().trim();
  const normUrl = (url ?? '').toLowerCase().trim();

  // 1. Check label keywords
  if (normLabel.includes('فيسبوك') || normLabel.includes('facebook') || normLabel === 'fb') return 'facebook';
  if (normLabel.includes('يوتيوب') || normLabel.includes('youtube') || normLabel === 'yt') return 'youtube';
  if (normLabel.includes('تيك توك') || normLabel.includes('تيكتوك') || normLabel.includes('tiktok')) return 'tiktok';
  if (normLabel.includes('تليجرام') || normLabel.includes('تيليجرام') || normLabel.includes('telegram')) return 'telegram';
  if (normLabel.includes('واتساب') || normLabel.includes('واتس') || normLabel.includes('whatsapp')) return 'whatsapp';
  if (normLabel.includes('إنستغرام') || normLabel.includes('انستجرام') || normLabel.includes('انستقرام') || normLabel.includes('instagram')) return 'instagram';
  if (normLabel.includes('لينكد') || normLabel.includes('linkedin')) return 'linkedin';
  if (normLabel.includes('تويتر') || normLabel.includes('twitter') || normLabel === 'x' || normLabel.includes('إكس')) return 'x';
  if (normLabel.includes('موقع') || normLabel.includes('مدونة') || normLabel.includes('website') || normLabel.includes('site')) return 'website';

  // 2. Check URL hosts
  for (const p of PLATFORMS) {
    if (p.hostPatterns.some(pattern => normUrl.includes(pattern))) {
      return p.key;
    }
  }

  return 'other';
}

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function YouTubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function TelegramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.943z" />
    </svg>
  );
}

function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.101-.477-.15-.678.15-.2.301-.778.978-.954 1.18-.175.201-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.896-.799-1.501-1.786-1.677-2.087-.176-.301-.019-.464.132-.614.135-.135.301-.351.452-.527.15-.175.2-.301.301-.501.101-.2.05-.376-.025-.526-.075-.15-.678-1.634-.929-2.235-.244-.585-.493-.505-.678-.515-.176-.008-.376-.01-.577-.01-.2 0-.527.075-.803.376-.276.301-1.054 1.03-1.054 2.511s1.079 2.912 1.229 3.113c.15.2 2.124 3.243 5.145 4.55 3.02 1.307 3.02.871 3.572.821.552-.05 1.78-.727 2.031-1.43.251-.702.251-1.304.176-1.43-.076-.126-.276-.201-.577-.351zM12.004 21.996h-.008c-1.748 0-3.46-.466-4.965-1.349l-.356-.211-3.692.968.985-3.599-.232-.369A9.946 9.946 0 0 1 2.05 12.004C2.05 6.516 6.516 2.05 12.004 2.05s9.954 4.466 9.954 9.954-4.466 9.992-9.954 9.992zM12 0C5.373 0 0 5.373 0 12c0 2.115.552 4.168 1.6 5.981L0 24l6.195-1.625A11.956 11.956 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  );
}

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function LinkedInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function PlatformIcon({
  platform,
  className,
  size = 18,
}: {
  platform: PlatformKey;
  className?: string;
  size?: number;
}) {
  const cls = cn('shrink-0 inline-block', className);
  const style = { width: size, height: size };

  switch (platform) {
    case 'facebook':
      return <FacebookIcon className={cn(cls, 'text-[#1877F2]')} style={style} />;
    case 'youtube':
      return <YouTubeIcon className={cn(cls, 'text-[#FF0000]')} style={style} />;
    case 'tiktok':
      return <TikTokIcon className={cn(cls, 'text-on-surface')} style={style} />;
    case 'telegram':
      return <TelegramIcon className={cn(cls, 'text-[#229ED9]')} style={style} />;
    case 'whatsapp':
      return <WhatsAppIcon className={cn(cls, 'text-[#25D366]')} style={style} />;
    case 'instagram':
      return <InstagramIcon className={cn(cls, 'text-[#E4405F]')} style={style} />;
    case 'linkedin':
      return <LinkedInIcon className={cn(cls, 'text-[#0A66C2]')} style={style} />;
    case 'x':
      return <XIcon className={cn(cls, 'text-on-surface')} style={style} />;
    case 'website':
      return <Globe className={cn(cls, 'text-primary')} style={style} />;
    default:
      return <Link2 className={cn(cls, 'text-primary')} style={style} />;
  }
}
