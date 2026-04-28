import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';

interface BookPlan {
  countryId: 'kenya' | 'tanzania' | 'nepal' | 'cambodia';
  title: string;
  subtitle: string;
  manuscript: string;
  theme: {
    className: string;
    paper: string;
    ink: string;
    accent: string;
    accent2: string;
    panel: string;
  };
  sceneLabels: string[];
}

const ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(ROOT, 'output/virtual-picture-books/generated');
const BUCKET = process.env.SUPABASE_TEACHER_ASSETS_BUCKET || 'teacher-assets';
const APPLY = process.argv.includes('--apply');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const BOOKS: BookPlan[] = [
  {
    countryId: 'kenya',
    title: '비가 오기 전에 꿀벌이 알려준 것',
    subtitle: '케냐의 작은 농장에서 레일라는 기후와 생명의 연결을 배웁니다.',
    manuscript: 'kenya.md',
    theme: {
      className: 'kenya',
      paper: '#fff7e6',
      ink: '#1f241f',
      accent: '#2f7a4e',
      accent2: '#b56a32',
      panel: '#fffdf7',
    },
    sceneLabels: ['농장', '마른 밭', '노란 꽃', '학교 뒤뜰', '꽃씨', '첫 싹', '꽃길', '첫 비'],
  },
  {
    countryId: 'tanzania',
    title: '진짜 영웅을 찾는 북소리',
    subtitle: '탄자니아의 마을 축제에서 바라카는 영웅의 뜻을 다시 배웁니다.',
    manuscript: 'tanzania.md',
    theme: {
      className: 'tanzania',
      paper: '#fbf1dc',
      ink: '#202020',
      accent: '#217c83',
      accent2: '#a9472c',
      panel: '#fffaf0',
    },
    sceneLabels: ['축제', '연습', '달리기', '도움', '발자국', '염소', '북소리', '영웅'],
  },
  {
    countryId: 'nepal',
    title: '구름 위 학교의 빨간 공책',
    subtitle: '네팔 산마을의 미라는 학교로 가는 길에서 배움의 의미를 찾습니다.',
    manuscript: 'nepal.md',
    theme: {
      className: 'nepal',
      paper: '#f7f8f3',
      ink: '#27384a',
      accent: '#c7372f',
      accent2: '#5e7f4e',
      panel: '#ffffff',
    },
    sceneLabels: ['산마을', '등굣길', '공책', '눈길', '장작', '교실', '질문', '배움'],
  },
  {
    countryId: 'cambodia',
    title: '메콩강에 띄운 파란 연',
    subtitle: '캄보디아의 강가 마을에서 소피아는 기억을 미래로 띄워 보냅니다.',
    manuscript: 'cambodia.md',
    theme: {
      className: 'cambodia',
      paper: '#fff9ec',
      ink: '#22323a',
      accent: '#285aa8',
      accent2: '#2f7886',
      panel: '#fffdf7',
    },
    sceneLabels: ['메콩강', '파란 천', '이야기', '연 만들기', '실패', '수선', '바람', '미래'],
  },
];

function readEnvFile() {
  const envPath = resolve(ROOT, '.env.local');
  const env: Record<string, string> = {};

  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    env[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
  }

  return env;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parsePages(markdown: string) {
  const pageMatches = [...markdown.matchAll(/### (\d+)쪽\n\n([\s\S]*?)(?=\n### \d+쪽|\n?$)/g)];
  return pageMatches.map((match) => match[2].trim());
}

function assetPath(book: BookPlan, filename: string) {
  return resolve(ROOT, 'output/virtual-picture-books', book.countryId, 'assets', filename);
}

function assetUrl(book: BookPlan, filename: string) {
  const path = assetPath(book, filename);
  return existsSync(path) ? `file://${path}` : null;
}

function sceneMarkup(book: BookPlan, pageNumber: number) {
  const label = escapeHtml(book.sceneLabels[pageNumber - 1] ?? String(pageNumber));
  const nodes = Array.from({ length: 6 }, (_, index) => `<span class="dot d${index + 1}"></span>`).join('');

  if (book.countryId === 'kenya') {
    return `<div class="scene kenya-scene">${nodes}<span class="bee b1"></span><span class="bee b2"></span><span class="path"></span><strong>${label}</strong></div>`;
  }

  if (book.countryId === 'tanzania') {
    return `<div class="scene tanzania-scene"><span class="flag f1"></span><span class="flag f2"></span><span class="flag f3"></span><span class="drum"></span><span class="mountain"></span><strong>${label}</strong></div>`;
  }

  if (book.countryId === 'nepal') {
    return `<div class="scene nepal-scene"><span class="ridge r1"></span><span class="ridge r2"></span><span class="book-mark"></span><span class="bridge"></span><strong>${label}</strong></div>`;
  }

  return `<div class="scene cambodia-scene"><span class="river"></span><span class="kite"></span><span class="boat"></span><span class="patch p1"></span><span class="patch p2"></span><strong>${label}</strong></div>`;
}

function buildHtml(book: BookPlan, pages: string[]) {
  const pageHtml = pages.map((text, index) => `
    <section class="book-page story-page">
      <div class="page-number">${index + 1}</div>
      <div class="art">${assetUrl(book, `page-${String(index + 1).padStart(2, '0')}.png`)
        ? `<img src="${assetUrl(book, `page-${String(index + 1).padStart(2, '0')}.png`)}" alt="" />`
        : sceneMarkup(book, index + 1)}</div>
      <div class="text-box">
        <p>${escapeHtml(text)}</p>
      </div>
    </section>
  `).join('\n');
  const coverImageUrl = assetUrl(book, 'cover.png');

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(book.title)}</title>
    <style>
      @font-face {
        font-family: StoryFont;
        src: url("file://${resolve(ROOT, 'public/fonts/온글잎 뉴보현_두꺼운 어린이그림책용 폰트.ttf')}");
      }

      @page {
        size: 210mm 210mm;
        margin: 0;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: ${book.theme.paper};
        color: ${book.theme.ink};
        font-family: StoryFont, "Apple SD Gothic Neo", sans-serif;
      }

      .book-page {
        position: relative;
        width: 210mm;
        height: 210mm;
        overflow: hidden;
        page-break-after: always;
        background: ${book.theme.paper};
      }

      .cover {
        padding: ${coverImageUrl ? '0' : '24mm 20mm 18mm'};
      }

      .cover-art {
        position: relative;
        width: 100%;
        height: 100%;
        border: ${coverImageUrl ? '0' : `4px solid ${book.theme.ink}`};
        border-radius: ${coverImageUrl ? '0' : '14px'};
        background: ${book.theme.panel};
        overflow: hidden;
      }

      .cover h1 {
        position: absolute;
        left: 20mm;
        right: 20mm;
        bottom: 28mm;
        margin: 0;
        font-size: 38pt;
        line-height: 1.12;
        letter-spacing: 0;
        color: ${book.theme.ink};
        z-index: 3;
      }

      .cover p {
        position: absolute;
        left: 20mm;
        right: 20mm;
        bottom: 15mm;
        margin: 0;
        font-size: 15pt;
        color: ${book.theme.ink};
        z-index: 3;
      }

      .cover .scene {
        position: absolute;
        inset: 8mm;
      }

      .story-page {
        display: grid;
        grid-template-rows: 132mm 1fr;
        gap: 0;
        padding: 12mm;
      }

      .page-number {
        position: absolute;
        right: 13mm;
        top: 10mm;
        width: 11mm;
        height: 11mm;
        border: 2px solid ${book.theme.ink};
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: ${book.theme.panel};
        font-size: 10pt;
        z-index: 5;
      }

      .art {
        border: 4px solid ${book.theme.ink};
        border-radius: 14px 14px 0 0;
        overflow: hidden;
        background: ${book.theme.panel};
      }

      .cover-art img,
      .art img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .text-box {
        border: 4px solid ${book.theme.ink};
        border-top: 0;
        border-radius: 0 0 14px 14px;
        background: ${book.theme.panel};
        padding: 8mm 10mm;
      }

      .text-box p {
        margin: 0;
        font-size: 15.8pt;
        line-height: 1.55;
        word-break: keep-all;
      }

      .scene {
        position: relative;
        width: 100%;
        height: 100%;
        background: ${book.theme.panel};
      }

      .scene strong {
        position: absolute;
        left: 12mm;
        top: 10mm;
        border: 3px solid ${book.theme.ink};
        border-radius: 999px;
        background: ${book.theme.paper};
        padding: 3mm 6mm;
        font-size: 18pt;
      }

      .dot {
        position: absolute;
        width: 18mm;
        height: 18mm;
        border-radius: 50%;
        background: ${book.theme.accent};
      }
      .d1 { left: 20mm; bottom: 25mm; }
      .d2 { left: 55mm; bottom: 42mm; background: ${book.theme.accent2}; }
      .d3 { left: 94mm; bottom: 30mm; }
      .d4 { right: 35mm; bottom: 55mm; background: ${book.theme.accent2}; }
      .d5 { right: 65mm; top: 46mm; }
      .d6 { left: 120mm; top: 60mm; background: ${book.theme.accent2}; }

      .bee {
        position: absolute;
        width: 28mm;
        height: 16mm;
        border: 3px solid ${book.theme.ink};
        border-radius: 50%;
        background: #e6a93a;
      }
      .bee::before, .bee::after {
        content: "";
        position: absolute;
        top: -10mm;
        width: 14mm;
        height: 11mm;
        border: 2px solid ${book.theme.accent};
        border-radius: 50%;
        background: white;
      }
      .bee::before { left: 2mm; }
      .bee::after { right: 2mm; }
      .b1 { left: 30mm; top: 48mm; }
      .b2 { right: 35mm; bottom: 38mm; transform: rotate(-10deg); }
      .path {
        position: absolute;
        left: 38mm;
        right: 38mm;
        top: 78mm;
        border-top: 5px dotted ${book.theme.accent2};
        transform: rotate(8deg);
      }

      .drum {
        position: absolute;
        left: 62mm;
        top: 38mm;
        width: 80mm;
        height: 80mm;
        border: 12mm solid ${book.theme.accent2};
        border-radius: 50%;
        background: #ead4a8;
        box-shadow: inset 0 0 0 3mm ${book.theme.ink};
      }
      .flag {
        position: absolute;
        top: 16mm;
        width: 0;
        height: 0;
        border-left: 7mm solid transparent;
        border-right: 7mm solid transparent;
        border-top: 18mm solid #f4c84a;
      }
      .f1 { left: 32mm; }
      .f2 { left: 82mm; border-top-color: ${book.theme.accent}; }
      .f3 { right: 42mm; border-top-color: ${book.theme.accent2}; }
      .mountain {
        position: absolute;
        right: 15mm;
        bottom: 18mm;
        width: 78mm;
        height: 40mm;
        border-left: 39mm solid transparent;
        border-right: 39mm solid transparent;
        border-bottom: 40mm solid #d9e4e8;
      }

      .ridge {
        position: absolute;
        bottom: 24mm;
        width: 0;
        height: 0;
        border-left: 58mm solid transparent;
        border-right: 58mm solid transparent;
        border-bottom: 78mm solid #dfe6e8;
      }
      .r1 { left: 5mm; }
      .r2 { right: 4mm; border-bottom-color: #c9d2d5; }
      .book-mark {
        position: absolute;
        left: 52mm;
        top: 44mm;
        width: 46mm;
        height: 60mm;
        border: 4px solid ${book.theme.ink};
        border-left: 12px solid ${book.theme.accent};
        background: white;
        transform: rotate(-8deg);
      }
      .bridge {
        position: absolute;
        right: 35mm;
        bottom: 50mm;
        width: 65mm;
        border-top: 6px dashed ${book.theme.accent};
      }

      .river {
        position: absolute;
        left: -20mm;
        right: -20mm;
        top: 62mm;
        height: 40mm;
        border-top: 5px solid ${book.theme.accent2};
        border-bottom: 5px solid ${book.theme.accent2};
        transform: rotate(-7deg);
      }
      .kite {
        position: absolute;
        left: 40mm;
        top: 25mm;
        width: 50mm;
        height: 50mm;
        border: 4px solid ${book.theme.accent};
        background: #dbe7ff;
        transform: rotate(45deg);
      }
      .boat {
        position: absolute;
        right: 32mm;
        bottom: 36mm;
        width: 70mm;
        height: 20mm;
        border-radius: 0 0 40mm 40mm;
        background: #8c6a45;
      }
      .patch {
        position: absolute;
        width: 25mm;
        height: 25mm;
        border: 3px dashed ${book.theme.accent};
        background: #eef3ff;
      }
      .p1 { left: 28mm; bottom: 35mm; }
      .p2 { right: 45mm; top: 42mm; }
    </style>
  </head>
  <body class="${book.theme.className}">
    <section class="book-page cover">
      <div class="cover-art">
        ${coverImageUrl ? `<img src="${coverImageUrl}" alt="" />` : sceneMarkup(book, 1)}
      </div>
      ${coverImageUrl ? '' : `<h1>${escapeHtml(book.title)}</h1><p>${escapeHtml(book.subtitle)}</p>`}
    </section>
    ${pageHtml}
  </body>
</html>`;
}

function renderPdf(htmlPath: string, pdfPath: string) {
  if (!existsSync(CHROME)) {
    throw new Error(`Chrome 실행 파일을 찾지 못했습니다: ${CHROME}`);
  }

  execFileSync(CHROME, [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    '--print-to-pdf=' + pdfPath,
    'file://' + htmlPath,
  ], { stdio: 'inherit' });
}

function publicUrl(projectUrl: string, storagePath: string) {
  return `${projectUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function uploadPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  countryId: string,
  pdfPath: string
) {
  const storagePath = `books/pdfs/virtual/${countryId}/${basename(pdfPath)}`;

  if (APPLY) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, readFileSync(pdfPath), {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;
  }

  return storagePath;
}

async function uploadImageAsset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  countryId: string,
  imagePath: string,
  filename: string
) {
  const storagePath = `books/images/virtual/${countryId}/${filename}`;

  if (APPLY) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, readFileSync(imagePath), {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;
  }

  return storagePath;
}

async function upsertBook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  options: {
    adminId: string;
    book: BookPlan;
    pdfUrl: string;
    coverUrl: string;
  }
) {
  if (!APPLY) {
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from('books')
    .select('id')
    .eq('country_id', options.book.countryId)
    .eq('title', options.book.title)
    .maybeSingle();

  if (existingError) throw existingError;
  const existingBook = existing as { id: string } | null;

  const row = {
    country_id: options.book.countryId,
    title: options.book.title,
    cover_url: options.coverUrl,
    pdf_url_ko: options.pdfUrl,
    pdf_url_en: options.pdfUrl,
    pdf_urls: { ko: options.pdfUrl },
    languages_available: ['ko'],
    created_by: options.adminId,
    scope: 'global',
    class_id: null,
    approved: true,
  };

  if (existingBook?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const booksTable = supabase.from('books') as any;
    const { error } = await booksTable.update(row).eq('id', existingBook.id);
    if (error) throw error;
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const booksTable = supabase.from('books') as any;
  const { error } = await booksTable.insert(row);
  if (error) throw error;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const env = { ...readEnvFile(), ...process.env };
  const projectUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.');
  }

  const supabase = createClient(projectUrl, serviceRoleKey);
  const { data: admin, error: adminError } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (adminError) throw adminError;
  const adminRow = admin as { id: string } | null;
  if (!adminRow?.id) {
    throw new Error('admin 권한 사용자를 찾지 못했습니다.');
  }

  const report: string[] = [];

  for (const book of BOOKS) {
    const markdown = readFileSync(resolve(ROOT, 'output/virtual-picture-books', book.manuscript), 'utf-8');
    const pages = parsePages(markdown);

    if (pages.length !== 8) {
      throw new Error(`${book.manuscript}: 본문 8쪽을 찾지 못했습니다. 현재 ${pages.length}쪽`);
    }

    const countryDir = resolve(OUTPUT_DIR, book.countryId);
    mkdirSync(countryDir, { recursive: true });

    const htmlPath = resolve(countryDir, `${book.countryId}-picture-book.html`);
    const pdfPath = resolve(countryDir, `${book.countryId}-picture-book.pdf`);
    writeFileSync(htmlPath, buildHtml(book, pages), 'utf-8');
    renderPdf(htmlPath, pdfPath);

    const storagePath = await uploadPdf(supabase, book.countryId, pdfPath);
    const pdfUrl = publicUrl(projectUrl, storagePath);
    const coverLocalPath = assetPath(book, 'cover.png');
    const coverStoragePath = existsSync(coverLocalPath)
      ? await uploadImageAsset(supabase, book.countryId, coverLocalPath, 'cover.png')
      : storagePath;
    const coverUrl = publicUrl(projectUrl, coverStoragePath);

    const supportingImages = [
      'character-sheet.png',
      ...Array.from({ length: 8 }, (_, index) => `page-${String(index + 1).padStart(2, '0')}.png`),
      'page-sheet.png',
    ];
    for (const filename of supportingImages) {
      const localImagePath = assetPath(book, filename);
      if (existsSync(localImagePath)) {
        await uploadImageAsset(supabase, book.countryId, localImagePath, filename);
      }
    }

    await upsertBook(supabase, { adminId: adminRow.id, book, pdfUrl, coverUrl });
    report.push(`${APPLY ? '[uploaded]' : '[dry-run]'} ${book.countryId}: ${book.title} -> ${pdfPath}`);
  }

  console.log(report.join('\n'));
  if (!APPLY) {
    console.log('\n실제 Supabase 업로드/도서 등록은 --apply 옵션을 붙여 실행하세요.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
