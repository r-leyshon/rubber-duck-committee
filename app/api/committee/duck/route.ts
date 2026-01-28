import { streamObject } from 'ai'
import { z } from 'zod'
import type { DuckPersona } from '@/lib/types'
import { vertex, DEFAULT_MODEL } from '@/lib/vertex'

// Simplified schema with descriptions to guide the model
const duckResponseSchema = z.object({
  status: z.enum(['complete', 'needs-context']).describe(
    'Set to "needs-context" if you need more information from the user to help them. Set to "complete" if you can provide a full analysis or solution.'
  ),
  thinking: z.array(z.object({
    step: z.number().describe('Step number starting from 1'),
    thought: z.string().describe('What you are considering at this step'),
  })).describe('Your chain of thought reasoning process, 2-4 steps'),
  analysis: z.string().describe(
    'Your main response to the user. Use markdown formatting. Be concise but thorough (2-4 paragraphs).'
  ),
  followUpQuestions: z.array(z.string()).optional().describe(
    'Questions to ask the user if you need more context. Only include if status is "needs-context".'
  ),
  suggestedSolution: z.string().optional().describe(
    'A clear suggested solution or approach. Only include if status is "complete" and you have a concrete recommendation.'
  ),
})

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
5. **Determine status carefully**:
   - Use "needs-context" if you need more information to help effectively
   - Use "complete" if you can provide a full analysis or solution
6. **If needs-context**: Include specific follow-up questions
7. **If complete**: Include a suggested solution when you have a concrete recommendation`

  // Build messages array with conversation history
  const messages = [
    ...conversationHistory,
    { role: 'user' as const, content: userMessage },
  ]

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
