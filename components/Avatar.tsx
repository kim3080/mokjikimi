export type AvatarKind = 'sprout' | 'bear' | 'cat' | 'bunny'

export function Avatar({ kind = 'sprout' }: { kind?: AvatarKind }) {
  return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className={`avatar avatar-${kind}`}>
    {kind === 'sprout' && <><path d="M50 32V17" stroke="#406951" strokeWidth="4" /><path d="M50 23c-13 0-18-8-17-16 13 0 18 7 17 16Z" fill="#7d9e60" /><path d="M50 20C51 8 61 5 69 8c-2 10-8 14-19 12Z" fill="#a0b576" /></>}
    {kind === 'bear' && <><circle cx="26" cy="32" r="13" fill="#c4a484" /><circle cx="74" cy="32" r="13" fill="#c4a484" /><circle cx="26" cy="32" r="7" fill="#e7ceb4" /><circle cx="74" cy="32" r="7" fill="#e7ceb4" /></>}
    {kind === 'cat' && <><path d="m20 43 1-28 25 17m10 0 23-17 1 28" fill="#a6adb2" stroke="#a6adb2" strokeWidth="4" /></>}
    {kind === 'bunny' && <><ellipse cx="36" cy="23" rx="10" ry="22" fill="#dbc6bd" /><ellipse cx="63" cy="23" rx="10" ry="22" fill="#dbc6bd" /><ellipse cx="36" cy="23" rx="4" ry="15" fill="#ecdcd4" /><ellipse cx="63" cy="23" rx="4" ry="15" fill="#ecdcd4" /></>}
    <ellipse cx="50" cy="57" rx="33" ry="29" fill={{ sprout: '#e2e6bd', bear: '#c4a484', cat: '#b7bdc0', bunny: '#e9d8cd' }[kind]} />
    <ellipse cx="37" cy="55" rx="2.5" ry="3" fill="#344538" /><ellipse cx="63" cy="55" rx="2.5" ry="3" fill="#344538" />
    <path d="M44 66q6 5 12 0" stroke="#344538" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="28" cy="63" rx="5" ry="3" fill="#d69f8f" opacity=".5" /><ellipse cx="72" cy="63" rx="5" ry="3" fill="#d69f8f" opacity=".5" />
    {kind === 'cat' && <path d="m19 57-11-3m11 11L8 68m73-11 11-3m-11 11 11 3" stroke="#78868c" strokeWidth="2" />}
  </svg>
}
