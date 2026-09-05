import { createVertex } from '@ai-sdk/google-vertex'

/**
 * Google Vertex AI provider configuration for the Rubber Duck Committee.
 * 
 * Environment-aware authentication:
 * - Local development: Uses GOOGLE_APPLICATION_CREDENTIALS (file path)
 * - Production (Vercel): Uses GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
 * 
 * Required environment variables:
 * - GOOGLE_VERTEX_PROJECT: Your Google Cloud project ID
 * - GOOGLE_VERTEX_LOCATION: The GCP region (e.g., 'us-central1', 'europe-west1')
 * 
 * For local development:
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON file
 * 
 * For production (Vercel):
 * - GOOGLE_CLIENT_EMAIL: Service account email
 * - GOOGLE_PRIVATE_KEY: Private key (with newlines as \n)
 */

// Determine if we're in production (Vercel sets this automatically)
const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'

// Build auth options based on environment
const getAuthOptions = () => {
  if (isProduction && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    // Production: Use explicit credentials from environment variables
    return {
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    }
  }
  // Local development: Let the SDK use GOOGLE_APPLICATION_CREDENTIALS automatically
  return undefined
}

export const vertex = createVertex({
  project: process.env.GOOGLE_VERTEX_PROJECT,
  location: process.env.GOOGLE_VERTEX_LOCATION ?? 'us-central1',
  googleAuthOptions: getAuthOptions(),
})

/**
 * Default model for text generation.
 * Using gemini-3.5-flash as the stable default (GA, retires May 2027+).
 * 
 * Model lifecycle reference:
 * https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions
 */
export const DEFAULT_MODEL = 'gemini-3.5-flash'

// Model aliases for different use cases
// Updated September 2026 - Gemini 2.0 models were retired June 1, 2026
export const MODELS = {
  default: 'gemini-3.5-flash',      // GA, stable workhorse
  latest: 'gemini-3.8-flash',       // Latest GA with best performance
  lite: 'gemini-3.5-flash-lite',    // Cost-optimized
  legacy: 'gemini-2.5-flash',       // Fallback (retires Oct 2026)
} as const

// Ordered list of models to try if the primary fails
export const MODEL_FALLBACK_ORDER = [
  'gemini-3.5-flash',
  'gemini-3.8-flash', 
  'gemini-2.5-flash',
] as const

/**
 * Check if an error is a model-not-found error (404)
 */
function isModelNotFoundError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    return (error as { statusCode: number }).statusCode === 404
  }
  return false
}

/**
 * Execute an AI operation with automatic model fallback.
 * If the primary model fails with 404 (not found/deprecated), tries fallback models.
 * 
 * @param operation - Function that takes a model ID and returns a Promise
 * @param preferredModel - The model to try first (defaults to DEFAULT_MODEL)
 * @returns The result of the first successful operation
 * @throws The last error if all models fail
 * 
 * @example
 * const result = await withModelFallback(
 *   (modelId) => generateText({ model: vertex(modelId), prompt: "Hello" })
 * )
 */
export async function withModelFallback<T>(
  operation: (modelId: string) => Promise<T>,
  preferredModel: string = DEFAULT_MODEL
): Promise<T> {
  // Build ordered list: preferred model first, then fallbacks (excluding duplicates)
  const modelsToTry = [
    preferredModel,
    ...MODEL_FALLBACK_ORDER.filter(m => m !== preferredModel)
  ]

  let lastError: unknown

  for (const modelId of modelsToTry) {
    try {
      return await operation(modelId)
    } catch (error) {
      lastError = error
      
      if (isModelNotFoundError(error)) {
        console.warn(`Model ${modelId} not available, trying next fallback...`)
        continue
      }
      
      // For non-404 errors, don't try fallbacks - rethrow immediately
      throw error
    }
  }

  // All models failed
  console.error('All fallback models exhausted')
  throw lastError
}
