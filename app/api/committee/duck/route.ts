import { streamObject } from 'ai'
import { z } from 'zod'
import type { DuckPersona } from '@/lib/types'
import { vertex, DEFAULT_MODEL } from '@/lib/vertex'

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

  const systemPrompt = `${persona.systemPrompt}

Your enabled modes for this session:
${modeInstructions}

IMPORTANT: You are part of a rubber duck debugging committee. You work INDEPENDENTLY.
Your job is to help the user debug their problem through your unique perspective.

${orchestratorContext ? `Context from the orchestrator: ${orchestratorContext}` : ''}

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

  // conversationHistory already includes the current user message
  const messages = conversationHistory

  const result = streamObject({
    model: vertex(DEFAULT_MODEL),
    schema: duckResponseSchema,
    system: systemPrompt,
    messages,
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
