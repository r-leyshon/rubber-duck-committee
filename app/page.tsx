'use client'

import { useState } from 'react'
import Image from 'next/image'
import { PersonaPanel } from '@/components/persona-config'
import { CommitteeView } from '@/components/committee-view'
import { InputPanel } from '@/components/input-panel'
import { Button } from '@/components/ui/button'
import { useCommittee } from '@/hooks/use-committee'
import { DEFAULT_PERSONAS } from '@/lib/types'
import type { DuckPersona } from '@/lib/types'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function RubberDuckCommittee() {
  const [personas, setPersonas] = useState<DuckPersona[]>(DEFAULT_PERSONAS)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const {
    messages,
    activeDucks,
    currentPhase,
    votingResult,
    isProcessing,
    submitToCommittee,
    initiateVoting,
    resetSession,
  } = useCommittee({ personas })

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant={isPanelOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="gap-1.5"
          >
            <Image
              src="/icons/multi-duck-icon-32.png"
              alt="Duck Personas"
              width={20}
              height={20}
              className="brightness-0 invert"
            />
            <span className="hidden sm:inline">Personas</span>
            <ChevronRight className={cn(
              "h-3.5 w-3.5 transition-transform",
              isPanelOpen && "rotate-180"
            )} />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-duck-analytical via-duck-creative to-duck-pragmatic flex items-center justify-center overflow-hidden p-1">
              <Image
                src="/icons/multi-duck-icon-64.png"
                alt="Duck Committee"
                width={28}
                height={28}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="font-semibold text-foreground text-sm">
                Duck Committee
              </h1>
              <p className="text-xs text-muted-foreground">
                Rubber duck debugging, evolved
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded bg-secondary">
            {personas.length} ducks
          </span>
          <span className="px-2 py-1 rounded bg-secondary">
            Vertex AI
          </span>
        </div>
      </header>

      {/* Persona configuration panel */}
      <PersonaPanel
        personas={personas}
        onUpdatePersonas={setPersonas}
        isOpen={isPanelOpen}
        onToggle={() => setIsPanelOpen(!isPanelOpen)}
      />

      {/* Main content */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden transition-all duration-300',
          isPanelOpen && 'ml-80'
        )}
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <CommitteeView
            personas={personas}
            messages={messages}
            activeDucks={activeDucks}
            currentPhase={currentPhase}
            votingResult={votingResult}
            isProcessing={isProcessing}
            onInitiateVoting={initiateVoting}
            onReset={resetSession}
            onAnswerSubmit={submitToCommittee}
          />
        )}

        {/* Input panel */}
        <InputPanel
          onSubmit={submitToCommittee}
          isProcessing={isProcessing}
          placeholder={
            currentPhase === 'exploring'
              ? 'Describe your problem to the duck committee...'
              : currentPhase === 'proposing'
                ? 'Add more context or details...'
                : currentPhase === 'concluded'
                  ? 'Ask follow-up questions about the solution or voting...'
                  : 'Add more context or details...'
          }
        />
      </main>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-8 overflow-auto">
      <div className="max-w-md text-center space-y-6">
        <div className="flex justify-center gap-4">
          <DuckAvatar color="duck-analytical" delay={0} />
          <DuckAvatar color="duck-creative" delay={100} />
          <DuckAvatar color="duck-pragmatic" delay={200} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Welcome to the Duck Committee
          </h2>
          <p className="text-muted-foreground">
            Describe your programming problem below. Three unique rubber duck
            personas will analyze it from different perspectives, then vote on
            the best solution.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <FeatureCard
            title="Independent Analysis"
            description="Each duck thinks separately to avoid groupthink"
          />
          <FeatureCard
            title="Transparent Reasoning"
            description="See the chain of thought behind each response"
          />
          <FeatureCard
            title="Democratic Voting"
            description="Ducks vote to select the best solution"
          />
        </div>
      </div>
    </div>
  )
}

function DuckAvatar({ color, delay }: { color: string; delay: number }) {
  return (
    <div
      className={cn(
        'h-16 w-16 rounded-full flex items-center justify-center animate-bounce overflow-hidden',
        `bg-${color}`
      )}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: '2s',
      }}
    >
      <Image
        src="/icons/duck-icon-64.png"
        alt="Duck"
        width={48}
        height={48}
        className="object-cover"
      />
    </div>
  )
}

function FeatureCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="p-4 rounded-lg bg-card border border-border">
      <h3 className="font-medium text-foreground text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
