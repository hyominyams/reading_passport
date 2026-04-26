import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookPdfTextRecord, BookPdfTextStatus } from '@/types/database';

export const BOOK_PDF_TEXT_TYPE = 'full_text';

type BookLike = {
  id: string;
};

type RawBookPdfText = Record<string, unknown>;

function normalizeStatus(value: unknown): BookPdfTextStatus {
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

export function normalizeBookPdfTextRecord(raw: unknown): BookPdfTextRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as RawBookPdfText;
  const id = toOptionalString(source.id);
  const bookId = toOptionalString(source.book_id);

  if (!id || !bookId) {
    return null;
  }

  return {
    id,
    book_id: bookId,
    extraction_type: toOptionalString(source.extraction_type) ?? BOOK_PDF_TEXT_TYPE,
    source_language: toOptionalString(source.source_language) ?? 'default',
    source_pdf_url: toOptionalString(source.source_pdf_url),
    source_hash: toOptionalString(source.source_hash),
    status: normalizeStatus(source.status),
    extracted_text: toOptionalString(source.extracted_text),
    extracted_text_chars: toNonNegativeNumber(source.extracted_text_chars),
    error_message: toOptionalString(source.error_message),
    started_at: toNullableDateString(source.started_at),
    completed_at: toNullableDateString(source.completed_at),
    created_at: toDateString(source.created_at),
    updated_at: toDateString(source.updated_at),
  };
}

export async function getLatestBookPdfText(
  client: SupabaseClient,
  bookId: string,
  options: {
    status?: BookPdfTextStatus;
    extractionType?: string;
  } = {},
): Promise<BookPdfTextRecord | null> {
  let query = client
    .from('book_pdf_texts')
    .select('*')
    .eq('book_id', bookId)
    .eq('extraction_type', options.extractionType ?? BOOK_PDF_TEXT_TYPE);

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching book pdf text:', error);
    return null;
  }

  return normalizeBookPdfTextRecord(data);
}

export function getLatestCompletedBookPdfText(client: SupabaseClient, bookId: string) {
  return getLatestBookPdfText(client, bookId, { status: 'completed' });
}

export async function attachLatestBookPdfTexts<T extends BookLike>(
  client: SupabaseClient,
  books: T[],
): Promise<(T & { book_pdf_text: BookPdfTextRecord | null })[]> {
  const bookIds = books.map((book) => book.id).filter(Boolean);

  if (bookIds.length === 0) {
    return books.map((book) => ({ ...book, book_pdf_text: null }));
  }

  const { data, error } = await client
    .from('book_pdf_texts')
    .select('*')
    .in('book_id', bookIds)
    .eq('extraction_type', BOOK_PDF_TEXT_TYPE)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching book pdf texts:', error);
    return books.map((book) => ({ ...book, book_pdf_text: null }));
  }

  const byBookId = new Map<string, BookPdfTextRecord>();

  for (const item of data ?? []) {
    const record = normalizeBookPdfTextRecord(item);
    if (record && !byBookId.has(record.book_id)) {
      byBookId.set(record.book_id, record);
    }
  }

  return books.map((book) => ({
    ...book,
    book_pdf_text: byBookId.get(book.id) ?? null,
  }));
}

export async function upsertBookPdfText(
  client: SupabaseClient,
  input: {
    bookId: string;
    status: BookPdfTextStatus;
    extractionType?: string;
    sourceLanguage?: string;
    sourcePdfUrl?: string | null;
    sourceHash?: string | null;
    extractedText?: string | null;
    extractedTextChars?: number;
    errorMessage?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  },
): Promise<BookPdfTextRecord | null> {
  const payload: Record<string, unknown> = {
    book_id: input.bookId,
    extraction_type: input.extractionType ?? BOOK_PDF_TEXT_TYPE,
    source_language: input.sourceLanguage?.trim() || 'default',
    status: input.status,
  };

  if (input.sourcePdfUrl !== undefined) payload.source_pdf_url = input.sourcePdfUrl;
  if (input.sourceHash !== undefined) payload.source_hash = input.sourceHash;
  if (input.extractedText !== undefined) payload.extracted_text = input.extractedText;
  if (input.extractedTextChars !== undefined) payload.extracted_text_chars = input.extractedTextChars;
  if (input.errorMessage !== undefined) payload.error_message = input.errorMessage;
  if (input.startedAt !== undefined) payload.started_at = input.startedAt;
  if (input.completedAt !== undefined) payload.completed_at = input.completedAt;

  const { data, error } = await client
    .from('book_pdf_texts')
    .upsert(payload, { onConflict: 'book_id,extraction_type,source_language' })
    .select('*')
    .single();

  if (error) {
    console.error('Error saving book pdf text:', error);
    return null;
  }

  return normalizeBookPdfTextRecord(data);
}
