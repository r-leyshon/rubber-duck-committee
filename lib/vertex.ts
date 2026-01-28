import { createVertex } from '@ai-sdk/google-vertex'

/**
 * Google Vertex AI provider configuration for the Rubber Duck Committee.
 * 
 * Authentication:
 * - For local development: Set GOOGLE_APPLICATION_CREDENTIALS to the path of your service account JSON file
 * - For production (GCP): Uses Application Default Credentials automatically
 * - Alternative: Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY environment variables
 * 
 * Required environment variables:
 * - GOOGLE_VERTEX_PROJECT: Your Google Cloud project ID
 * - GOOGLE_VERTEX_LOCATION: The GCP region (e.g., 'us-central1', 'europe-west1')
 * 
 * Authentication (choose one):
 * Option 1 - Service Account Key File:
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON file
 * 
 * Option 2 - Explicit Credentials:
 * - GOOGLE_CLIENT_EMAIL: Service account email
 * - GOOGLE_PRIVATE_KEY: Private key (with newlines as \n)
 */
export const vertex = createVertex({
  project: process.env.GOOGLE_VERTEX_PROJECT,
  location: process.env.GOOGLE_VERTEX_LOCATION ?? 'us-central1',
})

// Default model for text generation
export const DEFAULT_MODEL = 'gemini-2.0-flash-001'

// Model aliases for different use cases
export const MODELS = {
  fast: 'gemini-2.0-flash-001',
  pro: 'gemini-1.5-pro',
  flash: 'gemini-1.5-flash',
} as const
