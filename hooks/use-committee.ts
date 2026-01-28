'use client'

import { useState, useCallback } from 'react'
import type {
  DuckPersona,
  DuckPersonaId,
  CommitteeMessage,
  DuckResponse,
  VotingResult,
  ParticipantId,
  GroundingInfo,
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
      // If voting already completed, reset the voting state for a new round
      const isNewRoundAfterVoting = state.votingResult !== null
      
      setState((prev) => ({ 
        ...prev, 
        isProcessing: true,
        // Reset voting state if starting a new round after previous voting concluded
        ...(isNewRoundAfterVoting && {
          votingResult: null,
          currentPhase: 'exploring',
        }),
      }))

      // Add user message
      addMessage('user', 'user', userMessage)

      // Fire off parallel requests to all ducks
      const duckPromises = personas.map(async (persona) => {
        // Build conversation history for THIS specific duck
        // Include: user messages, orchestrator messages, and THIS duck's own previous responses
        const duckSpecificHistory = state.messages
          .filter((m) => 
            m.role === 'user' || 
            m.participantId === 'orchestrator' ||
            m.participantId === persona.id  // Include this duck's own previous responses
          )
          .map((m) => ({
            role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          }))
        
        // Append the current user message (not yet in state due to async update)
        const conversationHistory = [
          ...duckSpecificHistory,
          { role: 'user' as const, content: userMessage },
        ]
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
          
          // Track grounding metadata
          let groundingInfo: GroundingInfo | undefined = undefined

          // Helper function to process SSE lines
          const processLine = (line: string) => {
            const trimmed = line.trim()
            if (trimmed.startsWith('data:')) {
              const data = trimmed.slice(5).trim()
              if (data === '[DONE]') return
              try {
                const partialObject = JSON.parse(data)
                
                // Check if this is grounding metadata
                if (partialObject._groundingMetadata) {
                  groundingInfo = {
                    webSearchQueries: partialObject._groundingMetadata.webSearchQueries || [],
                    wasGrounded: partialObject._groundingMetadata.wasGrounded || false,
                  }
                  return
                }
                
                latestObject = partialObject
                
                // Update message in real-time with the analysis content
                const content = partialObject.analysis || ''
                const chainOfThought = (partialObject.thinking || []).map(
                  (t: { step: number; thought: string }) => ({
                    step: t.step,
                    thought: t.thought,
                    reasoning: '',
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

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              processLine(line)
            }
          }
          
          // Process any remaining data in buffer after stream ends
          if (buffer.trim()) {
            processLine(buffer)
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

          // Update the message with final content and grounding info
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
                    groundingInfo,
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
            groundingInfo,
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

      // Now get orchestrator summary (structured output)
      let shouldInitiateVoting = false
      
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
            }))
          }),
        })

        if (orchestratorResponse.ok && orchestratorResponse.body) {
          const reader = orchestratorResponse.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          
          // Track the latest partial object from Chair Duck
          let latestChairObject: {
            status?: 'needs-context' | 'ready-to-vote' | 'in-progress'
            message?: string
            questionsWithOptions?: Array<{ question: string; suggestedAnswers: string[] }>
          } = {}

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
                  const partialObject = JSON.parse(data)
                  latestChairObject = partialObject
                  
                  // Update message in real-time with the message content
                  const content = partialObject.message || ''
                  setState((prev) => ({
                    ...prev,
                    messages: prev.messages.map((m) =>
                      m.id === orchestratorMessage.id
                        ? { ...m, content }
                        : m
                    ),
                  }))
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }

          // Determine final status based on Chair Duck's structured response
          const chairStatus = latestChairObject.status || 'in-progress'
          const finalContent = latestChairObject.message || ''
          
          // Map Chair status to message status
          let messageStatus: 'complete' | 'needs-context' = 'complete'
          if (chairStatus === 'needs-context') {
            messageStatus = 'needs-context'
          }

          // Mark orchestrator message complete with appropriate status and questions
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === orchestratorMessage.id
                ? { 
                    ...m, 
                    content: finalContent, 
                    status: messageStatus,
                    questionsWithOptions: latestChairObject.questionsWithOptions,
                  }
                : m
            ),
          }))

          // Check if Chair Duck says we're ready to vote
          if (chairStatus === 'ready-to-vote') {
            shouldInitiateVoting = true
            setState((prev) => ({ ...prev, currentPhase: 'proposing' }))
          }
        }
      } catch (error) {
        console.error('[v0] Orchestrator error:', error)
      }

      setState((prev) => ({ ...prev, isProcessing: false }))

      // Auto-initiate voting if Chair Duck indicated ready
      if (shouldInitiateVoting) {
        // Add a brief delay for UX
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await initiateVotingInternal(duckResults)
      }
    },
    [personas, state.messages, state.currentPhase, addMessage, updateDuckStatus, initiateVotingInternal]
  )

  // Internal voting function that can be called with duck results directly
  async function initiateVotingInternal(duckResults: DuckResponse[]) {
    setState((prev) => ({ ...prev, currentPhase: 'voting', isProcessing: true }))

    // Add "Voting initiated" event message and capture its ID
    const eventMessage = addMessage('event', 'orchestrator', 'Voting initiated', { status: 'complete' })
    const eventMessageId = eventMessage.id

    const solutions = duckResults
      .filter((r) => r.suggestedSolution)
      .map((r) => ({
        duckId: r.duckId,
        duckName: personas.find((p) => p.id === r.duckId)?.name || r.duckId,
        solution: r.suggestedSolution!,
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
        
        // Update the event message with the voting result
        setState((prev) => ({
          ...prev,
          votingResult: result,
          currentPhase: 'concluded',
          // Attach voting result to the event message for historical access
          messages: prev.messages.map((m) =>
            m.id === eventMessageId
              ? { ...m, votingResult: result }
              : m
          ),
        }))

        // Add voting result message with the winning solution in the suggestedSolution box
        const winnerName = personas.find((p) => p.id === result.winner)?.name
        const winningSolution = solutions.find((s) => s.duckId === result.winner)?.solution || ''
        
        addMessage(
          'system',
          'orchestrator',
          `## Committee Decision

The committee has voted and **${winnerName}'s approach** has been selected as the recommended solution.${
            result.wasTiebreaker
              ? `\n\n*Chair Duck tiebreaker: ${result.tiebreakerReasoning}*`
              : ''
          }`,
          {
            suggestedSolution: winningSolution,
          }
        )
      }
    } catch (error) {
      console.error('[v0] Voting error:', error)
    }

    setState((prev) => ({ ...prev, isProcessing: false }))
  }

  // External voting function (for manual trigger if needed)
  const initiateVoting = useCallback(async () => {
    const duckResults = Array.from(state.duckResponses.values())
    await initiateVotingInternal(duckResults)
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
