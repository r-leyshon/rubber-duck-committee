'use client'

import { useRef, useEffect } from 'react'
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

  // Separate messages by type
  const userMessages = messages.filter((m) => m.role === 'user')
  const orchestratorMessages = messages.filter(
    (m) => m.participantId === 'orchestrator'
  )
  const duckMessages = messages.filter(
    (m) => m.role === 'duck' && m.participantId !== 'orchestrator'
  )

  // Check if we can vote
  const canVote =
    currentPhase === 'proposing' &&
    !isProcessing &&
    personas.every((p) => {
      const duckMsgs = messages.filter((m) => m.participantId === p.id)
      return duckMsgs.some((m) => m.suggestedSolution)
    })

  return (
    <div className="flex flex-col h-full">
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

      {/* Main content area */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* User messages at the top */}
          {userMessages.map((message) => (
            <div key={message.id} className="flex justify-center">
              <div className="max-w-2xl w-full">
                <MessageNode message={message} showConnector="bottom" />
              </div>
            </div>
          ))}

          {/* Diverging indicator */}
          {duckMessages.length > 0 && (
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
          )}

          {/* Duck streams in parallel */}
          {duckMessages.length > 0 && (
            <div className="flex justify-center gap-6 overflow-x-auto pb-4">
              {personas.map((persona) => (
                <DuckStream
                  key={persona.id}
                  duckId={persona.id}
                  duckName={persona.name}
                  messages={messages}
                  isActive={activeDucks.has(persona.id)}
                />
              ))}
            </div>
          )}

          {/* Converging indicator before orchestrator */}
          {orchestratorMessages.length > 0 && duckMessages.length > 0 && (
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
          )}

          {/* Orchestrator messages */}
          {orchestratorMessages.map((message) => (
            <div key={message.id} className="flex justify-center">
              <div className="max-w-2xl w-full">
                <MessageNode
                  message={message}
                  duckName="Orchestrator"
                  showConnector="top"
                />
              </div>
            </div>
          ))}

          {/* Voting results */}
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
        </div>
      </div>
    </div>
  )
}
