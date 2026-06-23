import Image from 'next/image';
import { BOP_DATA, MANUFACTURER_LOGOS } from '@/content/custom-bop';

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
  title,
  data,
}: {
  title: string;
  data: (number | null)[][];
}) {
  return (
    <>
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="border-collapse text-left">
          <thead>
            <tr>
              <th className="font-mono text-[9px] tracking-[.2em] uppercase text-txt-3 py-2 px-3 sticky left-0 bg-carbon z-10">
                Car
              </th>
              {BOP_DATA.tracks.map((track) => (
                <th
                  key={track}
                  className="font-mono text-[9px] tracking-[.2em] uppercase text-txt-3 py-2 px-2 whitespace-nowrap"
                >
                  {track}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BOP_DATA.cars.map((car, carIdx) => (
              <tr key={car} className="border-b border-line/30">
                <td className="font-sans text-[12px] text-txt sticky left-0 bg-carbon z-10 px-3 py-2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    {MANUFACTURER_LOGOS[car] && (
                      <Image
                        src={MANUFACTURER_LOGOS[car]}
                        alt=""
                        width={24}
                        height={24}
                        className="inline-block object-contain"
                      />
                    )}
                    {car}
                  </span>
                </td>
                {data[carIdx].map((value, trackIdx) => (
                  <td
                    key={BOP_DATA.tracks[trackIdx]}
                    className={`font-mono text-[11px] text-center py-2 px-2 ${cellColor(value)}`}
                  >
                    {formatCell(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function CustomBopPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 py-24">
      <span className="block font-mono text-[11px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(40px,6vw,72px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Custom BoP
      </h1>

      <BopTable title="Ballast (Kg)" data={BOP_DATA.ballast} />
      <BopTable title="Restrictor (%)" data={BOP_DATA.restrictor} />
    </section>
  );
}
