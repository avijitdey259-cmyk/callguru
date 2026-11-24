// PiCall icon set — filled-rounded SVG icons (UI refresh).
// Filled icons use fill="currentColor" with a same-colour 1px stroke and round
// joins so small sizes stay smooth. A few icons use the stroked renderer
// (2.2px round strokes, no fill): search, history, share, expand, send, close.
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { className?: string }

function Filled({ className = 'w-5 h-5', children, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" className={className} aria-hidden="true" {...rest}>{children}</svg>
  )
}

function Stroked({ className = 'w-5 h-5', children, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" className={className} aria-hidden="true" {...rest}>{children}</svg>
  )
}

export function IconHome(p: IconProps) {
  return <Filled {...p}><path d="M12 3.2 2.8 11.1c-.3.3-.1.8.4.8h1.6v8.3c0 .5.4.8.8.8h4.6v-6h3.6v6h4.6c.5 0 .8-.4.8-.8v-8.3h1.6c.5 0 .7-.5.4-.8L12 3.2Z" /></Filled>
}

export function IconFriends(p: IconProps) {
  return <Filled {...p}><path d="M8.5 11.5a3.5 3.5 0 1 0-3.5-3.5 3.5 3.5 0 0 0 3.5 3.5Zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM1.8 19.5v-1.4a5.2 5.2 0 0 1 5.2-5.2h3a5.2 5.2 0 0 1 3.4 1.3 4.6 4.6 0 0 1 4.4-1.1 4.7 4.7 0 0 1 3.4 4.5v1.9c0 .5-.4.8-.8.8H2.6c-.5 0-.8-.4-.8-.8Z" /></Filled>
}

export function IconReels(p: IconProps) {
  return <Filled {...p}><path d="M5 4.5h14a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 17V7A2.5 2.5 0 0 1 5 4.5Zm4.2 4.9v5.2c0 .5.6.9 1 .6l4.2-2.6c.4-.2.4-.9 0-1.2L10.2 8.8c-.4-.3-1 0-1 .6Z" /></Filled>
}

export function IconDating(p: IconProps) {
  return <Filled {...p}><path d="M12 21.2S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 8.1 5c1.7 0 3.1.9 3.9 2.2A4.6 4.6 0 0 1 15.9 5a4.6 4.6 0 0 1 4.6 4.6c0 5.8-8.5 11.6-8.5 11.6Z" /></Filled>
}

export function IconLiveTV(p: IconProps) {
  return <Filled {...p}><path d="M9.5 2.6a.9.9 0 0 1 1.3 0l2.4 2.5 2.5-2.4a.9.9 0 1 1 1.3 1.3L14.4 6.5h3.1A2.5 2.5 0 0 1 20 9v9.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5V9a2.5 2.5 0 0 1 2.5-2.5h3.1L7 4a.9.9 0 0 1 2.5-1.4ZM10 11.2v3.6c0 .5.6.9 1 .6l3-1.8c.4-.2.4-.9 0-1.2l-3-1.8c-.4-.3-1 0-1 .6Z" /></Filled>
}

export function IconChat(p: IconProps) {
  return <Filled {...p}><path d="M12 3.5A8.5 8.5 0 0 0 4.3 16.6L3 20.5c-.1.5.4.9.9.7l3.6-1.4A8.5 8.5 0 1 0 12 3.5ZM8 11.2a1.3 1.3 0 1 1 1.3 1.3A1.3 1.3 0 0 1 8 11.2Zm4.7 0a1.3 1.3 0 1 1 1.3 1.3 1.3 1.3 0 0 1-1.3-1.3Zm4.7 0a1.3 1.3 0 1 1 1.3 1.3 1.3 1.3 0 0 1-1.3-1.3Z" /></Filled>
}

export function IconWallet(p: IconProps) {
  return <Filled {...p}><path d="M19.5 5.5h-13A2.5 2.5 0 0 0 4 8v9.5A2.5 2.5 0 0 0 6.5 20h13a2 2 0 0 0 2-2V7.5a2 2 0 0 0-2-2ZM13 11.5a1.5 1.5 0 1 1 1.5 1.5 1.5 1.5 0 0 1-1.5-1.5Zm6.5-5.5v1.5h-13a.5.5 0 0 1-.5-.5V5.5A2.5 2.5 0 0 1 8.5 3h11a2 2 0 0 1 2 2v1Z" /></Filled>
}

export function IconSearch(p: IconProps) {
  return <Stroked {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Stroked>
}

export function IconBell(p: IconProps) {
  return <Filled {...p}><path d="M12 2.8a6.3 6.3 0 0 0-6.3 6.3v3.1l-1.3 2.6c-.3.6.1 1.2.8 1.2h13.6c.7 0 1.1-.6.8-1.2l-1.3-2.6V9.1A6.3 6.3 0 0 0 12 2.8ZM9.4 18.5a2.7 2.7 0 0 0 5.2 0H9.4Z" /></Filled>
}

export function IconMoon(p: IconProps) {
  return <Filled {...p}><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" /></Filled>
}

export function IconSun(p: IconProps) {
  return <Filled {...p}><circle cx="12" cy="12" r="4.4" /><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" strokeWidth={2.2} strokeLinecap="round" /></Filled>
}

export function IconDownload(p: IconProps) {
  return <Filled {...p}><path d="M12 3.5a.9.9 0 0 1 .9.9v8.4l2.5-2.5a.9.9 0 1 1 1.3 1.3l-4 4a.9.9 0 0 1-1.3 0l-4-4a.9.9 0 1 1 1.3-1.3l2.5 2.5V4.4a.9.9 0 0 1 .8-.9ZM5 17.5h14a.9.9 0 0 1 .9.9v1.1a2 2 0 0 1-2 2H6.1a2 2 0 0 1-2-2v-1.1a.9.9 0 0 1 .9-.9Z" /></Filled>
}

export function IconSettings(p: IconProps) {
  return <Filled {...p}><path d="M4 6.5h10.5M18.5 6.5H20M4 12h4.5M12.5 12H20M4 17.5h12.5M20.5 17.5H20" strokeWidth={2.2} strokeLinecap="round" fill="none" /><circle cx="16.5" cy="6.5" r="2.2" /><circle cx="10.5" cy="12" r="2.2" /><circle cx="18.5" cy="17.5" r="2.2" /></Filled>
}

export function IconShield(p: IconProps) {
  return <Filled {...p}><path d="M12 2.5 4.5 5.3v6.1c0 4.9 3.2 8.5 7.5 10.1 4.3-1.6 7.5-5.2 7.5-10.1V5.3L12 2.5Zm-1.2 13.4-3.2-3.2a.9.9 0 0 1 1.3-1.3l1.9 1.9 4.4-4.4a.9.9 0 1 1 1.3 1.3l-5.7 5.7Z" /></Filled>
}

export function IconStore(p: IconProps) {
  return <Filled {...p}><path d="M4 9.5 5 4.8A1.5 1.5 0 0 1 6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.3l1 4.7H4ZM3.5 11h17l-1 8.2a2 2 0 0 1-2 1.8H6.5a2 2 0 0 1-2-1.8L3.5 11Zm6.5 2.5v4.5h4v-4.5h-4Z" /></Filled>
}

export function IconHistory(p: IconProps) {
  return <Stroked {...p}><path d="M3.5 12a8.5 8.5 0 1 1 2.5 6" /><path d="M3.5 12H7M3.5 12l2-2.5" /><path d="M12 7.5V12l3 2" /></Stroked>
}

export function IconMegaphone(p: IconProps) {
  return <Filled {...p}><path d="M3.5 10.5v3a1.5 1.5 0 0 0 1.5 1.5h2.6l3.4 4.1c.5.6 1.5.2 1.5-.6v-13c0-.8-1-1.2-1.5-.6L7.6 9H5a1.5 1.5 0 0 0-1.5 1.5ZM15.5 8.5a4 4 0 0 1 0 7M18 6a8 8 0 0 1 0 12" fill="none" strokeWidth={2.2} strokeLinecap="round" /><path d="M3.5 10.5v3A1.5 1.5 0 0 0 5 15h2.6l3.4 4.1c.5.6 1.5.2 1.5-.6v-13c0-.8-1-1.2-1.5-.6L7.6 9H5a1.5 1.5 0 0 0-1.5 1.5Z" /></Filled>
}

export function IconBriefcase(p: IconProps) {
  return <Filled {...p}><path d="M9 6.5V5a2.5 2.5 0 0 1 2.5-2.5h1A2.5 2.5 0 0 1 15 5v1.5h3.5A2.5 2.5 0 0 1 21 9v9.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5V9A2.5 2.5 0 0 1 5.5 6.5H9ZM11 6.5h2V5a.5.5 0 0 0-.5-.5h-1A.5.5 0 0 0 11 5v1.5Z" /></Filled>
}

export function IconCall(p: IconProps) {
  return <Filled {...p}><path d="M6.6 3.5c.6 0 1.2.3 1.5.9l1.6 3.1c.3.7.2 1.5-.4 2L8 10.9a13.6 13.6 0 0 0 5.1 5.1l1.4-1.3c.5-.6 1.3-.7 2-.4l3.1 1.6c.6.3.9.9.9 1.5v2.1a2.5 2.5 0 0 1-2.5 2.5C10.4 22 2 13.6 2 6a2.5 2.5 0 0 1 2.5-2.5h2.1Z" /></Filled>
}

export function IconPhoto(p: IconProps) {
  return <Filled {...p}><path d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v10a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 17V7A2.5 2.5 0 0 1 5 4.5ZM8.5 10a1.8 1.8 0 1 0-1.8-1.8A1.8 1.8 0 0 0 8.5 10ZM5.4 16.6l4.2-4.2a1 1 0 0 1 1.4 0l2.2 2.2 2.4-2.4a1 1 0 0 1 1.4 0l1.6 1.6v3.7a.5.5 0 0 1-.5.5H5.9a.5.5 0 0 1-.5-.5v-.9Z" /></Filled>
}

export function IconVideo(p: IconProps) {
  return <Filled {...p}><path d="M3.5 7.5v9A2.5 2.5 0 0 0 6 19h8.5a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 14.5 5H6A2.5 2.5 0 0 0 3.5 7.5Zm13.5 2.6 3.2-2.4c.5-.4 1.3 0 1.3.7v7.2c0 .7-.8 1.1-1.3.7L17 14.1v-4Z" /></Filled>
}

export function IconImage(p: IconProps) {
  return <Filled {...p}><path d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v10a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 17V7A2.5 2.5 0 0 1 5 4.5ZM15.8 9.2a1.8 1.8 0 1 0-1.8-1.8 1.8 1.8 0 0 0 1.8 1.8ZM4.9 16.9l5.2-5.2a1 1 0 0 1 1.4 0l1.8 1.8 2.5-2.5a1 1 0 0 1 1.4 0l1.9 1.9v4.6a.5.5 0 0 1-.5.5H5.4a.5.5 0 0 1-.5-.5v-.6Z" /></Filled>
}

export function IconShare(p: IconProps) {
  return <Stroked {...p}><circle cx="17.5" cy="5.5" r="2.5" /><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="18.5" r="2.5" /><path d="m8.7 10.8 6.6-4M8.7 13.2l6.6 4" /></Stroked>
}

export function IconExpand(p: IconProps) {
  return <Stroked {...p}><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" /></Stroked>
}

export function IconSend(p: IconProps) {
  return <Stroked {...p}><path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" /></Stroked>
}

export function IconClose(p: IconProps) {
  return <Stroked {...p}><path d="m6 6 12 12M18 6 6 18" /></Stroked>
}

export function IconPlus(p: IconProps) {
  return <Filled {...p}><path d="M11 5.5h2a.9.9 0 0 1 .9.9v4.7h4.7a.9.9 0 0 1 .9.9v2a.9.9 0 0 1-.9.9h-4.7v4.7a.9.9 0 0 1-.9.9h-2a.9.9 0 0 1-.9-.9v-4.7H5.4a.9.9 0 0 1-.9-.9v-2a.9.9 0 0 1 .9-.9h4.7V6.4a.9.9 0 0 1 .9-.9Z" /></Filled>
}

export function IconSparkle(p: IconProps) {
  return <Filled {...p}><path d="M12 2.5c.7 4.8 2.7 6.8 7.5 7.5-4.8.7-6.8 2.7-7.5 7.5-.7-4.8-2.7-6.8-7.5-7.5 4.8-.7 6.8-2.7 7.5-7.5ZM18.5 14.5c.4 2.6 1.5 3.7 4 4-2.5.4-3.6 1.5-4 4-.4-2.5-1.5-3.6-4-4 2.5-.3 3.6-1.4 4-4Z" /></Filled>
}

export function IconChevronLeft(p: IconProps) {
  return <Filled {...p}><path d="M15.5 4.5a.9.9 0 0 1 0 1.3L9.3 12l6.2 6.2a.9.9 0 1 1-1.3 1.3l-6.8-6.8a.9.9 0 0 1 0-1.3l6.8-6.9a.9.9 0 0 1 1.3 0Z" /></Filled>
}

export function IconUser(p: IconProps) {
  return <Filled {...p}><path d="M12 12.5a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12.5Zm-7.5 8.5v-1.2a7.5 7.5 0 0 1 7.5-7.5 7.5 7.5 0 0 1 7.5 7.5V21a.9.9 0 0 1-.9.9H5.4a.9.9 0 0 1-.9-.9Z" /></Filled>
}

export function IconMail(p: IconProps) {
  return <Stroked {...p}><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7.5 7.5 5.5 7.5-5.5" /></Stroked>
}

export function IconLock(p: IconProps) {
  return <Stroked {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /><circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" /></Stroked>
}
