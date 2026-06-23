import { GridOSClient } from '@sra/simgrid-client';
import { GridOSError } from '@sra/shared-types';

const BASE_URL = process.env.GRIDOS_BASE_URL ?? 'https://www.thesimgrid.com/api/v1';
const API_KEY = process.env.GRIDOS_API_KEY ?? '';

if (!API_KEY) {
  console.error('GRIDOS_API_KEY is not set');
  process.exit(1);
}

const client = new GridOSClient(BASE_URL, API_KEY);
const CHAMPIONSHIP_ID = 25580;

async function main() {
  // 1. getChampionship
  console.log(`\n── getChampionship(${CHAMPIONSHIP_ID}) ──\n`);
  try {
    const champ = await client.getChampionship(CHAMPIONSHIP_ID);
    console.log(JSON.stringify(champ, null, 2));
  } catch (err) {
    if (err instanceof GridOSError) {
      console.error('GridOSError:', {
        status: err.status,
        endpoint: err.endpoint,
        message: err.message,
      });
    } else {
      throw err;
    }
  }

  // 2. getChampionshipStandings
  console.log(`\n── getChampionshipStandings(${CHAMPIONSHIP_ID}) ──\n`);
  try {
    const standings = await client.getChampionshipStandings(CHAMPIONSHIP_ID);
    console.log(JSON.stringify(standings, null, 2));
  } catch (err) {
    if (err instanceof GridOSError) {
      console.error('GridOSError:', {
        status: err.status,
        endpoint: err.endpoint,
        message: err.message,
      });
    } else {
      throw err;
    }
  }
}

main();
