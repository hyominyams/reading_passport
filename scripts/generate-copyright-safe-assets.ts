import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

type AspectRatio = '1:1' | '4:3' | '3:4';

interface AssetSpec {
  file: string;
  aspectRatio: AspectRatio;
  use: string;
  replaces: string[];
  prompt: string;
}

interface DocumentedAsset {
  file: string;
  aspectRatio: string;
  use: string;
  replaces: string[];
  prompt: string;
  source?: string;
  dataFiles?: string[];
  promptLabel?: string;
}

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'public/generated-copyright-safe');
const MODEL_SOURCE = 'GPT image generation via OpenAI gpt-image-2';
const MAP_SOURCE = 'Natural Earth 1:10m public domain vector data rendered locally with scripts/generate-country-map-images.ts';
const LOCAL_RASTER_SOURCE = 'Original local raster rendering with @napi-rs/canvas via scripts/generate-hidden-story-raster-assets.ts';
const GENERATED_DATE = '2026-04-28';

function readEnvFile() {
  const envPath = resolve(ROOT, '.env.local');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function basePrompt(primary: string) {
  return [
    primary,
    'Copyright-safe original generated image for an educational web app.',
    'Do not copy or imitate any existing photograph, artwork, brand, logo, book cover, or living artist style.',
    'No readable text, no captions, no signs, no watermarks, no UI, no logos.',
    'Natural composition with enough negative space for web cropping.',
  ].join(' ');
}

const countryAssets: AssetSpec[] = [
  {
    file: 'country-colombia.jpg',
    aspectRatio: '4:3',
    use: 'Colombia country card, landing carousel, landing CTA avatar',
    replaces: [
      '/images/countries/colombia.jpg',
      'previous external Unsplash photo',
    ],
    prompt: basePrompt(
      'Photorealistic editorial travel scene of Colombia: green Andean coffee hills, colorful hillside homes, warm morning light, lush plants in the foreground, inviting and child-friendly.'
    ),
  },
  {
    file: 'country-tanzania.jpg',
    aspectRatio: '4:3',
    use: 'Tanzania country card, landing carousel, landing CTA avatar',
    replaces: [
      '/images/countries/tanzania.jpg',
      'previous external Unsplash photo',
    ],
    prompt: basePrompt(
      'Photorealistic editorial travel scene of Tanzania: Mount Kilimanjaro in the distance, open savanna grasses, acacia trees, soft sunrise haze, calm and respectful educational tone.'
    ),
  },
  {
    file: 'country-cambodia.jpg',
    aspectRatio: '4:3',
    use: 'Cambodia country card, landing carousel, landing CTA avatar',
    replaces: [
      '/images/countries/cambodia.jpg',
      'previous external Unsplash photo',
    ],
    prompt: basePrompt(
      'Photorealistic editorial travel scene of Cambodia: Mekong riverside village with stilt houses, palm trees, distant ancient temple silhouettes, warm late-afternoon light.'
    ),
  },
  {
    file: 'country-nepal.jpg',
    aspectRatio: '4:3',
    use: 'Nepal country card, landing carousel, landing CTA avatar',
    replaces: [
      '/images/countries/nepal.jpg',
      'previous external Unsplash photo',
    ],
    prompt: basePrompt(
      'Photorealistic editorial travel scene of Nepal: Himalayan foothill village path, prayer flags, terraced fields, distant snowy mountains, clear morning air.'
    ),
  },
  {
    file: 'country-rwanda.jpg',
    aspectRatio: '4:3',
    use: 'Rwanda country card, landing carousel, landing CTA avatar',
    replaces: [
      '/images/countries/rwanda.jpg',
      'previous external Unsplash photo',
    ],
    prompt: basePrompt(
      'Photorealistic editorial travel scene of Rwanda: rolling green hills, terraced farms, winding rural road, soft clouds, peaceful bright atmosphere.'
    ),
  },
  {
    file: 'country-kenya.jpg',
    aspectRatio: '4:3',
    use: 'Kenya country card, landing carousel, landing CTA avatar',
    replaces: [
      '/images/countries/kenya.jpg',
      'previous external Unsplash photo',
    ],
    prompt: basePrompt(
      'Photorealistic editorial travel scene of Kenya: golden savanna, acacia trees, small school garden near a rural path, bright sky, warm welcoming mood.'
    ),
  },
  {
    file: 'landing-hero.jpg',
    aspectRatio: '4:3',
    use: 'Generated landing hero fallback; not currently applied after the user-confirmed self-produced MP4 hero video was restored',
    replaces: ['not currently applied'],
    prompt: basePrompt(
      'Cinematic photorealistic classroom tabletop scene for a global reading passport app: open picture book, passport stamp marks, small paper world map, colored pencils, soft window light, immersive first-screen hero image.'
    ),
  },
  {
    file: 'world-map.jpg',
    aspectRatio: '4:3',
    use: 'World map background in the reading journey map and campaign samples',
    replaces: ['/images/world_map.png'],
    prompt: basePrompt(
      'Flat illustrated world map background for children: simplified recognizable continents on warm off-white paper, subtle ocean texture, gentle ink edges, clean educational look.'
    ),
  },
  {
    file: 'content-video-thumb.jpg',
    aspectRatio: '4:3',
    use: 'Hidden Stories video card thumbnail replacing automatic YouTube thumbnail images',
    replaces: ['automatic YouTube video thumbnail image'],
    prompt: basePrompt(
      'Original educational video thumbnail illustration for a global reading activity: open notebook, play symbol made from paper, small map pins, colored pencils, warm classroom table, no readable text.'
    ),
  },
];

const styleAssets: AssetSpec[] = [
  ['style-watercolor.jpg', '수채화 style reference', 'Transparent watercolor children book illustration of a child reading under a small tree with a bird nearby, soft washes, gentle blending.'],
  ['style-rough-drawing.jpg', '거친 드로잉 style reference', 'Rough sketch children book illustration of a child reading under a small tree with a bird nearby, expressive pencil and crayon lines, loose rendering.'],
  ['style-pastel.jpg', '파스텔 style reference', 'Soft pastel children book illustration of a child reading under a small tree with a bird nearby, chalky texture, dreamy soft edges.'],
  ['style-collage.jpg', '콜라주 style reference', 'Paper collage children book illustration of a child reading under a small tree with a bird nearby, layered cut-paper shapes, tactile handmade look.'],
  ['style-woodblock.jpg', '판화 style reference', 'Woodblock print children book illustration of a child reading under a small tree with a bird nearby, bold outlines, carved texture, flat color blocks.'],
  ['style-cartoon-comic.jpg', '카툰앤코믹 style reference', 'Cartoon comic children book illustration of a child reading under a small tree with a bird nearby, clean outlines, lively stylization.'],
  ['style-anime.jpg', '일본 애니메이션 style reference', 'Original anime-inspired children book illustration of a child reading under a small tree with a bird nearby, clean cel shading, bright friendly forms.'],
  ['style-chibi.jpg', '2D 치비캐릭터 style reference', 'Original 2D chibi character illustration of a child reading under a small tree with a bird nearby, cute proportions, clean line art, flat cel shading.'],
  ['style-caricature.jpg', '캐리커처 style reference', 'Caricature children book illustration of a child reading under a small tree with a bird nearby, playful exaggerated proportions, expressive stylized features.'],
  ['style-stop-motion.jpg', '스톱모션 미니어처 style reference', 'Stop-motion miniature aesthetic children book scene of a child reading under a small tree with a bird nearby, handcrafted materials, tactile miniature set.'],
  ['style-clay-art.jpg', '3D 클레이아트 style reference', '3D clay art children book scene of a child reading under a small tree with a bird nearby, soft clay texture, sculpted handmade forms.'],
  ['style-3d-animation.jpg', '3D 애니메이션 style reference', 'Stylized 3D animation children book scene of a child reading under a small tree with a bird nearby, smooth dimensional forms, polished soft lighting.'],
].map(([file, use, primary]) => ({
  file,
  aspectRatio: '4:3' as const,
  use,
  replaces: ['/example_image/*'],
  prompt: basePrompt(primary),
}));

const campaignAssets: AssetSpec[] = [
  {
    file: 'campaign-world-market-poster.jpg',
    aspectRatio: '4:3',
    use: 'Sample campaign submission image: world market poster board',
    replaces: ['previous external Unsplash photo'],
    prompt: basePrompt(
      'Photorealistic classroom display board with student-made global market posters, colorful paper fruit shapes, map pins, craft materials, no readable writing.'
    ),
  },
  {
    file: 'campaign-card-news.jpg',
    aspectRatio: '4:3',
    use: 'Sample campaign submission image: card news materials',
    replaces: ['previous external Unsplash photo'],
    prompt: basePrompt(
      'Photorealistic desk scene with student card-news sheets, small world map print, markers, paper cutouts, classroom project atmosphere, no readable writing.'
    ),
  },
  {
    file: 'campaign-classroom-gallery.jpg',
    aspectRatio: '4:3',
    use: 'Sample campaign submission image: classroom gallery',
    replaces: ['previous external Unsplash photo'],
    prompt: basePrompt(
      'Photorealistic classroom gallery wall with children\'s cultural project artwork, neat display clips, soft daylight, organized and welcoming, no readable writing.'
    ),
  },
  {
    file: 'campaign-library-research.jpg',
    aspectRatio: '4:3',
    use: 'Sample campaign submission image: library research kit',
    replaces: ['previous external Unsplash photo'],
    prompt: basePrompt(
      'Photorealistic school library table with open books, research cards, colored sticky notes, globe, and pencils, calm educational project mood, no readable text.'
    ),
  },
  {
    file: 'campaign-food-culture.jpg',
    aspectRatio: '4:3',
    use: 'Sample campaign submission image: food culture reflection',
    replaces: ['previous external Unsplash photo'],
    prompt: basePrompt(
      'Photorealistic classroom food culture project table with simple paper plates, illustrated food cards, grains, fruit, and student notes turned away from camera, no readable writing.'
    ),
  },
];

const libraryAssets: AssetSpec[] = [
  ['library-colombia-butterfly.jpg', 'Dummy library Colombia story cover: 무지개 날개를 가진 나비', 'Children\'s picture book cover artwork without text: a glowing butterfly with rainbow-like wings above lush Colombian green hills and flowers.'],
  ['library-colombia-amazon-song.jpg', 'Dummy library Colombia story cover: 아마존의 숨겨진 노래', 'Children\'s picture book cover artwork without text: a child listening to a hidden song in a lush rainforest river scene inspired by Colombia.'],
  ['library-colombia-river-star.jpg', 'Dummy library Colombia story cover: 콜롬비아의 별이 된 소녀', 'Children\'s picture book cover artwork without text: a girl looking up at bright stars reflected in a Colombian river valley at dusk.'],
  ['library-colombia-secret-garden.jpg', 'Dummy library Colombia story cover: 카르타헤나의 비밀 정원', 'Children\'s picture book cover artwork without text: a secret garden behind colorful Caribbean-style walls, tropical flowers, warm sunset.'],
  ['library-tanzania-warrior.jpg', 'Dummy library Tanzania story cover: 세렝게티의 용감한 전사', 'Children\'s picture book cover artwork without text: a brave child standing on a path in the Tanzanian savanna, warm light, distant acacia trees.'],
  ['library-tanzania-giraffe.jpg', 'Dummy library Tanzania story cover: 달빛 아래 춤추는 기린', 'Children\'s picture book cover artwork without text: gentle giraffes moving under moonlight on a Tanzanian plain, magical but calm.'],
  ['library-tanzania-baobab.jpg', 'Dummy library Tanzania story cover: 바오밥 나무의 약속', 'Children\'s picture book cover artwork without text: a huge baobab tree sheltering children and small animals, golden African sunset.'],
  ['library-tanzania-cloud.jpg', 'Dummy library Tanzania story cover: 구름 위를 걷는 아이', 'Children\'s picture book cover artwork without text: a child imagining a path above soft clouds with Mount Kilimanjaro far away.'],
  ['library-tanzania-zanzibar.jpg', 'Dummy library Tanzania story cover: 잔지바르 해변의 보물', 'Children\'s picture book cover artwork without text: turquoise beach, small wooden boat, child discovering a safe sparkling shell treasure.'],
  ['library-cambodia-stone.jpg', 'Dummy library Cambodia story cover: 천년의 돌이 들려준 이야기', 'Children\'s picture book cover artwork without text: ancient carved stone blocks near a Cambodian temple, warm light, child listening curiously.'],
  ['library-cambodia-guardian.jpg', 'Dummy library Cambodia story cover: 앙코르와트의 수호 정령', 'Children\'s picture book cover artwork without text: a gentle guardian spirit shape made of light near an Angkor-inspired temple courtyard.'],
  ['library-cambodia-floating-school.jpg', 'Dummy library Cambodia story cover: 떠다니는 마을의 학교', 'Children\'s picture book cover artwork without text: floating classroom on a wide Cambodian lake, children arriving by small boats.'],
  ['library-cambodia-lotus.jpg', 'Dummy library Cambodia story cover: 연꽃 위의 소원', 'Children\'s picture book cover artwork without text: lotus flowers glowing on calm river water, child making a hopeful wish at sunrise.'],
  ['library-nepal-everest-flower.jpg', 'Dummy library Nepal story cover: 에베레스트에 핀 꽃 한 송이', 'Children\'s picture book cover artwork without text: small bright flower growing on a mountain path with snowy Himalayan peaks behind.'],
  ['library-nepal-echo.jpg', 'Dummy library Nepal story cover: 설산의 메아리', 'Children\'s picture book cover artwork without text: child calling gently across snowy mountains, echo shown as soft curved light in the air.'],
  ['library-nepal-alley.jpg', 'Dummy library Nepal story cover: 카트만두 골목의 마법사', 'Children\'s picture book cover artwork without text: warm Kathmandu alley with prayer flags, a kind mysterious storyteller holding a lantern.'],
  ['library-kenya-maasai.jpg', 'Dummy library Kenya story cover: 마사이 소년의 첫 번째 모험', 'Children\'s picture book cover artwork without text: a young child beginning a journey across a Kenyan savanna path, respectful cultural details, bright sky.'],
  ['library-kenya-nairobi.jpg', 'Dummy library Kenya story cover: 나이로비의 꿈꾸는 소녀', 'Children\'s picture book cover artwork without text: a girl looking toward a lively Nairobi skyline from a green hill, hopeful morning light.'],
  ['library-kenya-flamingo.jpg', 'Dummy library Kenya story cover: 플라밍고 호수의 전설', 'Children\'s picture book cover artwork without text: pink flamingos on a Kenyan lake, child silhouette watching with wonder, soft sunrise colors.'],
].map(([file, use, primary]) => ({
  file,
  aspectRatio: '3:4' as const,
  use,
  replaces: ['src/lib/data/dummyLibrary.ts Unsplash cover URL'],
  prompt: basePrompt(primary),
}));

const hiddenStoryAssets: AssetSpec[] = [
  ['hidden-kenya-hero.jpg', 'Step2 HTML Kenya hero image', './assets/kenya-hero.jpg', 'Photorealistic educational article hero image: Kenyan savanna with acacia trees, distant elephants as small silhouettes, clear sky, respectful documentary mood.'],
  ['hidden-kenya-cover.jpg', 'Step2 HTML Kenya cover card image', './assets/kenya-cover.png', 'Square children\'s book inspired illustration without text: Kenyan farm garden, flowers, bees, warm handmade picture-book feeling.'],
  ['hidden-kenya-garden.jpg', 'Step2 HTML Kenya garden image', './assets/kenya-garden.png', 'Children\'s educational illustration: family tending a small vegetable garden in rural Kenya, flowers along the edge, warm daylight.'],
  ['hidden-kenya-school.jpg', 'Step2 HTML Kenya school image', './assets/kenya-school.png', 'Children\'s educational illustration: students talking together in a Kenyan school yard with trees and simple classroom buildings.'],
  ['hidden-kenya-bees.jpg', 'Step2 HTML Kenya bees image', './assets/kenya-bees.png', 'Children\'s educational illustration: a girl observing bees and flowers after light rain in a small garden, calm and safe.'],
  ['hidden-kenya-page-02.jpg', 'Step2 HTML Kenya story scene image', './assets/kenya-page-02.png', 'Children\'s picture-book illustration: dry field, water container, child and family noticing delayed rain, hopeful not bleak.'],
  ['hidden-kenya-page-07.jpg', 'Step2 HTML Kenya story scene image', './assets/kenya-page-07.png', 'Children\'s picture-book illustration: villagers planting a flower path together to welcome bees and rain, cooperative mood.'],
  ['hidden-kenya-lesson-visual.jpg', 'Step2 HTML Kenya lesson visual asset', './assets/kenya-lesson-visual.png', 'Wide educational visual without text: sequence showing flower, bee pollination, vegetable garden, rain cloud, and harvest as simple connected picture icons.'],
  ['hidden-tanzania-hero.jpg', 'Step2 HTML Tanzania hero image', './assets/tanzania-hero.jpg', 'Photorealistic educational article hero image: Mount Kilimanjaro with snowy summit, open savanna foreground, soft morning light.'],
  ['hidden-tanzania-cover.jpg', 'Step2 HTML Tanzania cover card image', './assets/tanzania-cover.png', 'Square children\'s book inspired illustration without text: village festival near Kilimanjaro, drums, children, warm colors.'],
  ['hidden-tanzania-festival.jpg', 'Step2 HTML Tanzania festival image', './assets/tanzania-festival.png', 'Children\'s educational illustration: community festival with ngoma drums, people gathered in a Tanzanian village, Kilimanjaro far behind.'],
  ['hidden-tanzania-friends.jpg', 'Step2 HTML Tanzania friends image', './assets/tanzania-friends.png', 'Children\'s picture-book illustration: two children in a rural village yard, one comforting a friend, warm respectful mood.'],
  ['hidden-tanzania-journal.jpg', 'Step2 HTML Tanzania journal image', './assets/tanzania-journal.png', 'Children\'s picture-book illustration: boy writing in a journal while looking toward Kilimanjaro at sunset, quiet reflective atmosphere.'],
  ['hidden-tanzania-page-03.jpg', 'Step2 HTML Tanzania story scene image', './assets/tanzania-page-03.png', 'Children\'s picture-book illustration: a child running toward a finish line during a village sports day, friends cheering, joyful motion.'],
  ['hidden-tanzania-page-06.jpg', 'Step2 HTML Tanzania story scene image', './assets/tanzania-page-06.png', 'Children\'s picture-book illustration: children working together to rescue a small goat near a village path, safe cooperative scene.'],
  ['hidden-tanzania-lesson-visual.jpg', 'Step2 HTML Tanzania lesson visual asset', './assets/tanzania-lesson-visual.png', 'Wide educational visual without text: Kilimanjaro mountain layers, lake, village, drum, and community helping hands as simple connected illustrations.'],
  ['hidden-nepal-hero.jpg', 'Step2 HTML Nepal hero image', './assets/nepal-hero.jpg', 'Photorealistic educational article hero image: Kathmandu-style temple square inspired architecture, prayer flags, mountains hinted in the distance, no crowds in focus.'],
  ['hidden-nepal-cover.jpg', 'Step2 HTML Nepal cover card image', './assets/nepal-cover.png', 'Square children\'s book inspired illustration without text: Nepali mountain path, red notebook, prayer flags, snowy Himalaya in the background.'],
  ['hidden-nepal-window.jpg', 'Step2 HTML Nepal window image', './assets/nepal-window.png', 'Children\'s picture-book illustration: room with a window looking toward Himalayan mountains, a school bag and red notebook being packed.'],
  ['hidden-nepal-journal.jpg', 'Step2 HTML Nepal journal image', './assets/nepal-journal.png', 'Children\'s picture-book illustration: child writing in a journal on a hillside with prayer flags and distant snowy peaks.'],
  ['hidden-nepal-page-04.jpg', 'Step2 HTML Nepal story scene image', './assets/nepal-page-04.png', 'Children\'s picture-book illustration: snowy mountain path where a child helps an elderly person pick up fallen firewood, gentle and safe.'],
  ['hidden-nepal-page-07.jpg', 'Step2 HTML Nepal story scene image', './assets/nepal-page-07.png', 'Children\'s picture-book illustration: classroom discussion in a Nepali mountain school, students raising hands, bright window light.'],
  ['hidden-nepal-lesson-visual.jpg', 'Step2 HTML Nepal lesson visual asset', './assets/nepal-lesson-visual.png', 'Wide educational visual without text: Nepal terrain layers from low plains to hills to Himalaya, school path, bridge, and red notebook icons.'],
  ['hidden-cambodia-cover.jpg', 'Step2 HTML Cambodia hero/cover image', './assets/cambodia-cover.png', 'Square children\'s book inspired illustration without text: Cambodian Mekong riverside village, blue kite, distant Angkor-inspired temple, warm sky.'],
  ['hidden-cambodia-market.jpg', 'Step2 HTML Cambodia market image', './assets/cambodia-market.png', 'Children\'s educational illustration: floating market near the Mekong with cloth stall, boats, fruit, and a curious child walking safely nearby.'],
  ['hidden-cambodia-river.jpg', 'Step2 HTML Cambodia river image', './assets/cambodia-river.png', 'Children\'s picture-book illustration: friends flying a blue kite beside the Mekong River at sunset, calm water and palm trees.'],
  ['hidden-cambodia-page-05.jpg', 'Step2 HTML Cambodia story scene image', './assets/cambodia-page-05.png', 'Children\'s picture-book illustration: first kite-flying attempt fails gently in a riverside field, children learning together, hopeful mood.'],
  ['hidden-cambodia-page-06.jpg', 'Step2 HTML Cambodia story scene image', './assets/cambodia-page-06.png', 'Children\'s picture-book illustration: children repairing a torn blue kite together with cloth patches beside the river.'],
  ['hidden-cambodia-lesson-visual.jpg', 'Step2 HTML Cambodia lesson visual asset', './assets/cambodia-lesson-visual.png', 'Wide educational visual without text: Mekong River, Tonle Sap lake rhythm, boat village, rice field, and temple waterway shown as simple connected illustrations.'],
].map(([file, use, replaces, primary]) => ({
  file,
  aspectRatio: file.includes('lesson-visual') ? '4:3' as const : '1:1' as const,
  use,
  replaces: [replaces],
  prompt: basePrompt(primary),
}));

const allAssets: AssetSpec[] = [
  ...countryAssets,
  ...styleAssets,
  ...campaignAssets,
  ...libraryAssets,
  ...hiddenStoryAssets,
];

const mapAssets: DocumentedAsset[] = [
  {
    file: 'hidden-map-kenya.png',
    aspectRatio: '1:1',
    use: 'Step2 HTML Kenya map image',
    replaces: ['inline SVG map in public/virtual-picture-books/hidden-stories-html/kenya-bees-climate.html'],
    source: MAP_SOURCE,
    dataFiles: ['ne_10m_admin_0_countries.geojson', 'ne_10m_lakes.geojson'],
    promptLabel: 'Render spec',
    prompt:
      'Render a copyright-safe educational PNG map of Kenya from public-domain Natural Earth country and lake geometry. Highlight Kenya with a green outline and warm yellow fill. Include surrounding countries, Indian Ocean, Lake Victoria, Lake Turkana, the equator, Great Rift Valley, Nairobi, Mombasa, Kisumu, Mount Kenya, and Maasai Mara. Use Korean labels rendered locally with Apple SD Gothic Neo. Do not copy any existing map image or use external map tiles.',
  },
  {
    file: 'hidden-map-tanzania.png',
    aspectRatio: '1:1',
    use: 'Step2 HTML Tanzania map image',
    replaces: ['inline SVG map in public/virtual-picture-books/hidden-stories-html/tanzania-hero-community.html'],
    source: MAP_SOURCE,
    dataFiles: ['ne_10m_admin_0_countries.geojson', 'ne_10m_lakes.geojson'],
    promptLabel: 'Render spec',
    prompt:
      'Render a copyright-safe educational PNG map of Tanzania from public-domain Natural Earth country and lake geometry. Highlight Tanzania with a blue-green outline and warm yellow fill. Include surrounding countries, Indian Ocean, Lake Victoria, Lake Tanganyika, Lake Malawi, the equator, Dodoma, Dar es Salaam, Zanzibar, Mount Kilimanjaro, Ngorongoro, and Serengeti. Use Korean labels rendered locally with Apple SD Gothic Neo. Do not copy any existing map image or use external map tiles.',
  },
  {
    file: 'hidden-map-nepal.png',
    aspectRatio: '1400:860',
    use: 'Step2 HTML Nepal map image',
    replaces: ['inline SVG map in public/virtual-picture-books/hidden-stories-html/nepal-school-road.html'],
    source: MAP_SOURCE,
    dataFiles: ['ne_10m_admin_0_countries.geojson'],
    promptLabel: 'Render spec',
    prompt:
      'Render a copyright-safe educational PNG map of Nepal from public-domain Natural Earth country geometry. Highlight Nepal with a red outline and warm paper fill. Include China (Tibet), India, Kathmandu, Pokhara, Lumbini, Chitwan, Terai Plain, Annapurna, Manaslu, Everest, and Kanchenjunga. Use Korean labels rendered locally with Apple SD Gothic Neo. Do not copy any existing map image or use external map tiles.',
  },
  {
    file: 'hidden-map-cambodia.png',
    aspectRatio: '8:7',
    use: 'Step2 HTML Cambodia map image',
    replaces: ['inline SVG map in public/virtual-picture-books/hidden-stories-html/cambodia-mekong-memory.html'],
    source: MAP_SOURCE,
    dataFiles: [
      'ne_10m_admin_0_countries.geojson',
      'ne_10m_lakes.geojson',
      'ne_10m_rivers_lake_centerlines.geojson',
    ],
    promptLabel: 'Render spec',
    prompt:
      'Render a copyright-safe educational PNG map of Cambodia from public-domain Natural Earth country, lake, and river geometry. Highlight Cambodia with a deep blue outline and warm yellow fill. Include Thailand, Laos, Vietnam, Gulf of Thailand, Tonle Sap, Mekong River, Phnom Penh, Siem Reap, Angkor, and Sihanoukville. Use Korean labels rendered locally with Apple SD Gothic Neo. Do not copy any existing map image or use external map tiles.',
  },
  {
    file: 'hidden-map-rwanda.png',
    aspectRatio: '8:7',
    use: 'Step2 HTML Rwanda map image and hidden stories index tile image',
    replaces: [
      'inline SVG map in public/virtual-picture-books/hidden-stories-html/rwanda-thousand-hills.html',
      'inline SVG thumbnail in public/virtual-picture-books/hidden-stories-html/index.html',
    ],
    source: MAP_SOURCE,
    dataFiles: ['ne_10m_admin_0_countries.geojson', 'ne_10m_lakes.geojson'],
    promptLabel: 'Render spec',
    prompt:
      'Render a copyright-safe educational PNG map of Rwanda from public-domain Natural Earth country and lake geometry. Highlight Rwanda with a green outline and light green fill. Include Uganda, Tanzania, Burundi, Democratic Republic of the Congo, Lake Kivu, Kigali, Huye, Virunga volcanoes, Akagera National Park, and an equator reference line north of Rwanda. Use Korean labels rendered locally with Apple SD Gothic Neo. Do not copy any existing map image or use external map tiles.',
  },
];

const localRasterAssets: DocumentedAsset[] = [
  ['hidden-rwanda-hills.png', 'Step2 HTML Rwanda hero raster illustration', 'inline SVG hill illustration in public/virtual-picture-books/hidden-stories-html/rwanda-thousand-hills.html', 'Render an original raster classroom illustration of Rwanda as the land of a thousand hills: layered green hills, a northwest volcano, Lake Kivu-inspired water, small houses, birds, sun, and Korean/French title labels. No copied artwork or external image source.'],
  ['hidden-diagram-tanzania-elevation.png', 'Step2 HTML Tanzania elevation diagram image', 'inline SVG Kilimanjaro elevation diagram in public/virtual-picture-books/hidden-stories-html/tanzania-hero-community.html', 'Render an original raster educational diagram of Kilimanjaro elevation zones: savanna/cropland, rain forest, moorland, alpine desert, summit glacier, and Korean labels. No copied diagram or external image source.'],
  ['hidden-diagram-nepal-elevation.png', 'Step2 HTML Nepal elevation diagram image', 'inline SVG Nepal elevation diagram in public/virtual-picture-books/hidden-stories-html/nepal-school-road.html', 'Render an original raster educational south-to-north Nepal elevation diagram: Terai plain, middle hills, Himalaya, elevation markers, and Korean labels. No copied diagram or external image source.'],
  ['hidden-diagram-cambodia-tonle-sap.png', 'Step2 HTML Cambodia Tonle Sap comparison diagram image', 'inline SVG Tonle Sap dry/wet season diagram in public/virtual-picture-books/hidden-stories-html/cambodia-mekong-memory.html', 'Render an original raster educational comparison of Tonle Sap in dry season and wet season: smaller dry-season lake, larger wet-season lake, five-times arrow, Mekong backflow label, and Korean labels. No copied diagram or external image source.'],
  ['hidden-icon-kenya-harambee.png', 'Step2 HTML Kenya pictogram: 하람비', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/kenya-bees-climate.html', 'Render an original raster pictogram for Harambee: three people and a shared upward gesture, green accent, clean educational icon style.'],
  ['hidden-icon-kenya-savanna.png', 'Step2 HTML Kenya pictogram: 사바나', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/kenya-bees-climate.html', 'Render an original raster pictogram for savanna: ground line and acacia-like trees, green accent, clean educational icon style.'],
  ['hidden-icon-kenya-equator.png', 'Step2 HTML Kenya pictogram: 적도', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/kenya-bees-climate.html', 'Render an original raster pictogram for the equator: sun and rays, warm accent, clean educational icon style.'],
  ['hidden-icon-kenya-mpesa.png', 'Step2 HTML Kenya pictogram: M-PESA', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/kenya-bees-climate.html', 'Render an original raster pictogram for mobile money: simple phone and transaction lines, green accent, clean educational icon style.'],
  ['hidden-icon-tanzania-ujamaa.png', 'Step2 HTML Tanzania pictogram: 우자마', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/tanzania-hero-community.html', 'Render an original raster pictogram for Ujamaa: globe-like community circle lines, blue accent, clean educational icon style.'],
  ['hidden-icon-tanzania-ngoma.png', 'Step2 HTML Tanzania pictogram: 응고마', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/tanzania-hero-community.html', 'Render an original raster pictogram for ngoma: hand drum shape, blue accent, clean educational icon style.'],
  ['hidden-icon-tanzania-kilimanjaro.png', 'Step2 HTML Tanzania pictogram: 킬리만자로', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/tanzania-hero-community.html', 'Render an original raster pictogram for Kilimanjaro: mountain profile, warm accent, clean educational icon style.'],
  ['hidden-icon-tanzania-kanga.png', 'Step2 HTML Tanzania pictogram: 칸가', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/tanzania-hero-community.html', 'Render an original raster pictogram for kanga cloth: patterned horizontal textile lines and dots, blue accent, clean educational icon style.'],
  ['hidden-icon-nepal-himalaya.png', 'Step2 HTML Nepal pictogram: 히말라야', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/nepal-school-road.html', 'Render an original raster pictogram for Himalaya: mountain peaks, red accent, clean educational icon style.'],
  ['hidden-icon-nepal-prayer-flags.png', 'Step2 HTML Nepal pictogram: 기도 깃발', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/nepal-school-road.html', 'Render an original raster pictogram for prayer flags: line with small flags, blue accent, clean educational icon style.'],
  ['hidden-icon-nepal-timezone.png', 'Step2 HTML Nepal pictogram: UTC+5:45', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/nepal-school-road.html', 'Render an original raster pictogram for a special time zone: clock face and hands, blue accent, clean educational icon style.'],
  ['hidden-icon-nepal-dal-bhat.png', 'Step2 HTML Nepal pictogram: 달밧', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/nepal-school-road.html', 'Render an original raster pictogram for dal bhat: bowl and rice arc, red accent, clean educational icon style.'],
  ['hidden-icon-cambodia-angkor.png', 'Step2 HTML Cambodia pictogram: 앙코르', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/cambodia-mekong-memory.html', 'Render an original raster pictogram for Angkor: temple towers, blue accent, clean educational icon style.'],
  ['hidden-icon-cambodia-mekong.png', 'Step2 HTML Cambodia pictogram: 메콩', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/cambodia-mekong-memory.html', 'Render an original raster pictogram for Mekong River: two flowing wave lines, blue accent, clean educational icon style.'],
  ['hidden-icon-cambodia-apsara.png', 'Step2 HTML Cambodia pictogram: 압사라', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/cambodia-mekong-memory.html', 'Render an original raster pictogram for Apsara dance: dancer silhouette lines, gold accent, clean educational icon style.'],
  ['hidden-icon-cambodia-kite.png', 'Step2 HTML Cambodia pictogram: 파란 연', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/cambodia-mekong-memory.html', 'Render an original raster pictogram for a blue kite: diamond kite and tail, blue accent, clean educational icon style.'],
  ['hidden-icon-rwanda-hills.png', 'Step2 HTML Rwanda pictogram: 천 개의 언덕', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/rwanda-thousand-hills.html', 'Render an original raster pictogram for Rwanda hills: repeating hill curves, green accent, clean educational icon style.'],
  ['hidden-icon-rwanda-imigongo.png', 'Step2 HTML Rwanda pictogram: 이미공고', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/rwanda-thousand-hills.html', 'Render an original raster pictogram for Imigongo: geometric peak pattern, green accent, clean educational icon style.'],
  ['hidden-icon-rwanda-agaseke.png', 'Step2 HTML Rwanda pictogram: 아가세케', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/rwanda-thousand-hills.html', 'Render an original raster pictogram for Agaseke basket: lidded basket with handle, blue accent, clean educational icon style.'],
  ['hidden-icon-rwanda-umuganda.png', 'Step2 HTML Rwanda pictogram: 우무간다', 'inline SVG pictogram in public/virtual-picture-books/hidden-stories-html/rwanda-thousand-hills.html', 'Render an original raster pictogram for Umuganda: connected community circles and lines, green accent, clean educational icon style.'],
].map(([file, use, replaces, prompt]) => ({
  file,
  aspectRatio: file.includes('icon') ? '1:1' : file.includes('rwanda-hills') ? '3:2' : '10:3',
  use,
  replaces: [replaces],
  source: LOCAL_RASTER_SOURCE,
  promptLabel: 'Render spec',
  prompt,
}));

const documentedAssets: DocumentedAsset[] = [
  ...allAssets.map((asset) => ({ ...asset, source: MODEL_SOURCE, promptLabel: 'Prompt' })),
  ...mapAssets,
  ...localRasterAssets,
];

function imagePath(file: string) {
  return join(OUT_DIR, file);
}

function publicPath(file: string) {
  return `/generated-copyright-safe/${file}`;
}

function writeSourcesMarkdown() {
  const lines = [
    '# Copyright-Safe Generated Image Sources',
    '',
    `Generated date: ${GENERATED_DATE}`,
    '',
    `Source for original illustrative/photo-style files in this folder: ${MODEL_SOURCE}.`,
    '',
    `Source for the Step2 country map PNG files: ${MAP_SOURCE}.`,
    '',
    `Source for the Step2 SVG-replacement PNG files: ${LOCAL_RASTER_SOURCE}.`,
    '',
    'Map data references:',
    '- Natural Earth Terms of Use: https://www.naturalearthdata.com/about/terms-of-use/',
    '- Natural Earth GeoJSON repository: https://github.com/nvkelso/natural-earth-vector/tree/master/geojson',
    '',
    'The images were generated as original project assets for the World Docent reading passport app. GPT prompts explicitly avoided existing photos, artworks, brands, logos, readable text, watermarks, and living-artist imitation. Map PNGs were rendered from public-domain geodata and local label specifications rather than copied from a map image.',
    '',
    '## Asset Index',
    '',
    '| File | App path | Use | Replaces |',
    '| --- | --- | --- | --- |',
    ...documentedAssets.map((asset) => `| ${asset.file} | ${publicPath(asset.file)} | ${asset.use} | ${asset.replaces.join('<br>')} |`),
    '',
    '## Prompts',
    '',
    ...documentedAssets.flatMap((asset) => [
      `### ${asset.file}`,
      '',
      `- App path: \`${publicPath(asset.file)}\``,
      `- Source: ${asset.source ?? MODEL_SOURCE}`,
      `- Aspect ratio: ${asset.aspectRatio}`,
      `- Use: ${asset.use}`,
      `- Replaces: ${asset.replaces.map((item) => `\`${item}\``).join(', ')}`,
      ...(asset.dataFiles?.length ? [`- Data files: ${asset.dataFiles.map((item) => `\`${item}\``).join(', ')}`] : []),
      '',
      `${asset.promptLabel ?? 'Prompt'}:`,
      '',
      '```text',
      asset.prompt,
      '```',
      '',
    ]),
  ];

  writeFileSync(join(OUT_DIR, 'IMAGE_SOURCES.md'), `${lines.join('\n')}\n`, 'utf-8');
}

async function main() {
  readEnvFile();
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to generate copyright-safe assets.');
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const { generateOpenAIImage } = await import('../src/lib/ai/openai-image');
  const requested = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith('--')));
  const force = process.argv.includes('--force');
  const selected = requested.size > 0
    ? allAssets.filter((asset) => requested.has(asset.file))
    : allAssets;

  for (const [index, asset] of selected.entries()) {
    const target = imagePath(asset.file);
    if (!force && existsSync(target)) {
      console.log(`[skip ${index + 1}/${selected.length}] ${asset.file}`);
      continue;
    }

    console.log(`[generate ${index + 1}/${selected.length}] ${asset.file}`);
    const image = await generateOpenAIImage({
      prompt: asset.prompt,
      aspectRatio: asset.aspectRatio,
      quality: 'medium',
      outputFormat: 'jpeg',
      timeoutMs: 180_000,
    });
    writeFileSync(target, Buffer.from(image.data, 'base64'));
  }

  writeSourcesMarkdown();
  console.log(`Wrote ${join(OUT_DIR, 'IMAGE_SOURCES.md')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
