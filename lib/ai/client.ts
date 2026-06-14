import OpenAI from 'openai'

export const nimClient = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY!,
  baseURL: process.env.NVIDIA_NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1',
})
