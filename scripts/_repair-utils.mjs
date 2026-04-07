import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadEnv() {
  const envPath = resolve(__dirname, '../.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  const env = {};

  for (const rawLine of envContent.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [key, ...rest] = line.split('=');
    if (!key || rest.length === 0) continue;

    env[key.trim()] = rest.join('=').trim();
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  return { url, serviceRoleKey };
}

export function createServiceClient() {
  const { url, serviceRoleKey } = loadEnv();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function parseArgs(argv) {
  const flags = new Set(argv.slice(2));
  return {
    apply: flags.has('--apply') || flags.has('--write') || flags.has('--commit'),
    dryRun: !(flags.has('--apply') || flags.has('--write') || flags.has('--commit')),
    help: flags.has('--help') || flags.has('-h'),
    limit: readFlagNumber(argv, '--limit'),
    teacherId: readFlagValue(argv, '--teacher-id'),
    classId: readFlagValue(argv, '--class-id'),
  };
}

function readFlagValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

function readFlagNumber(argv, name) {
  const raw = readFlagValue(argv, name);
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function stableStudentEmail(studentId) {
  return `student-${studentId}@student.worlddocent.local`;
}

export function isSixDigitCode(value) {
  return typeof value === 'string' && /^[0-9]{6}$/.test(value);
}

export function randomPassword() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

export async function listAllAuthUsers(supabase) {
  const users = [];
  const perPage = 1000;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const pageUsers = data?.users ?? [];
    users.push(...pageUsers);

    if (pageUsers.length < perPage) {
      break;
    }
  }

  return users;
}

export function chunkMessage(lines) {
  return lines.filter(Boolean).join('\n');
}

export function printUsage(lines) {
  console.log(lines.join('\n'));
}
