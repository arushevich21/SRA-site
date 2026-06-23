export type LapTimeEntry = {
  track: string;
  reference: string;
  div1: string;
  div2: string;
  div3: string;
  div4: string;
};

export const HOT_LAP_TIMES: LapTimeEntry[] = [
  { track: 'Barcelona', reference: '1:42.782', div1: '1:43.450', div2: '1:44.217', div3: '1:44.770', div4: '1:45.134' },
  { track: 'Brands Hatch', reference: '1:22.500', div1: '1:23.036', div2: '1:23.652', div3: '1:24.096', div4: '1:24.388' },
  { track: 'Circuit of The Americas', reference: '2:04.607', div1: '2:05.416', div2: '2:06.347', div3: '2:07.018', div4: '2:07.459' },
  { track: 'Donington Park', reference: '1:25.910', div1: '1:26.468', div2: '1:27.110', div3: '1:27.572', div4: '1:27.876' },
  { track: 'Hungaroring', reference: '1:42.443', div1: '1:43.108', div2: '1:43.874', div3: '1:44.425', div4: '1:44.787' },
  { track: 'Imola', reference: '1:39.949', div1: '1:40.598', div2: '1:41.345', div3: '1:41.883', div4: '1:42.236' },
  { track: 'Indianapolis', reference: '1:34.863', div1: '1:35.479', div2: '1:36.188', div3: '1:36.698', div4: '1:37.034' },
  { track: 'Kyalami', reference: '1:39.805', div1: '1:40.453', div2: '1:41.199', div3: '1:41.736', div4: '1:42.089' },
  { track: 'Laguna Seca', reference: '1:21.301', div1: '1:21.829', div2: '1:22.436', div3: '1:22.874', div4: '1:23.161' },
  { track: 'Misano', reference: '1:32.698', div1: '1:33.300', div2: '1:33.992', div3: '1:34.491', div4: '1:34.819' },
  { track: 'Monza', reference: '1:46.711', div1: '1:47.404', div2: '1:48.201', div3: '1:48.775', div4: '1:49.153' },
  { track: 'Mount Panorama', reference: '1:59.575', div1: '2:00.352', div2: '2:01.245', div3: '2:01.888', div4: '2:02.312' },
  { track: 'Nordschleife', reference: '8:10.000', div1: '8:13.185', div2: '8:16.845', div3: '8:19.481', div4: '8:21.216' },
  { track: 'Nürburgring', reference: '1:53.255', div1: '1:53.991', div2: '1:54.837', div3: '1:55.446', div4: '1:55.847' },
  { track: 'Oulton Park', reference: '1:32.485', div1: '1:33.086', div2: '1:33.777', div3: '1:34.274', div4: '1:34.601' },
  { track: 'Paul Ricard', reference: '1:52.906', div1: '1:53.639', div2: '1:54.483', div3: '1:55.090', div4: '1:55.490' },
  { track: 'Red Bull Ring', reference: '1:27.629', div1: '1:28.198', div2: '1:28.853', div3: '1:29.324', div4: '1:29.634' },
  { track: 'Silverstone', reference: '1:56.848', div1: '1:57.607', div2: '1:58.480', div3: '1:59.109', div4: '1:59.522' },
  { track: 'Snetterton', reference: '1:45.596', div1: '1:46.282', div2: '1:47.071', div3: '1:47.639', div4: '1:48.013' },
  { track: 'Spa Francorchamps', reference: '2:16.434', div1: '2:17.320', div2: '2:18.339', div3: '2:19.073', div4: '2:19.556' },
  { track: 'Suzuka', reference: '1:58.666', div1: '1:59.437', div2: '2:00.323', div3: '2:00.962', div4: '2:01.382' },
  { track: 'Valencia', reference: '1:29.735', div1: '1:30.318', div2: '1:30.988', div3: '1:31.471', div4: '1:31.789' },
  { track: 'Watkins Glen', reference: '1:43.244', div1: '1:43.915', div2: '1:44.686', div3: '1:45.241', div4: '1:45.607' },
  { track: 'Zandvoort', reference: '1:34.706', div1: '1:35.321', div2: '1:36.029', div3: '1:36.538', div4: '1:36.873' },
  { track: 'Zolder', reference: '1:27.360', div1: '1:27.927', div2: '1:28.580', div3: '1:29.050', div4: '1:29.359' },
];

export const HOT_STINT_TIMES: LapTimeEntry[] = [
  { track: 'Barcelona', reference: '1:43.039', div1: '1:43.708', div2: '1:44.478', div3: '1:45.032', div4: '1:45.397' },
  { track: 'Brands Hatch', reference: '1:22.706', div1: '1:23.243', div2: '1:23.861', div3: '1:24.306', div4: '1:24.599' },
  { track: 'Circuit of The Americas', reference: '2:04.919', div1: '2:05.730', div2: '2:06.663', div3: '2:07.335', div4: '2:07.777' },
  { track: 'Donington Park', reference: '1:26.125', div1: '1:26.684', div2: '1:27.327', div3: '1:27.791', div4: '1:28.096' },
  { track: 'Hungaroring', reference: '1:42.699', div1: '1:43.366', div2: '1:44.133', div3: '1:44.686', div4: '1:45.049' },
  { track: 'Imola', reference: '1:40.199', div1: '1:40.850', div2: '1:41.598', div3: '1:42.137', div4: '1:42.492' },
  { track: 'Indianapolis', reference: '1:35.100', div1: '1:35.718', div2: '1:36.428', div3: '1:36.940', div4: '1:37.277' },
  { track: 'Kyalami', reference: '1:40.055', div1: '1:40.704', div2: '1:41.452', div3: '1:41.990', div4: '1:42.344' },
  { track: 'Laguna Seca', reference: '1:21.504', div1: '1:22.034', div2: '1:22.642', div3: '1:23.081', div4: '1:23.369' },
  { track: 'Misano', reference: '1:32.930', div1: '1:33.533', div2: '1:34.227', div3: '1:34.727', div4: '1:35.056' },
  { track: 'Monza', reference: '1:46.978', div1: '1:47.673', div2: '1:48.472', div3: '1:49.047', div4: '1:49.426' },
  { track: 'Mount Panorama', reference: '1:59.874', div1: '2:00.653', div2: '2:01.548', div3: '2:02.193', div4: '2:02.617' },
  { track: 'Nordschleife', reference: '8:11.225', div1: '8:14.417', div2: '8:18.087', div3: '8:20.730', div4: '8:22.469' },
  { track: 'Nürburgring', reference: '1:53.538', div1: '1:54.276', div2: '1:55.124', div3: '1:55.735', div4: '1:56.137' },
  { track: 'Oulton Park', reference: '1:32.716', div1: '1:33.318', div2: '1:34.011', div3: '1:34.510', div4: '1:34.838' },
  { track: 'Paul Ricard', reference: '1:53.188', div1: '1:53.923', div2: '1:54.769', div3: '1:55.378', div4: '1:55.779' },
  { track: 'Red Bull Ring', reference: '1:27.848', div1: '1:28.419', div2: '1:29.075', div3: '1:29.547', div4: '1:29.858' },
  { track: 'Silverstone', reference: '1:57.140', div1: '1:57.901', div2: '1:58.776', div3: '1:59.406', div4: '1:59.821' },
  { track: 'Snetterton', reference: '1:45.860', div1: '1:46.548', div2: '1:47.338', div3: '1:47.908', div4: '1:48.283' },
  { track: 'Spa Francorchamps', reference: '2:16.775', div1: '2:17.664', div2: '2:18.685', div3: '2:19.421', div4: '2:19.905' },
  { track: 'Suzuka', reference: '1:58.963', div1: '1:59.735', div2: '2:00.624', div3: '2:01.264', div4: '2:01.685' },
  { track: 'Valencia', reference: '1:29.959', div1: '1:30.544', div2: '1:31.216', div3: '1:31.700', div4: '1:32.018' },
  { track: 'Watkins Glen', reference: '1:43.502', div1: '1:44.174', div2: '1:44.948', div3: '1:45.504', div4: '1:45.871' },
  { track: 'Zandvoort', reference: '1:34.943', div1: '1:35.559', div2: '1:36.269', div3: '1:36.779', div4: '1:37.116' },
  { track: 'Zolder', reference: '1:27.578', div1: '1:28.147', div2: '1:28.801', div3: '1:29.273', div4: '1:29.583' },
];

export const HOT_LAP_MULTIPLIERS = { div1: 1.0065, div2: 1.01397, div3: 1.01935, div4: 1.02289 };
export const HOT_STINT_MULTIPLIERS = { div1: 1.009, div2: 1.0165, div3: 1.0219, div4: 1.0254 };
