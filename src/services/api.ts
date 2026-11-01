
// ---------------- AI BEDSHEET DESCRIPTION GENERATOR API ---------------- //

export interface AiDescriptionPayload {
  name?: string;
  fabric?: string;
  colorTone?: string;
  pattern?: string;
  dimensions?: string;
  threadCount?: string;
  pillowCovers?: string;
  collection?: string;
  features?: string[];
  style?: 'elegant' | 'luxurious' | 'minimal' | 'detailed';
  customNotes?: string;
  imageUrl?: string;
}

export interface AiDescriptionResult {
  success: boolean;
  description: string;
  source: 'gemini' | 'atelier_engine';
  style: string;
  model?: string;
  warnings?: string;
  error?: string;
}

export async function generateProductDescriptionApi(
  payload: AiDescriptionPayload
): Promise<AiDescriptionResult> {
  const response = await fetch('/api/ai/generate-description', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Description generation failed (${response.status})`
    );
  }

  if (!data.description) {
    throw new Error('Gemini returned an empty description.');
  }

  return data as AiDescriptionResult;
}
