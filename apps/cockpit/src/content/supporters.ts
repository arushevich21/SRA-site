// Everyone backing SRA on Discord or Patreon, by tier, for the stream
// acknowledgements (the supporters ticker on every scene and the three
// columns on the sponsors scene). Transcribed from the three Discord roles —
// each tier is a manually managed role plus an integration-managed one, and
// `both` marks someone in both, which the scene shows as the ⭐ "subscribed
// on Discord and Patreon". Country comes from their drivers row. Within a
// tier the order is by last name, as the old scene collection had it.
//
// Someone who holds more than one role is listed in every tier they hold —
// that's how the old scenes read, and it's what they paid for.

export type Supporter = {
  name: string;
  // ISO 3166-1 alpha-2, for the flag. Null when unknown (no drivers row).
  country: string | null;
  // In both the Discord and the Patreon role for this tier.
  both?: true;
};

export type SupporterTier = {
  key: 'title' | 'sponsor' | 'supporter';
  // Column heading on the sponsors scene.
  label: string;
  // Chip in the ticker.
  short: string;
  members: readonly Supporter[];
};

export const SUPPORTER_TIERS: readonly SupporterTier[] = [
  { key: 'title', label: 'Title Sponsors', short: 'TITLE SPONSORS', members: [
    { name: "Bryan Acomb", country: "US" },
    { name: "Aaron Anderson", country: "US" },
    { name: "Jon Baham", country: "US" },
    { name: "Brad Bertram", country: "US" },
    { name: "Gordon Beverly III", country: "US" },
    { name: "Milo Green", country: "US" },
    { name: "Thomas Greer", country: "US" },
    { name: "Pauleh Hartman", country: "US" },
    { name: "Dan Hernandez", country: "US" },
    { name: "Anthony Kelley", country: "US" },
    { name: "Sean Leitch", country: "US" },
    { name: "Ramon Lorenzo", country: "US" },
    { name: "Michael McWeezerson", country: "US" },
    { name: "R Moffett", country: "CA" },
    { name: "Cory Mummery", country: "US" },
    { name: "Josh Parker", country: "US" },
    { name: "Cody Platt", country: "US" },
    { name: "Fire Queso", country: "BG" },
    { name: "Jeremy Rann", country: "US" },
    { name: "Richard Schulze", country: "BE", both: true },
    { name: "Caleb Yarrington", country: "US" },
  ] },
  { key: 'sponsor', label: 'Sponsors', short: 'SPONSORS', members: [
    { name: "Bryan Acomb", country: "US" },
    { name: "Mark Allen", country: "CA" },
    { name: "Julien Bacon", country: "CA" },
    { name: "Brad Bertram", country: "US" },
    { name: "Gordon Beverly III", country: "US" },
    { name: "Selena Boonstra", country: "CA" },
    { name: "Ein Byron", country: "US" },
    { name: "Donovan Colton", country: "US" },
    { name: "Corey Coult", country: "US" },
    { name: "Shaun Daniels", country: "US" },
    { name: "Mark DC", country: "US" },
    { name: "Zodi Fade", country: "CH" },
    { name: "Mike Ferro", country: "US" },
    { name: "Ron FLO", country: "CA" },
    { name: "Milo Green", country: "US" },
    { name: "Thomas Greer", country: "US" },
    { name: "Dan Hernandez", country: "US" },
    { name: "Michael Jeffries", country: "US" },
    { name: "Sean Keenan", country: "US" },
    { name: "Matt Kirkland", country: "US" },
    { name: "Cleveland Leatherwood", country: "US" },
    { name: "Sean Leitch", country: "US" },
    { name: "Shane Lewis", country: "CA" },
    { name: "Ramon Lorenzo", country: "US" },
    { name: "Ethan Marvin", country: "US" },
    { name: "R Moffett", country: "CA" },
    { name: "Cory Mummery", country: "US" },
    { name: "Cezary Penkiewicz", country: "PL" },
    { name: "Cody Platt", country: "US" },
    { name: "Jeremy Rann", country: "US" },
    { name: "Martin Riggs", country: "US" },
    { name: "Ben Roberts", country: "US" },
    { name: "Darren Robichaud", country: "CA" },
    { name: "Eduardo Rodríguez", country: "MX" },
    { name: "Jermaine Rose", country: "JM" },
    { name: "Adam Santana", country: "US" },
    { name: "Matt Schmitzer", country: "US" },
    { name: "Richard Schulze", country: "BE" },
    { name: "Nate Specht", country: "US" },
    { name: "Andrew Wilson", country: "US" },
    { name: "Chris Witting Jr", country: "PR" },
    { name: "Caleb Yarrington", country: "US" },
  ] },
  { key: 'supporter', label: 'Supporters', short: 'SUPPORTERS', members: [
    { name: "Bryan Acomb", country: "US" },
    { name: "Bryan Anderson", country: "SE" },
    { name: "John Ansom", country: "GB" },
    { name: "Kasra Arabi", country: "IR" },
    { name: "Andrew Berg", country: "US" },
    { name: "Brad Bertram", country: "US" },
    { name: "Gordon Beverly III", country: "US" },
    { name: "Mark DC", country: "US" },
    { name: "Don Draper", country: "CA" },
    { name: "Milo Green", country: "US" },
    { name: "Thomas Greer", country: "US" },
    { name: "Dan Hernandez", country: "US" },
    { name: "Michael Jeffries", country: "US" },
    { name: "Roy Keay", country: "US" },
    { name: "Pawel Kreska", country: "PL" },
    { name: "Sean Leitch", country: "US" },
    { name: "Ramon Lorenzo", country: "US" },
    { name: "R Moffett", country: "CA" },
    { name: "Cory Mummery", country: "US" },
    { name: "nksalgado", country: null },
    { name: "Cezary Penkiewicz", country: "PL" },
    { name: "Cody Platt", country: "US" },
    { name: "Jeremy Rann", country: "US" },
    { name: "Jermaine Rose", country: "JM" },
    { name: "Adam Santana", country: "US" },
    { name: "Richard Schulze", country: "BE" },
    { name: "Nate Specht", country: "US" },
    { name: "Roby Toty", country: "US" },
    { name: "Rob Warren", country: "US" },
    { name: "Andrew Wilson", country: "US" },
    { name: "Chris Witting Jr", country: "PR" },
  ] },
];
