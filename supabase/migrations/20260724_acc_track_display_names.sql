-- Curate ACC track_layouts display names for the leaderboards list:
--   nurburgring      "Nurburgring"      -> "Nürburgring GP"     (name the layout)
--   nurburgring_24h  "nurburgring_24h"  -> "Nürburgring 24H"    (drop the raw-key underscore)
--   spa              "spa"              -> "Spa-Francorchamps"  (full circuit name)

UPDATE track_layouts SET display_name = 'Nürburgring GP'
  WHERE game = 'ACC' AND layout_key = 'nurburgring';

UPDATE track_layouts SET display_name = 'Nürburgring 24H'
  WHERE game = 'ACC' AND layout_key = 'nurburgring_24h';

UPDATE track_layouts SET display_name = 'Spa-Francorchamps'
  WHERE game = 'ACC' AND layout_key = 'spa';
