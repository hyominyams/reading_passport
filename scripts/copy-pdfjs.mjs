#!/usr/bin/env node
/**
 * Copies pdfjs-dist legacy build files to public/pdfjs/
 * so they can be served from the same origin (faster than CDN).
 *
 * Run via: node scripts/copy-pdfjs.mjs
 * Also runs automatically on `npm install` via the postinstall hook.
 */

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const src = resolve(root, 'node_modules/pdfjs-dist/legacy/build');
const dest = resolve(root, 'public/pdfjs');

const files = ['pdf.min.mjs', 'pdf.worker.min.mjs'];

if (!existsSync(dest)) {
  mkdirSync(dest, { recursive: true });
}

for (const file of files) {
  const from = resolve(src, file);
  const to = resolve(dest, file);
  if (!existsSync(from)) {
    console.warn(`[copy-pdfjs] WARNING: ${from} not found, skipping`);
    continue;
  }
  copyFileSync(from, to);
  console.log(`[copy-pdfjs] ${file} → public/pdfjs/`);
}
