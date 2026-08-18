import { OverlayHeader, OverlayPanel } from './OverlayPrimitives';

const supporterTiers = [
  { label: 'Title Supporters', names: ['Bryan Anderson', 'Pauleh Hartman', 'Amos Movo'] },
  { label: 'Sponsors', names: ['Thomas Olhausen', 'Selena Boonstra', 'Jason Allen'] },
  { label: 'Supporters', names: ['Mike Geno', 'Kyle Barbour', 'Matthew Higgs'] },
];

export function SponsorsOverlay({ footerMessage }: { footerMessage?: string }) {
  const footer = footerMessage?.split('|').filter(Boolean);
  return <>
    <OverlayHeader title="Thank you to our community supporters!" subtitle="Monthly supporters on Discord and Patreon" />
    <div className="stream-sponsor-columns">
      {supporterTiers.map(({ label, names }) => <OverlayPanel key={label}>
        <h2>{label}</h2>
        <div className="stream-supporter-list">{names.map((name) => <strong key={name}>{name}</strong>)}</div>
      </OverlayPanel>)}
    </div>
    <p className="stream-footer-note">{footer?.length ? footer.join(' · ') : 'Thanks for watching · Join us at sra.gg/start · Chat with us at discord.gg/SimRacingAlliance'}</p>
  </>;
}
