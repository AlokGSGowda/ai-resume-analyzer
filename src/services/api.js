const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') || ''
const API_BASE_URL = `${configuredApiUrl}/api`
const MAX_ATTEMPTS = 3
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function retryDelay(response, attempt) {
  const retryAfter = response?.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    const dateDelay = Date.parse(retryAfter) - Date.now()
    const delay = Number.isFinite(seconds) ? seconds * 1000 : dateDelay
    if (delay > 0) return Math.min(delay, 8000)
  }
  return 700 * (2 ** (attempt - 1))
}

function readableError(status, message) {
  if (status === 400) return message || 'Check the information you provided and try again.'
  if (status === 413) return 'This request is too large. Use a shorter resume or job description.'
  if (status === 429) return 'The AI service is busy right now. Please wait a moment and try again.'
  if (status === 502 || status === 503 || status === 504) return 'The AI service is temporarily unavailable. Please try again shortly.'
  if (status >= 500) return 'The server could not complete this request. Please try again shortly.'
  return message || 'The request could not be completed. Please try again.'
}

async function postJson(path, payload, onRetry) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000),
      })
    } catch (error) {
      const canRetry = error instanceof TypeError && attempt < MAX_ATTEMPTS
      if (canRetry) {
        onRetry?.(`Connection hiccup. Retrying (${attempt}/${MAX_ATTEMPTS - 1})…`)
        await wait(700 * (2 ** (attempt - 1)))
        continue
      }
      if (error.name === 'TimeoutError') {
        throw new Error('The request took too long. Please try again.', { cause: error })
      }
      throw new Error('Could not reach the analysis server. Check your connection and try again.', { cause: error })
    }

    let data
    try {
      data = await response.json()
    } catch {
      throw new Error('The analysis server returned an unreadable response. Please try again.')
    }

    if (response.ok) return data

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
      onRetry?.(`The AI service is temporarily busy. Retrying (${attempt}/${MAX_ATTEMPTS - 1})…`)
      await wait(retryDelay(response, attempt))
      continue
    }

    throw new Error(readableError(response.status, data.error))
  }

  throw new Error('The request could not be completed. Please try again.')
}

export async function analyzeResume(resumeText, onRetry) {
  const data = await postJson('/analyze', { resumeText }, onRetry)
  return data.analysis
}

export async function matchResumeToJob(resumeText, jobDescription, onRetry) {
  const data = await postJson('/match-job', { resumeText, jobDescription }, onRetry)
  return data.jobAnalysis
}
