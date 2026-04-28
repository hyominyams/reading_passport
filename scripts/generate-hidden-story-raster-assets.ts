import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

type CanvasContext = ReturnType<ReturnType<typeof createCanvas>['getContext']>;

interface IconSpec {
  file: string;
  label: string;
  accent: string;
  draw: (ctx: CanvasContext, accent: string) => void;
}

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'public/generated-copyright-safe');
const FONT_FAMILY = 'Apple SD Gothic Neo';

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

function savePng(file: string, width: number, height: number, draw: (ctx: CanvasContext) => void) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  draw(ctx);
  writeFileSync(join(OUT_DIR, file), canvas.toBuffer('image/png'));
  console.log(`wrote ${join(OUT_DIR, file)}`);
}

function label(ctx: CanvasContext, text: string, x: number, y: number, size = 22, color = '#1a1d22', align: CanvasTextAlign = 'center') {
  ctx.save();
  ctx.font = `800 ${size}px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 5);
  ctx.strokeStyle = 'rgba(255, 252, 243, 0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRoundedPanel(ctx: CanvasContext, width: number, height: number, fill = '#fbf7ef') {
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d8cdb5';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, width - 4, height - 4);
}

function drawRwandaHills() {
  savePng('hidden-rwanda-hills.png', 1200, 800, (ctx) => {
    drawRoundedPanel(ctx, 1200, 800, '#eef4e6');
    ctx.fillStyle = '#cfe1ee';
    ctx.fillRect(0, 0, 1200, 260);

    ctx.fillStyle = '#fff1b3';
    ctx.beginPath();
    ctx.arc(960, 150, 54, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5b8e6b';
    ctx.beginPath();
    ctx.moveTo(115, 455);
    ctx.lineTo(245, 225);
    ctx.lineTo(375, 455);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a07a32';
    ctx.beginPath();
    ctx.moveTo(195, 325);
    ctx.lineTo(245, 225);
    ctx.lineTo(295, 325);
    ctx.closePath();
    ctx.fill();

    const hills = [
      { y: 500, fill: '#2f6b42', amp: 70 },
      { y: 585, fill: '#43814a', amp: 58 },
      { y: 655, fill: '#64a05f', amp: 42 },
      { y: 735, fill: '#8abb7b', amp: 35 },
    ];

    hills.forEach((hill, index) => {
      ctx.fillStyle = hill.fill;
      ctx.beginPath();
      ctx.moveTo(0, hill.y);
      for (let x = 0; x <= 1200; x += 80) {
        const y = hill.y - Math.sin((x / 1200) * Math.PI * 3 + index) * hill.amp;
        ctx.quadraticCurveTo(x + 40, y - 18, x + 80, y);
      }
      ctx.lineTo(1200, 800);
      ctx.lineTo(0, 800);
      ctx.closePath();
      ctx.fill();
    });

    ctx.fillStyle = '#7db0d2';
    ctx.beginPath();
    ctx.ellipse(95, 615, 200, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    const houses = [
      [455, 550],
      [735, 520],
      [930, 590],
    ];
    houses.forEach(([x, y]) => {
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(x, y, 38, 30);
      ctx.fillStyle = '#9b6230';
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 19, y - 22);
      ctx.lineTo(x + 44, y);
      ctx.closePath();
      ctx.fill();
    });

    ctx.strokeStyle = '#1f7a4f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const [x, y, s] of [
      [630, 190, 1],
      [705, 225, 0.7],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 12 * s, y - 12 * s, x + 24 * s, y);
      ctx.quadraticCurveTo(x + 36 * s, y - 12 * s, x + 48 * s, y);
      ctx.stroke();
    }

    label(ctx, 'Le pays des mille collines', 600, 72, 34, '#1f7a4f');
    label(ctx, '천 개의 언덕이 만든 나라', 600, 118, 26, '#3a6f43');
  });
}

function drawTanzaniaElevation() {
  savePng('hidden-diagram-tanzania-elevation.png', 1200, 360, (ctx) => {
    drawRoundedPanel(ctx, 1200, 360, '#f8f0dd');
    ctx.fillStyle = '#e9d3a4';
    ctx.fillRect(0, 285, 1200, 75);

    ctx.fillStyle = '#a87b4a';
    ctx.strokeStyle = '#5b3d20';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(120, 285);
    ctx.lineTo(430, 285);
    ctx.lineTo(555, 85);
    ctx.lineTo(640, 85);
    ctx.lineTo(770, 285);
    ctx.lineTo(1080, 285);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(555, 85);
    ctx.lineTo(640, 85);
    ctx.lineTo(622, 120);
    ctx.lineTo(575, 120);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const bands = [
      [264, '#3f7c3f', '1,800m', '경작지·사바나'],
      [225, '#5b8e4e', '2,800m', '열대 우림'],
      [182, '#a98e3f', '4,000m', '고산 황무지'],
      [142, '#9b6230', '5,000m', '고산 사막'],
    ];
    bands.forEach(([y, color, heightText, zone]) => {
      ctx.strokeStyle = color as string;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(125, y as number);
      ctx.lineTo(1075, y as number);
      ctx.stroke();
      label(ctx, heightText as string, 72, y as number, 20, '#1a1d22', 'left');
      label(ctx, zone as string, 1110, y as number, 20, '#1a1d22', 'right');
    });
    label(ctx, '5,895m', 72, 95, 20, '#1a1d22', 'left');
    label(ctx, '정상 · 빙하', 600, 50, 24, '#1a1d22');
    label(ctx, '킬리만자로 — 한 산 안의 다섯 식생대', 600, 324, 26, '#1f6e87');
  });
}

function drawNepalElevation() {
  savePng('hidden-diagram-nepal-elevation.png', 1200, 360, (ctx) => {
    drawRoundedPanel(ctx, 1200, 360, '#f4f0e7');
    ctx.fillStyle = '#a8c490';
    ctx.strokeStyle = '#4a6e3c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 304);
    ctx.lineTo(300, 300);
    ctx.lineTo(500, 218);
    ctx.lineTo(640, 148);
    ctx.lineTo(760, 78);
    ctx.lineTo(840, 30);
    ctx.lineTo(920, 80);
    ctx.lineTo(1040, 232);
    ctx.lineTo(1200, 300);
    ctx.lineTo(1200, 360);
    ctx.lineTo(0, 360);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(760, 78);
    ctx.lineTo(840, 30);
    ctx.lineTo(920, 80);
    ctx.lineTo(878, 86);
    ctx.lineTo(820, 48);
    ctx.lineTo(776, 88);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = '#5b3d20';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 260);
    ctx.lineTo(1200, 260);
    ctx.stroke();
    ctx.setLineDash([]);

    label(ctx, '테라이 평야', 130, 322, 22, '#1a1d22');
    label(ctx, '중부 언덕', 500, 322, 22, '#1a1d22');
    label(ctx, '히말라야', 900, 322, 22, '#1a1d22');
    label(ctx, '60m', 135, 284, 18, '#1a1d22');
    label(ctx, '2,000m', 540, 218, 18, '#1a1d22');
    label(ctx, '8,849m', 830, 60, 18, '#1a1d22');
    label(ctx, '남북 약 200km', 600, 246, 18, '#5b3d20');
    label(ctx, '남에서 북으로 — 네팔의 다섯 단계 고도 풍경', 600, 32, 26, '#b22a2a');
  });
}

function drawCambodiaLakeCycle() {
  savePng('hidden-diagram-cambodia-tonle-sap.png', 1200, 360, (ctx) => {
    drawRoundedPanel(ctx, 1200, 360, '#fbf4e1');
    ctx.fillStyle = '#e6cf95';
    ctx.fillRect(70, 210, 430, 95);
    ctx.fillRect(700, 210, 430, 95);
    ctx.strokeStyle = '#a07a32';
    ctx.lineWidth = 3;
    ctx.strokeRect(70, 210, 430, 95);
    ctx.strokeRect(700, 210, 430, 95);

    ctx.fillStyle = '#cfe1ee';
    ctx.strokeStyle = '#4a7fb3';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(285, 178, 118, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(915, 168, 238, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#1e528f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(520, 168);
    ctx.lineTo(680, 168);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(680, 168);
    ctx.lineTo(650, 150);
    ctx.lineTo(650, 186);
    ctx.closePath();
    ctx.fillStyle = '#1e528f';
    ctx.fill();

    label(ctx, '건기 — 약 2,500 km²', 285, 248, 22, '#1a1d22');
    label(ctx, '평균 깊이 1m', 285, 282, 18, '#5a6470');
    label(ctx, '우기 — 약 12,000 km²', 915, 248, 22, '#1a1d22');
    label(ctx, '평균 깊이 9m', 915, 282, 18, '#5a6470');
    label(ctx, '5×', 600, 130, 30, '#1e528f');
    label(ctx, '메콩물 역류', 600, 92, 20, '#1e528f');
    label(ctx, '톤레삽 — 한 호수의 두 가지 얼굴', 600, 34, 26, '#1e528f');
  });
}

function drawIconBase(ctx: CanvasContext) {
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#fffdf6';
  ctx.beginPath();
  ctx.roundRect(4, 4, 120, 120, 28);
  ctx.fill();
  ctx.strokeStyle = '#e6dfcf';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function drawPeople(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  [[36, 43], [64, 36], [92, 43]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(22, 100);
  ctx.quadraticCurveTo(28, 72, 50, 72);
  ctx.lineTo(78, 72);
  ctx.quadraticCurveTo(100, 72, 106, 100);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(48, 69);
  ctx.lineTo(64, 54);
  ctx.lineTo(80, 69);
  ctx.stroke();
}

function drawTree(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(20, 98);
  ctx.lineTo(108, 98);
  ctx.stroke();
  for (const [x, y, s] of [[34, 70, 1], [72, 68, 0.85], [96, 78, 0.7]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, 98);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 16 * s, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSun(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(64, 64, 17, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30);
    ctx.lineTo(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48);
    ctx.stroke();
  }
}

function drawPhone(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(40, 18, 48, 92, 10);
  ctx.stroke();
  [42, 62, 82].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(78, y);
    ctx.stroke();
  });
}

function drawGlobe(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(64, 64, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(23, 64);
  ctx.quadraticCurveTo(64, 44, 105, 64);
  ctx.moveTo(23, 64);
  ctx.quadraticCurveTo(64, 84, 105, 64);
  ctx.moveTo(64, 22);
  ctx.lineTo(64, 106);
  ctx.stroke();
}

function drawDrum(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(64, 36, 34, 11, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30, 36);
  ctx.lineTo(42, 98);
  ctx.moveTo(98, 36);
  ctx.lineTo(86, 98);
  ctx.moveTo(42, 98);
  ctx.quadraticCurveTo(64, 108, 86, 98);
  ctx.stroke();
}

function drawMountain(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.fillStyle = `${accent}22`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(20, 102);
  ctx.lineTo(52, 34);
  ctx.lineTo(76, 84);
  ctx.lineTo(100, 24);
  ctx.lineTo(112, 102);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawPattern(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  [34, 64, 94].forEach((y, i) => {
    ctx.beginPath();
    ctx.moveTo(25, y);
    ctx.lineTo(103, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(i === 0 ? 45 : i === 1 ? 80 : 58, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
  });
}

function drawFlags(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(18, 62);
  ctx.lineTo(110, 62);
  ctx.stroke();
  for (const [x, h] of [[34, 32], [55, 42], [76, 30], [98, 38]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, 62);
    ctx.lineTo(x, 62 - h);
    ctx.stroke();
    ctx.fillStyle = `${accent}44`;
    ctx.beginPath();
    ctx.moveTo(x, 62 - h);
    ctx.lineTo(x + 15, 68 - h);
    ctx.lineTo(x, 74 - h);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClock(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(64, 64, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(64, 36);
  ctx.lineTo(64, 64);
  ctx.lineTo(88, 78);
  ctx.stroke();
}

function drawBowl(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(26, 62);
  ctx.quadraticCurveTo(64, 96, 102, 62);
  ctx.moveTo(28, 62);
  ctx.lineTo(100, 62);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(44, 50);
  ctx.quadraticCurveTo(64, 38, 84, 50);
  ctx.stroke();
}

function drawTemple(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(24, 100);
  ctx.lineTo(104, 100);
  ctx.moveTo(34, 100);
  ctx.lineTo(34, 62);
  ctx.lineTo(48, 48);
  ctx.lineTo(48, 100);
  ctx.moveTo(58, 100);
  ctx.lineTo(58, 44);
  ctx.lineTo(72, 28);
  ctx.lineTo(72, 100);
  ctx.moveTo(82, 100);
  ctx.lineTo(82, 64);
  ctx.lineTo(96, 52);
  ctx.lineTo(96, 100);
  ctx.stroke();
}

function drawWaves(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  [52, 74].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(18, y);
    for (let x = 18; x < 110; x += 24) {
      ctx.quadraticCurveTo(x + 12, y - 18, x + 24, y);
    }
    ctx.stroke();
  });
}

function drawDancer(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(64, 38, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(64, 52);
  ctx.quadraticCurveTo(44, 70, 36, 100);
  ctx.moveTo(64, 52);
  ctx.quadraticCurveTo(84, 70, 92, 100);
  ctx.moveTo(48, 78);
  ctx.quadraticCurveTo(64, 88, 80, 78);
  ctx.stroke();
}

function drawKite(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.fillStyle = `${accent}22`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(64, 18);
  ctx.lineTo(96, 64);
  ctx.lineTo(64, 110);
  ctx.lineTo(32, 64);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(64, 110);
  ctx.quadraticCurveTo(72, 120, 62, 126);
  ctx.stroke();
}

function drawHillLine(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(18, 92);
  ctx.quadraticCurveTo(38, 34, 64, 92);
  ctx.quadraticCurveTo(90, 34, 110, 92);
  ctx.moveTo(18, 94);
  ctx.lineTo(110, 94);
  ctx.stroke();
}

function drawBasket(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(64, 72, 42, 20, 0, 0, Math.PI * 2);
  ctx.moveTo(24, 72);
  ctx.lineTo(34, 98);
  ctx.quadraticCurveTo(64, 112, 94, 98);
  ctx.lineTo(104, 72);
  ctx.moveTo(64, 52);
  ctx.lineTo(64, 28);
  ctx.arc(64, 24, 9, 0, Math.PI * 2);
  ctx.stroke();
}

function drawConnectedCircles(ctx: CanvasContext, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(48, 52, 22, 0, Math.PI * 2);
  ctx.arc(80, 78, 22, 0, Math.PI * 2);
  ctx.moveTo(48, 30);
  ctx.lineTo(48, 18);
  ctx.moveTo(24, 52);
  ctx.lineTo(12, 52);
  ctx.moveTo(102, 78);
  ctx.lineTo(116, 78);
  ctx.moveTo(80, 100);
  ctx.lineTo(80, 114);
  ctx.stroke();
}

const icons: IconSpec[] = [
  { file: 'hidden-icon-kenya-harambee.png', label: '하람비', accent: '#2f7a4e', draw: drawPeople },
  { file: 'hidden-icon-kenya-savanna.png', label: '사바나', accent: '#2f7a4e', draw: drawTree },
  { file: 'hidden-icon-kenya-equator.png', label: '적도', accent: '#b85628', draw: drawSun },
  { file: 'hidden-icon-kenya-mpesa.png', label: 'M-PESA', accent: '#2f7a4e', draw: drawPhone },
  { file: 'hidden-icon-tanzania-ujamaa.png', label: '우자마', accent: '#1f6e87', draw: drawGlobe },
  { file: 'hidden-icon-tanzania-ngoma.png', label: '응고마', accent: '#1f6e87', draw: drawDrum },
  { file: 'hidden-icon-tanzania-kilimanjaro.png', label: '킬리만자로', accent: '#b14a2a', draw: drawMountain },
  { file: 'hidden-icon-tanzania-kanga.png', label: '칸가', accent: '#1f6e87', draw: drawPattern },
  { file: 'hidden-icon-nepal-himalaya.png', label: '히말라야', accent: '#b22a2a', draw: drawMountain },
  { file: 'hidden-icon-nepal-prayer-flags.png', label: '기도 깃발', accent: '#2c5d8c', draw: drawFlags },
  { file: 'hidden-icon-nepal-timezone.png', label: '시간대', accent: '#2c5d8c', draw: drawClock },
  { file: 'hidden-icon-nepal-dal-bhat.png', label: '달밧', accent: '#b22a2a', draw: drawBowl },
  { file: 'hidden-icon-cambodia-angkor.png', label: '앙코르', accent: '#1e528f', draw: drawTemple },
  { file: 'hidden-icon-cambodia-mekong.png', label: '메콩', accent: '#1e528f', draw: drawWaves },
  { file: 'hidden-icon-cambodia-apsara.png', label: '압사라', accent: '#b8862a', draw: drawDancer },
  { file: 'hidden-icon-cambodia-kite.png', label: '파란 연', accent: '#1e528f', draw: drawKite },
  { file: 'hidden-icon-rwanda-hills.png', label: '천 개의 언덕', accent: '#1f7a4f', draw: drawHillLine },
  { file: 'hidden-icon-rwanda-imigongo.png', label: '이미공고', accent: '#1f7a4f', draw: drawMountain },
  { file: 'hidden-icon-rwanda-agaseke.png', label: '아가세케', accent: '#2f6db3', draw: drawBasket },
  { file: 'hidden-icon-rwanda-umuganda.png', label: '우무간다', accent: '#1f7a4f', draw: drawConnectedCircles },
];

function drawIcons() {
  for (const icon of icons) {
    savePng(icon.file, 128, 128, (ctx) => {
      drawIconBase(ctx);
      icon.draw(ctx, icon.accent);
    });
  }
}

function main() {
  registerFonts();
  mkdirSync(OUT_DIR, { recursive: true });
  drawRwandaHills();
  drawTanzaniaElevation();
  drawNepalElevation();
  drawCambodiaLakeCycle();
  drawIcons();
}

main();
