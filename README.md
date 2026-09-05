# Rubber Duck Committee

A collaborative AI debugging assistant powered by Google Vertex AI and Gemini. The application creates a "committee" of AI personas with different debugging approaches to help you solve problems.

## Features

- **Multiple AI Personas**: Three distinct debugging personalities:
  - **Professor Quacksworth** (Analytical) - Methodical, detail-oriented problem decomposition
  - **Ducky McBrainstorm** (Creative) - Lateral thinking and unconventional solutions  
  - **Captain Waddles** (Pragmatic) - Practical, action-oriented debugging
- **Orchestrator Duck**: Synthesizes insights from all committee members
- **Voice Input**: Record audio and have it transcribed automatically
- **Voting System**: Committee votes on the best solution when multiple are proposed
- **Chain of Thought**: See the reasoning process of each AI persona

## Architecture

```mermaid
flowchart TB
    subgraph Browser["🌐 Browser"]
        IP[InputPanel]
        VI[VoiceInput]
        CV[CommitteeView]
        PP[PersonaPanel]
        UC[useCommittee Hook]
        
        IP --> UC
        VI --> UC
        UC --> CV
        PP -.->|config| UC
    end
    
    subgraph API["⚡ Next.js API Routes"]
        Duck["/api/committee/duck<br/>Individual persona responses"]
        Orch["/api/committee/orchestrate<br/>Chair Duck synthesis"]
        Vote["/api/committee/vote<br/>Voting & tallying"]
        Trans["/api/transcribe<br/>Audio → Text"]
        Vertex["lib/vertex.ts<br/>Vertex AI Client"]
        
        Duck --> Vertex
        Orch --> Vertex
        Vote --> Vertex
        Trans --> Vertex
    end
    
    subgraph GCP["☁️ Google Cloud Vertex AI"]
        Gemini["Gemini 3.5 Flash<br/>• Structured JSON<br/>• Streaming<br/>• Web Search<br/>• Audio Transcription"]
    end
    
    UC <-->|SSE Streams| Duck
    UC <-->|SSE Streams| Orch
    UC <-->|SSE Streams| Vote
    VI -->|Audio| Trans
    
    Vertex <-->|HTTPS| Gemini
```

### Flow Overview

1. **User Input** → User submits a problem via text or voice
2. **Parallel Processing** → All duck personas receive the problem simultaneously
3. **Structured Responses** → Each duck returns a Zod-validated response with:
   - Chain of thought reasoning
   - Status (needs context / complete)
   - Suggested solution (when ready)
4. **Orchestration** → Chair Duck synthesizes responses and determines next action
5. **Voting** → When solutions are proposed, ducks vote with reasoning
6. **Resolution** → Chair Duck presents the winning solution

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Structured Output (Zod)** | Ensures consistent, parseable responses from LLM |
| **SSE Streaming** | Real-time UI updates as responses generate |
| **Parallel Duck Calls** | Reduces latency; personas don't influence each other |
| **Two-Step Grounding** | Web search requires separate call before structured output |
| **Client-Side State** | `useCommittee` hook manages conversation flow |

## Prerequisites

- Node.js 20+ 
- A Google Cloud Platform account with Vertex AI API enabled
- A service account with Vertex AI permissions

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd rubber-duck-committee
npm install
```

### 2. Google Cloud Setup

#### Enable Vertex AI API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Library**
4. Search for "Vertex AI API" and enable it

#### Create a Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Give it a name (e.g., `rubber-duck-vertex-ai`)
4. Grant the role **Vertex AI User** (`roles/aiplatform.user`)
5. Click **Done**

#### Generate a Key File

1. Click on your new service account
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key**
4. Choose **JSON** and click **Create**
5. Save the downloaded file securely (e.g., `~/.gcp/rubber-duck-key.json`)

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Required: Your GCP Project ID
GOOGLE_VERTEX_PROJECT=your-project-id

# Required: GCP Region (choose one close to you)
GOOGLE_VERTEX_LOCATION=us-central1

# Authentication: Path to your service account key file
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
```

#### Available Regions

| Region | Location |
|--------|----------|
| `us-central1` | Iowa, USA |
| `us-east4` | Virginia, USA |
| `us-west1` | Oregon, USA |
| `europe-west1` | Belgium |
| `europe-west4` | Netherlands |
| `asia-northeast1` | Tokyo, Japan |
| `asia-southeast1` | Singapore |

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Authentication Methods

### Option 1: Service Account Key File (Recommended for Local Development)

Set the path to your JSON key file:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json
```

### Option 2: Explicit Credentials

If you can't use a key file, extract the values from your JSON file:

```bash
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_PRIVATE_KEY_ID=abc123...
```

### Option 3: Application Default Credentials (GCP Environments)

When deployed on GCP (Cloud Run, GKE, etc.), attach a service account to the resource. No environment variables needed.

```bash
# Only need project and location
GOOGLE_VERTEX_PROJECT=your-project-id
GOOGLE_VERTEX_LOCATION=us-central1
```

## API Routes

| Route | Description |
|-------|-------------|
| `POST /api/committee/duck` | Individual duck persona responses |
| `POST /api/committee/orchestrate` | Orchestrator synthesis |
| `POST /api/committee/vote` | Voting on solutions |
| `POST /api/transcribe` | Audio transcription |

## Tech Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [Vercel AI SDK 6](https://sdk.vercel.ai/) - AI integration
- [@ai-sdk/google-vertex](https://sdk.vercel.ai/providers/ai-sdk-providers/google-vertex) - Vertex AI provider
- [Gemini 3.5 Flash](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models) - AI model
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Radix UI](https://www.radix-ui.com/) - UI components

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Deployment

### Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com/)
3. Add environment variables in Vercel dashboard
4. Deploy

### Google Cloud Run

```bash
# Build container
docker build -t rubber-duck-committee .

# Deploy to Cloud Run
gcloud run deploy rubber-duck-committee \
  --image gcr.io/YOUR_PROJECT/rubber-duck-committee \
  --platform managed \
  --region us-central1 \
  --set-env-vars "GOOGLE_VERTEX_PROJECT=your-project,GOOGLE_VERTEX_LOCATION=us-central1"
```

## Troubleshooting

### "Permission denied" errors

Ensure your service account has the `Vertex AI User` role:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### "API not enabled" errors

Enable the Vertex AI API:

```bash
gcloud services enable aiplatform.googleapis.com --project YOUR_PROJECT
```

### Model not available in region

Some models may not be available in all regions. Try `us-central1` which has the widest model availability.

## License

MIT
