interface BrandMarkProps {
  size?: number;
}

// The Goodtime calendar mark: a week of availability in heatmap greens, with the confirmed
// time picked out. Decorative wherever it appears next to the "goodtime" name.
// public/favicon.svg is the same drawing with fixed colors for the browser tab.
export const BrandMark = ({ size = 32 }: BrandMarkProps) => (
  <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id="brand-mark-body">
        <rect x="4" y="10" width="56" height="50" rx="11" />
      </clipPath>
    </defs>
    <rect className="mark-body" x="4" y="10" width="56" height="50" rx="11" />
    <rect className="mark-header" x="4" y="10" width="56" height="13" clipPath="url(#brand-mark-body)" />
    <rect className="mark-ring" x="17" y="4" width="7" height="13" rx="3.5" />
    <rect className="mark-ring" x="40" y="4" width="7" height="13" rx="3.5" />

    <rect className="mark-heat-1" x="10" y="27.5" width="9.5" height="8" rx="2" />
    <rect className="mark-heat-3" x="21.5" y="27.5" width="9.5" height="8" rx="2" />
    <rect className="mark-heat-2" x="33" y="27.5" width="9.5" height="8" rx="2" />
    <rect className="mark-heat-1" x="44.5" y="27.5" width="9.5" height="8" rx="2" />

    <rect className="mark-heat-1" x="10" y="37" width="9.5" height="8" rx="2" />
    <rect className="mark-picked" x="21.5" y="37" width="21" height="8" rx="2" />
    <polyline className="mark-check" points="28.5,41 31,43.4 35.8,38.8" />
    <rect className="mark-heat-4" x="44.5" y="37" width="9.5" height="8" rx="2" />

    <rect className="mark-heat-3" x="10" y="46.5" width="9.5" height="8" rx="2" />
    <rect className="mark-heat-2" x="21.5" y="46.5" width="9.5" height="8" rx="2" />
    <rect className="mark-heat-2" x="33" y="46.5" width="9.5" height="8" rx="2" />
    <rect className="mark-heat-4" x="44.5" y="46.5" width="9.5" height="8" rx="2" />
  </svg>
);
