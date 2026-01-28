import { streamText } from 'ai'
import { vertex, DEFAULT_MODEL } from '@/lib/vertex'

export async function POST(req: Request) {
  const {
    userMessage,
    duckResponses,
    phase,
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
    phase: 'exploring' | 'proposing' | 'concluded'
  } = await req.json()

  // Analyze the committee's state
  const needsContext = duckResponses.filter((r) => r.status === 'needs-context')
  const complete = duckResponses.filter((r) => r.status === 'complete')
  const allHaveSolutions = duckResponses.every((r) => r.suggestedSolution)

  // Collect all follow-up questions from ducks that need context
  const allQuestions = needsContext.flatMap((r) => r.followUpQuestions || [])
  
  // Build a concise context for the Chair
  let situationContext = ''
  if (needsContext.length > 0) {
    situationContext = `${needsContext.length} of ${duckResponses.length} committee members need more context.
    
Their questions:
${allQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
`
  } else if (allHaveSolutions) {
    situationContext = `All committee members have proposed solutions. The committee is ready to vote.`
  } else {
    situationContext = `${complete.length} of ${duckResponses.length} committee members have completed their analysis.`
  }

  const systemPrompt = `You are Chair Duck - the moderator of the rubber duck debugging committee.

Your role is BRIEF and FOCUSED. You do NOT summarize or repeat what the committee members said.

## Your ONLY responsibilities:

1. **If members need context**: Present the consolidated questions to the user in a clear, numbered list. Be brief - just say the committee needs more information and list the questions.

2. **If all members have solutions**: Simply state that the committee is ready to vote. Do not summarize the solutions.

3. **Never repeat or summarize** what individual committee members said - the user can see their responses directly.

## Current Situation:
${situationContext}

## Response Format:
- Keep it to 2-3 sentences maximum, plus any questions if needed
- Be direct and professional
- Do NOT say things like "Here's what the committee said..." or "Let me summarize..."
- Just give the outcome and next step`

  const messages = [
    {
      role: 'user' as const,
      content: `The user asked: "${userMessage}"\n\nProvide a brief status update.`,
    },
  ]

  const result = streamText({
    model: vertex(DEFAULT_MODEL),
    system: systemPrompt,
    messages,
  })

  return result.toUIMessageStreamResponse()
}
