export type BopData = {
  cars: string[];
  tracks: string[];
  ballast: (number | null)[][]; // cars x tracks, null = "-"
  restrictor: (number | null)[][]; // cars x tracks, null = "-"
};

export const BOP_DATA: BopData = {
  cars: [
    'AMR V12 Vantage GT3',
    'AMR V8 Vantage GT3',
    'Audi R8 LMS GT3 Evo 2',
    'Bentley Continental GT3',
    'BMW M4 GT3',
    'BMW M6 GT3',
    'Emil Frey Jaguar G3',
    'Ferrari 296 GT3',
    'Ferrari 488 GT3 Evo',
    'Ford Mustang GT3',
    'Honda NSX GT3 Evo',
    'Lamborghini Huracán GT3 EVO2',
    'Lexus RC F GT3',
    'McLaren 650S GT3',
    'McLaren 720S GT3',
    'McLaren 720S GT3 Evo',
    'Mercedes-AMG GT3 EVO',
    'Nissan GT-R Nismo GT3',
    'Porsche 991 II GT3 R',
    'Porsche 992 GT3 R',
    'Reiter Engineering R-EX GT3',
  ],
  tracks: [
    'Barcelona',
    'Brands Hatch',
    'Circuit of The Americas',
    'Donington Park',
    'Hungaroring',
    'Imola',
    'Indianapolis',
    'Kyalami',
    'Laguna Seca',
    'Misano',
    'Monza',
    'Mount Panorama',
    'Nordschleife',
    'Nürburgring',
    'Oulton Park',
    'Paul Ricard',
    'Red Bull Ring',
    'Silverstone',
    'Snetterton',
    'Spa Francorchamps',
    'Suzuka',
    'Valencia',
    'Watkins Glen',
    'Zandvoort',
    'Zolder',
  ],
  ballast: [
    // AMR V12 Vantage GT3
    [-40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40],
    // AMR V8 Vantage GT3
    [-5, null, 10, 15, -5, null, null, 15, -5, null, 5, null, 20, null, 20, 15, -20, 5, null, -5, -5, -15, 15, null, -25],
    // Audi R8 LMS GT3 Evo 2
    [-5, null, 5, null, 10, 5, 5, null, 5, null, -5, 10, -5, -20, -10, null, 5, 15, -10, null, -5, null, 10, null, -10],
    // Bentley Continental GT3
    [null, -20, -30, -30, -35, -20, -15, -20, -35, -40, -15, 10, -15, -15, -35, null, -5, -30, -40, -20, -20, -10, -40, -30, -20],
    // BMW M4 GT3
    [-5, 5, 5, 25, 5, null, -10, 5, null, 10, 15, -10, 20, 20, 5, 5, 25, 5, 15, 5, -5, 10, -5, 10, 10],
    // BMW M6 GT3
    [-40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40],
    // Emil Frey Jaguar G3
    [-40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40],
    // Ferrari 296 GT3
    [15, null, 5, -15, 15, 10, 10, -5, null, null, 10, -20, 5, 5, -5, -5, -20, 15, 5, 5, 10, null, 5, 15, -15],
    // Ferrari 488 GT3 Evo
    [-20, -30, -35, -40, -10, -40, -5, -25, -25, -35, -40, -40, -40, -35, -40, -30, -40, -25, -40, -30, -40, -25, -15, -15, -30],
    // Ford Mustang GT3
    [-5, -25, -15, null, -5, -5, null, null, -5, -25, -30, 10, 10, -20, -10, -15, 15, -35, -10, null, -10, -20, -10, -20, null],
    // Honda NSX GT3 Evo
    [null, -5, -5, null, -15, -15, -25, -15, 15, -5, -30, -10, -25, null, null, -30, -25, -5, 10, -25, -20, 5, -25, -5, -10],
    // Lamborghini Huracán GT3 EVO2
    [null, 10, -15, -10, 5, null, 5, -5, 10, 5, -5, null, null, 10, 15, 5, 5, 5, null, -5, -5, null, 10, 15, -5],
    // Lexus RC F GT3
    [-35, -35, -40, -25, -40, -40, -25, -35, -30, -35, -5, -15, -20, -20, -15, -10, -20, -40, -25, -10, -20, -25, null, -25, -30],
    // McLaren 650S GT3
    [null, -40, -40, null, -40, -40, null, null, 5, null, null, -40, null, null, -40, null, -40, -40, -40, -40, -40, null, null, null, -40],
    // McLaren 720S GT3
    [-40, 5, null, -35, -10, -20, null, -25, -10, null, -20, null, null, -25, null, -5, null, null, null, 5, -15, null, null, null, null],
    // McLaren 720S GT3 Evo
    [null, 25, null, -15, 20, 5, -5, 10, -10, 5, 5, 20, null, -5, null, 5, 20, 10, -5, 10, 10, 15, 5, 10, null],
    // Mercedes-AMG GT3 EVO
    [-15, -10, 5, -15, -10, -10, null, -15, -5, 20, -5, -5, -20, -15, -5, 5, 10, -10, 5, -15, 10, null, 15, 5, 10],
    // Nissan GT-R Nismo GT3
    [-10, -20, null, null, -25, -10, -5, -15, 5, -5, 20, -10, -5, -10, 15, 15, 5, -30, 10, 5, null, null, 10, null, -10],
    // Porsche 991 II GT3 R
    [-35, -40, -20, -20, -5, -40, -20, -20, 10, -25, -35, -40, -40, -35, -15, -30, -40, -30, -30, -30, -40, -25, -35, -5, -40],
    // Porsche 992 GT3 R
    [null, -10, 20, -5, 10, 10, -5, null, -5, -5, -10, -15, -30, -5, -5, -10, -20, null, null, null, 10, -5, -5, null, -15],
    // Reiter Engineering R-EX GT3
    [null, -40, -40, null, -40, null, null, null, -40, -40, -40, -40, -40, null, -40, null, null, -40, null, -40, -40, null, null, null, -40],
  ],
  restrictor: [
    // AMR V12 Vantage GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // AMR V8 Vantage GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Audi R8 LMS GT3 Evo 2
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Bentley Continental GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // BMW M4 GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // BMW M6 GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Emil Frey Jaguar G3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Ferrari 296 GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Ferrari 488 GT3 Evo
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Ford Mustang GT3
    [20, 19, 20, 20, 20, 20, 20, 19, null, 20, 20, 19, null, 20, 20, 20, null, 20, 20, 19, 20, 20, 20, 20, 20],
    // Honda NSX GT3 Evo
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Lamborghini Huracán GT3 EVO2
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Lexus RC F GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // McLaren 650S GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // McLaren 720S GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // McLaren 720S GT3 Evo
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Mercedes-AMG GT3 EVO
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Nissan GT-R Nismo GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Porsche 991 II GT3 R
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Porsche 992 GT3 R
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Reiter Engineering R-EX GT3
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  ],
};

/**
 * Manufacturer logo URLs mapped by car name.
 * Source: https://static.simracingalliance.com/assets/images/logo/manufacturers/light/
 */
export const MANUFACTURER_LOGOS: Record<string, string> = {
  'AMR V12 Vantage GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/aston_martin.png',
  'AMR V8 Vantage GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/aston_martin.png',
  'Audi R8 LMS GT3 Evo 2':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/audi.png',
  'Bentley Continental GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/bentley.png',
  'BMW M4 GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/bmw.png',
  'BMW M6 GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/bmw.png',
  'Emil Frey Jaguar G3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/jaguar.png',
  'Ferrari 296 GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/ferrari.png',
  'Ferrari 488 GT3 Evo':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/ferrari.png',
  'Ford Mustang GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/ford.png',
  'Honda NSX GT3 Evo':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/honda.png',
  'Lamborghini Huracán GT3 EVO2':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/lamborghini.png',
  'Lexus RC F GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/lexus.png',
  'McLaren 650S GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/mclaren.png',
  'McLaren 720S GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/mclaren.png',
  'McLaren 720S GT3 Evo':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/mclaren.png',
  'Mercedes-AMG GT3 EVO':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/mercedes.png',
  'Nissan GT-R Nismo GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/nissan.png',
  'Porsche 991 II GT3 R':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/porsche.png',
  'Porsche 992 GT3 R':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/porsche.png',
  'Reiter Engineering R-EX GT3':
    'https://static.simracingalliance.com/assets/images/logo/manufacturers/light/lamborghini.png',
};
