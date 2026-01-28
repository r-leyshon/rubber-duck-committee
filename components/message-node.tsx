'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, Loader2, CheckCircle2, HelpCircle } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import ReactMarkdown from 'react-markdown'
import type { CommitteeMessage, ChainOfThought, DuckPersonaId } from '@/lib/types'

interface MessageNodeProps {
  message: CommitteeMessage
  duckName?: string
  showConnector?: 'top' | 'bottom' | 'both' | 'none'
  isConverging?: boolean
}

const PARTICIPANT_COLORS: Record<string, string> = {
  analytical: 'border-duck-analytical/50 bg-duck-analytical/5',
  creative: 'border-duck-creative/50 bg-duck-creative/5',
  pragmatic: 'border-duck-pragmatic/50 bg-duck-pragmatic/5',
  orchestrator: 'border-orchestrator/50 bg-orchestrator/5',
  user: 'border-primary/50 bg-primary/5',
}

const PARTICIPANT_ACCENT: Record<string, string> = {
  analytical: 'bg-duck-analytical',
  creative: 'bg-duck-creative',
  pragmatic: 'bg-duck-pragmatic',
  orchestrator: 'bg-orchestrator',
  user: 'bg-primary',
}

const STATUS_ICONS = {
  thinking: <Loader2 className="h-4 w-4 animate-spin text-status-thinking" />,
  complete: <CheckCircle2 className="h-4 w-4 text-status-complete" />,
  'needs-context': <HelpCircle className="h-4 w-4 text-status-waiting" />,
  waiting: <Loader2 className="h-4 w-4 animate-pulse text-muted-foreground" />,
}

function ChainOfThoughtPanel({ thoughts }: { thoughts: ChainOfThought[] }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!thoughts || thoughts.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
        <span className="font-mono">Chain of Thought ({thoughts.length} steps)</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {thoughts.map((step) => (
          <div
            key={step.step}
            className="pl-4 border-l-2 border-node-line text-xs space-y-1"
          >
            <div className="font-medium text-muted-foreground">
              Step {step.step}
            </div>
            <div className="text-foreground/80">{step.thought}</div>
            <div className="text-muted-foreground italic">{step.reasoning}</div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function MessageNode({
  message,
  duckName,
  showConnector = 'none',
  isConverging = false,
}: MessageNodeProps) {
  const participantKey = message.participantId as string
  const displayName =
    message.role === 'user'
      ? 'You'
      : message.role === 'orchestrator'
        ? 'Orchestrator'
        : duckName || message.participantId

  return (
    <div className="relative flex flex-col items-center">
      {/* Top connector line */}
      {(showConnector === 'top' || showConnector === 'both') && (
        <div
          className={cn(
            'w-px h-6 bg-node-line',
            message.status === 'thinking' && 'bg-node-line-active animate-pulse'
          )}
        />
      )}

      {/* Converging lines for orchestrator messages */}
      {isConverging && (
        <div className="relative w-full h-8 mb-2">
          <svg
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
          >
            <line
              x1="25%"
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
              x1="75%"
              y1="0"
              x2="50%"
              y2="100%"
              stroke="var(--node-line)"
              strokeWidth="1"
            />
          </svg>
        </div>
      )}

      {/* Message card */}
      <div
        className={cn(
          'w-full max-w-2xl rounded-lg border p-4 transition-all duration-300',
          PARTICIPANT_COLORS[participantKey],
          message.status === 'thinking' && 'ring-1 ring-node-line-active animate-pulse'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-background',
                PARTICIPANT_ACCENT[participantKey]
              )}
            >
              {displayName.charAt(0)}
            </div>
            <span className="font-medium text-sm text-foreground">
              {displayName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {STATUS_ICONS[message.status]}
            <span className="text-xs text-muted-foreground capitalize">
              {message.status === 'needs-context' ? 'Needs Context' : message.status}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="text-sm text-foreground/90 prose prose-sm prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:text-foreground prose-strong:text-foreground">
          {message.content ? (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          ) : (
            <span className="text-muted-foreground italic">Thinking...</span>
          )}
        </div>

        {/* Suggested solution highlight */}
        {message.suggestedSolution && (
          <div className="mt-3 p-3 rounded-md bg-status-complete/10 border border-status-complete/30">
            <div className="text-xs font-medium text-status-complete mb-1">
              Suggested Solution
            </div>
            <div className="text-sm text-foreground prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>{message.suggestedSolution}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Chain of thought expandable */}
        {message.chainOfThought && message.chainOfThought.length > 0 && (
          <ChainOfThoughtPanel thoughts={message.chainOfThought} />
        )}
      </div>

      {/* Bottom connector line */}
      {(showConnector === 'bottom' || showConnector === 'both') && (
        <div className="w-px h-6 bg-node-line" />
      )}
    </div>
  )
}

interface DuckStreamProps {
  duckId: DuckPersonaId
  duckName: string
  messages: CommitteeMessage[]
  isActive: boolean
}

export function DuckStream({ duckId, duckName, messages, isActive }: DuckStreamProps) {
  const duckMessages = messages.filter((m) => m.participantId === duckId)

  return (
    <div className="flex flex-col items-center min-w-[300px] max-w-[350px]">
      {/* Duck header */}
      <div
        className={cn(
          'px-4 py-2 rounded-full border text-sm font-medium mb-4 transition-all',
          PARTICIPANT_COLORS[duckId],
          isActive && 'ring-2 ring-node-line-active'
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold text-background',
              PARTICIPANT_ACCENT[duckId]
            )}
          >
            {duckName.charAt(0)}
          </div>
          <span>{duckName}</span>
          {isActive && (
            <Loader2 className="h-3 w-3 animate-spin text-status-thinking" />
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4 w-full">
        {duckMessages.map((message, idx) => (
          <MessageNode
            key={message.id}
            message={message}
            duckName={duckName}
            showConnector={
              idx === 0 ? 'bottom' : idx === duckMessages.length - 1 ? 'top' : 'both'
            }
          />
        ))}
        {duckMessages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Waiting for input...
          </div>
        )}
      </div>
    </div>
  )
}
