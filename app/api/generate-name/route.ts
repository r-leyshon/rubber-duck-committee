import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { vertex, DEFAULT_MODEL } from '@/lib/vertex'

export async function POST(req: NextRequest) {
  try {
    const { description, systemPrompt } = await req.json()

    if (!description && !systemPrompt) {
      return NextResponse.json(
        { error: 'Please provide a description or system prompt' },
        { status: 400 }
      )
    }

    const context = [
      description && `Description: ${description}`,
      systemPrompt && `Personality/Role: ${systemPrompt.slice(0, 500)}...`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const { text } = await generateText({
      model: vertex(DEFAULT_MODEL),
      prompt: `You are a creative name generator for rubber duck debugging personas. Generate a single fun, memorable duck-themed name based on the following persona details.

The name should:
- Include a duck-related word or pun (e.g., "Quack", "Waddles", "Duck", "Mallard", "Feather", "Bill", "Wing", "Pond", "Drake")
- Reflect the persona's personality or role
- Be playful and memorable (like "Professor Quacksworth", "Captain Waddles", "Ducky McBrainstorm", "Sir Debug-a-Lot", "Mallory the Methodical")
- Be 2-3 words maximum

${context}

Respond with ONLY the name, nothing else. No quotes, no explanation, just the name.`,
      maxTokens: 50,
    })

    const name = text.trim().replace(/^["']|["']$/g, '')

    return NextResponse.json({ name })
  } catch (error) {
    console.error('Name generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate name' },
      { status: 500 }
    )
  }
}
