import type { CSSProperties, ReactNode } from 'react'

export type IconName = 'leaf' | 'arrow' | 'plus' | 'door' | 'clock' | 'users' | 'shield' | 'camera' | 'reset' | 'play' | 'pause' | 'coffee' | 'book' | 'check' | 'info' | 'link' | 'video'
const paths: Record<IconName, ReactNode> = {
  leaf: <><path d="M12 21V11M12 15C4 15 3 10 3 5c6 0 9 3 9 10ZM12 11c0-6 4-9 9-9 0 6-3 9-9 9Z" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  door: <><path d="M10 4H4v16h6m4-13 5 5-5 5m-6-5h11" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  camera: <><path d="M9 5 7 8H3v12h18V8h-4l-2-3ZM3 3l18 18" /><path d="M10 10a4 4 0 0 1 5 5" /></>,
  reset: <><path d="M3 10a9 9 0 1 1 2 9M3 4v6h6" /></>,
  play: <path d="m9 5 11 7-11 7Z" />,
  pause: <><path d="M8 5v14M16 5v14" strokeWidth="3" /></>,
  coffee: <><path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9ZM16 10h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2" /></>,
  book: <><path d="M12 6v15M3 3c4 0 7 1 9 3 2-2 5-3 9-3v15c-4 0-7 1-9 3-2-2-5-3-9-3V3Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  link: <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1m2 4a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" />,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.2" /></>,
}

export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>
}
