import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

type Coordinate = [number, number];
type BBox = [number, number, number, number];

type Geometry =
  | { type: 'Point'; coordinates: Coordinate }
  | { type: 'LineString'; coordinates: Coordinate[] }
  | { type: 'MultiLineString'; coordinates: Coordinate[][] }
  | { type: 'Polygon'; coordinates: Coordinate[][] }
  | { type: 'MultiPolygon'; coordinates: Coordinate[][][] };

interface Feature {
  type: 'Feature';
  geometry: Geometry;
  properties: Record<string, string | number | null | undefined>;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

interface Label {
  text: string;
  lon: number;
  lat: number;
  dx?: number;
  dy?: number;
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  kind?: 'capital' | 'city' | 'mountain' | 'water' | 'region' | 'neighbor';
}

interface LineLabel {
  text: string;
  lat: number;
  color: string;
  yOffset?: number;
}

interface CustomLine {
  text?: string;
  coordinates: Coordinate[];
  color: string;
  width?: number;
  dash?: number[];
  labelCoord?: Coordinate;
  labelDx?: number;
  labelDy?: number;
}

interface MapSpec {
  id: string;
  file: string;
  htmlFile: string;
  iso: string;
  title: string;
  alt: string;
  width: number;
  height: number;
  use: string;
  replaces: string;
  fill: string;
  accent: string;
  accent2: string;
  ocean: boolean;
  bboxPadding: number;
  minLat?: number;
  maxLat?: number;
  minLon?: number;
  maxLon?: number;
  neighborLabels: Label[];
  labels: Label[];
  lakes: string[];
  rivers: string[];
  lineLabels?: LineLabel[];
  customLines?: CustomLine[];
}

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'public/generated-copyright-safe');
const DATA_DIR = resolve(ROOT, '.codex/tmp-map-data');
const FONT_FAMILY = 'Apple SD Gothic Neo';
const DATA_SOURCE = 'Natural Earth 1:10m public domain vector data rendered locally with @napi-rs/canvas';

const DATASETS = {
  countries: {
    file: 'countries.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson',
  },
  lakes: {
    file: 'lakes.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson',
  },
  rivers: {
    file: 'rivers.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson',
  },
};

const specs: MapSpec[] = [
  {
    id: 'kenya',
    file: 'hidden-map-kenya.png',
    htmlFile: 'kenya-bees-climate.html',
    iso: 'KEN',
    title: '케냐 지도',
    alt: '케냐 국가 지도 - 나이로비, 몸바사, 키수무, 케냐산, 빅토리아호, 투르카나호, 인도양, 적도',
    width: 1200,
    height: 1200,
    use: 'Step2 HTML Kenya map image',
    replaces: 'inline SVG map in public/virtual-picture-books/hidden-stories-html/kenya-bees-climate.html',
    fill: '#efd487',
    accent: '#2f7a4e',
    accent2: '#b85628',
    ocean: true,
    bboxPadding: 0.17,
    neighborLabels: [
      { text: '남수단', lon: 34.9, lat: 4.35, kind: 'neighbor' },
      { text: '우간다', lon: 33.8, lat: 0.85, kind: 'neighbor' },
      { text: '탄자니아', lon: 36.2, lat: -4.7, kind: 'neighbor' },
      { text: '에티오피아', lon: 37.8, lat: 4.0, kind: 'neighbor' },
      { text: '소말리아', lon: 41.0, lat: 1.1, kind: 'neighbor' },
    ],
    labels: [
      { text: '나이로비 ★', lon: 36.8219, lat: -1.2921, dx: 20, dy: 5, kind: 'capital' },
      { text: '몸바사', lon: 39.6682, lat: -4.0435, dx: -12, dy: 30, align: 'right', kind: 'city' },
      { text: '키수무', lon: 34.7617, lat: -0.0917, dx: 18, dy: 5, kind: 'city' },
      { text: '케냐산 5,199m', lon: 37.3084, lat: -0.1521, dx: 18, dy: -12, kind: 'mountain' },
      { text: '마사이 마라', lon: 35.14, lat: -1.45, dx: -18, dy: 28, align: 'right', kind: 'region' },
      { text: '빅토리아호', lon: 33.4, lat: -0.35, dx: 10, dy: 0, kind: 'water' },
      { text: '투르카나호', lon: 36.08, lat: 3.35, dx: 16, dy: 8, kind: 'water' },
      { text: '인도양', lon: 41.6, lat: -3.0, dx: 0, dy: 0, kind: 'water' },
    ],
    lakes: ['Lake Victoria', 'Lake Turkana'],
    rivers: [],
    lineLabels: [{ text: 'EQUATOR (적도)', lat: 0, color: '#b85628' }],
    customLines: [
      {
        text: '대지구대',
        color: '#6f5b42',
        width: 5,
        dash: [14, 12],
        coordinates: [
          [35.95, 3.9],
          [36.05, 2.2],
          [36.18, 0.7],
          [36.55, -0.8],
          [36.75, -2.1],
          [36.4, -3.2],
        ],
        labelCoord: [36.35, 0.8],
        labelDx: 18,
        labelDy: 0,
      },
    ],
  },
  {
    id: 'tanzania',
    file: 'hidden-map-tanzania.png',
    htmlFile: 'tanzania-hero-community.html',
    iso: 'TZA',
    title: '탄자니아 지도',
    alt: '탄자니아 국가 지도 - 도도마, 다르에스살람, 잔지바르, 킬리만자로, 세렝게티, 빅토리아호, 탕가니카호, 말라위호, 인도양',
    width: 1200,
    height: 1200,
    use: 'Step2 HTML Tanzania map image',
    replaces: 'inline SVG map in public/virtual-picture-books/hidden-stories-html/tanzania-hero-community.html',
    fill: '#e9cf87',
    accent: '#1f6e87',
    accent2: '#b14a2a',
    ocean: true,
    bboxPadding: 0.14,
    maxLat: 0.2,
    neighborLabels: [
      { text: '케냐', lon: 37.5, lat: -1.5, kind: 'neighbor' },
      { text: '우간다', lon: 31.9, lat: -0.35, kind: 'neighbor' },
      { text: '르완다', lon: 30.1, lat: -2.0, kind: 'neighbor' },
      { text: '모잠비크', lon: 37.0, lat: -11.0, kind: 'neighbor' },
    ],
    labels: [
      { text: '도도마 ★', lon: 35.7516, lat: -6.163, dx: 18, dy: 6, kind: 'capital' },
      { text: '다르에스살람', lon: 39.2083, lat: -6.7924, dx: -16, dy: 32, align: 'right', kind: 'city' },
      { text: '잔지바르', lon: 39.2, lat: -6.16, dx: 18, dy: -10, kind: 'city' },
      { text: '킬리만자로 5,895m', lon: 37.3556, lat: -3.0674, dx: 18, dy: -14, kind: 'mountain' },
      { text: '응고롱고로', lon: 35.58, lat: -3.2, dx: -18, dy: 8, align: 'right', kind: 'region' },
      { text: '세렝게티', lon: 34.8, lat: -2.3, dx: -10, dy: 34, align: 'right', kind: 'region' },
      { text: '빅토리아호', lon: 32.7, lat: -1.0, dx: -8, dy: 8, align: 'right', kind: 'water' },
      { text: '탕가니카호', lon: 30.7, lat: -6.1, dx: -8, dy: 0, align: 'right', kind: 'water' },
      { text: '말라위호', lon: 34.7, lat: -10.6, dx: 12, dy: 4, kind: 'water' },
      { text: '인도양', lon: 41.0, lat: -8.5, dx: 0, dy: 0, kind: 'water' },
    ],
    lakes: ['Lake Victoria', 'Lake Tanganyika', 'Lake Malawi'],
    rivers: [],
    lineLabels: [{ text: 'EQUATOR (적도)', lat: 0, color: '#b14a2a' }],
  },
  {
    id: 'nepal',
    file: 'hidden-map-nepal.png',
    htmlFile: 'nepal-school-road.html',
    iso: 'NPL',
    title: '네팔 지도',
    alt: '네팔 국가 지도 - 카트만두, 포카라, 룸비니, 치트완, 히말라야 주요 봉우리, 중국, 인도',
    width: 1400,
    height: 860,
    use: 'Step2 HTML Nepal map image',
    replaces: 'inline SVG map in public/virtual-picture-books/hidden-stories-html/nepal-school-road.html',
    fill: '#efdcb7',
    accent: '#b22a2a',
    accent2: '#2c5d8c',
    ocean: false,
    bboxPadding: 0.16,
    neighborLabels: [
      { text: '중국 (티베트)', lon: 84.8, lat: 30.1, kind: 'neighbor' },
      { text: '인도', lon: 84.2, lat: 26.2, kind: 'neighbor' },
    ],
    labels: [
      { text: '카트만두 ★', lon: 85.324, lat: 27.7172, dx: 16, dy: 18, kind: 'capital' },
      { text: '포카라', lon: 83.9856, lat: 28.2096, dx: -18, dy: 8, align: 'right', kind: 'city' },
      { text: '룸비니', lon: 83.276, lat: 27.484, dx: -18, dy: 28, align: 'right', kind: 'city' },
      { text: '치트완', lon: 84.42, lat: 27.58, dx: 18, dy: 30, kind: 'region' },
      { text: '테라이 평야', lon: 86.2, lat: 26.85, dx: 0, dy: 0, kind: 'region' },
      { text: '안나푸르나', lon: 83.82, lat: 28.596, dx: -20, dy: -24, align: 'right', kind: 'mountain' },
      { text: '마나슬루', lon: 84.56, lat: 28.55, dx: 18, dy: -32, kind: 'mountain' },
      { text: '에베레스트', lon: 86.925, lat: 27.988, dx: 18, dy: -18, kind: 'mountain' },
      { text: '칸첸중가', lon: 88.1475, lat: 27.7025, dx: 18, dy: -16, kind: 'mountain' },
    ],
    lakes: [],
    rivers: [],
  },
  {
    id: 'cambodia',
    file: 'hidden-map-cambodia.png',
    htmlFile: 'cambodia-mekong-memory.html',
    iso: 'KHM',
    title: '캄보디아 지도',
    alt: '캄보디아 국가 지도 - 프놈펜, 시엠레아프, 앙코르 유적, 시아누크빌, 톤레삽 호수, 메콩강, 태국, 라오스, 베트남',
    width: 1200,
    height: 1050,
    use: 'Step2 HTML Cambodia map image',
    replaces: 'inline SVG map in public/virtual-picture-books/hidden-stories-html/cambodia-mekong-memory.html',
    fill: '#ecd28a',
    accent: '#1e528f',
    accent2: '#b8862a',
    ocean: true,
    bboxPadding: 0.22,
    neighborLabels: [
      { text: '태국', lon: 102.2, lat: 13.2, kind: 'neighbor' },
      { text: '라오스', lon: 105.5, lat: 14.5, kind: 'neighbor' },
      { text: '베트남', lon: 106.8, lat: 11.7, kind: 'neighbor' },
      { text: '타이만', lon: 103.4, lat: 9.4, kind: 'water' },
    ],
    labels: [
      { text: '프놈펜 ★', lon: 104.9282, lat: 11.5564, dx: 18, dy: 6, kind: 'capital' },
      { text: '시엠레아프', lon: 103.8564, lat: 13.3633, dx: -14, dy: 16, align: 'right', kind: 'city' },
      { text: '앙코르 유적', lon: 103.867, lat: 13.4125, dx: -16, dy: -50, align: 'right', kind: 'region' },
      { text: '시아누크빌', lon: 103.525, lat: 10.625, dx: -18, dy: 26, align: 'right', kind: 'city' },
      { text: '톤레삽 호수', lon: 103.8, lat: 12.6, dx: -12, dy: 8, align: 'right', kind: 'water' },
      { text: '메콩강', lon: 105.8, lat: 12.5, dx: 18, dy: -10, kind: 'water' },
    ],
    lakes: ['Tonlé Sap'],
    rivers: ['Mekong', 'Tonle Sap'],
  },
  {
    id: 'rwanda',
    file: 'hidden-map-rwanda.png',
    htmlFile: 'rwanda-thousand-hills.html',
    iso: 'RWA',
    title: '르완다 지도',
    alt: '르완다 국가 지도 - 키갈리, 후예, 비룽가 화산, 아카게라 국립공원, 키부호, 주변 국가, 적도 남쪽 위치',
    width: 1200,
    height: 1050,
    use: 'Step2 HTML Rwanda map image',
    replaces: 'inline SVG map in public/virtual-picture-books/hidden-stories-html/rwanda-thousand-hills.html',
    fill: '#d8e3a9',
    accent: '#1f7a4f',
    accent2: '#2f6db3',
    ocean: false,
    bboxPadding: 0.34,
    maxLat: 0.15,
    neighborLabels: [
      { text: '우간다', lon: 30.0, lat: -0.25, kind: 'neighbor' },
      { text: '탄자니아', lon: 31.15, lat: -2.05, kind: 'neighbor' },
      { text: '부룬디', lon: 29.95, lat: -3.05, kind: 'neighbor' },
      { text: '콩고민주공화국', lon: 28.72, lat: -1.55, size: 22, kind: 'neighbor' },
    ],
    labels: [
      { text: '키갈리 ★', lon: 30.0619, lat: -1.9441, dx: 18, dy: 6, kind: 'capital' },
      { text: '후예', lon: 29.7394, lat: -2.5967, dx: 18, dy: 26, kind: 'city' },
      { text: '비룽가 화산', lon: 29.50, lat: -1.43, dx: -18, dy: -22, align: 'right', kind: 'mountain' },
      { text: '아카게라 국립공원', lon: 30.78, lat: -1.85, dx: 18, dy: -8, kind: 'region' },
      { text: '키부호', lon: 29.16, lat: -2.35, dx: -10, dy: 24, align: 'right', kind: 'water' },
    ],
    lakes: ['Lake Kivu'],
    rivers: [],
    lineLabels: [{ text: 'EQUATOR (적도) — 르완다는 적도 바로 남쪽', lat: 0, color: '#2f6db3' }],
  },
];

function registerFonts() {
  const fontPaths = [
    '/System/Library/Fonts/AppleSDGothicNeo.ttc',
    '/System/Library/Fonts/Supplemental/AppleGothic.ttf',
  ];

  for (const fontPath of fontPaths) {
    if (existsSync(fontPath)) {
      GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);
    }
  }
}

async function ensureDataset(name: keyof typeof DATASETS): Promise<FeatureCollection> {
  mkdirSync(DATA_DIR, { recursive: true });
  const dataset = DATASETS[name];
  const target = join(DATA_DIR, dataset.file);

  if (!existsSync(target)) {
    const response = await fetch(dataset.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${dataset.url}: ${response.status}`);
    }
    writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  }

  return JSON.parse(readFileSync(target, 'utf-8')) as FeatureCollection;
}

function forEachCoord(geometry: Geometry, callback: (coord: Coordinate) => void) {
  const walk = (value: unknown) => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      callback(value as Coordinate);
      return;
    }

    if (Array.isArray(value)) {
      for (const child of value) walk(child);
    }
  };

  walk(geometry.coordinates);
}

function bboxForFeature(feature: Feature): BBox {
  const bbox: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  forEachCoord(feature.geometry, ([lon, lat]) => {
    bbox[0] = Math.min(bbox[0], lon);
    bbox[1] = Math.min(bbox[1], lat);
    bbox[2] = Math.max(bbox[2], lon);
    bbox[3] = Math.max(bbox[3], lat);
  });
  return bbox;
}

function expandBBox(bbox: BBox, ratio: number): BBox {
  const lonPad = (bbox[2] - bbox[0]) * ratio;
  const latPad = (bbox[3] - bbox[1]) * ratio;
  return [bbox[0] - lonPad, bbox[1] - latPad, bbox[2] + lonPad, bbox[3] + latPad];
}

function intersects(a: BBox, b: BBox) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function featureIso(feature: Feature) {
  return String(feature.properties.ISO_A3 || feature.properties.ADM0_A3 || feature.properties.SOV_A3 || '');
}

function featureName(feature: Feature) {
  return String(feature.properties.name || feature.properties.NAME || feature.properties.NAME_EN || '');
}

function makeProjector(bbox: BBox, width: number, height: number, padding: number) {
  const lonSpan = bbox[2] - bbox[0];
  const latSpan = bbox[3] - bbox[1];
  const scale = Math.min((width - padding * 2) / lonSpan, (height - padding * 2) / latSpan);
  const usedWidth = lonSpan * scale;
  const usedHeight = latSpan * scale;
  const offsetX = (width - usedWidth) / 2;
  const offsetY = (height - usedHeight) / 2;

  return ([lon, lat]: Coordinate): [number, number] => [
    offsetX + (lon - bbox[0]) * scale,
    offsetY + (bbox[3] - lat) * scale,
  ];
}

function pathGeometry(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  geometry: Geometry,
  project: (coord: Coordinate) => [number, number]
) {
  const drawRing = (ring: Coordinate[]) => {
    ring.forEach((coord, index) => {
      const [x, y] = project(coord);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };

  ctx.beginPath();
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(drawRing);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => polygon.forEach(drawRing));
  } else if (geometry.type === 'LineString') {
    geometry.coordinates.forEach((coord, index) => {
      const [x, y] = project(coord);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  } else if (geometry.type === 'MultiLineString') {
    geometry.coordinates.forEach((line) => {
      line.forEach((coord, index) => {
        const [x, y] = project(coord);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
    });
  }
}

function drawLabel(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  label: Label,
  project: (coord: Coordinate) => [number, number]
) {
  const [baseX, baseY] = project([label.lon, label.lat]);
  const x = baseX + (label.dx ?? 0);
  const y = baseY + (label.dy ?? 0);
  const size = label.size ?? (label.kind === 'neighbor' ? 28 : label.kind === 'water' ? 27 : 30);
  const color =
    label.color ??
    (label.kind === 'water'
      ? '#2a5a85'
      : label.kind === 'neighbor'
        ? '#71765f'
        : label.kind === 'region'
          ? '#646b55'
          : '#242322');

  ctx.save();
  ctx.font = `800 ${size}px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = label.align ?? 'left';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(5, size / 5);
  ctx.strokeStyle = 'rgba(255, 252, 243, 0.92)';
  ctx.strokeText(label.text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(label.text, x, y);
  ctx.restore();
}

function drawMarker(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  label: Label,
  spec: MapSpec,
  project: (coord: Coordinate) => [number, number]
) {
  if (!['capital', 'city', 'mountain'].includes(label.kind ?? '')) return;
  const [x, y] = project([label.lon, label.lat]);

  ctx.save();
  if (label.kind === 'mountain') {
    ctx.beginPath();
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x - 18, y + 16);
    ctx.lineTo(x + 18, y + 16);
    ctx.closePath();
    ctx.fillStyle = spec.accent2;
    ctx.strokeStyle = '#fff8e8';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, label.kind === 'capital' ? 12 : 9, 0, Math.PI * 2);
    ctx.fillStyle = label.kind === 'capital' ? spec.accent2 : spec.accent;
    ctx.strokeStyle = '#fff8e8';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fill();
  }
  ctx.restore();
}

function drawLineLabels(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  spec: MapSpec,
  bbox: BBox,
  project: (coord: Coordinate) => [number, number]
) {
  for (const line of spec.lineLabels ?? []) {
    if (line.lat < bbox[1] || line.lat > bbox[3]) continue;
    const [x1, y] = project([bbox[0], line.lat]);
    const [x2] = project([bbox[2], line.lat]);
    ctx.save();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `900 25px "${FONT_FAMILY}", sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255, 252, 243, 0.92)';
    ctx.fillStyle = line.color;
    ctx.strokeText(line.text, 34, y - 10 + (line.yOffset ?? 0));
    ctx.fillText(line.text, 34, y - 10 + (line.yOffset ?? 0));
    ctx.restore();
  }
}

function drawCustomLines(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  spec: MapSpec,
  project: (coord: Coordinate) => [number, number]
) {
  for (const line of spec.customLines ?? []) {
    ctx.save();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width ?? 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(line.dash ?? []);
    ctx.beginPath();
    line.coordinates.forEach((coord, index) => {
      const [x, y] = project(coord);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    if (line.text && line.labelCoord) {
      const [x, y] = project(line.labelCoord);
      ctx.font = `800 28px "${FONT_FAMILY}", sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255, 252, 243, 0.92)';
      ctx.fillStyle = line.color;
      ctx.strokeText(line.text, x + (line.labelDx ?? 0), y + (line.labelDy ?? 0));
      ctx.fillText(line.text, x + (line.labelDx ?? 0), y + (line.labelDy ?? 0));
    }

    ctx.restore();
  }
}

function drawMap(
  spec: MapSpec,
  countries: FeatureCollection,
  lakes: FeatureCollection,
  rivers: FeatureCollection
) {
  const target = countries.features.find((feature) => featureIso(feature) === spec.iso);
  if (!target) throw new Error(`Country not found: ${spec.iso}`);

  const targetBBox = bboxForFeature(target);
  const paddedBBox = expandBBox(targetBBox, spec.bboxPadding);
  const bbox: BBox = [
    spec.minLon ?? paddedBBox[0],
    spec.minLat ?? paddedBBox[1],
    spec.maxLon ?? paddedBBox[2],
    spec.maxLat ?? paddedBBox[3],
  ];

  const canvas = createCanvas(spec.width, spec.height);
  const ctx = canvas.getContext('2d');
  const project = makeProjector(bbox, spec.width, spec.height, Math.round(spec.width * 0.055));

  ctx.fillStyle = spec.ocean ? '#dcebf2' : '#f4efe2';
  ctx.fillRect(0, 0, spec.width, spec.height);

  const visibleCountries = countries.features.filter((feature) => intersects(bboxForFeature(feature), bbox));
  for (const feature of visibleCountries) {
    if (featureIso(feature) === spec.iso) continue;
    pathGeometry(ctx, feature.geometry, project);
    ctx.fillStyle = '#e8dfc9';
    ctx.strokeStyle = '#cdbf9f';
    ctx.lineWidth = 2.5;
    ctx.fill('evenodd');
    ctx.stroke();
  }

  pathGeometry(ctx, target.geometry, project);
  ctx.fillStyle = spec.fill;
  ctx.strokeStyle = spec.accent;
  ctx.lineWidth = 8;
  ctx.fill('evenodd');
  ctx.stroke();

  const visibleLakes = lakes.features.filter(
    (feature) => spec.lakes.includes(featureName(feature)) && intersects(bboxForFeature(feature), bbox)
  );
  for (const lake of visibleLakes) {
    pathGeometry(ctx, lake.geometry, project);
    ctx.fillStyle = '#79aeda';
    ctx.strokeStyle = '#417aaa';
    ctx.lineWidth = 3.5;
    ctx.fill('evenodd');
    ctx.stroke();
  }

  const visibleRivers = rivers.features.filter(
    (feature) => spec.rivers.includes(featureName(feature)) && intersects(bboxForFeature(feature), bbox)
  );
  for (const river of visibleRivers) {
    pathGeometry(ctx, river.geometry, project);
    ctx.strokeStyle = '#3f86bd';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  drawLineLabels(ctx, spec, bbox, project);
  drawCustomLines(ctx, spec, project);

  for (const label of spec.neighborLabels) drawLabel(ctx, label, project);
  for (const label of spec.labels) drawMarker(ctx, label, spec, project);
  for (const label of spec.labels) drawLabel(ctx, label, project);

  ctx.save();
  ctx.fillStyle = 'rgba(255, 250, 236, 0.86)';
  ctx.strokeStyle = 'rgba(77, 66, 48, 0.16)';
  ctx.lineWidth = 2;
  ctx.roundRect(28, spec.height - 82, 330, 54, 18);
  ctx.fill();
  ctx.stroke();
  ctx.font = `900 28px "${FONT_FAMILY}", sans-serif`;
  ctx.fillStyle = '#242322';
  ctx.fillText(spec.title, 54, spec.height - 47);
  ctx.restore();

  writeFileSync(join(OUT_DIR, spec.file), canvas.toBuffer('image/png'));
}

async function main() {
  registerFonts();
  mkdirSync(OUT_DIR, { recursive: true });

  const [countries, lakes, rivers] = await Promise.all([
    ensureDataset('countries'),
    ensureDataset('lakes'),
    ensureDataset('rivers'),
  ]);

  for (const spec of specs) {
    drawMap(spec, countries, lakes, rivers);
    console.log(`wrote ${join(OUT_DIR, spec.file)}`);
  }

  console.log(DATA_SOURCE);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
