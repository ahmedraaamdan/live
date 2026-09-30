/**
 * Single-color social icons (fill="currentColor", viewBox 0 0 24 24). This
 * exact path data is deployed identically across every Gahez product's
 * footer — keep it byte-for-byte in sync so the icons look the same on
 * gahez.space, tools.gahez.space, academy.gahez.space, etc.
 */

type IconProps = {
  size?: number;
  className?: string;
};

export function InstagramIcon({ size = 24, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069M12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24s3.667-.014 4.947-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.667.014 15.259 0 12 0m0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8m6.406-11.845a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88" />
    </svg>
  );
}

export function TikTokIcon({ size = 24, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
      <path d="M16.6 5.82c-.84-.9-1.31-2.07-1.31-3.32h-3.03v13.44c0 1.6-1.3 2.9-2.9 2.9a2.9 2.9 0 0 1-2.9-2.9 2.9 2.9 0 0 1 2.9-2.9c.32 0 .63.05.92.15V9.98a6 6 0 0 0-.92-.07 6.13 6.13 0 0 0-6.13 6.13A6.13 6.13 0 0 0 9.36 22.17a6.13 6.13 0 0 0 6.13-6.13V9.01a9.34 9.34 0 0 0 5.45 1.74V7.72c-1.62 0-3.05-.72-4.34-1.9Z" />
    </svg>
  );
}

export function YouTubeIcon({ size = 24, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
      <path d="M23.498 6.186a3.02 3.02 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.02 3.02 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.02 3.02 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.02 3.02 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
    </svg>
  );
}

export function FacebookIcon({ size = 24, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.7 8.7 0 0 1 1.141.195v3.325a8.6 8.6 0 0 0-.653-.036 26.8 26.8 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 1.762-.287 1.905h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.628-5.373-12-12-12s-12 5.372-12 12c0 5.616 3.861 10.328 9.101 11.647Z" />
    </svg>
  );
}
