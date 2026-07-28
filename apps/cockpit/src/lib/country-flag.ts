// Regional-indicator flag emoji render unreliably on Windows/Chrome (often
// just the letters, or nothing) — an actual image is more portable. flagcdn.com
// is a free public CDN keyed by ISO 3166-1 alpha-2 code.
export function countryFlagUrl(countryCode: string): string {
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
}
