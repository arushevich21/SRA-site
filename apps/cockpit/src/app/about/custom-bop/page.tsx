import Image from 'next/image';
import { BOP_DATA, MANUFACTURER_LOGOS } from '@/content/custom-bop';
import { Collapsible } from '@/components/Collapsible';

function cellColor(value: number | null): string {
  if (value === null || value === 0) return 'text-txt-3';
  if (value > 0) return 'text-gold-deep';
  return 'text-live';
}

function formatCell(value: number | null): string {
  if (value === null) return '-';
  if (value > 0) return `+${value}`;
  return String(value);
}

function BopTable({
  data,
}: {
  data: (number | null)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse w-full text-left" style={{ fontSize: '11px' }}>
        <thead>
          <tr>
            <th className="font-mono tracking-[.15em] uppercase text-txt-3 py-1 px-1 sticky left-0 bg-carbon z-10 min-w-[160px]">
              Car
            </th>
            {BOP_DATA.tracks.map((track) => (
              <th
                key={track}
                className="font-mono tracking-[.15em] uppercase text-txt-3 py-2 px-2 text-center whitespace-nowrap border-l border-line"
              >
                {track}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BOP_DATA.cars.map((car, carIdx) => (
            <tr key={car} className="border-b border-line/20">
              <td className="font-sans text-[12px] text-txt sticky left-0 bg-carbon z-10 px-1 py-[3px] whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  {MANUFACTURER_LOGOS[car] && (
                    <Image
                      src={MANUFACTURER_LOGOS[car]}
                      alt=""
                      width={18}
                      height={18}
                      className="inline-block object-contain"
                      unoptimized
                    />
                  )}
                  {car}
                </span>
              </td>
              {data[carIdx].map((value, trackIdx) => (
                <td
                  key={BOP_DATA.tracks[trackIdx]}
                  className={`font-mono text-center py-[3px] px-1 border-l border-line ${cellColor(value)}`}
                >
                  {formatCell(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomBopPage() {
  return (
    <section className="max-w-full mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Custom BoP
      </h1>

      <Collapsible title="ACC — GT3" defaultOpen>
        <Collapsible title="Ballast (Kg)" defaultOpen>
          <BopTable data={BOP_DATA.ballast} />
        </Collapsible>

        <Collapsible title="Restrictor (%)">
          <BopTable data={BOP_DATA.restrictor} />
        </Collapsible>
      </Collapsible>
    </section>
  );
}