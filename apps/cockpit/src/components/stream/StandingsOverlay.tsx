import type { ChampionshipContent } from '@/content/championships';
import type { StandingsExport } from '@/lib/standings-types';
import Image from 'next/image';

export function StandingsOverlay({ championship, division, type, page, standings }: { championship: ChampionshipContent; division: string; type: 'driver' | 'team'; page: number; standings: StandingsExport }) {
  const rows = standings.flatMap((group) => group.standings).slice((page - 1) * 26, page * 26);
  const columns = [rows.slice(0, 13), rows.slice(13, 26)];
  const title = type === 'driver' ? 'Drivers Standings' : 'Team Standings';
  return <>
    <div className="stream-standings-heading"><Image className="stream-logo-image" src="/badges/GT3TSAsset_white.png" alt="" width={400} height={200} sizes="7vw" unoptimized /><Image className="stream-series-logo" src={championship.logo ?? '/badges/GT3TS_Logo.png'} alt="" width={400} height={200} sizes="7vw" unoptimized /><h1>{championship.classTag} Team Series — {championship.title.match(/Season\s+\d+/)?.[0] ?? 'Season'} Division {division}</h1><h2>{title} — After 6 of 8 rounds</h2></div>
    <div className="stream-standings-grid">{columns.map((column, columnIndex) => <div className="stream-standings-column" key={column[0]?.position ?? `empty-${columnIndex}`}>{column.map((row) => <article className="stream-standing-row" key={`${columnIndex}-${row.position}`}><strong className="stream-position">#{row.position}</strong><div className="stream-driver"><b>{row.id}</b><span>{type === 'driver' ? 'Team name pending' : 'Team & drivers pending'}</span></div><span className="stream-car">{row.car}</span><strong className="stream-points"><span className="stream-points-value">{row.actualPoints}</span><small>{row.position === 1 ? '' : `-${row.position * 5}`}</small></strong></article>)}</div>)}</div>
  </>;
}
