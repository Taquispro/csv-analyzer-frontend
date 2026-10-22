# Clarity frontend

Standalone React + Vite frontend for the CSV Analyst backend.

## Run locally

1. Start the Spring Boot backend on `http://localhost:8080`.
2. In this directory, run `npm install` and then `npm run dev`.
3. Open the local URL printed by Vite (normally `http://localhost:5173`).

Vite proxies `/api` requests to the backend. Set `VITE_API_TARGET` to change the backend origin, for example `VITE_API_TARGET=http://localhost:9090 npm run dev`.

The app uses `/api/csv/preview`, `/api/csv/analyze`, and `/api/csv/ask`. The `/api/gemini/test` and `/plan` routes remain backend utility endpoints and are not part of the data-analysis interface.
# csv-analyzer-frontend
