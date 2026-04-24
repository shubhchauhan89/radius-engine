export function parseAIJson(text: string): any {
  // Strip markdown code blocks (e.g., ```json ... ``` or just ``` ... ```)
  const cleanedText = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/, '').trim();
  
  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('[JSON Utils] Error parsing AI output:', cleanedText);
    throw new Error('Failed to parse AI output into JSON.');
  }
}
