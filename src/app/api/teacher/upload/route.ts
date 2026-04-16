import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadTeacherAsset } from '@/lib/storage/teacher-assets';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

const UPLOAD_CONFIG: Record<string, { folder: string; maxBytes: number }> = {
  'book-cover': { folder: 'books/covers', maxBytes: 5 * 1024 * 1024 },
  'book-pdf': { folder: 'books/pdfs', maxBytes: 25 * 1024 * 1024 },
  'hidden-content': { folder: 'hidden-content', maxBytes: 10 * 1024 * 1024 },
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const formData = await request.formData();
  const kind = String(formData.get('kind') || '');
  const file = formData.get('file');

  if (!(file instanceof File) || !kind) {
    return NextResponse.json({ error: '업로드할 파일 정보가 부족합니다' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `지원하지 않는 파일 형식입니다: ${file.type}` }, { status: 400 });
  }

  const uploadConfig = UPLOAD_CONFIG[kind];
  if (!uploadConfig) {
    return NextResponse.json({ error: '지원하지 않는 업로드 종류입니다' }, { status: 400 });
  }

  if (file.size > uploadConfig.maxBytes) {
    return NextResponse.json(
      { error: `파일 크기는 ${(uploadConfig.maxBytes / (1024 * 1024)).toFixed(0)}MB 이하여야 합니다` },
      { status: 400 }
    );
  }

  let publicUrl: string;
  let storagePath: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadTeacherAsset({
      fileBuffer: buffer,
      mimeType: file.type,
      folder: uploadConfig.folder,
      fileName: file.name,
    });
    publicUrl = result.publicUrl;
    storagePath = result.storagePath;
  } catch (err) {
    console.error('Storage upload failed:', err);
    const message = err instanceof Error ? err.message : '파일 저장에 실패했습니다';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    asset: {
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      publicUrl,
      storagePath,
    },
  });
}
