import OpenAI from 'openai'

export const nimClient = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY!,
  baseURL: process.env.NVIDIA_NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1',
})

export async function getCompletion({
  systemPrompt,
  userPrompt,
  temperature = 0.1,
  maxTokens = 2048,
}: {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
}): Promise<string> {
  const completion = await nimClient.chat.completions.create({
    model: process.env.NVIDIA_NIM_MODEL ?? 'meta/llama-3.1-70b-instruct',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from AI')
  return content
}

export function parseJsonResponse(response: string): unknown {
  // Strip markdown code fences defensively in case the model wraps output
  const cleaned = response
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  return JSON.parse(cleaned)
}
