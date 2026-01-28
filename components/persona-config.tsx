'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, Search, Settings2 } from 'lucide-react'
import type { DuckPersona, DuckMode } from '@/lib/types'
import { DUCK_MODES } from '@/lib/types'

interface PersonaConfigProps {
  persona: DuckPersona
  onUpdate: (persona: DuckPersona) => void
}

const PERSONA_COLORS: Record<string, string> = {
  'duck-analytical': 'bg-duck-analytical/20 border-duck-analytical/50 text-duck-analytical',
  'duck-creative': 'bg-duck-creative/20 border-duck-creative/50 text-duck-creative',
  'duck-pragmatic': 'bg-duck-pragmatic/20 border-duck-pragmatic/50 text-duck-pragmatic',
}

const PERSONA_ACCENT: Record<string, string> = {
  'duck-analytical': 'bg-duck-analytical',
  'duck-creative': 'bg-duck-creative',
  'duck-pragmatic': 'bg-duck-pragmatic',
}

export function PersonaConfig({ persona, onUpdate }: PersonaConfigProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState(persona.systemPrompt)

  const toggleMode = (mode: DuckMode) => {
    const newModes = persona.enabledModes.includes(mode)
      ? persona.enabledModes.filter((m) => m !== mode)
      : [...persona.enabledModes, mode]
    onUpdate({ ...persona, enabledModes: newModes })
  }

  const toggleWebSearch = () => {
    onUpdate({ ...persona, hasWebSearch: !persona.hasWebSearch })
  }

  const savePrompt = () => {
    onUpdate({ ...persona, systemPrompt: editedPrompt })
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all duration-200',
        PERSONA_COLORS[persona.color]
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center text-background font-bold text-lg',
              PERSONA_ACCENT[persona.color]
            )}
          >
            {persona.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{persona.name}</h3>
            <p className="text-xs text-muted-foreground">{persona.description}</p>
          </div>
        </div>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              <Settings2 className="h-4 w-4" />
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent className="mt-4 space-y-4">
          {/* Modes Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Enabled Modes
            </label>
            <div className="flex flex-wrap gap-2">
              {DUCK_MODES.map((mode) => (
                <Badge
                  key={mode.id}
                  variant={
                    persona.enabledModes.includes(mode.id)
                      ? 'default'
                      : 'outline'
                  }
                  className={cn(
                    'cursor-pointer transition-all',
                    persona.enabledModes.includes(mode.id)
                      ? PERSONA_ACCENT[persona.color]
                      : 'hover:bg-secondary'
                  )}
                  onClick={() => toggleMode(mode.id)}
                >
                  {mode.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Web Search Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium text-foreground">
                Web Search
              </label>
            </div>
            <Switch
              checked={persona.hasWebSearch}
              onCheckedChange={toggleWebSearch}
            />
          </div>

          {/* System Prompt Editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              System Prompt
            </label>
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="min-h-[200px] font-mono text-xs bg-background/50"
              placeholder="Enter system prompt..."
            />
            {editedPrompt !== persona.systemPrompt && (
              <div className="flex gap-2">
                <Button size="sm" onClick={savePrompt}>
                  Save Changes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditedPrompt(persona.systemPrompt)}
                >
                  Reset
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active modes preview */}
      {!isOpen && (
        <div className="mt-3 flex flex-wrap gap-1">
          {persona.enabledModes.slice(0, 3).map((mode) => (
            <Badge
              key={mode}
              variant="secondary"
              className="text-xs bg-background/30"
            >
              {DUCK_MODES.find((m) => m.id === mode)?.label}
            </Badge>
          ))}
          {persona.enabledModes.length > 3 && (
            <Badge variant="secondary" className="text-xs bg-background/30">
              +{persona.enabledModes.length - 3}
            </Badge>
          )}
          {persona.hasWebSearch && (
            <Badge variant="secondary" className="text-xs bg-background/30">
              <Search className="h-3 w-3 mr-1" />
              Web
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

interface PersonaPanelProps {
  personas: DuckPersona[]
  onUpdatePersonas: (personas: DuckPersona[]) => void
  isOpen: boolean
  onToggle: () => void
}

export function PersonaPanel({
  personas,
  onUpdatePersonas,
  isOpen,
  onToggle,
}: PersonaPanelProps) {
  const handleUpdatePersona = (updated: DuckPersona) => {
    onUpdatePersonas(
      personas.map((p) => (p.id === updated.id ? updated : p))
    )
  }

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full bg-card border-r border-border z-40 transition-all duration-300 overflow-hidden',
        isOpen ? 'w-80' : 'w-0'
      )}
    >
      <div className="h-full overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Duck Committee
          </h2>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            <ChevronDown className="h-4 w-4 rotate-90" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure your rubber duck personas for debugging sessions.
        </p>
        <div className="space-y-3">
          {personas.map((persona) => (
            <PersonaConfig
              key={persona.id}
              persona={persona}
              onUpdate={handleUpdatePersona}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}
