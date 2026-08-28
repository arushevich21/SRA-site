import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { SUPPORTERS } from '@/content/supporters';

export function OverlayCanvas({ children, className = '', opacity }: { children: ReactNode; className?: string; opacity?: number }) {
  const style: CSSProperties | undefined = opacity === undefined ? undefined : { opacity };
  return <div className="overlay-root" style={style}><div className={`overlay-canvas ${className}`}>{children}</div></div>;
}

export function OverlayHeader({ title, subtitle, logoSrc = '/badges/GT3TSAsset_white.png' }: { title: string; subtitle?: string; logoSrc?: string }) {
  return <header className="stream-header"><Image className="stream-logo-image" src={logoSrc} alt="" width={400} height={200} sizes="7vw" unoptimized /><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></header>;
}

export function SponsorTicker() {
  const message = <>{SUPPORTERS.map((name, index) => <span key={name}>{index > 0 && ' • '}{name}</span>)}<span> • Thank you for supporting SRA</span></>;
  return <div className="stream-sponsor-ticker"><strong className="stream-sponsor-ticker-label">SUPPORTERS:</strong><div className="stream-sponsor-ticker-window"><div className="stream-sponsor-ticker-track"><span>{message}</span><span aria-hidden="true">{message}</span></div></div></div>;
}

export function OverlayPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`stream-panel ${className}`}>{children}</section>;
}
