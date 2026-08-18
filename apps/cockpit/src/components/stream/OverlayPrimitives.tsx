import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';

export function OverlayCanvas({ children, className = '', opacity }: { children: ReactNode; className?: string; opacity?: number }) {
  const style: CSSProperties | undefined = opacity === undefined ? undefined : { opacity };
  return <div className="overlay-root" style={style}><div className={`overlay-canvas ${className}`}>{children}</div></div>;
}

export function OverlayHeader({ title, subtitle, logoSrc = '/badges/GT3TSAsset_white.png' }: { title: string; subtitle?: string; logoSrc?: string }) {
  return <header className="stream-header"><Image className="stream-logo-image" src={logoSrc} alt="" width={400} height={200} sizes="7vw" unoptimized /><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></header>;
}

export function SponsorTicker() {
  const message = <>Trackside VIP <span>•</span> Documize <span>•</span> Trak Racer <span>•</span> Triple Stint <span>•</span> GO Setups <span>•</span> Armamentario <span>•</span> AT3D Sim Shop <span>•</span> Castle Cauldron <span>•</span> Echoes of Nox <span>•</span> KP Concepts <span>•</span> Retro Saga <span>•</span> Thank you to all of our league partners and community supporters</>;
  return <div className="stream-sponsor-ticker"><strong className="stream-sponsor-ticker-label">SPONSORS:</strong><div className="stream-sponsor-ticker-window"><div className="stream-sponsor-ticker-track"><span>{message}</span><span aria-hidden="true">{message}</span></div></div></div>;
}

export function OverlayPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`stream-panel ${className}`}>{children}</section>;
}
