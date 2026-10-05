# Putra AI Platform V2

Production-oriented Next.js + PostgreSQL platform.

## Deployment
1. Upload/push this repository to GitHub.
2. Import the repository into Vercel.
3. Create PostgreSQL and set DATABASE_URL.
4. Set GEMINI_API_KEY or GROQ_API_KEY.
5. Set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD only for the first seed.
6. Run Prisma deployment migration/push using the deployment workflow you choose.
7. Seed once.
8. Remove/change the initial admin password after first login.

## Core modules
Auth, profiles, sessions, assistants, providers, models, voices, conversations, messages, memories, stories, story sessions, audit logs, admin center, AI routing, web search adapter, browser voice Call.

## Important
The browser Call uses SpeechRecognition/SpeechSynthesis. It is not a PSTN phone call. Custom cloned voice is provider-dependent and plugs into Voice.externalId/Profile.voiceId.
