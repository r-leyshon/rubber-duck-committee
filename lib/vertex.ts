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

// Default model for text generation
export const DEFAULT_MODEL = 'gemini-2.0-flash-001'

// Model aliases for different use cases
export const MODELS = {
  default: 'gemini-2.0-flash-001',
  lite: 'gemini-2.0-flash-lite-001',
  pro: 'gemini-1.5-pro-002',
  flash: 'gemini-1.5-flash-002',
} as const
