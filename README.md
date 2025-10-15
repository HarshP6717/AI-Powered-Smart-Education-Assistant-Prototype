# AI-Powered Smart Education Assistant (Demo)

This repository contains a client-side demo of an AI-powered education assistant. It is intentionally self-contained and runs entirely in the browser using localStorage and mocked AI functions so you can try the features offline.

Main features included in this demo:

- Subjects CRUD
- AI-mocked content generation (flashcards, quizzes, cheat sheets)
- Study sessions with timer and coin rewards
- Flashcards and quizzes viewing
- Simple gamification (coins, store purchases)
- Offline support via Service Worker
- Settings and language toggle (UI only)

How to run
-----------
Open `index.html` in a browser (Chrome/Edge/Firefox). For full offline support, serve the folder via a static server (e.g., `npx http-server .`).

Notes
-----
This demo uses an `AI` mock in `ai-mock.js` and a simple `DB` layer using `localStorage` in `db.js`. It's a starting point to integrate a real backend and AI services.

Next steps you can implement:
- Replace AI mocks with calls to an LLM or AI service.
- Add authentication and multi-user support.
- Replace localStorage with IndexedDB for larger data and better querying.
- Add charts and analytics visualization.
