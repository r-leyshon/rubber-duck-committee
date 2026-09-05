import { generateText } from 'ai'
import { vertex, DEFAULT_MODEL, withModelFallback } from '@/lib/vertex'

export async function POST(req: Request) {
  const formData = await req.formData()
  const audioFile = formData.get('audio') as File

  if (!audioFile) {
    return Response.json({ error: 'No audio file provided' }, { status: 400 })
  }

  try {
    // Convert File to ArrayBuffer for the AI SDK
    const audioBuffer = await audioFile.arrayBuffer()
    
    // Determine the media type from the file
    const mediaType = audioFile.type || 'audio/webm'

    // Use Gemini's native audio processing capability with fallback
    const result = await withModelFallback((modelId) =>
      generateText({
        model: vertex(modelId),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please transcribe the following audio accurately. Return only the transcribed text, nothing else.',
              },
              {
                type: 'file',
                data: new Uint8Array(audioBuffer),
                mediaType: mediaType as 'audio/mpeg' | 'audio/wav' | 'audio/webm' | 'audio/ogg',
              },
            ],
          },
        ],
        providerOptions: {
          google: {
            audioTimestamp: true,
          },
        },
      })
    )

    return Response.json({
      text: result.text,
      segments: [], // Gemini doesn't provide segment-level timestamps in this mode
    })
  } catch (error) {
    console.error('[v0] Transcription error:', error)
    return Response.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}
