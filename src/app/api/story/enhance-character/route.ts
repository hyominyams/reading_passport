import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';

export async function POST(request: NextRequest) {
  try {
    const { character_name, appearance_description, art_style, story_context } =
      await request.json();

    const artStyleMap: Record<string, string> = {
      colored_pencil: 'colored pencil illustration style, hand-drawn look with visible pencil strokes',
      watercolor: 'watercolor painting style, soft washes, flowing colors, delicate translucent layers',
      woodblock: 'woodblock print style, bold outlines, flat color areas, traditional printmaking aesthetic',
      pastel: 'soft pastel illustration style, chalky textures, gentle blending, warm dreamy feel',
    };

    const artStyleEnglish: Record<string, string> = {
      colored_pencil: 'colored pencil illustration',
      watercolor: 'watercolor illustration',
      woodblock: 'woodblock print style',
      pastel: 'soft pastel illustration',
    };

    const styleDesc = artStyleMap[art_style] || art_style;
    const artStyleLabel = artStyleEnglish[art_style] || art_style;

    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a prompt engineer for children's book character illustration.
Given a character description from a student, enhance it into a detailed, child-friendly image generation prompt.

[Fixed conditions - MUST include all of these]
- White background, character only (no background elements)
- Full body or half body pose
- Art style: ${artStyleLabel}
- Children's picture book illustration style
- No background (white background only)

Rules:
- Output ONLY the enhanced English prompt. No other text.
- MUST include: white background, character only, full body or half body
- MUST include the art style: ${artStyleLabel}
- MUST include: children's book illustration style
- Keep it appropriate for children's book illustration
- Include details about pose and expression
- Make the character warm and appealing
- Do NOT include any violent or scary elements
- Do NOT include any background elements`,
        },
        {
          role: 'user',
          content: `Character: ${character_name}
Appearance: ${appearance_description}
Art Style: ${styleDesc}
Story Context: ${story_context}

Generate an enhanced image prompt for this character. Output English prompt only, no other text.`,
        },
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 300,
      }
    );

    return Response.json({ enhanced_prompt: result });
  } catch (error) {
    console.error('Character enhancement error:', error);
    return Response.json(
      { error: 'Failed to enhance character prompt' },
      { status: 500 }
    );
  }
}
