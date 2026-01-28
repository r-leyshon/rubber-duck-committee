'use client'

import { useRef, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { MessageNode } from './message-node'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RotateCcw, Trophy, Vote } from 'lucide-react'
import type { DuckPersona, CommitteeMessage, DuckPersonaId, VotingResult, Vote as VoteType } from '@/lib/types'

// Reusable PersonaBadge component for consistent styling
function PersonaBadge({
  persona,
  variant = 'filled',
}: {
  persona: DuckPersona | undefined
  variant?: 'filled' | 'outline'
}) {
  if (!persona) return null
  
  const colorVar = `var(--${persona.color})`
  
  // Common base styles for all badges
  const baseClasses = 'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0'
  
  if (variant === 'outline') {
    return (
      <span
        className={baseClasses}
        style={{
          border: `2px solid ${colorVar}`,
          color: colorVar,
          backgroundColor: 'transparent',
        }}
      >
        {persona.name}
      </span>
    )
  }
  
  // Filled variant
  return (
    <span
      className={baseClasses}
      style={{
        backgroundColor: colorVar,
        border: `2px solid ${colorVar}`,
        color: 'var(--background)',
      }}
    >
      {persona.name}
    </span>
  )
}

interface CommitteeViewProps {
  personas: DuckPersona[]
  messages: CommitteeMessage[]
  activeDucks?: Set<DuckPersonaId>
  currentPhase: 'exploring' | 'proposing' | 'voting' | 'concluded'
  votingResult: VotingResult | null
  isProcessing: boolean
  onInitiateVoting?: () => void  // Optional - voting now auto-triggers
  onReset: () => void
  onAnswerSubmit?: (answers: string) => void  // For quick answer submission
}

// Voting block that occurred within a round
interface VotingBlock {
  eventMessage: CommitteeMessage
  resultMessage: CommitteeMessage | null
  votes: VoteType[]
  winner: string | null
  wasTiebreaker?: boolean
  tiebreakerReasoning?: string
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

// A conversation round groups: user message -> duck responses -> orchestrator summary -> optional voting
interface ConversationRound {
  userMessage: CommitteeMessage
  duckMessages: CommitteeMessage[]
  orchestratorMessage: CommitteeMessage | null
  votingBlock: VotingBlock | null  // Voting that occurred in this round
}

// Connector line component for visual flow
function ConnectorLine({ direction }: { direction: 'down' | 'converge' | 'diverge' }) {
  if (direction === 'down') {
    return (
      <div className="flex justify-center h-8">
        <div className="w-px bg-border" />
      </div>
    )
  }
  
  if (direction === 'diverge') {
    return (
      <div className="relative h-12">
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <line x1="50%" y1="0" x2="16.67%" y2="100%" stroke="var(--node-line)" strokeWidth="1" />
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="var(--node-line)" strokeWidth="1" />
          <line x1="50%" y1="0" x2="83.33%" y2="100%" stroke="var(--node-line)" strokeWidth="1" />
        </svg>
      </div>
    )
  }
  
  // converge
  return (
    <div className="relative h-12">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <line x1="16.67%" y1="0" x2="50%" y2="100%" stroke="var(--node-line)" strokeWidth="1" />
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="var(--node-line)" strokeWidth="1" />
        <line x1="83.33%" y1="0" x2="50%" y2="100%" stroke="var(--node-line)" strokeWidth="1" />
      </svg>
    </div>
  )
}

// Event node component for system events like "Voting initiated"
function EventNode({ content, icon }: { content: string; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <div className="px-4 py-2 rounded-full border border-orchestrator/50 bg-orchestrator/10 flex items-center gap-2">
        {icon || <Vote className="h-4 w-4 text-orchestrator" />}
        <span className="text-sm font-medium text-orchestrator">{content}</span>
      </div>
    </div>
  )
}

// Round display component to render a single conversation round
function RoundDisplay({
  round,
  personas,
  onAnswerSubmit,
  showNextConnector,
}: {
  round: ConversationRound
  personas: DuckPersona[]
  onAnswerSubmit?: (answers: string) => void
  showNextConnector: boolean
}) {
  return (
    <div className="space-y-6">
      {/* User message */}
      <div className="flex justify-center">
        <div className="max-w-2xl w-full">
          <MessageNode message={round.userMessage} />
        </div>
      </div>

      {/* Connector to duck responses */}
      {round.duckMessages.length > 0 && <ConnectorLine direction="diverge" />}

      {/* Duck responses for this round */}
      {round.duckMessages.length > 0 && (
        <div className="flex justify-center gap-6 overflow-x-auto pb-4">
          {personas.map((persona) => {
            const roundDuckMessages = round.duckMessages.filter(
              (m) => m.participantId === persona.id
            )
            if (roundDuckMessages.length === 0) return null

            return (
              <div
                key={persona.id}
                className="min-w-[300px] max-w-[400px] flex-1 overflow-hidden"
              >
                {roundDuckMessages.map((message) => (
                  <MessageNode
                    key={message.id}
                    message={message}
                    duckName={persona.name}
                    duckColor={persona.color}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Connector to orchestrator */}
      {round.orchestratorMessage && round.duckMessages.length > 0 && (
        <ConnectorLine direction="converge" />
      )}

      {/* Orchestrator message for this round */}
      {round.orchestratorMessage && (
        <div className="flex justify-center">
          <div className="max-w-2xl w-full">
            <MessageNode
              message={round.orchestratorMessage}
              duckName="Chair Duck"
              onAnswerSubmit={onAnswerSubmit}
            />
          </div>
        </div>
      )}

      {/* Voting block if this round triggered voting */}
      {round.votingBlock && (
        <>
          <ConnectorLine direction="down" />
          <EventNode content={round.votingBlock.eventMessage.content} />
          
          {/* Voting results */}
          {round.votingBlock.votes.length > 0 && (
            <>
              <ConnectorLine direction="down" />
              <div className="flex justify-center">
                <div className="max-w-2xl w-full p-6 rounded-lg border border-orchestrator/50 bg-orchestrator/5">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="h-5 w-5 text-orchestrator" />
                    <h3 className="font-semibold text-foreground">
                      Voting Results
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {round.votingBlock.votes.map((vote, idx) => {
                      const voter = personas.find((p) => p.id === vote.voterId)
                      const votedFor = personas.find((p) => p.id === vote.votedFor)
                      const voterColor = voter?.color ? `var(--${voter.color})` : 'var(--muted)'
                      return (
                        <div
                          key={idx}
                          className="rounded-lg border p-3"
                          style={{
                            borderColor: `color-mix(in oklch, ${voterColor} 40%, transparent)`,
                            backgroundColor: `color-mix(in oklch, ${voterColor} 5%, transparent)`,
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <PersonaBadge persona={voter} variant="outline" />
                            <span className="text-muted-foreground text-sm">voted for</span>
                            <PersonaBadge persona={votedFor} variant="filled" />
                          </div>
                          {vote.reasoning && (
                            <p className="text-sm text-muted-foreground pl-2 border-l-2 italic" style={{ borderColor: voterColor }}>
                              &ldquo;{vote.reasoning}&rdquo;
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {round.votingBlock.wasTiebreaker && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        <strong>Tiebreaker:</strong>{' '}
                        {round.votingBlock.tiebreakerReasoning}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Chair Duck's final message with the winning solution */}
          {round.votingBlock.resultMessage && (
            <>
              <ConnectorLine direction="down" />
              <div className="flex justify-center">
                <div className="max-w-2xl w-full">
                  <MessageNode
                    message={round.votingBlock.resultMessage}
                    duckName="Chair Duck"
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Connector to next round if there is one */}
      {showNextConnector && (round.orchestratorMessage || round.votingBlock) && (
        <ConnectorLine direction="down" />
      )}
    </div>
  )
}

export function CommitteeView({
  personas,
  messages,
  currentPhase,
  votingResult,
  isProcessing,
  onReset,
  onAnswerSubmit,
}: CommitteeViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Group messages into conversation rounds, including voting blocks within each round
  const rounds = useMemo(() => {
    const result: ConversationRound[] = []
    
    // Find indices of all user messages
    const userMsgIndices: number[] = []
    messages.forEach((m, idx) => {
      if (m.role === 'user') userMsgIndices.push(idx)
    })
    
    // Find all event messages (voting initiated)
    const eventMessages = messages.filter((m) => m.role === 'event')
    const eventMsgIds = new Set(eventMessages.map((m) => m.id))
    
    // Find all system messages (voting results)
    const systemMessages = messages.filter(
      (m) => m.role === 'system' && m.participantId === 'orchestrator'
    )
    
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
      
      // Orchestrator message in this round (exclude system and event roles)
      const orchestratorMsg = roundMessages.find(
        (m) => m.participantId === 'orchestrator' && m.role === 'orchestrator'
      )
      
      // Find voting event in this round
      const votingEventMsg = roundMessages.find((m) => eventMsgIds.has(m.id))
      
      // Find voting result in this round (system message after the event)
      const votingResultMsg = votingEventMsg
        ? roundMessages.find(
            (m) => m.role === 'system' && m.participantId === 'orchestrator'
          )
        : null
      
      // Build voting block if present
      let votingBlock: VotingBlock | null = null
      if (votingEventMsg) {
        // Get voting result from the event message itself (stored when voting completes)
        // This ensures historical voting rounds retain their results
        const storedResult = votingEventMsg.votingResult
        
        // Fall back to the current votingResult prop if this is the most recent/in-progress voting
        const effectiveResult = storedResult || (
          systemMessages.length > 0 && 
          votingResultMsg?.id === systemMessages[systemMessages.length - 1]?.id
            ? votingResult
            : null
        )
        
        votingBlock = {
          eventMessage: votingEventMsg,
          resultMessage: votingResultMsg || null,
          votes: effectiveResult?.votes || [],
          winner: effectiveResult?.winner || null,
          wasTiebreaker: effectiveResult?.wasTiebreaker || false,
          tiebreakerReasoning: effectiveResult?.tiebreakerReasoning,
        }
      }
      
      result.push({
        userMessage: userMsg,
        duckMessages: duckMsgs,
        orchestratorMessage: orchestratorMsg || null,
        votingBlock,
      })
    })
    
    return result
  }, [messages, votingResult])

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
          {isProcessing && currentPhase === 'voting' && (
            <Badge variant="outline" className="animate-pulse">
              Voting in progress...
            </Badge>
          )}
          <Button variant="outline" onClick={onReset} className="gap-2 bg-transparent">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Main content area - chronological conversation flow */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Render all rounds chronologically - voting blocks are embedded within each round */}
          {rounds.map((round, roundIdx) => (
            <RoundDisplay
              key={round.userMessage.id}
              round={round}
              personas={personas}
              onAnswerSubmit={onAnswerSubmit}
              showNextConnector={roundIdx < rounds.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
