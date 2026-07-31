import Image from 'next/image';
import Link from 'next/link';

const LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-carbon-2">
      <div className="max-w-[1280px] mx-auto px-7 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3 shrink-0">
            <Image
              src="/badges/GT3TSAsset_white.png"
              alt="Sim Racing Alliance"
              width={480}
              height={120}
              className="h-[36px] w-auto object-contain"
            />
          </Link>

        <span className="font-mono text-xs text-txt-3">
          &copy; {new Date().getFullYear()} Sim Racing Alliance
        </span>

        <nav className="flex flex-wrap items-right justify-right gap-x-8 gap-y-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-sans text-sm text-txt-2 hover:text-gold transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        
      </div>
    </footer>
  );
}
