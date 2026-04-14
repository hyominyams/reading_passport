import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('country_facts')
    .select('*')
    .order('country_id', { ascending: true })
    .order('order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ facts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const body = await request.json();
  const countryId = typeof body.country_id === 'string' ? body.country_id.trim() : '';
  const factText = typeof body.fact_text === 'string' ? body.fact_text.trim() : '';
  const factTextEn = typeof body.fact_text_en === 'string' ? body.fact_text_en.trim() : '';
  const order = typeof body.order === 'number' && Number.isFinite(body.order) ? Math.max(0, Math.round(body.order)) : 0;

  if (!countryId || !factText) {
    return NextResponse.json({ error: '국가와 문구를 입력해주세요' }, { status: 400 });
  }

  const { data, error } = await service
    .from('country_facts')
    .insert({
      country_id: countryId,
      fact_text: factText,
      fact_text_en: factTextEn || null,
      order,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ fact: data });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const body = await request.json();
  const id = typeof body.id === 'string' ? body.id : '';

  if (!id) {
    return NextResponse.json({ error: 'fact ID가 필요합니다' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (typeof body.country_id === 'string') updateData.country_id = body.country_id.trim();
  if (typeof body.fact_text === 'string') updateData.fact_text = body.fact_text.trim();
  if (typeof body.fact_text_en === 'string') updateData.fact_text_en = body.fact_text_en.trim() || null;
  if (typeof body.order === 'number' && Number.isFinite(body.order)) updateData.order = Math.max(0, Math.round(body.order));

  const { data, error } = await service
    .from('country_facts')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ fact: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'fact ID가 필요합니다' }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from('country_facts')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
