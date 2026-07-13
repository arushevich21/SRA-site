import Image from 'next/image';
import Link from 'next/link';
import { SIMS } from '@/content/sims';
import { GameLabel } from '@/components/GameLabel';
import { CountUpStats } from '@/components/CountUpStats';

const STATS = [
  { value: '18', label: 'Seasons' },
  { value: '3,400+', label: 'Members' },
  { value: '40+', label: 'Race Servers' },
  { value: '94,327', label: 'Sessions' },
  { value: '4,540,616', label: 'Laps' },
];

const PARTNERS = [
  { name: 'Armamentario', logo: '/sponsors/sliders/armamentario-com.png', href: 'https://www.armamentario.com' },
  { name: 'AT3D', logo: '/sponsors/sliders/at3d-sim-shop.png', href: 'https://at3d.net' },
  { name: 'Castle Cauldron', logo: '/sponsors/sliders/castlecauldron.png', href: 'https://facebook.com/castlecauldron' },
  { name: 'Documize', logo: '/sponsors/sliders/documize-com.png', href: 'https://documize.com' },
  { name: 'Echoes of Nox', logo: '/sponsors/sliders/echoes_of_nox.png', href: 'https://store.steampowered.com/app/4368440/Echoes_of_Nox/' },
  { name: 'GO Setups', logo: '/sponsors/sliders/go-setups.png', href: 'https://gosetups.gg/product/acc-setups/?ref=5879' },
  { name: 'KP Concepts', logo: '/sponsors/sliders/kp_concepts.png', href: 'https://www.kpconcepts.com' },
  { name: 'Retro Saga', logo: '/sponsors/sliders/retro-saga-ca.png', href: 'https://retrosaga.ca' },
  { name: 'Trackside', logo: '/sponsors/sliders/TS_Logo_White_SVG.png', href: 'https://trackside.vip' },
  { name: 'Trak Racer', logo: '/sponsors/sliders/trak-racer.png', href: 'https://trakracer.com' },
  { name: 'Triple Stint', logo: '/sponsors/partners/triple-stint/White%20Text/Logo.png', href: 'https://triplestintracing.com/' },
];

export default function HomePage() {
  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-7 pt-[76px] pb-16 overflow-hidden">
        <div
          className="absolute top-0 right-[-10%] w-[46%] h-full z-0"
          style={{
            background: 'linear-gradient(115deg, transparent 0%, rgba(230,181,61,.07) 45%, rgba(230,181,61,.13) 50%, transparent 51%)',
            transform: 'skewX(-12deg)',
          }}
        />

        <div className="relative z-10 max-w-[800px] text-center">
          <Image
            src="/badges/GT3TSAsset_white.png"
            alt="Sim Racing Alliance"
            width={480}
            height={120}
            className="mx-auto mb-10 w-[180px] h-auto"
            priority
          />

          <h1 className="font-display font-black text-[clamp(36px,5.5vw,64px)] uppercase leading-[.95] tracking-[-1px] text-txt">
            Welcome to Sim Racing Alliance
          </h1>

          <p className="font-sans text-[16px] text-txt-2 leading-relaxed mt-6 max-w-[600px] mx-auto">
            We are a <span className="text-gold">North American, PC-based</span>{' '}
            sim racing league committed to providing a{' '}
            <span className="text-gold">competitive</span> and{' '}
            <span className="shake text-gold">clean</span> racing
            environment. Explore the available racing platforms,
            select the competition that suits you, and get connected with
            the community.
          </p>

          <div className="mt-8">
            <Link
              href="/about/league-info"
              className="inline-block font-sans font-bold text-[13.5px] tracking-[.09em] uppercase bg-gold text-carbon px-7 py-4 hover:bg-gold-soft hover:shadow-[0_0_30px_rgba(230,181,61,.45)] transition-all"
              style={{ transform: 'skewX(-9deg)' }}
            >
              <span style={{ display: 'inline-block', transform: 'skewX(9deg)' }}>
                Get Started →
              </span>
            </Link>
          </div>

          {/* Stats bar */}
          <CountUpStats stats={STATS} />
        </div>
      </section>

      {/* ── WHO WE ARE ────────────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="max-w-[1280px] mx-auto px-7 py-20 text-center">
          <span className="block font-mono text-[11px] tracking-[.35em] uppercase text-gold mb-5">
            Who We Are
          </span>
          <p className="font-sans text-[17px] text-txt-2 leading-relaxed max-w-[700px] mx-auto text-pretty">
            Sim Racing Alliance is a competitive multi-sim racing league
            featuring organized championships across multiple platforms.
            Whether you race GT3s in ACC, prototypes in Le Mans Ultimate,
            or MX-5s in AC Evo — there&apos;s a grid with your&nbsp;name&nbsp;on&nbsp;it.
          </p>
        </div>
      </section>

      {/* ── SIM SELECTOR ──────────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="max-w-[1280px] mx-auto px-7 py-20">
          <span className="block font-mono text-[11px] tracking-[.35em] uppercase text-gold mb-3 text-center">
            Choose Your Sim
          </span>
          <h2 className="font-display font-black text-[clamp(28px,4vw,48px)] uppercase leading-[.92] tracking-[-0.5px] text-txt text-center mb-12">
            Start Racing
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SIMS.map((sim) => (
              <Link
                key={sim.slug}
                href={`/${sim.slug}`}
                className="group relative border border-line bg-panel hover:bg-panel-2 transition-all overflow-hidden"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ backgroundColor: sim.accentColor }}
                />
                <div className="px-6 py-8">
                  <span
                    className="block font-display font-black text-[22px] uppercase leading-none tracking-[-0.3px] mb-2 transition-colors"
                    style={{ color: sim.accentColor }}
                  >
                    <GameLabel game={sim.game} />
                  </span>
                  <span className="block font-sans text-[13px] text-txt-3 group-hover:text-txt-2 transition-colors">
                    {sim.displayName}
                  </span>
                </div>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 font-mono text-[14px] text-txt-3/30 group-hover:text-txt-3/60 transition-colors">
                  →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTNERS STRIP ────────────────────────────────────────────── */}
      <section className="border-t border-b border-line py-10 overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-7">
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-11 gap-6 items-center">
            {PARTNERS.map((p) => (
              <a
                key={p.href}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center p-3 opacity-50 hover:opacity-100 transition-opacity"
              >
                <Image
                  src={p.logo}
                  alt={p.name}
                  width={120}
                  height={40}
                  className="max-h-[40px] max-w-full object-contain"
                  unoptimized
                />
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
