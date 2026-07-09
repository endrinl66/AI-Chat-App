# AI Chat — Real-Time Messaging with an Integrated AI Assistant

A full-stack, real-time chat application where an AI assistant is a genuine participant in the conversation — not a bolted-on chatbot. Users can create rooms, chat live with WebSockets, mention `@ai` to bring the assistant into any conversation, get AI-generated reply suggestions, and summarize long threads with one click.

**🔗 Live demo:** [ai-chat-app-ten-phi.vercel.app](https://ai-chat-app-ten-phi.vercel.app)

> **Note:** The backend runs on Render's free tier, which spins down after periods of inactivity. If the app has been idle, the first request may take 30-60 seconds while the server wakes up — this is a hosting limitation, not a bug.

---

## Features

**Core chat**
- User authentication (JWT, hashed passwords)
- Real-time messaging with Socket.io, organized into rooms
- Online presence indicators and "user is typing…" status
- Message editing and deleting
- Read receipts ("Seen by…")
- Emoji reactions on messages
- Threaded replies with quoted previews
- @mention notifications, live, even across different rooms
- Unread message badges per room
- Room renaming
- Dark mode

**AI-powered features (via Groq / Llama 3.3)**
- **`@ai` mentions** — the AI reads recent room context and replies naturally, in-line
- **Smart reply suggestions** — three short, contextual reply options generated on demand
- **Thread summarization** — "Catch me up" condenses long conversations into a few sentences
- Live "AI is thinking…" indicator while a response is generating

---

## Tech Stack

**Frontend**
- React (Vite)
- React Router
- Socket.io-client
- Axios
- Plain CSS (custom design system, no framework)

**Backend**
- Node.js / Express
- Socket.io
- MongoDB (Atlas) with Mongoose
- JWT authentication + bcrypt
- Groq API (Llama 3.3 70B) for AI features

**Hosting**
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

---

## Architecture

```
React (Vite) ──WebSocket──▶ Express + Socket.io ──▶ MongoDB Atlas
                                    │
                                    └──▶ Groq API (AI replies, suggestions, summaries)
```

The backend handles three responsibilities: maintaining WebSocket connections for real-time state, persisting all chat data to MongoDB, and calling Groq's API whenever an AI feature is triggered.

---

## Running Locally

### Prerequisites
- Node.js (v18+)
- A free MongoDB Atlas account
- A free Groq API key ([console.groq.com](https://console.groq.com))

### 1. Clone the repo
```bash
git clone https://github.com/endrinl66/AI-Chat-App.git
cd AI-Chat-App
```

### 2. Set up the backend
```bash
npm install
```

Create a `.env` file in the root with:
```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_random_secret_string
GROQ_API_KEY=your_groq_api_key
```

Start the backend:
```bash
npm run dev
```

### 3. Set up the frontend
```bash
cd client
npm install
npm run dev
```

The app will be available at `http://localhost:5173`, with the API running at `http://localhost:5000`.

---

## Project Structure

```
AI-Chat-App/
├── client/               # React frontend
│   └── src/
│       ├── pages/        # Login, Register, Chat
│       ├── context/      # Auth context
│       └── utils/        # API client, socket connection
├── models/                # Mongoose schemas (User, Room, Message)
├── routes/                # Express REST routes
├── middleware/             # JWT auth middleware
├── services/               # Groq AI service layer
├── socket.js               # Socket.io real-time event handling
└── server.js                # Express app entry point
```

---

## What I'd Build Next

- Cloud image storage for shared media (currently disabled to avoid free-tier file loss on redeploy)
- Semantic search across message history using embeddings
- Sentiment/engagement analytics dashboard per room

---

## Author

Built by Endri — [LinkedIn : endrinl66]
