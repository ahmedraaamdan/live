import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge has to know the design system's custom scales, or it
// treats `text-title-md` and `text-on-surface` as the same group and drops one.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'display-lg', 'display-md', 'display-sm', 'headline-lg', 'headline-md', 'headline-sm',
        'title-lg', 'title-md', 'title-sm', 'body-lg', 'body-md', 'body-sm', 'label-lg', 'label-md', 'label-sm',
      ],
      radius: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
      shadow: ['e1', 'e2', 'e3', 'e4', 'e5', 'glow'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
