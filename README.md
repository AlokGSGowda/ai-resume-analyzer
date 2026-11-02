# AI Resume Analyzer

A responsive resume review and job-matching app built with React, Vite, PDF.js, Express, and the Google Gemini API. PDF text is extracted in the browser; the backend sends the extracted text to Gemini and returns validated JSON. Reports are generated in the browser.

## Features

- Drag-and-drop or browse to select a PDF resume (up to 10 MB).
- Extract selectable text across all PDF pages. Scanned/image-only pages are reported; OCR is not supported.
- Resume score, score explanation, strengths, weaknesses, skills to consider, and practical suggestions.
- Job-description match score, resume-evidenced skills, skill gaps, relevant qualifications, and recommendations.
- Downloadable PDF report with resume analysis and optional job-match results.
- Responsive dashboard, accessible status messages, bounded retries for temporary API failures, and clear/reset controls.
- Gemini API key stays in the backend environment; it is never bundled into frontend code.

## Requirements

- Node.js 20.19+ or 22.12+ (Node.js 22 LTS recommended).
- npm.
- A Google Gemini API key.

## Run locally

1. Install frontend dependencies:

   ```sh
   npm install
   ```

2. Create `server/.env` from the example. In PowerShell:

   ```powershell
   Copy-Item server\.env.example server\.env
   ```

   Set `GEMINI_API_KEY` in `server/.env`. Do not put this key in a `VITE_` variable or commit the `.env` file.

3. Start the backend in one terminal:

   ```sh
   npm run dev:server
   ```

4. Start the frontend in another terminal:

   ```sh
   npm run dev
   ```

5. Open the Vite URL (normally `http://localhost:5173`). The Vite development server proxies `/api` requests to `http://localhost:5000`.

The backend reads `PORT` and `GEMINI_API_KEY` from `server/.env`. `FRONTEND_URL` is an optional comma-separated CORS allowlist. Local development allows Vite's `localhost:5173` and preview's `localhost:4173` by default.

## Verify the app

```sh
npm run lint
npm run build
npm --prefix server test
```

Check backend health at `http://localhost:5000/api/health`. To test the configured Gemini model and key, open `http://localhost:5000/api/test-gemini`; this makes a live Gemini API request.

For an end-to-end check, upload a text-based PDF, run the analysis, paste a job description, run matching, and download the report. An image-only PDF should produce an OCR-not-supported message. Gemini requests require a valid API key, network access, and available model quota.

## Environment variables

### Backend (`server/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Google Gemini API key. Keep it server-side. |
| `PORT` | No | HTTP port; defaults to `5000`. |
| `FRONTEND_URL` | Production | Comma-separated frontend origin allowlist, e.g. `https://your-app.vercel.app`. |

### Frontend (Vite build environment)

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | Production | Backend origin, e.g. `https://your-api.onrender.com`; leave empty in local development to use the Vite proxy. This value is public and must never contain a secret. |

## Deploy

### Backend on Render

1. Create a **Web Service** from this repository.
2. Set the **Root Directory** to `server`.
3. Use **Build Command** `npm install` and **Start Command** `npm start`.
4. Add `GEMINI_API_KEY` as a secret environment variable and set `FRONTEND_URL` to the deployed Vercel origin. Set `NODE_ENV=production` if the platform does not set it automatically; Render does.
5. Deploy and check `https://<your-service>.onrender.com/api/health`.

The server loads its `.env` from the `server` directory when running locally. On Render, set environment variables in the service dashboard instead of uploading an `.env` file.

### Frontend on Vercel

1. Import the same repository as a Vercel project.
2. Use the repository root as the project root, `npm run build` as the build command, and `dist` as the output directory.
3. Add `VITE_API_URL` with the deployed backend origin (no `/api` suffix), e.g. `https://<your-service>.onrender.com`.
4. Deploy, then update the backend's `FRONTEND_URL` to the final Vercel origin and redeploy the backend if needed.

Vite embeds `VITE_API_URL` at build time. Set or change it in Vercel before rebuilding. The Gemini key belongs only in the backend environment.

## API

- `GET /api/health` — backend health check.
- `GET /api/test-gemini` — live Gemini connectivity check.
- `POST /api/analyze` — `{ "resumeText": "..." }`.
- `POST /api/match-job` — `{ "resumeText": "...", "jobDescription": "..." }`.

The analysis routes validate input size and the shape of the model's JSON response. API failures return sanitized messages and appropriate status codes; resume contents are not logged or persisted by this application.
