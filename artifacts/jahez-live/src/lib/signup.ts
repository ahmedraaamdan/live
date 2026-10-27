/**
 * Registration is open: every call to action on the site ("start as a
 * teacher", "book a seat", the header) sends people to the app's sign-up,
 * with their role picked when the button knows it.
 */
import { siteConfig } from '@/lib/site-config';

export type SignupRole = 'student' | 'teacher' | 'parent';

/** Same date gahez.space announces for the whole Gahez family. */
export const LAUNCH_DATE = '1 يناير 2027';

export function signupUrl(role?: SignupRole): string {
  return role ? `${siteConfig.appUrl}/signup?role=${role}` : `${siteConfig.appUrl}/welcome`;
}

export function openSignup(role?: SignupRole) {
  window.location.assign(signupUrl(role));
}
