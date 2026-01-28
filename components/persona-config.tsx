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
import { ChevronDown, Search, Pencil, Palette, Sparkles, Loader2 } from 'lucide-react'
import type { DuckPersona, DuckMode } from '@/lib/types'
import { DUCK_MODES } from '@/lib/types'

interface PersonaConfigProps {
  persona: DuckPersona
  onUpdate: (persona: DuckPersona) => void
}

// Expanded color palette
const COLOR_OPTIONS = [
  { id: 'duck-cyan', label: 'Cyan', hue: 200 },
  { id: 'duck-orange', label: 'Orange', hue: 45 },
  { id: 'duck-green', label: 'Green', hue: 145 },
  { id: 'duck-purple', label: 'Purple', hue: 300 },
  { id: 'duck-pink', label: 'Pink', hue: 350 },
  { id: 'duck-yellow', label: 'Yellow', hue: 90 },
  { id: 'duck-red', label: 'Red', hue: 25 },
  { id: 'duck-blue', label: 'Blue', hue: 260 },
  { id: 'duck-teal', label: 'Teal', hue: 180 },
  { id: 'duck-lime', label: 'Lime', hue: 125 },
  { id: 'duck-amber', label: 'Amber', hue: 70 },
  { id: 'duck-indigo', label: 'Indigo', hue: 280 },
]

// Extract key traits from system prompt for preview
function PersonaTraitsPreview({ systemPrompt }: { systemPrompt: string }) {
  const extractField = (field: string): string | null => {
    const regex = new RegExp(`\\*\\*${field}\\*\\*:\\s*(.+?)(?:\\n|$)`, 'i')
    const match = systemPrompt.match(regex)
    return match ? match[1].trim() : null
  }

  const extractQuote = (): string | null => {
    const regex = /## Debugging Philosophy\s*\n+"?([^"]+)"?/i
    const match = systemPrompt.match(regex)
    return match ? match[1].trim().replace(/^"|"$/g, '') : null
  }

  const occupation = extractField('Occupation')
  const personality = extractField('Personality type')
  const philosophy = extractQuote()

  if (!occupation && !personality && !philosophy) {
    return null
  }

  return (
    <div className="text-xs space-y-1.5 text-muted-foreground bg-background/20 rounded-md p-2">
      {occupation && (
        <div className="flex gap-2">
          <span className="text-foreground/60 shrink-0">💼</span>
          <span>{occupation}</span>
        </div>
      )}
      {personality && (
        <div className="flex gap-2">
          <span className="text-foreground/60 shrink-0">🧠</span>
          <span>{personality}</span>
        </div>
      )}
      {philosophy && (
        <div className="flex gap-2 italic">
          <span className="text-foreground/60 shrink-0">💬</span>
          <span className="line-clamp-2">&ldquo;{philosophy}&rdquo;</span>
        </div>
      )}
    </div>
  )
}

export function PersonaConfig({ persona, onUpdate }: PersonaConfigProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editedName, setEditedName] = useState(persona.name)
  const [editedDescription, setEditedDescription] = useState(persona.description)
  const [editedPrompt, setEditedPrompt] = useState(persona.systemPrompt)
  const [editedColor, setEditedColor] = useState(persona.color)
  const [isGeneratingName, setIsGeneratingName] = useState(false)

  const hasChanges = 
    editedName !== persona.name ||
    editedDescription !== persona.description ||
    editedPrompt !== persona.systemPrompt ||
    editedColor !== persona.color

  const toggleMode = (mode: DuckMode) => {
    const newModes = persona.enabledModes.includes(mode)
      ? persona.enabledModes.filter((m) => m !== mode)
      : [...persona.enabledModes, mode]
    onUpdate({ ...persona, enabledModes: newModes })
  }

  const toggleWebSearch = () => {
    onUpdate({ ...persona, hasWebSearch: !persona.hasWebSearch })
  }

  const saveChanges = () => {
    onUpdate({ 
      ...persona, 
      name: editedName,
      description: editedDescription,
      systemPrompt: editedPrompt,
      color: editedColor,
    })
  }

  const resetChanges = () => {
    setEditedName(persona.name)
    setEditedDescription(persona.description)
    setEditedPrompt(persona.systemPrompt)
    setEditedColor(persona.color)
  }

  const generateName = async () => {
    if (isGeneratingName) return
    
    setIsGeneratingName(true)
    try {
      const response = await fetch('/api/generate-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editedDescription,
          systemPrompt: editedPrompt,
        }),
      })
      
      if (response.ok) {
        const { name } = await response.json()
        if (name) {
          setEditedName(name)
        }
      }
    } catch (error) {
      console.error('Failed to generate name:', error)
    } finally {
      setIsGeneratingName(false)
    }
  }

  const activeColor = isOpen ? editedColor : persona.color
  const colorVar = `var(--${activeColor})`

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className="rounded-lg border-2 p-4 transition-all duration-200"
        style={{
          borderColor: colorVar,
          backgroundColor: `color-mix(in oklch, ${colorVar} 15%, transparent)`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-background font-bold text-lg shrink-0"
              style={{ backgroundColor: colorVar }}
            >
              {(isOpen ? editedName : persona.name).charAt(0)}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {isOpen ? editedName : persona.name}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {isOpen ? editedDescription : persona.description}
              </p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button 
              variant={isOpen ? "secondary" : "outline"} 
              size="sm" 
              className={cn(
                "gap-1.5 shrink-0",
                !isOpen && "hover:bg-secondary"
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="text-xs">{isOpen ? 'Editing' : 'Edit'}</span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-4 space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-background/50 focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Duck name..."
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={generateName}
                disabled={isGeneratingName}
                className="shrink-0 h-9 w-9"
                title="Generate a duck-themed name based on description and prompt"
              >
                {isGeneratingName ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Description
            </label>
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="min-h-[60px] text-sm bg-background/50"
              placeholder="Brief description..."
            />
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setEditedColor(color.id)}
                  className={cn(
                    'h-7 w-7 rounded-full transition-all',
                    editedColor === color.id 
                      ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' 
                      : 'opacity-70 hover:opacity-100 hover:scale-105'
                  )}
                  style={{ backgroundColor: `var(--${color.id})` }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Modes Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Enabled Modes
            </label>
            <div className="flex flex-wrap gap-2">
              {DUCK_MODES.map((mode) => {
                const isEnabled = persona.enabledModes.includes(mode.id)
                return (
                  <button
                    key={mode.id}
                    onClick={() => toggleMode(mode.id)}
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs font-medium transition-all',
                      isEnabled
                        ? 'text-background'
                        : 'border border-border hover:bg-secondary text-foreground'
                    )}
                    style={isEnabled ? { backgroundColor: colorVar } : undefined}
                  >
                    {mode.label}
                  </button>
                )
              })}
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
          </div>

          {/* Save/Reset buttons */}
          {hasChanges && (
            <div className="flex gap-2 pt-2 border-t border-border/50">
              <Button size="sm" onClick={saveChanges} className="flex-1">
                Save Changes
              </Button>
              <Button size="sm" variant="ghost" onClick={resetChanges}>
                Reset
              </Button>
            </div>
          )}
        </CollapsibleContent>

        {/* Persona preview - always visible when collapsed */}
        {!isOpen && (
          <div className="mt-3 space-y-2">
            <PersonaTraitsPreview systemPrompt={persona.systemPrompt} />
            
            <div className="flex flex-wrap gap-1">
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

            {/* Hint to edit */}
            <p className="text-[10px] text-muted-foreground/60 text-center pt-1">
              Click &ldquo;Edit&rdquo; to customize this persona
            </p>
          </div>
        )}
      </div>
    </Collapsible>
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
        <div className="bg-secondary/50 rounded-md p-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Pencil className="h-4 w-4 shrink-0" />
            <span>Click <strong>&ldquo;Edit&rdquo;</strong> on any persona to customize their name, color, description, and personality.</span>
          </p>
        </div>
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
