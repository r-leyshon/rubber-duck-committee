'use client'

import { useRef, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { DuckStream, MessageNode } from './message-node'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Vote, RotateCcw, Trophy } from 'lucide-react'
import type { DuckPersona, CommitteeMessage, DuckPersonaId, VotingResult } from '@/lib/types'

interface CommitteeViewProps {
  personas: DuckPersona[]
  messages: CommitteeMessage[]
  activeDucks: Set<DuckPersonaId>
  currentPhase: 'exploring' | 'proposing' | 'voting' | 'concluded'
  votingResult: VotingResult | null
  isProcessing: boolean
  onInitiateVoting: () => void
  onReset: () => void
}

const PHASE_LABELS = {
  exploring: 'Exploring Problem',
  proposing: 'Proposing Solutions',
  voting: 'Voting in Progress',
  concluded: 'Session Complete',
}

const PHASE_COLORS = {
  exploring: 'bg-status-thinking/20 text-status-thinking border-status-thinking/50',
  proposing: 'bg-status-waiting/20 text-status-waiting border-status-waiting/50',
  voting: 'bg-duck-analytical/20 text-duck-analytical border-duck-analytical/50',
  concluded: 'bg-status-complete/20 text-status-complete border-status-complete/50',
}

// A conversation round groups: user message -> duck responses -> orchestrator summary
interface ConversationRound {
  userMessage: CommitteeMessage
  duckMessages: CommitteeMessage[]
  orchestratorMessage: CommitteeMessage | null
}

export function CommitteeView({
  personas,
  messages,
  activeDucks,
  currentPhase,
  votingResult,
  isProcessing,
  onInitiateVoting,
  onReset,
}: CommitteeViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Group messages into conversation rounds using array indices (not timestamps)
  const rounds = useMemo(() => {
    const result: ConversationRound[] = []
    
    // Find indices of all user messages
    const userMsgIndices: number[] = []
    messages.forEach((m, idx) => {
      if (m.role === 'user') userMsgIndices.push(idx)
    })
    
    userMsgIndices.forEach((userMsgIdx, roundNum) => {
      const userMsg = messages[userMsgIdx]
      
      // Find the end boundary (next user message index, or end of array)
      const nextUserMsgIdx = userMsgIndices[roundNum + 1] ?? messages.length
      
      // Get all messages between this user message and the next
      const roundMessages = messages.slice(userMsgIdx + 1, nextUserMsgIdx)
      
      // Duck messages in this round
      const duckMsgs = roundMessages.filter(
        (m) => m.role === 'duck' && m.participantId !== 'orchestrator'
      )
      
      // Orchestrator message in this round (exclude system role which is voting result)
      const orchestratorMsg = roundMessages.find(
        (m) => m.participantId === 'orchestrator' && m.role !== 'system'
      )
      
      result.push({
        userMessage: userMsg,
        duckMessages: duckMsgs,
        orchestratorMessage: orchestratorMsg || null,
      })
    })
    
    return result
  }, [messages])

  // Find the final Chair Duck message (with voting results) - it's a 'system' role message
  const votingResultMessage = useMemo(() => {
    return messages.find((m) => m.role === 'system' && m.participantId === 'orchestrator')
  }, [messages])

  // Check if we can vote
  const canVote =
    currentPhase === 'proposing' &&
    !isProcessing &&
    personas.every((p) => {
      const duckMsgs = messages.filter((m) => m.participantId === p.id)
      return duckMsgs.some((m) => m.suggestedSolution)
    })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Phase indicator */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Badge className={cn('border', PHASE_COLORS[currentPhase])}>
            {PHASE_LABELS[currentPhase]}
          </Badge>
          {votingResult && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-orchestrator" />
              <span>
                Winner:{' '}
                <strong className="text-foreground">
                  {personas.find((p) => p.id === votingResult.winner)?.name}
                </strong>
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canVote && (
            <Button
              onClick={onInitiateVoting}
              disabled={isProcessing}
              className="gap-2"
            >
              <Vote className="h-4 w-4" />
              Start Voting
            </Button>
          )}
          <Button variant="outline" onClick={onReset} className="gap-2 bg-transparent">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Main content area - chronological conversation flow */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Render each conversation round in order */}
          {rounds.map((round, roundIdx) => (
            <div key={round.userMessage.id} className="space-y-8">
              {/* User message */}
              <div className="flex justify-center">
                <div className="max-w-2xl w-full">
                  <MessageNode 
                    message={round.userMessage} 
                    showConnector={round.duckMessages.length > 0 ? 'bottom' : undefined} 
                  />
                </div>
              </div>

              {/* Duck responses for this round */}
              {round.duckMessages.length > 0 && (
                <>
                  {/* Diverging indicator */}
                  <div className="relative h-12">
                    <svg
                      className="absolute inset-0 w-full h-full"
                      preserveAspectRatio="none"
                    >
                      <line
                        x1="50%"
                        y1="0"
                        x2="16.67%"
                        y2="100%"
                        stroke="var(--node-line)"
                        strokeWidth="1"
                      />
                      <line
                        x1="50%"
                        y1="0"
                        x2="50%"
                        y2="100%"
                        stroke="var(--node-line)"
                        strokeWidth="1"
                      />
                      <line
                        x1="50%"
                        y1="0"
                        x2="83.33%"
                        y2="100%"
                        stroke="var(--node-line)"
                        strokeWidth="1"
                      />
                    </svg>
                  </div>

                  {/* Duck streams in parallel for this round */}
                  <div className="flex justify-center gap-6 overflow-x-auto pb-4">
                    {personas.map((persona) => {
                      // Get only this round's messages for this duck
                      const roundDuckMessages = round.duckMessages.filter(
                        (m) => m.participantId === persona.id
                      )
                      if (roundDuckMessages.length === 0) return null
                      
                      return (
                        <div
                          key={persona.id}
                          className="min-w-[300px] max-w-[400px] flex-1"
                        >
                          {roundDuckMessages.map((message) => (
                            <MessageNode
                              key={message.id}
                              message={message}
                              duckName={persona.name}
                            />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Orchestrator message for this round */}
              {round.orchestratorMessage && round.duckMessages.length > 0 && (
                <>
                  {/* Converging indicator */}
                  <div className="relative h-12">
                    <svg
                      className="absolute inset-0 w-full h-full"
                      preserveAspectRatio="none"
                    >
                      <line
                        x1="16.67%"
                        y1="0"
                        x2="50%"
                        y2="100%"
                        stroke="var(--node-line)"
                        strokeWidth="1"
                      />
                      <line
                        x1="50%"
                        y1="0"
                        x2="50%"
                        y2="100%"
                        stroke="var(--node-line)"
                        strokeWidth="1"
                      />
                      <line
                        x1="83.33%"
                        y1="0"
                        x2="50%"
                        y2="100%"
                        stroke="var(--node-line)"
                        strokeWidth="1"
                      />
                    </svg>
                  </div>

                  <div className="flex justify-center">
                    <div className="max-w-2xl w-full">
                      <MessageNode
                        message={round.orchestratorMessage}
                        duckName="Chair Duck"
                        showConnector={roundIdx < rounds.length - 1 ? 'bottom' : undefined}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Voting results - shown after all rounds */}
          {votingResult && (
            <div className="flex justify-center">
              <div className="max-w-2xl w-full p-6 rounded-lg border border-orchestrator/50 bg-orchestrator/5">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-orchestrator" />
                  <h3 className="font-semibold text-foreground">
                    Voting Results
                  </h3>
                </div>
                <div className="space-y-3">
                  {votingResult.votes.map((vote, idx) => {
                    const voter = personas.find((p) => p.id === vote.voterId)
                    const votedFor = personas.find((p) => p.id === vote.votedFor)
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-3 text-sm"
                      >
                        <Badge variant="outline" className="shrink-0">
                          {voter?.name}
                        </Badge>
                        <span className="text-muted-foreground">voted for</span>
                        <Badge
                          className={cn(
                            'shrink-0',
                            vote.votedFor === votingResult.winner
                              ? 'bg-orchestrator text-background'
                              : ''
                          )}
                        >
                          {votedFor?.name}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
                {votingResult.wasTiebreaker && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      <strong>Tiebreaker:</strong>{' '}
                      {votingResult.tiebreakerReasoning}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chair Duck's final message with the winning solution */}
          {votingResultMessage && (
            <div className="flex justify-center">
              <div className="max-w-2xl w-full">
                <MessageNode
                  message={votingResultMessage}
                  duckName="Chair Duck"
                  showConnector="top"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
