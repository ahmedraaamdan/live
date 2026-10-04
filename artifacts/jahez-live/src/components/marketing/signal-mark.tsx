/**
 * The Gahez identity, shared with gahez.space, Agent and Tools. The rules
 * live in Gahez Tools, assets/design/BRAND.md.
 */

const G_PATH =
  'M443.62,161.36h-20.82c-10.2,49.84-54.3,87.33-107.15,87.33-60.41,0-109.37-48.97-109.37-109.37s48.97-109.37,109.37-109.37c48.96,0,90.4,32.17,104.35,76.52h20.54C424.83,45.25,369.28,0,303.17,0h-161.36C63.49,0,0,63.49,0,141.81h0c0,78.32,63.49,141.81,141.81,141.81h161.36c71.98,0,131.42-53.62,140.58-123.1h-.13v.83Z';
const G_BAR = '444.64 166.78 465.46 166.78 465.46 165.95 465.46 138.5 357.03 138.5 357.03 165.95 357.03 166.78 444.64 166.78';

/** The G mark alone, in the current text colour. */
export function GahezMark() {
  return (
    <svg className="gahez-mark" viewBox="0 0 465.46 283.62" aria-hidden="true" fill="currentColor">
      <path d={G_PATH} />
      <polygon points={G_BAR} />
    </svg>
  );
}

/** The lockup as gahez.space draws it, with the product name as a badge. */
export function Logo() {
  return (
    <span className="brand-lockup" aria-label="Gahez Live — جاهز">
      <GahezMark />
      <span className="brand-word" dir="ltr">
        Gahez
      </span>
      <span className="brand-badge" dir="ltr">
        Live
      </span>
    </span>
  );
}
