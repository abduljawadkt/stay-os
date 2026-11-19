import { cn } from "@/lib/utils";

/**
 * Photos attached to complaints are drawn as simple scenes (no stock or placeholder images).
 * kind: fan | tap | wifi | light | room
 */
export function ComplaintPhoto({ kind, className }: { kind: string; className?: string }) {
  return (
    <svg viewBox="0 0 256 176" className={cn("block", className)} role="img" aria-label={`Photo: ${kind}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`wall-${kind}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9e4d8" />
          <stop offset="1" stopColor="#d8d1c2" />
        </linearGradient>
      </defs>
      <rect width="256" height="176" fill={`url(#wall-${kind})`} />
      {kind === "fan" && (
        <g>
          <rect x="0" y="0" width="256" height="34" fill="#f4f1ea" />
          <rect x="125" y="20" width="6" height="34" fill="#8a8578" />
          <circle cx="128" cy="62" r="11" fill="#6d695f" />
          <path d="M128 62 L52 74 Q46 66 54 60 Z" fill="#a39f94" />
          <path d="M128 62 L196 92 Q200 100 191 101 Z" fill="#a39f94" />
          <path d="M128 62 L140 132 Q132 138 126 130 Z" fill="#a39f94" />
          <circle cx="128" cy="62" r="4" fill="#4b4840" />
          <rect x="196" y="120" width="34" height="44" rx="3" fill="#f6f4ef" stroke="#c9c3b5" />
          <circle cx="213" cy="140" r="9" fill="#e7e2d6" stroke="#9c968a" />
          <path d="M213 140 l5 -5" stroke="#5c584f" strokeWidth="2" strokeLinecap="round" />
          <text x="18" y="160" fontSize="11" fill="#6d695f" fontFamily="sans-serif">B-108 · 9:51 AM</text>
        </g>
      )}
      {kind === "tap" && (
        <g>
          <rect x="0" y="110" width="256" height="66" fill="#c7d3d8" />
          <rect x="96" y="40" width="64" height="16" rx="4" fill="#b8b9b5" />
          <rect x="146" y="48" width="14" height="34" rx="5" fill="#a9aaa6" />
          <path d="M153 86 q-3 8 0 12 q3 -4 0 -12" fill="#7fb6d6" />
          <circle cx="153" cy="108" r="3" fill="#7fb6d6" />
          <ellipse cx="150" cy="128" rx="30" ry="6" fill="#9cc3d8" opacity=".7" />
        </g>
      )}
      {kind === "light" && (
        <g>
          <rect x="40" y="40" width="176" height="14" rx="7" fill="#f7f5ee" stroke="#c9c3b5" />
          <rect x="44" y="43" width="80" height="8" rx="4" fill="#fffbe6" />
          <rect x="124" y="43" width="88" height="8" rx="4" fill="#bdb8ab" />
        </g>
      )}
      {(kind === "wifi" || kind === "room") && (
        <g>
          <rect x="70" y="60" width="116" height="70" rx="8" fill="#2b2f36" />
          <rect x="78" y="68" width="100" height="54" rx="3" fill="#eef0f2" />
          <path d="M128 106 a3 3 0 1 1 0.01 0" stroke="#c2331f" strokeWidth="4" strokeLinecap="round" />
          <path d="M116 98 q12 -10 24 0" fill="none" stroke="#9aa3ad" strokeWidth="3" strokeLinecap="round" />
          <path d="M108 90 q20 -16 40 0" fill="none" stroke="#c4cad0" strokeWidth="3" strokeLinecap="round" />
          <line x1="104" y1="76" x2="152" y2="114" stroke="#c2331f" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
