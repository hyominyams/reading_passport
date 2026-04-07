import { NextRequest } from 'next/server';
import openai from '@/lib/ai/openai';

export async function POST(request: NextRequest) {
  try {
    const { prompt, character_refs } = await request.json();

    // Build the full prompt with character refs if available
    let fullPrompt = prompt;
    if (character_refs && character_refs.length > 0) {
      const refDescs = character_refs
        .map((ref: { name: string; imageUrl: string }) => `${ref.name}`)
        .join(', ');
      fullPrompt = `${prompt}\nConsistently depict these characters: ${refDescs}`;
    }

    // Use DALL-E 3 for image generation
    // In production, this would be replaced with Nanobanana2 API
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Children's book illustration: ${fullPrompt}. Style: warm, friendly, appropriate for elementary school students.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      return Response.json(
        { error: 'No image generated' },
        { status: 500 }
      );
    }

    return Response.json({ image_url: imageUrl });
  } catch (error) {
    console.error('Image generation error:', error);
    return Response.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}
