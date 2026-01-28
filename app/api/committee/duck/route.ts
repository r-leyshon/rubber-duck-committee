import { streamText, tool } from 'ai'
import { z } from 'zod'
import type { DuckPersona } from '@/lib/types'
import { vertex, DEFAULT_MODEL } from '@/lib/vertex'

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

  // Build tools based on persona configuration
  const webSearchTool = tool({
    description: 'Search the web for relevant information to help debug the problem',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }: { query: string }) => {
      // Simulated web search - in production, integrate with actual search API
      return {
        results: [
          {
            title: `Search results for: ${query}`,
            snippet: 'Relevant documentation and community discussions found.',
            url: 'https://example.com',
          },
        ],
      }
    },
  })

  const tools = persona.hasWebSearch ? { webSearch: webSearchTool } : undefined

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

IMPORTANT: You are part of a rubber duck debugging committee. You work INDEPENDENTLY - you do NOT have access to what other committee members are thinking. 
Your job is to help the user debug their problem through your unique perspective.

${orchestratorContext ? `Context from the orchestrator: ${orchestratorContext}` : ''}

## Response Guidelines

1. **Stay in character** - Respond according to your persona's personality and approach
2. **Be concise but thorough** - Aim for 2-4 paragraphs maximum
3. **Use markdown formatting** - Use **bold**, \`code\`, and bullet points for clarity
4. **Show your thinking** - Briefly explain your reasoning process
5. **End with either:**
   - Follow-up questions if you need more context, OR
   - A clear suggested approach/solution

Remember: Be helpful, be yourself, and help the user see their problem from a new angle.`

  // Build messages array
  const messages = [
    ...conversationHistory,
    { role: 'user' as const, content: userMessage },
  ]

  const result = streamText({
    model: vertex(DEFAULT_MODEL),
    system: systemPrompt,
    messages,
    tools,
  })

  return result.toUIMessageStreamResponse()
}
