export type DuckPersonaId = 'analytical' | 'creative' | 'pragmatic'
export type OrchestratorId = 'orchestrator'
export type ParticipantId = DuckPersonaId | OrchestratorId | 'user'

export interface DuckPersona {
  id: DuckPersonaId
  name: string
  description: string
  systemPrompt: string
  color: string
  enabledModes: DuckMode[]
  hasWebSearch: boolean
}

export type DuckMode = 
  | 'probing-questions'
  | 'root-cause-analysis'
  | 'solution-brainstorm'
  | 'code-review'
  | 'architecture-review'
  | 'debugging'

export const DUCK_MODES: { id: DuckMode; label: string; description: string }[] = [
  { id: 'probing-questions', label: 'Probing Questions', description: 'Ask clarifying questions to understand the problem better' },
  { id: 'root-cause-analysis', label: 'Root Cause Analysis', description: 'Dig deep to find the underlying cause' },
  { id: 'solution-brainstorm', label: 'Solution Brainstorm', description: 'Generate creative solutions' },
  { id: 'code-review', label: 'Code Review', description: 'Review code for bugs and improvements' },
  { id: 'architecture-review', label: 'Architecture Review', description: 'Evaluate system design decisions' },
  { id: 'debugging', label: 'Debugging', description: 'Step through logic to find issues' },
]

export const DEFAULT_PERSONAS: DuckPersona[] = [
  {
    id: 'analytical',
    name: 'Professor Quacksworth',
    description: 'A methodical, detail-oriented duck who excels at breaking down complex problems into manageable pieces.',
    systemPrompt: `You are Professor Quacksworth, an analytical rubber duck debugging assistant. Your approach is methodical and precise.

Your personality:
- You break down problems systematically
- You ask pointed, specific questions
- You look for logical inconsistencies
- You prefer data and evidence over intuition
- You document your reasoning clearly

When helping debug:
1. First, understand the exact symptoms
2. Identify what should happen vs what is happening
3. Form hypotheses about potential causes
4. Test each hypothesis logically
5. Provide structured, step-by-step solutions`,
    color: 'duck-analytical',
    enabledModes: ['probing-questions', 'root-cause-analysis', 'debugging'],
    hasWebSearch: true,
  },
  {
    id: 'creative',
    name: 'Ducky McBrainstorm',
    description: 'An imaginative duck who thinks outside the box and suggests unconventional approaches.',
    systemPrompt: `You are Ducky McBrainstorm, a creative rubber duck debugging assistant. Your approach is innovative and lateral.

Your personality:
- You think outside the box
- You make unexpected connections
- You suggest unconventional solutions
- You're not afraid of "crazy" ideas
- You see problems as opportunities

When helping debug:
1. Challenge assumptions about the problem
2. Look for analogies in other domains
3. Consider completely different approaches
4. Brainstorm multiple alternative solutions
5. Encourage experimentation`,
    color: 'duck-creative',
    enabledModes: ['solution-brainstorm', 'architecture-review'],
    hasWebSearch: true,
  },
  {
    id: 'pragmatic',
    name: 'Captain Waddles',
    description: 'A practical duck focused on shipping working solutions efficiently.',
    systemPrompt: `You are Captain Waddles, a pragmatic rubber duck debugging assistant. Your approach is practical and results-oriented.

Your personality:
- You focus on what works
- You consider time and resource constraints
- You value simplicity over elegance
- You think about maintainability
- You're direct and action-oriented

When helping debug:
1. Understand the constraints and deadline
2. Find the fastest path to a working solution
3. Consider trade-offs pragmatically
4. Suggest quick wins and incremental fixes
5. Always provide actionable next steps`,
    color: 'duck-pragmatic',
    enabledModes: ['code-review', 'debugging', 'solution-brainstorm'],
    hasWebSearch: false,
  },
]

// Message types for the committee
export type MessageRole = 'user' | 'duck' | 'orchestrator' | 'system'

export interface ChainOfThought {
  step: number
  thought: string
  reasoning: string
}

export interface CommitteeMessage {
  id: string
  role: MessageRole
  participantId: ParticipantId
  content: string
  chainOfThought?: ChainOfThought[]
  timestamp: Date
  status: 'thinking' | 'complete' | 'needs-context' | 'waiting'
  suggestedSolution?: string
  vote?: DuckPersonaId
}

export interface DuckResponse {
  duckId: DuckPersonaId
  content: string
  chainOfThought: ChainOfThought[]
  status: 'thinking' | 'complete' | 'needs-context'
  followUpQuestions?: string[]
  suggestedSolution?: string
}

export interface Vote {
  voterId: DuckPersonaId | OrchestratorId
  votedFor: DuckPersonaId
  reasoning: string
}

export interface VotingResult {
  votes: Vote[]
  winner: DuckPersonaId
  wasTiebreaker: boolean
  tiebreakerReasoning?: string
}

export interface CommitteeSession {
  id: string
  messages: CommitteeMessage[]
  personas: DuckPersona[]
  currentPhase: 'exploring' | 'proposing' | 'voting' | 'concluded'
  duckResponses: Map<DuckPersonaId, DuckResponse>
  votingResult?: VotingResult
}

// API types
export interface CommitteeRequest {
  sessionId: string
  userMessage: string
  personas: DuckPersona[]
  isVoiceInput?: boolean
}

export interface DuckStreamEvent {
  type: 'thinking' | 'content' | 'chain-of-thought' | 'status' | 'solution' | 'vote' | 'complete'
  duckId: DuckPersonaId | OrchestratorId
  data: unknown
}

// Transcription
export interface TranscriptionResult {
  text: string
  confidence: number
}
