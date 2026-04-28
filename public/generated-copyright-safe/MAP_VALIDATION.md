# Step2 Country Map Validation

Validation date: 2026-04-28

## Scope

This check covers the Step2 country map PNG files:

- `hidden-map-kenya.png`
- `hidden-map-tanzania.png`
- `hidden-map-nepal.png`
- `hidden-map-cambodia.png`
- `hidden-map-rwanda.png`

The goal was not to make a legal boundary reference map. The goal was to confirm that each educational map preserves the recognizable national outline and places the main classroom labels in the correct broad region.

## Sources Checked

- Natural Earth Terms of Use: https://www.naturalearthdata.com/about/terms-of-use/
- Natural Earth GeoJSON repository: https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
- Natural Earth datasets used locally:
  - `ne_10m_admin_0_countries.geojson`
  - `ne_10m_lakes.geojson`
  - `ne_10m_rivers_lake_centerlines.geojson`
- CIA Maps, Tanzania: https://www.cia.gov/resources/map/tanzania/
- CIA Maps, Rwanda: https://www.cia.gov/resources/map/rwanda/
- CIA World Factbook 2022 archive, Tanzania geography fields: https://www.cia.gov/the-world-factbook/about/archives/2022/countries/tanzania/

## Method

1. Country outlines were rendered directly from Natural Earth 1:10m Admin-0 geometry. No external map screenshot, map tile, or copyrighted map image was copied.
2. Lakes and rivers were rendered from Natural Earth lake and river layers where used.
3. Major labels were checked against the expected geographic relationship:
   - capital and major cities inside the country and in the correct region
   - major lakes on the correct border or interior position
   - mountains in the correct broad part of the country
   - neighboring countries on the correct side of the border
4. The PNG output was visually inspected after rendering for obvious distortion, label collisions, and missing legend features.

## Results

| File | Shape Check | Label Check | Result |
| --- | --- | --- | --- |
| `hidden-map-kenya.png` | Kenya outline matches the Natural Earth country geometry: Lake Victoria touches the west, Lake Turkana is in the north, the Indian Ocean coast is in the southeast, and the long eastern border shape is preserved. | Nairobi, Mombasa, Kisumu, Mount Kenya, Maasai Mara, Lake Victoria, Lake Turkana, Indian Ocean, South Sudan, Ethiopia, Somalia, Uganda, Tanzania, and the equator are in the expected broad positions. Great Rift Valley was added after validation because the legend referenced it. | Pass |
| `hidden-map-tanzania.png` | Tanzania outline matches Natural Earth geometry: broad mainland, Indian Ocean coast, Zanzibar offshore, Lake Victoria north, Lake Tanganyika west, and Lake Malawi southwest. | Dodoma, Dar es Salaam, Zanzibar, Kilimanjaro, Serengeti, Ngorongoro, and major lakes are in the expected broad positions. This agrees with CIA geography notes that Tanzania borders the Indian Ocean and includes Zanzibar, Kilimanjaro, and the three large lakes. | Pass |
| `hidden-map-nepal.png` | Nepal outline matches Natural Earth geometry: long east-west country shape between China/Tibet and India. | Kathmandu, Pokhara, Lumbini, Chitwan, Terai Plain, Annapurna, Manaslu, Everest, and Kanchenjunga are in the expected broad regions. Mountain markers are simplified for classroom readability. | Pass |
| `hidden-map-cambodia.png` | Cambodia outline matches Natural Earth geometry: rounded inland shape with southwest Gulf of Thailand coast and eastern Mekong corridor. | Phnom Penh is at the Mekong/Tonle Sap confluence area, Siem Reap and Angkor are northwest, Tonle Sap is central-northwest, Mekong runs north-south/east, and Sihanoukville is southwest on the coast. | Pass |
| `hidden-map-rwanda.png` | Rwanda outline matches Natural Earth geometry: compact inland country, Lake Kivu on the west, Uganda north, Tanzania east, Burundi south, DRC west. | Kigali is central, Huye is south, Virunga volcanoes are northwest, Akagera is east, Lake Kivu is west, and the equator reference line is north of Rwanda. This agrees with CIA Rwanda map references and general geography. | Pass |

## Notes

- These maps are simplified educational assets. They are suitable for Step2 hidden-stories learning pages, not for legal boundary adjudication or navigation.
- Natural Earth explicitly places its raster and vector map data in the public domain. The rendered PNGs are original project outputs generated from that public-domain geodata and local labels.
- No generated map uses Google Maps, OpenStreetMap tiles, commercial atlas images, or copied screenshots.
