import Image from 'next/image';
import { Collapsible } from '@/components/Collapsible';
import { getPublicBop, type PublicBopCar } from '@/lib/public-bop';

export const dynamic = 'force-dynamic';

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
  cars,
  tracks,
  data,
}: {
  cars: PublicBopCar[];
  tracks: string[];
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
            {tracks.map((track) => (
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
          {cars.map((car, carIdx) => (
            <tr key={car.name} className="border-b border-line/20">
              <td className="font-sans text-[12px] text-txt sticky left-0 bg-carbon z-10 px-1 py-[3px] whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  {car.logo && (
                    <Image
                      src={car.logo}
                      alt=""
                      width={18}
                      height={18}
                      className="inline-block object-contain"
                      unoptimized
                    />
                  )}
                  {car.name}
                </span>
              </td>
              {data[carIdx].map((value, trackIdx) => (
                <td
                  key={tracks[trackIdx]}
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

export default async function CustomBopPage() {
  const bop = await getPublicBop();

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
          <BopTable cars={bop.cars} tracks={bop.tracks} data={bop.ballast} />
        </Collapsible>

        <Collapsible title="Restrictor (%)">
          <BopTable cars={bop.cars} tracks={bop.tracks} data={bop.restrictor} />
        </Collapsible>
      </Collapsible>
    </section>
  );
}
