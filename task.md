# Tasks

- [x] Implement backend Tutor Mode changes
  - [x] Add `mode` parameter to `ChatQuery` Pydantic schema in `schemas/chat.py`
  - [x] Refactor prompt generation in `api/routes/chat.py` to support `mode="teacher"`
- [x] Implement frontend Tutor Mode changes
  - [x] Add `mode` parameter to `streamChat` in `lib/api.ts`
  - [x] Add `tutorMode` toggle switch and update welcome suggestions in `components/ChatWindow.tsx`
  - [x] Implement dynamic quick-action toolbar for educational prompts (Explain, Quiz, Interview, Architecture)
  - [x] Implement Maximize/Minimize chatbot overlay layout in `ChatWindow.tsx` and `globals.css`
  - [x] Add dynamic **Stop Button** in `ChatWindow.tsx` to halt response generation mid-stream
- [x] Run verification tests and build scripts
  - [x] Verify backend tests pass
  - [x] Verify frontend build and lint pass successfully
