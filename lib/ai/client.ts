import OpenAI from 'openai'

let _nimClient: OpenAI | null = null

function getNimClient(): OpenAI {
  if (!_nimClient) {
    _nimClient = new OpenAI({
      apiKey: process.env.NVIDIA_NIM_API_KEY ?? 'placeholder-key',
      baseURL: process.env.NVIDIA_NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1',
    })
  }
  return _nimClient
}

export async function getCompletion({
  systemPrompt,
  userPrompt,
  temperature = 0.1,
  maxTokens = 2048,
  seed,
}: {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
  /** Fixed seed for deterministic output — same input always yields the same CV. */
  seed?: number
}): Promise<string> {
  const NIM_MODEL = process.env.NVIDIA_NIM_MODEL ?? 'meta/llama-3.1-70b-instruct'
  const startTime = Date.now()
  const completion = await getNimClient().chat.completions.create({
    model: NIM_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
    ...(seed !== undefined ? { seed } : {}),
  })
  const duration = Date.now() - startTime
  console.log(`[AI TIMING] Model: ${NIM_MODEL}, Duration: ${duration}ms`)
  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from AI')
  return content
}

export function parseJsonResponse<T = unknown>(response: string): T {
  const cleaned = response
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  return JSON.parse(cleaned) as T
}
