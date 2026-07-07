import Image from 'next/image';
import {
  HOT_LAP_TIMES,
  HOT_STINT_TIMES,
  HOT_LAP_MULTIPLIERS,
  HOT_STINT_MULTIPLIERS,
  type LapTimeEntry,
} from '@/content/reference-lap-times';
import { Collapsible } from '@/components/Collapsible';

const DIVISIONS = [
  { key: 'div1' as const, logo: '/badges/Division 1.png', alt: 'Division 1' },
  { key: 'div2' as const, logo: '/badges/Division 2.png', alt: 'Division 2' },
  { key: 'div3' as const, logo: '/badges/Division 3.png', alt: 'Division 3' },
  { key: 'div4' as const, logo: '/badges/Division 4.png', alt: 'Division 4' },
];

function MultiplierNote({ multipliers }: { multipliers: { div1: number; div2: number; div3: number; div4: number } }) {
  return (
    <p className="font-mono text-[15px] text-txt-3 mb-4">
      Division multipliers — D1: +{((multipliers.div1 - 1) * 100).toFixed(2)}% · D2: +{((multipliers.div2 - 1) * 100).toFixed(2)}% · D3: +{((multipliers.div3 - 1) * 100).toFixed(2)}% · D4: +{((multipliers.div4 - 1) * 100).toFixed(2)}%
    </p>
  );
}

function LapTimeTable({ data }: { data: LapTimeEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line/30">
            <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-3 px-3">Track</th>
            <th className="py-3 px-3 text-center">
                <Image
                  src="/badges/Alien.png"
                  alt="Reference"
                  width={40}
                  height={40}
                  className="w-[32px] h-[32px] object-contain mx-auto"
                />
              </th>
            {DIVISIONS.map((div) => (
              <th key={div.key} className="py-3 px-3 text-center">
                <Image
                  src={div.logo}
                  alt={div.alt}
                  width={40}
                  height={40}
                  className="w-[32px] h-[32px] object-contain mx-auto"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.track} className="border-b border-line/30">
              <td className="font-display font-bold text-[16px] uppercase text-txt-2 py-2 px-3">{entry.track}</td>
              <td className="font-mono text-[15px] text-gold py-2 px-3 text-center">{entry.reference}</td>
              {DIVISIONS.map((div) => (
                <td key={div.key} className="font-mono text-[15px] text-txt-2 py-2 px-3 text-center">
                  {entry[div.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReferenceLapTimesPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">— About</span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Reference Lap Times
      </h1>

      <Collapsible title="ACC — GT3" defaultOpen>
        <Collapsible title="Hot Lap" defaultOpen>
          <MultiplierNote multipliers={HOT_LAP_MULTIPLIERS} />
          <LapTimeTable data={HOT_LAP_TIMES} />
        </Collapsible>

        <Collapsible title="Hot Stint">
          <MultiplierNote multipliers={HOT_STINT_MULTIPLIERS} />
          <LapTimeTable data={HOT_STINT_TIMES} />
        </Collapsible>
      </Collapsible>

      <p className="font-mono text-[15px] text-txt-3 mt-10">
        Data sourced from GT3 vehicles under optimal dry conditions at approximately 21°C ambient temperature.
      </p>
    </section>
  );
}
