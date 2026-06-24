// OneTapZ logomark — tapping hand over an NFC card with a magenta tap ripple.
// Acid lime + hot magenta on a transparent background (shown on a dark chip).
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 520 520" fill="none" aria-hidden="true">
      <g strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="28">
        <path d="M 160 300 L 100 300 L 60 430 L 460 430 L 420 300 L 360 300" stroke="#CCFF00" />
        <path
          d="M 200 70 L 200 120 A 20 20 0 0 0 240 120 L 240 240 A 20 20 0 0 1 280 240 L 280 140 A 20 20 0 0 0 320 140 L 320 160 A 20 20 0 0 0 360 160 L 360 70"
          stroke="#CCFF00"
        />
        <path d="M 210 300 A 50 50 0 0 1 310 300" stroke="#FF1F9C" />
      </g>
    </svg>
  );
}
