import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACC_CAR_MANUFACTURER_ICON_NAMES } from '@sra/domain';
import { ACEVO_MANUFACTURERS } from '../acevo-manufacturers';

// <CarIcon> serves icons from public/car-logos/<IconName>.svg rather than
// rendering them inline. An icon name with no generated file would show a
// broken image — re-run scripts/build-car-logos.ts to fix.
describe('car logo files', () => {
  const publicDir = path.resolve(__dirname, '../../../public/car-logos');
  const names = new Set([
    ...Object.values(ACC_CAR_MANUFACTURER_ICON_NAMES),
    ...ACEVO_MANUFACTURERS.flatMap(([, m]) => (m.icon ? [m.icon] : [])),
  ]);

  it.each([...names])('%s.svg exists', (name) => {
    expect(existsSync(path.join(publicDir, `${name}.svg`))).toBe(true);
  });
});
