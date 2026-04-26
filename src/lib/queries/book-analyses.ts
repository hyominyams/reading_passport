import type { SupabaseClient } from '@supabase/supabase-js';
import { parseBookAnalysis } from '@/lib/book-analysis';
import type { BookAnalysisRecord, BookAnalysisStatus } from '@/types/database';

export const BOOK_ANALYSIS_TYPE = 'full_book';
export const BOOK_ANALYSIS_MODEL = 'gpt-5-mini';
export const BOOK_ANALYSIS_PROMPT_VERSION = 'book-analysis-v1';

type BookLike = {
  id: string;
};

type RawBookAnalysis = Record<string, unknown>;

function normalizeStatus(value: unknown): BookAnalysisStatus {
  if (
    value === 'pending'
    || value === 'processing'
    || value === 'completed'
    || value === 'failed'
    || value === 'stale'
  ) {
    return value;
  }

  return 'pending';
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toDateString(value: unknown): string {
  return typeof value === 'string' ? value : new Date().toISOString();
}

function toNullableDateString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toNonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function normalizeBookAnalysisRecord(raw: unknown): BookAnalysisRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as RawBookAnalysis;
  const id = toOptionalString(source.id);
  const bookId = toOptionalString(source.book_id);

  if (!id || !bookId) {
    return null;
  }

  return {
    id,
    book_id: bookId,
    analysis_type: toOptionalString(source.analysis_type) ?? BOOK_ANALYSIS_TYPE,
    source_language: toOptionalString(source.source_language) ?? 'default',
    source_pdf_url: toOptionalString(source.source_pdf_url),
    source_hash: toOptionalString(source.source_hash),
    status: normalizeStatus(source.status),
    model: toOptionalString(source.model),
    prompt_version: toOptionalString(source.prompt_version),
    analysis_json: parseBookAnalysis(source.analysis_json),
    extracted_text_chars: toNonNegativeNumber(source.extracted_text_chars),
    error_message: toOptionalString(source.error_message),
    started_at: toNullableDateString(source.started_at),
    completed_at: toNullableDateString(source.completed_at),
    created_at: toDateString(source.created_at),
    updated_at: toDateString(source.updated_at),
  };
}

export function isCompletedBookAnalysis(analysis: BookAnalysisRecord | null | undefined) {
  return analysis?.status === 'completed';
}

export async function getLatestBookAnalysis(
  client: SupabaseClient,
  bookId: string,
  options: {
    status?: BookAnalysisStatus;
    analysisType?: string;
  } = {},
): Promise<BookAnalysisRecord | null> {
  let query = client
    .from('book_analyses')
    .select('*')
    .eq('book_id', bookId)
    .eq('analysis_type', options.analysisType ?? BOOK_ANALYSIS_TYPE);

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching book analysis:', error);
    return null;
  }

  return normalizeBookAnalysisRecord(data);
}

export function getLatestCompletedBookAnalysis(client: SupabaseClient, bookId: string) {
  return getLatestBookAnalysis(client, bookId, { status: 'completed' });
}

export async function attachLatestBookAnalyses<T extends BookLike>(
  client: SupabaseClient,
  books: T[],
): Promise<(T & { book_analysis: BookAnalysisRecord | null })[]> {
  const bookIds = books.map((book) => book.id).filter(Boolean);

  if (bookIds.length === 0) {
    return books.map((book) => ({ ...book, book_analysis: null }));
  }

  const { data, error } = await client
    .from('book_analyses')
    .select('*')
    .in('book_id', bookIds)
    .eq('analysis_type', BOOK_ANALYSIS_TYPE)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching book analyses:', error);
    return books.map((book) => ({ ...book, book_analysis: null }));
  }

  const byBookId = new Map<string, BookAnalysisRecord>();

  for (const item of data ?? []) {
    const record = normalizeBookAnalysisRecord(item);
    if (record && !byBookId.has(record.book_id)) {
      byBookId.set(record.book_id, record);
    }
  }

  return books.map((book) => ({
    ...book,
    book_analysis: byBookId.get(book.id) ?? null,
  }));
}

export async function upsertBookAnalysis(
  client: SupabaseClient,
  input: {
    bookId: string;
    status: BookAnalysisStatus;
    analysisType?: string;
    sourceLanguage?: string;
    sourcePdfUrl?: string | null;
    sourceHash?: string | null;
    model?: string | null;
    promptVersion?: string | null;
    analysisJson?: unknown;
    extractedTextChars?: number;
    errorMessage?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  },
): Promise<BookAnalysisRecord | null> {
  const payload: Record<string, unknown> = {
    book_id: input.bookId,
    analysis_type: input.analysisType ?? BOOK_ANALYSIS_TYPE,
    source_language: input.sourceLanguage?.trim() || 'default',
    status: input.status,
  };

  if (input.sourcePdfUrl !== undefined) payload.source_pdf_url = input.sourcePdfUrl;
  if (input.sourceHash !== undefined) payload.source_hash = input.sourceHash;
  if (input.model !== undefined) payload.model = input.model;
  if (input.promptVersion !== undefined) payload.prompt_version = input.promptVersion;
  if (input.analysisJson !== undefined) payload.analysis_json = input.analysisJson;
  if (input.extractedTextChars !== undefined) payload.extracted_text_chars = input.extractedTextChars;
  if (input.errorMessage !== undefined) payload.error_message = input.errorMessage;
  if (input.startedAt !== undefined) payload.started_at = input.startedAt;
  if (input.completedAt !== undefined) payload.completed_at = input.completedAt;

  const { data, error } = await client
    .from('book_analyses')
    .upsert(payload, { onConflict: 'book_id,analysis_type,source_language' })
    .select('*')
    .single();

  if (error) {
    console.error('Error saving book analysis:', error);
    return null;
  }

  return normalizeBookAnalysisRecord(data);
}
