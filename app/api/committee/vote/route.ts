import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { DuckPersona, DuckPersonaId, Vote, VotingResult } from '@/lib/types'
import { vertex, DEFAULT_MODEL } from '@/lib/vertex'

// Structured output schema for voting
const voteSchema = z.object({
  votedFor: z.enum(['analytical', 'creative', 'pragmatic']).describe('The ID of the duck whose solution you are voting for'),
  reasoning: z.string().describe('Explanation for why this solution was chosen'),
})

export async function POST(req: Request) {
  const {
    personas,
    solutions,
    userProblem,
  }: {
    personas: DuckPersona[]
    solutions: Array<{
      duckId: DuckPersonaId
      duckName: string
      solution: string
    }>
    userProblem: string
  } = await req.json()

  // Each duck votes independently - they can see all solutions but vote based on their perspective
  const votes: Vote[] = []

  // Collect votes from each duck
  for (const persona of personas) {
    const solutionSummaries = solutions
      .map(
        (s) =>
          `**Solution from ${s.duckName}** (ID: ${s.duckId}):\n${s.solution}`
      )
      .join('\n\n---\n\n')

    const { output } = await generateText({
      model: vertex(DEFAULT_MODEL),
      output: Output.object({ schema: voteSchema }),
      prompt: `You are ${persona.name}, evaluating solutions proposed by the rubber duck debugging committee.

The user's problem: ${userProblem}

The proposed solutions:
${solutionSummaries}

Based on your perspective as ${persona.name} (${persona.description}), vote for the solution you believe is the BEST approach.

You CANNOT vote for your own solution if you proposed one. Consider:
- Effectiveness: Will this actually solve the problem?
- Practicality: Is this feasible to implement?
- Completeness: Does this address all aspects of the problem?

Cast your vote.`,
    })

    if (output) {
      votes.push({
        voterId: persona.id,
        votedFor: output.votedFor as DuckPersonaId,
        reasoning: output.reasoning,
      })
    }
  }

  // Tally votes
  const voteCounts: Record<DuckPersonaId, number> = {
    analytical: 0,
    creative: 0,
    pragmatic: 0,
  }

  for (const vote of votes) {
    voteCounts[vote.votedFor]++
  }

  // Find winner(s)
  const maxVotes = Math.max(...Object.values(voteCounts))
  const winners = (Object.entries(voteCounts) as [DuckPersonaId, number][])
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id)

  let winner: DuckPersonaId
  let wasTiebreaker = false
  let tiebreakerReasoning: string | undefined

  if (winners.length === 1) {
    winner = winners[0]
  } else {
    // Tiebreaker: Orchestrator decides
    wasTiebreaker = true

    const tiedSolutions = solutions
      .filter((s) => winners.includes(s.duckId))
      .map((s) => `**${s.duckName}**: ${s.solution}`)
      .join('\n\n')

    const { output: tiebreakerOutput } = await generateText({
      model: vertex(DEFAULT_MODEL),
      output: Output.object({
        schema: z.object({
          winner: z.enum(['analytical', 'creative', 'pragmatic']),
          reasoning: z.string(),
        }),
      }),
      prompt: `You are the Orchestrator Duck, breaking a tie in the voting.

The user's problem: ${userProblem}

The tied solutions:
${tiedSolutions}

Vote counts: ${JSON.stringify(voteCounts)}

As the neutral moderator, decide which solution should win. Consider the user's original problem and which solution best addresses their needs.`,
    })

    if (tiebreakerOutput) {
      winner = tiebreakerOutput.winner as DuckPersonaId
      tiebreakerReasoning = tiebreakerOutput.reasoning
    } else {
      // Fallback: pick first winner
      winner = winners[0]
    }
  }

  const result: VotingResult = {
    votes,
    winner,
    wasTiebreaker,
    tiebreakerReasoning,
  }

  return Response.json(result)
}
