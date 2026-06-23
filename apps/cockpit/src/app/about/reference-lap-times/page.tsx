import {
  HOT_LAP_TIMES,
  HOT_STINT_TIMES,
  HOT_LAP_MULTIPLIERS,
  HOT_STINT_MULTIPLIERS,
  type LapTimeEntry,
} from '@/content/reference-lap-times';

function MultiplierNote({ multipliers }: { multipliers: { div1: number; div2: number; div3: number; div4: number } }) {
  return (
    <p className="font-mono text-[10px] text-txt-3 mb-4">
      Division multipliers — D1: {multipliers.div1} · D2: {multipliers.div2} · D3: {multipliers.div3} · D4: {multipliers.div4}
    </p>
  );
}

function LapTimeTable({ data }: { data: LapTimeEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line/30">
            <th className="font-mono text-[9px] tracking-[.3em] uppercase text-txt-3 py-2 px-3">Track</th>
            <th className="font-mono text-[9px] tracking-[.3em] uppercase text-txt-3 py-2 px-3 text-center">Reference</th>
            <th className="font-mono text-[9px] tracking-[.3em] uppercase text-txt-3 py-2 px-3 text-center">Div 1</th>
            <th className="font-mono text-[9px] tracking-[.3em] uppercase text-txt-3 py-2 px-3 text-center">Div 2</th>
            <th className="font-mono text-[9px] tracking-[.3em] uppercase text-txt-3 py-2 px-3 text-center">Div 3</th>
            <th className="font-mono text-[9px] tracking-[.3em] uppercase text-txt-3 py-2 px-3 text-center">Div 4</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.track} className="border-b border-line/30">
              <td className="font-display font-bold text-[13px] uppercase text-txt-2 py-2 px-3">{entry.track}</td>
              <td className="font-mono text-[11px] text-gold py-2 px-3 text-center">{entry.reference}</td>
              <td className="font-mono text-[11px] text-txt-2 py-2 px-3 text-center">{entry.div1}</td>
              <td className="font-mono text-[11px] text-txt-2 py-2 px-3 text-center">{entry.div2}</td>
              <td className="font-mono text-[11px] text-txt-2 py-2 px-3 text-center">{entry.div3}</td>
              <td className="font-mono text-[11px] text-txt-2 py-2 px-3 text-center">{entry.div4}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReferenceLapTimesPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 py-24">
      <span className="block font-mono text-[11px] tracking-[.3em] uppercase text-gold mb-5">— About</span>
      <h1 className="font-display font-black text-[clamp(40px,6vw,72px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Reference Lap Times
      </h1>

      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">Hot Lap</h2>
      <MultiplierNote multipliers={HOT_LAP_MULTIPLIERS} />
      <LapTimeTable data={HOT_LAP_TIMES} />

      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">Hot Stint</h2>
      <MultiplierNote multipliers={HOT_STINT_MULTIPLIERS} />
      <LapTimeTable data={HOT_STINT_TIMES} />

      <p className="font-mono text-[10px] text-txt-3 mt-10">
        Data sourced from GT3 vehicles under optimal dry conditions at approximately 21°C ambient temperature.
      </p>
    </section>
  );
}
