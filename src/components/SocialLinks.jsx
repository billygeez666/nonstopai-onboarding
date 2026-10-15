import { CONTACT } from '../config/contact.js'

// Instagram + TikTok links. Generic camera / music-note icons; the platform name
// is always the accessible name, and a visible label when showLabels is set.
// Opens in a new tab with rel="noopener".

const svgProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
}

const ICONS = {
  camera: (
    <svg {...svgProps}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  note: (
    <svg {...svgProps}>
      <path d="M9 18V6l11-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </svg>
  ),
}

const LINKS = [
  { name: 'Instagram', href: CONTACT.instagram, icon: 'camera' },
  { name: 'TikTok', href: CONTACT.tiktok, icon: 'note' },
]

export default function SocialLinks({ className = '', showLabels = false }) {
  return (
    <div className={`social ${className}`.trim()}>
      {LINKS.map((s) => (
        <a
          key={s.name}
          className="soc"
          href={s.href}
          target="_blank"
          rel="noopener"
          aria-label={`${s.name} (opens in a new tab)`}
          title={s.name}
        >
          {ICONS[s.icon]}
          {showLabels && <span>{s.name}</span>}
        </a>
      ))}
    </div>
  )
}
