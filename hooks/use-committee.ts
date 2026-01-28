'use client'

import { useState, useCallback } from 'react'
import type {
  DuckPersona,
  DuckPersonaId,
  CommitteeMessage,
  DuckResponse,
  VotingResult,
  ParticipantId,
} from '@/lib/types'

interface UseCommitteeOptions {
  personas: DuckPersona[]
}

interface CommitteeState {
  messages: CommitteeMessage[]
  duckResponses: Map<DuckPersonaId, DuckResponse>
  currentPhase: 'exploring' | 'proposing' | 'voting' | 'concluded'
  votingResult: VotingResult | null
  isProcessing: boolean
  activeDucks: Set<DuckPersonaId>
}

export function useCommittee({ personas }: UseCommitteeOptions) {
  const [state, setState] = useState<CommitteeState>({
    messages: [],
    duckResponses: new Map(),
    currentPhase: 'exploring',
    votingResult: null,
    isProcessing: false,
    activeDucks: new Set(),
  })

  const addMessage = useCallback(
    (
      role: CommitteeMessage['role'],
      participantId: ParticipantId,
      content: string,
      extras?: Partial<CommitteeMessage>
    ) => {
      const newMessage: CommitteeMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role,
        participantId,
        content,
        timestamp: new Date(),
        status: 'complete',
        ...extras,
      }
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, newMessage],
      }))
      return newMessage
    },
    []
  )

  const updateDuckStatus = useCallback(
    (duckId: DuckPersonaId, status: 'thinking' | 'complete' | 'needs-context' | 'waiting') => {
      setState((prev) => {
        const newActiveDucks = new Set(prev.activeDucks)
        if (status === 'thinking') {
          newActiveDucks.add(duckId)
        } else {
          newActiveDucks.delete(duckId)
        }
        return { ...prev, activeDucks: newActiveDucks }
      })
    },
    []
  )

  const submitToCommittee = useCallback(
    async (userMessage: string) => {
      setState((prev) => ({ ...prev, isProcessing: true }))

      // Add user message
      addMessage('user', 'user', userMessage)

      // Get conversation history for context
      const conversationHistory = state.messages
        .filter((m) => m.role === 'user' || m.participantId === 'orchestrator')
        .map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        }))

      // Fire off parallel requests to all ducks
      const duckPromises = personas.map(async (persona) => {
        updateDuckStatus(persona.id, 'thinking')

        // Add thinking message
        const thinkingMessage = addMessage('duck', persona.id, '', {
          status: 'thinking',
        })

        try {
          const response = await fetch('/api/committee/duck', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              persona,
              userMessage,
              conversationHistory,
            }),
          })

          if (!response.ok) throw new Error('Duck API error')
          if (!response.body) throw new Error('No response body')

          // Parse SSE stream of partial objects
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          
          // Track the latest partial object
          let latestObject: {
            status?: 'complete' | 'needs-context'
            thinking?: Array<{ step: number; thought: string }>
            analysis?: string
            followUpQuestions?: string[]
            suggestedSolution?: string
          } = {}

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('data:')) {
                const data = trimmed.slice(5).trim()
                if (data === '[DONE]') continue
                try {
                  // Parse the partial object
                  const partialObject = JSON.parse(data)
                  latestObject = partialObject
                  
                  // Update message in real-time with the analysis content
                  const content = partialObject.analysis || ''
                  const chainOfThought = (partialObject.thinking || []).map(
                    (t: { step: number; thought: string }) => ({
                      step: t.step,
                      thought: t.thought,
                      reasoning: '', // We simplified the schema
                    })
                  )
                  
                  setState((prev) => ({
                    ...prev,
                    messages: prev.messages.map((m) =>
                      m.id === thinkingMessage.id
                        ? { 
                            ...m, 
                            content,
                            chainOfThought,
                            status: 'thinking',
                          }
                        : m
                    ),
                  }))
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }

          // Determine final status
          const finalStatus = latestObject.status || 'complete'
          const finalContent = latestObject.analysis || ''
          const chainOfThought = (latestObject.thinking || []).map(
            (t: { step: number; thought: string }) => ({
              step: t.step,
              thought: t.thought,
              reasoning: '',
            })
          )

          // Update the message with final content
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === thinkingMessage.id
                ? {
                    ...m,
                    content: finalContent,
                    chainOfThought,
                    status: finalStatus,
                    suggestedSolution: latestObject.suggestedSolution,
                  }
                : m
            ),
          }))

          const duckResponse: DuckResponse = {
            duckId: persona.id,
            content: finalContent,
            chainOfThought,
            status: finalStatus,
            followUpQuestions: latestObject.followUpQuestions,
            suggestedSolution: latestObject.suggestedSolution,
          }

          setState((prev) => {
            const newResponses = new Map(prev.duckResponses)
            newResponses.set(persona.id, duckResponse)
            return { ...prev, duckResponses: newResponses }
          })

          updateDuckStatus(persona.id, finalStatus)

          return duckResponse
        } catch (error) {
          console.error(`[v0] Error from ${persona.name}:`, error)
          updateDuckStatus(persona.id, 'complete')

          return {
            duckId: persona.id,
            content: 'I encountered an error processing your request.',
            chainOfThought: [],
            status: 'complete' as const,
          }
        }
      })

      // Wait for all ducks to respond
      const duckResults = await Promise.all(duckPromises)

      // Now get orchestrator summary
      try {
        const orchestratorResponse = await fetch('/api/committee/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage,
            duckResponses: duckResults.map((r) => ({
              duckId: r.duckId,
              duckName: personas.find((p) => p.id === r.duckId)?.name || r.duckId,
              content: r.content,
              status: r.status,
              followUpQuestions: r.followUpQuestions,
              suggestedSolution: r.suggestedSolution,
            })),
            conversationHistory,
            phase: state.currentPhase,
          }),
        })

        if (orchestratorResponse.ok && orchestratorResponse.body) {
          const reader = orchestratorResponse.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let orchestratorContent = ''

          const orchestratorMessage = addMessage('orchestrator', 'orchestrator', '', {
            status: 'thinking',
          })

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('data:')) {
                const data = trimmed.slice(5).trim()
                if (data === '[DONE]') continue
                try {
                  const chunk = JSON.parse(data)
                  if (chunk.type === 'text-delta' && chunk.delta) {
                    orchestratorContent += chunk.delta
                    // Update message in real-time
                    setState((prev) => ({
                      ...prev,
                      messages: prev.messages.map((m) =>
                        m.id === orchestratorMessage.id
                          ? { ...m, content: orchestratorContent }
                          : m
                      ),
                    }))
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }

          // Mark orchestrator message complete
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === orchestratorMessage.id
                ? { ...m, status: 'complete' }
                : m
            ),
          }))
        }
      } catch (error) {
        console.error('[v0] Orchestrator error:', error)
      }

      // Check if all ducks have solutions (move to voting phase)
      const allHaveSolutions = duckResults.every(
        (r) => r.suggestedSolution && r.status === 'complete'
      )

      if (allHaveSolutions) {
        setState((prev) => ({ ...prev, currentPhase: 'proposing' }))
      }

      setState((prev) => ({ ...prev, isProcessing: false }))
    },
    [personas, state.messages, state.currentPhase, addMessage, updateDuckStatus]
  )

  const initiateVoting = useCallback(async () => {
    setState((prev) => ({ ...prev, currentPhase: 'voting', isProcessing: true }))

    const solutions = Array.from(state.duckResponses.entries())
      .filter(([, response]) => response.suggestedSolution)
      .map(([duckId, response]) => ({
        duckId,
        duckName: personas.find((p) => p.id === duckId)?.name || duckId,
        solution: response.suggestedSolution!,
      }))

    const userProblem = state.messages.find((m) => m.role === 'user')?.content || ''

    try {
      const voteResponse = await fetch('/api/committee/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personas,
          solutions,
          userProblem,
        }),
      })

      if (voteResponse.ok) {
        const result: VotingResult = await voteResponse.json()
        setState((prev) => ({
          ...prev,
          votingResult: result,
          currentPhase: 'concluded',
        }))

        // Add voting result message
        const winnerName = personas.find((p) => p.id === result.winner)?.name
        addMessage(
          'system',
          'orchestrator',
          `The committee has voted! **${winnerName}'s solution** has been selected as the winning approach.${
            result.wasTiebreaker
              ? `\n\n(Tiebreaker: ${result.tiebreakerReasoning})`
              : ''
          }\n\nVoting breakdown:\n${result.votes
            .map((v) => {
              const voterName = personas.find((p) => p.id === v.voterId)?.name
              const votedForName = personas.find((p) => p.id === v.votedFor)?.name
              return `- ${voterName} voted for ${votedForName}: ${v.reasoning}`
            })
            .join('\n')}`
        )
      }
    } catch (error) {
      console.error('[v0] Voting error:', error)
    }

    setState((prev) => ({ ...prev, isProcessing: false }))
  }, [state.duckResponses, state.messages, personas, addMessage])

  const resetSession = useCallback(() => {
    setState({
      messages: [],
      duckResponses: new Map(),
      currentPhase: 'exploring',
      votingResult: null,
      isProcessing: false,
      activeDucks: new Set(),
    })
  }, [])

  return {
    ...state,
    submitToCommittee,
    initiateVoting,
    resetSession,
  }
}
