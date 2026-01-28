import { streamObject } from 'ai'
import { z } from 'zod'
import { vertex, DEFAULT_MODEL } from '@/lib/vertex'

// Question with suggested answers for quick user input
const questionWithOptionsSchema = z.object({
  question: z.string().describe('The clarifying question'),
  suggestedAnswers: z.array(z.string()).describe(
    'Suggested quick answers the user can click (3-5 options). Make these practical and likely answers.'
  ),
})

// Structured output schema for Chair Duck
const chairResponseSchema = z.object({
  status: z.enum(['needs-context', 'ready-to-vote', 'in-progress']).describe(
    'Set to "needs-context" if committee members need more information. Set to "ready-to-vote" if all members have proposed solutions. Set to "in-progress" if analysis is ongoing.'
  ),
  message: z.string().describe(
    'A brief message to the user (1-2 sentences max). Keep it concise - questions will be shown separately.'
  ),
  questionsWithOptions: z.array(questionWithOptionsSchema).optional().describe(
    'Only include if status is "needs-context". Each question should have 3-5 suggested quick answers the user can click.'
  ),
})

export type ChairResponseType = z.infer<typeof chairResponseSchema>
export type QuestionWithOptions = z.infer<typeof questionWithOptionsSchema>

export async function POST(req: Request) {
  const {
    userMessage,
    duckResponses,
  }: {
    userMessage: string
    duckResponses: Array<{
      duckId: string
      duckName: string
      content: string
      status: string
      followUpQuestions?: string[]
      suggestedSolution?: string
    }>
  } = await req.json()

  // Analyze the committee's state to guide the model
  const needsContext = duckResponses.filter((r) => r.status === 'needs-context')
  const allHaveSolutions = duckResponses.every((r) => r.suggestedSolution)

  // Collect all follow-up questions from ducks that need context
  const allQuestions = needsContext.flatMap((r) => r.followUpQuestions || [])
  // Deduplicate similar questions
  const uniqueQuestions = [...new Set(allQuestions)]
  
  // Determine the expected status
  let expectedStatus = 'in-progress'
  if (needsContext.length > 0) {
    expectedStatus = 'needs-context'
  } else if (allHaveSolutions) {
    expectedStatus = 'ready-to-vote'
  }

  const systemPrompt = `You are Chair Duck - the moderator of the rubber duck debugging committee.

Your role is BRIEF and FOCUSED. You do NOT summarize or repeat what the committee members said.

## Current Committee State:
- Members needing context: ${needsContext.length}/${duckResponses.length}
- Members with solutions: ${duckResponses.filter(r => r.suggestedSolution).length}/${duckResponses.length}
${uniqueQuestions.length > 0 ? `- Questions raised:\n${uniqueQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}` : ''}

## Your Response:

Based on the committee state above, you MUST set status to "${expectedStatus}".

${expectedStatus === 'needs-context' ? `
Since members need context, you MUST:
1. Keep your message to ONE brief sentence (e.g., "The committee needs a few more details.")
2. Provide questionsWithOptions - consolidate the questions and for EACH question, suggest 3-5 practical multiple-choice answers the user can quickly click
3. Make suggested answers realistic and cover common scenarios
4. Always include a general option like "Other" or "Not sure" as the last option
` : ''}

${expectedStatus === 'ready-to-vote' ? `
Since all members have solutions, briefly announce that voting will now begin. Keep it to one sentence.
Do NOT summarize the solutions or mention voting patterns - the user can see these in the UI.
` : ''}

IMPORTANT:
- Keep your message to 1-2 sentences maximum
- Do NOT say things like "Here's what the committee said..." or summarize individual responses
- Do NOT describe voting patterns or who voted for whom - this is shown separately in the UI
- Be direct and professional`

  const messages = [
    {
      role: 'user' as const,
      content: `The user's question: "${userMessage}"`,
    },
  ]

  const result = streamObject({
    model: vertex(DEFAULT_MODEL),
    schema: chairResponseSchema,
    system: systemPrompt,
    messages,
  })

  // Stream the object as newline-delimited JSON (same format as duck route)
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
        console.error('Orchestrator stream error:', error)
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
