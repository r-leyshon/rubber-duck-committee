'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ChevronDown, Loader2, CheckCircle2, HelpCircle, MessageSquare, Send, Search } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import ReactMarkdown from 'react-markdown'
import type { CommitteeMessage, ChainOfThought, DuckPersonaId, QuestionWithOptions, GroundingInfo } from '@/lib/types'

interface MessageNodeProps {
  message: CommitteeMessage
  duckName?: string
  duckColor?: string // CSS variable name like 'duck-cyan'
  showConnector?: 'top' | 'bottom' | 'both' | 'none'
  isConverging?: boolean
  onAnswerSubmit?: (answers: string) => void
}

// Fallback colors for orchestrator and user
const SPECIAL_COLORS: Record<string, { border: string; bg: string; accent: string }> = {
  orchestrator: {
    border: 'var(--orchestrator)',
    bg: 'color-mix(in oklch, var(--orchestrator) 5%, transparent)',
    accent: 'var(--orchestrator)',
  },
  user: {
    border: 'var(--primary)',
    bg: 'color-mix(in oklch, var(--primary) 5%, transparent)',
    accent: 'var(--primary)',
  },
}

// Participant colors for duck stream headers
const PARTICIPANT_COLORS: Record<DuckPersonaId, string> = {
  analytical: 'border-duck-analytical bg-duck-analytical/10 text-duck-analytical',
  creative: 'border-duck-creative bg-duck-creative/10 text-duck-creative',
  pragmatic: 'border-duck-pragmatic bg-duck-pragmatic/10 text-duck-pragmatic',
}

const PARTICIPANT_ACCENT: Record<DuckPersonaId, string> = {
  analytical: 'bg-duck-analytical',
  creative: 'bg-duck-creative',
  pragmatic: 'bg-duck-pragmatic',
}

const STATUS_ICONS = {
  thinking: <Loader2 className="h-4 w-4 animate-spin text-status-thinking" />,
  complete: <CheckCircle2 className="h-4 w-4 text-status-complete" />,
  'needs-context': <HelpCircle className="h-4 w-4 text-status-waiting" />,
  waiting: <Loader2 className="h-4 w-4 animate-pulse text-muted-foreground" />,
}

function ChainOfThoughtPanel({ 
  thoughts, 
  groundingInfo 
}: { 
  thoughts: ChainOfThought[]
  groundingInfo?: GroundingInfo 
}) {
  const [isOpen, setIsOpen] = useState(false)

  if ((!thoughts || thoughts.length === 0) && !groundingInfo?.wasGrounded) return null

  // Show web search badge if grounding was used (queries may be empty if metadata wasn't exposed)
  const hasWebSearch = groundingInfo?.wasGrounded === true

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-3">
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
        <span className="font-mono">
          Chain of Thought ({thoughts.length} steps)
          {hasWebSearch && (
            <span className="ml-2 inline-flex items-center gap-1 text-blue-400">
              <Search className="h-3 w-3" />
              Web Search
            </span>
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {/* Show web search indicator if grounding was used */}
        {hasWebSearch && (
          <div className="pl-4 border-l-2 border-blue-500/50 text-xs space-y-1 bg-blue-500/5 rounded-r-md py-2 pr-2">
            <div className="font-medium text-blue-400 flex items-center gap-1">
              <Search className="h-3 w-3" />
              Web Search Used
            </div>
            {groundingInfo && groundingInfo.webSearchQueries.length > 0 ? (
              <ul className="text-foreground/80 space-y-1">
                {groundingInfo.webSearchQueries.map((query, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-muted-foreground">•</span>
                    <span className="italic">&ldquo;{query}&rdquo;</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-foreground/60">Real-time web content was used to inform this response.</p>
            )}
          </div>
        )}
        
        {thoughts.map((step, index) => (
          <div
            key={`step-${index}-${step.step}`}
            className="pl-4 border-l-2 border-node-line text-xs space-y-1"
          >
            <div className="font-medium text-muted-foreground">
              Step {step.step}
            </div>
            <div className="text-foreground/80">{step.thought}</div>
            {step.reasoning && (
              <div className="text-muted-foreground italic">{step.reasoning}</div>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

// Questions with multiple choice panel
function QuestionsPanel({ 
  questions, 
  onSubmit 
}: { 
  questions: QuestionWithOptions[]
  onSubmit?: (answers: string) => void 
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [freeTextAnswers, setFreeTextAnswers] = useState<Record<number, string>>({})
  const [showFreeText, setShowFreeText] = useState<Record<number, boolean>>({})

  if (!questions || questions.length === 0) return null

  const handleSelectAnswer = (questionIdx: number, answer: string) => {
    if (answer === 'Other (please specify)' || answer === 'Other' || answer === 'Not sure') {
      setShowFreeText((prev) => ({ ...prev, [questionIdx]: true }))
      setSelectedAnswers((prev) => ({ ...prev, [questionIdx]: '' }))
    } else {
      setShowFreeText((prev) => ({ ...prev, [questionIdx]: false }))
      setSelectedAnswers((prev) => ({ ...prev, [questionIdx]: answer }))
      setFreeTextAnswers((prev) => ({ ...prev, [questionIdx]: '' }))
    }
  }

  const handleFreeTextChange = (questionIdx: number, text: string) => {
    setFreeTextAnswers((prev) => ({ ...prev, [questionIdx]: text }))
    setSelectedAnswers((prev) => ({ ...prev, [questionIdx]: text }))
  }

  const handleSubmit = () => {
    if (!onSubmit) return
    
    // Compile answers into a formatted response
    const answersText = questions
      .map((q, idx) => {
        const answer = selectedAnswers[idx]
        if (!answer) return null
        return `**${q.question}**\n${answer}`
      })
      .filter(Boolean)
      .join('\n\n')
    
    if (answersText) {
      onSubmit(answersText)
    }
  }

  const hasAnyAnswers = Object.values(selectedAnswers).some((a) => a && a.trim())

  return (
    <div className="mt-4 p-4 rounded-lg bg-status-waiting/10 border border-status-waiting/30 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-status-waiting">
        <MessageSquare className="h-4 w-4" />
        Quick Answers
      </div>
      
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="space-y-2">
          <div className="text-sm font-medium text-foreground">{q.question}</div>
          <div className="flex flex-wrap gap-2">
            {q.suggestedAnswers.map((answer, aIdx) => (
              <button
                key={aIdx}
                onClick={() => handleSelectAnswer(qIdx, answer)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-full border transition-all',
                  selectedAnswers[qIdx] === answer && !showFreeText[qIdx]
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card hover:bg-secondary border-border hover:border-primary/50'
                )}
              >
                {answer}
              </button>
            ))}
          </div>
          {showFreeText[qIdx] && (
            <Textarea
              placeholder="Type your answer..."
              value={freeTextAnswers[qIdx] || ''}
              onChange={(e) => handleFreeTextChange(qIdx, e.target.value)}
              className="mt-2 text-sm min-h-[60px]"
            />
          )}
        </div>
      ))}
      
      {hasAnyAnswers && onSubmit && (
        <Button onClick={handleSubmit} className="w-full gap-2">
          <Send className="h-4 w-4" />
          Submit Answers
        </Button>
      )}
    </div>
  )
}

export function MessageNode({
  message,
  duckName,
  duckColor,
  showConnector = 'none',
  isConverging = false,
  onAnswerSubmit,
}: MessageNodeProps) {
  const isOrchestrator = message.role === 'orchestrator' || message.participantId === 'orchestrator'
  const isUser = message.role === 'user'
  const isDuck = !isOrchestrator && !isUser
  const displayName =
    isUser
      ? 'You'
      : isOrchestrator
        ? 'Chair Duck'
        : duckName || message.participantId

  // Duck responses are collapsed by default (but Suggested Solution is always visible)
  const [isContentExpanded, setIsContentExpanded] = useState(!isDuck)

  // Determine colors based on participant type
  const getColors = () => {
    if (isUser) return SPECIAL_COLORS.user
    if (isOrchestrator) return SPECIAL_COLORS.orchestrator
    if (duckColor) {
      const colorVar = `var(--${duckColor})`
      return {
        border: colorVar,
        bg: `color-mix(in oklch, ${colorVar} 8%, transparent)`,
        accent: colorVar,
      }
    }
    // Fallback to primary
    return SPECIAL_COLORS.user
  }
  
  const colors = getColors()

  return (
    <div className="relative flex flex-col items-center h-full">
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

      {/* Message card - h-full to stretch to container */}
      <div
        className={cn(
          'w-full max-w-2xl rounded-lg border-2 p-4 transition-all duration-300 overflow-hidden flex flex-col',
          isDuck && 'h-full',
          message.status === 'thinking' && 'ring-1 ring-node-line-active animate-pulse'
        )}
        style={{
          borderColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: colors.accent }}
            >
              {message.role === 'user' ? (
                <span className="text-xs font-bold text-background">Y</span>
              ) : isOrchestrator ? (
                <Image
                  src="/icons/chair-duck-icon-32.png"
                  alt="Chair Duck"
                  width={24}
                  height={24}
                  className="object-cover"
                />
              ) : (
                <Image
                  src="/icons/duck-icon-32.png"
                  alt="Duck"
                  width={24}
                  height={24}
                  className="object-cover"
                />
              )}
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

        {/* Chain of thought expandable - appears above content */}
        {message.chainOfThought && message.chainOfThought.length > 0 && (
          <ChainOfThoughtPanel thoughts={message.chainOfThought} groundingInfo={message.groundingInfo} />
        )}

        {/* Content - collapsible for duck messages */}
        {isDuck && message.content ? (
          <Collapsible open={isContentExpanded} onOpenChange={setIsContentExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform',
                  isContentExpanded && 'rotate-180'
                )}
              />
              <span className="font-mono">
                {isContentExpanded ? 'Hide Analysis' : 'Show Analysis'}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="text-sm text-foreground/90 prose prose-sm prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:text-foreground prose-strong:text-foreground break-words overflow-hidden">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="text-sm text-foreground/90 prose prose-sm prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:text-foreground prose-strong:text-foreground break-words overflow-hidden">
            {message.content ? (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            ) : (
              <span className="text-muted-foreground italic">Thinking...</span>
            )}
          </div>
        )}

        {/* Suggested solution highlight - ALWAYS visible */}
        {message.suggestedSolution && (
          <div className="mt-3 p-3 rounded-md bg-status-complete/10 border border-status-complete/30">
            <div className="text-xs font-medium text-status-complete mb-1">
              Suggested Solution
            </div>
            <div className="text-sm text-foreground prose prose-sm prose-invert max-w-none break-words overflow-hidden">
              <ReactMarkdown>{message.suggestedSolution}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Questions with multiple choice for quick answers */}
        {message.questionsWithOptions && message.questionsWithOptions.length > 0 && (
          <QuestionsPanel 
            questions={message.questionsWithOptions} 
            onSubmit={onAnswerSubmit}
          />
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
              'h-5 w-5 rounded-full flex items-center justify-center overflow-hidden',
              PARTICIPANT_ACCENT[duckId]
            )}
          >
            <Image
              src="/icons/duck-icon-32.png"
              alt={duckName}
              width={20}
              height={20}
              className="object-cover"
            />
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
