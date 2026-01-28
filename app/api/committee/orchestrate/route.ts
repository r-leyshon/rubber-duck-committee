import { streamText } from 'ai'
import { vertex, DEFAULT_MODEL } from '@/lib/vertex'

export async function POST(req: Request) {
  const {
    userMessage,
    duckResponses,
    conversationHistory,
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
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
    phase: 'exploring' | 'proposing' | 'concluded'
  } = await req.json()

  // Build context from duck responses
  const duckSummaries = duckResponses
    .map((r) => {
      let summary = `**${r.duckName}** (${r.status}):\n${r.content}`
      if (r.followUpQuestions && r.followUpQuestions.length > 0) {
        summary += `\n\nFollow-up questions:\n${r.followUpQuestions.map((q) => `- ${q}`).join('\n')}`
      }
      if (r.suggestedSolution) {
        summary += `\n\nSuggested solution: ${r.suggestedSolution}`
      }
      return summary
    })
    .join('\n\n---\n\n')

  const systemPrompt = `You are the Orchestrator Duck - the moderator of the rubber duck debugging committee. 
Your role is to synthesize the insights from the committee members and communicate clearly with the user.

Current phase: ${phase}

The committee members have provided their analysis:

${duckSummaries}

Your responsibilities:
1. Summarize the key insights from each committee member
2. Identify areas of agreement and disagreement
3. If committee members have follow-up questions, consolidate and present them clearly to the user
4. If the committee is ready to propose solutions, present the options
5. Guide the conversation toward a resolution

Be concise but thorough. Maintain a friendly, professional tone.
When presenting follow-up questions, group similar questions together and prioritize the most important ones.
When there are proposed solutions, present them clearly with pros and cons.

Do NOT make up information - only synthesize what the committee has provided.`

  const messages = [
    ...conversationHistory,
    {
      role: 'user' as const,
      content: `User message: "${userMessage}"\n\nPlease synthesize the committee's responses and guide the next step of the conversation.`,
    },
  ]

  const result = streamText({
    model: vertex(DEFAULT_MODEL),
    system: systemPrompt,
    messages,
  })

  return result.toUIMessageStreamResponse()
}
