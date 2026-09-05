import { streamObject, generateText } from 'ai'
import { z } from 'zod'
import type { DuckPersona } from '@/lib/types'
import { vertex, DEFAULT_MODEL, withModelFallback } from '@/lib/vertex'

// Common fields shared between both status types
const thinkingSchema = z.array(z.object({
  step: z.number().describe('Step number starting from 1'),
  thought: z.string().describe('What you are considering at this step'),
})).describe('Your chain of thought reasoning process, 2-4 steps')

const analysisSchema = z.string().describe(
  'Your main response to the user. Use markdown formatting. Be concise but thorough (2-4 paragraphs).'
)

// Discriminated union: status determines which fields are required
const duckResponseSchema = z.discriminatedUnion('status', [
  // When complete: suggestedSolution is REQUIRED
  z.object({
    status: z.literal('complete').describe('Set to "complete" when you can provide a full analysis and solution.'),
    thinking: thinkingSchema,
    analysis: analysisSchema,
    suggestedSolution: z.string().describe(
      'REQUIRED when status is "complete". A clear, actionable solution summarized in 2-5 bullet points or a short paragraph.'
    ),
    followUpQuestions: z.array(z.string()).optional(),
  }),
  // When needs-context: followUpQuestions is REQUIRED, suggestedSolution is optional
  z.object({
    status: z.literal('needs-context').describe('Set to "needs-context" when you need more information from the user.'),
    thinking: thinkingSchema,
    analysis: analysisSchema,
    followUpQuestions: z.array(z.string()).describe(
      'REQUIRED when status is "needs-context". Questions to ask the user for more details.'
    ),
    suggestedSolution: z.string().optional(),
  }),
])

export type DuckResponseType = z.infer<typeof duckResponseSchema>

// Type for grounding metadata from Google
interface GroundingMetadata {
  webSearchQueries?: string[]
  searchEntryPoint?: { renderedContent: string }
  groundingSupports?: Array<{
    segment: { startIndex: number; endIndex: number; text: string }
    groundingChunkIndices: number[]
    confidenceScores: number[]
  }>
  retrievalMetadata?: { webDynamicRetrievalScore: number }
}

export async function POST(req: Request) {
  const { 
    persona, 
    userMessage, 
    conversationHistory,
    orchestratorContext 
  }: {
    persona: DuckPersona
    userMessage: string
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
    orchestratorContext?: string
  } = await req.json()

  // Build system prompt with modes
  const modeInstructions = persona.enabledModes
    .map((mode) => {
      switch (mode) {
        case 'probing-questions':
          return '- Ask clarifying questions to understand the problem better'
        case 'root-cause-analysis':
          return '- Dig deep to identify the root cause, not just symptoms'
        case 'solution-brainstorm':
          return '- Generate multiple creative solutions'
        case 'code-review':
          return '- Review any code provided for bugs and improvements'
        case 'architecture-review':
          return '- Consider system design and architectural implications'
        case 'debugging':
          return '- Walk through the logic step by step to find issues'
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join('\n')

  // Track grounding results
  let groundingContext = ''
  let webSearchQueries: string[] = []
  let wasGrounded = false

  // STEP 1: If web search is enabled, first do a grounding call (text generation, no schema)
  if (persona.hasWebSearch) {
    try {
      const groundingPrompt = `You are a research assistant. The user has asked: "${userMessage}"

Search for current, relevant information to help answer this question. Provide a concise summary of what you find, including any relevant facts, documentation references, or current best practices. Focus on accuracy and recency.`

      // Use withModelFallback for resilience against deprecated models
      const groundingResult = await withModelFallback((modelId) =>
        generateText({
          model: vertex(modelId),
          prompt: groundingPrompt,
          providerOptions: {
            vertex: {
              googleSearchRetrieval: {
                dynamicRetrievalConfig: {
                  mode: 'MODE_DYNAMIC',
                  dynamicThreshold: 0.1,
                },
              },
            },
          },
        })
      )

      // Extract grounding metadata (cast to access experimental property)
      const providerMeta = (groundingResult as unknown as { 
        experimental_providerMetadata?: { google?: { groundingMetadata?: GroundingMetadata } }
      }).experimental_providerMetadata

      if (providerMeta?.google?.groundingMetadata) {
        const meta = providerMeta.google.groundingMetadata
        webSearchQueries = meta.webSearchQueries || []
      }

      // Use the grounded text as context for the structured response
      if (groundingResult.text && groundingResult.text.length > 0) {
        groundingContext = `\n\n## Web Search Results\nThe following information was found via web search:\n${groundingResult.text}`
        wasGrounded = true
      }
    } catch (error) {
      console.error(`[Web Search] Error for ${persona.name}:`, error)
      // Continue without grounding if it fails
    }
  }

  // Build system prompt with grounding context if available
  const webSearchNote = wasGrounded 
    ? `\n\n## Web Search\nYou performed a web search. Include "Web search performed" as one of your thinking steps and reference the search results in your analysis.`
    : ''

  const systemPrompt = `${persona.systemPrompt}

Your enabled modes for this session:
${modeInstructions}
${webSearchNote}

IMPORTANT: You are part of a rubber duck debugging committee. You work INDEPENDENTLY.
Your job is to help the user debug their problem through your unique perspective.

${orchestratorContext ? `Context from the orchestrator: ${orchestratorContext}` : ''}
${groundingContext}

## Response Guidelines

1. **Stay in character** - Respond according to your persona's personality
2. **Think step by step** - Show your reasoning in the "thinking" field (2-4 steps)
3. **Be concise** - Keep your analysis to 2-4 paragraphs
4. **Use markdown** - Format with **bold**, \`code\`, and bullet points

## CRITICAL: Status determines required fields

**If status = "complete":**
- You MUST provide suggestedSolution (2-5 bullet points or short paragraph)
- followUpQuestions is optional

**If status = "needs-context":**
- You MUST provide followUpQuestions (list of clarifying questions)
- suggestedSolution is optional

Choose "needs-context" when the problem is vague or missing key details.
Choose "complete" when you can provide a concrete, actionable solution.`

  // STEP 2: Generate structured response (with grounding context if available)
  const messages = conversationHistory

  // Use persona's model preference or default
  const modelId = persona.modelId || DEFAULT_MODEL
  const temperature = persona.temperature ?? 1.0

  const result = streamObject({
    model: vertex(modelId),
    schema: duckResponseSchema,
    system: systemPrompt,
    messages,
    temperature,
  })

  // Stream the object as newline-delimited JSON
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const partialObject of result.partialObjectStream) {
          const data = JSON.stringify(partialObject)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }
        
        // Send grounding metadata from Step 1 if we have it
        if (wasGrounded) {
          const groundingData = JSON.stringify({
            _groundingMetadata: {
              webSearchQueries,
              wasGrounded: true,
            }
          })
          controller.enqueue(encoder.encode(`data: ${groundingData}\n\n`))
        }
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        console.error('Stream error:', error)
        controller.error(error)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
