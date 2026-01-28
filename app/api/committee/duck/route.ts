import { streamText, tool, Output } from 'ai'
import { z } from 'zod'
import type { DuckPersona } from '@/lib/types'
import { vertex, DEFAULT_MODEL } from '@/lib/vertex'

// Schema for duck response with chain of thought
const duckResponseSchema = z.object({
  chainOfThought: z.array(
    z.object({
      step: z.number(),
      thought: z.string(),
      reasoning: z.string(),
    })
  ),
  status: z.enum(['thinking', 'complete', 'needs-context']),
  followUpQuestions: z.array(z.string()).nullable(),
  analysis: z.string(),
  suggestedSolution: z.string().nullable(),
})

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

You MUST structure your response with clear chain-of-thought reasoning. Think step by step and show your work.

Format your thinking as:
1. First, state what you understand about the problem
2. Then, explain your reasoning process
3. Either ask follow-up questions if you need more context, OR provide your analysis and suggested solution

Always be helpful, thorough, and true to your persona's character.`

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
    output: Output.object({
      schema: duckResponseSchema,
    }),
  })

  return result.toUIMessageStreamResponse()
}
