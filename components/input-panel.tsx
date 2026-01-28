'use client'

import React from "react"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { VoiceInput } from './voice-input'
import { Send, Loader2 } from 'lucide-react'

interface InputPanelProps {
  onSubmit: (message: string) => void
  isProcessing: boolean
  placeholder?: string
}

export function InputPanel({
  onSubmit,
  isProcessing,
  placeholder = 'Describe your problem to the duck committee...',
}: InputPanelProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (!input.trim() || isProcessing) return
    onSubmit(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleTranscription = (text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text))
    textareaRef.current?.focus()
  }

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-sm p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isProcessing}
              className="min-h-[52px] max-h-[200px] resize-none pr-12 bg-input/50"
              rows={1}
            />
            <div className="absolute right-2 bottom-2">
              <VoiceInput
                onTranscription={handleTranscription}
                disabled={isProcessing}
              />
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isProcessing}
            className="h-[52px] px-6"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line. Use the microphone for voice input.
        </p>
      </div>
    </div>
  )
}
