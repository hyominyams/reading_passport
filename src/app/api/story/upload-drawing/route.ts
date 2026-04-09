import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { storeGeneratedImageBuffer } from '@/lib/storage/generated-images';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const storyId = formData.get('storyId') as string;
  const file = formData.get('file') as File;

  if (!storyId || !file) {
    return NextResponse.json(
      { error: 'Missing storyId or file' },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Use JPG or PNG.` },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum 5MB.' },
      { status: 400 },
    );
  }

  // Verify the story belongs to this user
  const { data: story } = await supabase
    .from('stories')
    .select('id, student_id')
    .eq('id', storyId)
    .single();

  if (!story || story.student_id !== user.id) {
    return NextResponse.json(
      { error: 'Story not found or access denied' },
      { status: 404 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await storeGeneratedImageBuffer({
      fileBuffer: buffer,
      mimeType: file.type,
      folder: 'student-drawings',
    });

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 },
    );
  }
}
