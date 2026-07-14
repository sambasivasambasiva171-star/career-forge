import OpenAI from 'openai'

let _nimClient: OpenAI | null = null

/** Fallback when the API response has no `usage` field: ~4 chars/token. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// UNVERIFIED — NVIDIA NIM does not publish a stable per-model price sheet.
// These are placeholders for relative cost trending in logs only; do not
// use them for actual billing decisions without confirming current pricing.
const ESTIMATED_INPUT_COST_PER_1M_TOKENS = 0.25
const ESTIMATED_OUTPUT_COST_PER_1M_TOKENS = 0.75

function getNimClient(): OpenAI {
  if (!_nimClient) {
    const apiKey = process.env.NVIDIA_NIM_API_KEY
    if (!apiKey) {
      throw new Error(
        'NVIDIA_NIM_API_KEY is required. Set it in your environment variables or .env.local'
      )
    }
    _nimClient = new OpenAI({
      apiKey,
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
  const content = completion.choices[0]?.message?.content

  // Prefer the API's own token count; only estimate if the response omits it.
  const usage = completion.usage
  const inputTokens = usage?.prompt_tokens ?? estimateTokens(systemPrompt + userPrompt)
  const outputTokens = usage?.completion_tokens ?? estimateTokens(content ?? '')
  const estimatedCost =
    (inputTokens / 1_000_000) * ESTIMATED_INPUT_COST_PER_1M_TOKENS +
    (outputTokens / 1_000_000) * ESTIMATED_OUTPUT_COST_PER_1M_TOKENS

  console.log(
    `[AI_USAGE] Model: ${NIM_MODEL}, Duration: ${duration}ms, Tokens: ${inputTokens + outputTokens} ` +
    `(in: ${inputTokens}, out: ${outputTokens}, source: ${usage ? 'api' : 'estimated'}), ` +
    `EstCost: $${estimatedCost.toFixed(6)} (UNVERIFIED pricing — see comment above)`
  )

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
