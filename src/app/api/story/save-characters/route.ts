import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { normalizeIllustrationStyle } from '@/lib/illustration-styles';
import type { CharacterDesign, CharacterGender, IllustrationStyle, Story } from '@/types/database';

export const runtime = 'nodejs';

function normalizeCharacterDesign(character: Partial<CharacterDesign> | null | undefined): CharacterDesign {
  const safeGender = character?.gender;
  const gender: CharacterGender =
    safeGender === 'female' || safeGender === 'male'
      ? safeGender
      : 'unspecified';

  return {
    name: character?.name?.trim() ?? '',
    gender,
    appearance: character?.appearance?.trim() ?? '',
    personality: character?.personality?.trim() ?? '',
    imageUrl: character?.imageUrl ?? null,
  };
}

function hasMeaningfulCharacter(character: CharacterDesign) {
  return (
    character.name.length > 0 ||
    character.appearance.length > 0 ||
    character.personality.length > 0 ||
    character.imageUrl !== null
  );
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as {
      storyId?: unknown;
      characters?: unknown;
      selectedStyle?: unknown;
      targetStep?: unknown;
    };

    const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : '';
    const targetStep =
      typeof body.targetStep === 'number' && Number.isFinite(body.targetStep)
        ? Math.max(1, Math.round(body.targetStep))
        : 6;

    if (!storyId) {
      return Response.json({ error: '이야기 정보를 찾지 못했어요.' }, { status: 400 });
    }

    const rawCharacters = Array.isArray(body.characters) ? body.characters : [];
    const normalizedCharacters = rawCharacters
      .map((character) => normalizeCharacterDesign(character as Partial<CharacterDesign>))
      .filter((character) => hasMeaningfulCharacter(character));
    const validCharacters = normalizedCharacters.filter((character) => character.name.length > 0);

    if (validCharacters.length === 0) {
      return Response.json({ error: '최소 1명의 주인공 이름을 입력해 주세요.' }, { status: 400 });
    }

    const selectedStyle: IllustrationStyle = normalizeIllustrationStyle(
      typeof body.selectedStyle === 'string' ? body.selectedStyle : null
    );

    const service = createServiceClient();
    const { data: storyData, error: storyError } = await service
      .from('stories')
      .select('id, student_id, story_status, final_text, current_step, language')
      .eq('id', storyId)
      .single();

    if (storyError || !storyData) {
      return Response.json({ error: '이야기를 찾을 수 없습니다.' }, { status: 404 });
    }

    const story = storyData as Pick<
      Story,
      'id' | 'student_id' | 'story_status' | 'final_text' | 'current_step' | 'language'
    >;

    if (story.student_id !== user.id) {
      return Response.json({ error: '이 이야기를 수정할 수 없습니다.' }, { status: 403 });
    }

    if (story.story_status === 'archived') {
      return Response.json({ error: '이미 종료된 이야기입니다.' }, { status: 409 });
    }

    if (!story.final_text || story.final_text.length === 0) {
      return Response.json({ error: '이야기 바꿔 쓰기를 먼저 완성해 주세요.' }, { status: 409 });
    }

    const { data: updatedStory, error: updateError } = await service
      .from('stories')
      .update({
        character_designs: normalizedCharacters,
        illustration_style: selectedStyle,
        current_step: Math.max(story.current_step ?? 1, targetStep),
      })
      .eq('id', storyId)
      .select('id, current_step, language, character_designs')
      .single();

    if (updateError || !updatedStory) {
      return Response.json(
        { error: updateError?.message || '주인공 저장에 실패했어요.' },
        { status: 500 }
      );
    }

    const persistedCharacters = Array.isArray(updatedStory.character_designs)
      ? updatedStory.character_designs.filter((character: CharacterDesign) =>
          typeof character?.name === 'string' && character.name.trim().length > 0
        )
      : [];

    if (persistedCharacters.length === 0) {
      return Response.json({ error: '주인공 저장을 확인하지 못했어요.' }, { status: 500 });
    }

    return Response.json({
      story: updatedStory,
    });
  } catch (error) {
    console.error('Save characters error:', error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '주인공 저장에 실패했어요.',
      },
      { status: 500 }
    );
  }
}
