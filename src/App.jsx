import { useRef, useState } from 'react'
import { analyzeResume, matchResumeToJob } from './services/api.js'
import { downloadAnalysisReport } from './utils/createReport.js'
import './App.css'

const MAX_FILE_SIZE = 10 * 1024 * 1024

function Icon({ name, size = 20 }) {
  const paths = {
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5M12 3v12" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
    target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  }

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function LoadingStatus({ stage }) {
  if (!stage) return null
  return (
    <div className="loading-status" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{stage}</span>
      <span className="loading-track" aria-hidden="true"><span /></span>
    </div>
  )
}

function Notice({ notice, onDismiss }) {
  if (!notice) return null
  return (
    <div className={`notice notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      <span>{notice.text}</span>
      <button className="notice-dismiss" type="button" aria-label="Dismiss notification" onClick={onDismiss}>
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}

function ItemSection({ title, items, tone, emptyText, ordered = false }) {
  const List = ordered ? 'ol' : 'ul'
  return (
    <section className={`detail-card detail-${tone}`}>
      <div className="detail-heading">
        <span className="detail-mark" aria-hidden="true"><Icon name={tone === 'strength' ? 'check' : tone === 'suggestion' ? 'arrow' : 'target'} size={17} /></span>
        <h3>{title}</h3>
        <span className="detail-count">{items.length}</span>
      </div>
      {items.length > 0 ? (
        <List className="detail-list">
          {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </List>
      ) : <p className="empty-detail">{emptyText}</p>}
    </section>
  )
}

function SummaryCard({ label, count, tone }) {
  return (
    <div className={`summary-card summary-${tone}`}>
      <span className="summary-icon"><Icon name={tone === 'strength' ? 'check' : tone === 'suggestion' ? 'spark' : 'target'} size={18} /></span>
      <strong>{count}</strong>
      <span>{label}</span>
    </div>
  )
}

function App() {
  const [resume, setResume] = useState(null)
  const [resumeText, setResumeText] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [jobDescription, setJobDescription] = useState('')
  const [jobAnalysis, setJobAnalysis] = useState(null)
  const [stage, setStage] = useState('')
  const [notice, setNotice] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [showResumeText, setShowResumeText] = useState(false)
  const fileInputRef = useRef(null)
  const isBusy = Boolean(stage)

  function clearResults() {
    setResumeText('')
    setAnalysis(null)
    setJobAnalysis(null)
    setJobDescription('')
    setShowResumeText(false)
  }

  function validateSelectedFile(file) {
    if (!file) return false
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setNotice({ type: 'error', text: 'Choose a PDF file. Other file formats are not supported.' })
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      setNotice({ type: 'error', text: 'This PDF is larger than 10 MB. Choose a smaller file and try again.' })
      return false
    }
    if (file.size === 0) {
      setNotice({ type: 'error', text: 'This file is empty. Choose a valid PDF and try again.' })
      return false
    }
    clearResults()
    setResume(file)
    setNotice({ type: 'success', text: `${file.name} is ready. Analyze it to see your resume insights.` })
    if (fileInputRef.current) fileInputRef.current.value = ''
    return true
  }

  async function extractPdfText(file) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const signature = new TextDecoder().decode(bytes.subarray(0, 5))
    if (signature !== '%PDF-') {
      throw new Error('This file does not appear to be a valid PDF. Please choose another file.')
    }

    try {
      const [{ GlobalWorkerOptions, getDocument }, { default: pdfWorker }] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ])
      GlobalWorkerOptions.workerSrc = pdfWorker
      const pdf = await getDocument({ data: bytes, isEvalSupported: false }).promise
      const pageTexts = []
      let unreadablePages = 0

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const content = await page.getTextContent()
        const text = content.items
          .map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : ''))
          .join('')
          .replace(/[ \t]+/g, ' ')
          .replace(/ *\n */g, '\n')
          .trim()

        if (!text) unreadablePages += 1
        pageTexts.push(text)
      }

      const extractedText = pageTexts.filter(Boolean).join('\n\n').trim()
      if (!extractedText) {
        throw new Error('No selectable text was found. This PDF may be empty or scanned/image-only; OCR is not supported, so upload a text-based PDF.')
      }
      if (extractedText.includes('\uFFFD')) {
        throw new Error('Some PDF characters could not be decoded reliably. Re-export the resume as a searchable PDF and upload it again.')
      }

      return { extractedText, pageCount: pdf.numPages, unreadablePages }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('No selectable text')) throw error
      if (/password|encrypted/i.test(errorMessage)) {
        throw new Error('This PDF is password-protected. Remove its password and upload it again.', { cause: error })
      }
      if (errorMessage.startsWith('This file does not')) throw error
      throw new Error('This PDF could not be read. It may be damaged or use an unsupported format.', { cause: error })
    }
  }

  async function handleAnalyze() {
    if (!resume || isBusy) return
    setNotice(null)
    setAnalysis(null)
    setJobAnalysis(null)
    setStage('Reading every page of your PDF…')

    try {
      const { extractedText, pageCount, unreadablePages } = await extractPdfText(resume)
      setResumeText(extractedText)
      setStage('Analyzing your resume with Gemini…')
      const result = await analyzeResume(extractedText, (retryMessage) => setStage(retryMessage))
      setAnalysis(result)
      setNotice({
        type: 'success',
        text: unreadablePages
          ? `Analysis complete. ${unreadablePages} of ${pageCount} pages had no selectable text and may contain scanned content.`
          : 'Your resume analysis is ready.',
      })
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Resume analysis failed. Please try again.' })
    } finally {
      setStage('')
    }
  }

  async function handleJobMatch(event) {
    event.preventDefault()
    if (!resumeText.trim() || !jobDescription.trim() || isBusy) return
    setJobAnalysis(null)
    setNotice(null)
    setStage('Comparing resume evidence with the job requirements…')

    try {
      const result = await matchResumeToJob(resumeText, jobDescription, (retryMessage) => setStage(retryMessage))
      setJobAnalysis(result)
      setNotice({ type: 'success', text: 'Your job match results are ready.' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Job matching failed. Please try again.' })
    } finally {
      setStage('')
    }
  }

  function handleRemove() {
    setResume(null)
    clearResults()
    setNotice(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    if (!isBusy) validateSelectedFile(event.dataTransfer.files[0])
  }

  async function handleReportDownload() {
    try {
      await downloadAnalysisReport({ analysis, jobAnalysis, fileName: resume?.name })
      setNotice({ type: 'success', text: 'Your PDF report has been downloaded.' })
    } catch {
      setNotice({ type: 'error', text: 'The report could not be generated. Please try again.' })
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="AI Resume Analyzer home">
          <span className="brand-mark"><Icon name="spark" size={21} /></span>
          <span>Resume<span className="brand-accent">ly</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#upload">Analyze</a>
          <a href="#analysis">Insights</a>
          <a href="#job-match">Job match</a>
        </nav>
        <a className="header-action" href="#upload"><Icon name="spark" size={16} /> Get started</a>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT OPPORTUNITY STARTS HERE</div>
            <h1>Make your resume<br />work <span>smarter.</span></h1>
            <p>Get thoughtful, actionable feedback on your resume and see how it stacks up against the role you want.</p>
            <a className="text-link" href="#upload">Explore your resume <Icon name="arrow" size={16} /></a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-glow" />
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
            <div className="art-document">
              <span className="art-doc-icon"><Icon name="file" size={23} /></span>
              <span className="art-line art-line-long" /><span className="art-line" /><span className="art-line art-line-short" />
              <span className="art-rule" />
              <span className="art-line art-line-long" /><span className="art-line" /><span className="art-line art-line-short" />
            </div>
            <div className="art-score"><span>YOUR RESUME REVIEW</span><strong>Actionable insights</strong><small><Icon name="spark" size={13} /> Tailored to your experience</small></div>
            <span className="art-sparkle sparkle-a"><Icon name="spark" size={22} /></span>
            <span className="art-sparkle sparkle-b"><Icon name="check" size={18} /></span>
          </div>
        </section>

        <section id="upload" className="workspace-section">
          <div className="section-intro">
            <div><span className="section-kicker">01 — START WITH YOUR RESUME</span><h2>Get your resume in shape</h2></div>
            <p>Upload a PDF and get a clear picture of what’s working and what to improve.</p>
          </div>
          <div className="upload-layout">
            <div
              className={`upload-card${dragging ? ' is-dragging' : ''}${resume ? ' has-file' : ''}`}
              onDragOver={(event) => { event.preventDefault(); if (!isBusy) setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <div className="upload-symbol"><Icon name={resume ? 'file' : 'upload'} size={24} /></div>
              {resume ? (
                <>
                  <p className="upload-title">Your resume is ready</p>
                  <p className="upload-subtitle">We’ll read every page and look for selectable text.</p>
                  <div className="selected-file">
                    <span className="file-icon"><Icon name="file" size={18} /></span>
                    <span className="file-meta"><strong title={resume.name}>{resume.name}</strong><small>{resume.size < 1024 * 1024 ? `${(resume.size / 1024).toFixed(1)} KB` : `${(resume.size / (1024 * 1024)).toFixed(2)} MB`} · PDF</small></span>
                    <button className="icon-button" type="button" onClick={handleRemove} disabled={isBusy} aria-label="Remove resume"><Icon name="close" size={17} /></button>
                  </div>
                  <div className="upload-actions">
                    <button className="button button-primary" type="button" onClick={handleAnalyze} disabled={isBusy}>
                      {isBusy ? 'Working on it…' : analysis ? 'Analyze again' : 'Analyze my resume'} <Icon name="arrow" size={16} />
                    </button>
                    <button className="button button-subtle" type="button" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>Replace PDF</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="upload-title">Drop your resume here</p>
                  <p className="upload-subtitle">or browse files from your device</p>
                  <button className="button button-primary" type="button" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
                    Browse files <Icon name="upload" size={16} />
                  </button>
                  <p className="file-hint">PDF only · Up to 10 MB · Your resume is not stored</p>
                </>
              )}
              <input
                ref={fileInputRef}
                className="visually-hidden"
                id="resume-file"
                type="file"
                aria-label="Choose a PDF resume"
                accept=".pdf,application/pdf"
                onChange={(event) => validateSelectedFile(event.target.files?.[0])}
                disabled={isBusy}
              />
            </div>
            <aside className="privacy-card">
              <span className="privacy-icon"><Icon name="check" size={18} /></span>
              <div><strong>Private by design</strong><p>Your PDF is processed in your browser. Only extracted text is sent to the AI service for analysis.</p></div>
              <div className="privacy-divider" />
              <strong className="privacy-subhead">A quick note</strong>
              <p>Image-only scans can’t be read yet. Use a text-based PDF for the best results.</p>
            </aside>
          </div>

          <LoadingStatus stage={stage} />
          <Notice notice={notice} onDismiss={() => setNotice(null)} />
        </section>

        {analysis && (
          <section id="analysis" className="dashboard-section">
            <div className="section-intro dashboard-heading">
              <div><span className="section-kicker">02 — YOUR RESUME SNAPSHOT</span><h2>Insights to move you forward</h2></div>
              <div className="dashboard-actions">
                <button className="button button-outline" type="button" onClick={handleReportDownload}><Icon name="download" size={17} /> Download report</button>
                <button className="button button-quiet" type="button" onClick={handleRemove} disabled={isBusy}>Clear analysis</button>
              </div>
            </div>
            <div className="score-and-summary">
              <article className="score-card">
                <div className="score-topline"><span className="score-badge"><Icon name="spark" size={15} /> RESUME SCORE</span><span className="score-caption">Out of 100</span></div>
                <div className="score-value">{analysis.score}<span>/100</span></div>
                <div className="score-progress" role="progressbar" aria-label="Resume score" aria-valuenow={analysis.score} aria-valuemin="0" aria-valuemax="100">
                  <span style={{ width: `${analysis.score}%` }} />
                </div>
                <p>{analysis.scoreReason}</p>
              </article>
              <div className="summary-grid">
                <SummaryCard label="Strengths" count={analysis.strengths.length} tone="strength" />
                <SummaryCard label="Opportunities" count={analysis.weaknesses.length} tone="weakness" />
                <SummaryCard label="Skills to build" count={analysis.missingSkills.length} tone="missing" />
                <SummaryCard label="Suggestions" count={analysis.suggestions.length} tone="suggestion" />
              </div>
            </div>
            <div className="details-grid">
              <ItemSection title="What’s working" items={analysis.strengths} tone="strength" emptyText="No specific strengths were returned." />
              <ItemSection title="Room to improve" items={analysis.weaknesses} tone="weakness" emptyText="No major weaknesses were identified." />
              <ItemSection title="Skills to consider" items={analysis.missingSkills} tone="missing" emptyText="No missing skills were highlighted." />
              <ItemSection title="Your next steps" items={analysis.suggestions} tone="suggestion" emptyText="No suggestions were returned." ordered />
            </div>
            <details className="resume-text-details">
              <summary onClick={() => setShowResumeText(!showResumeText)}>{showResumeText ? 'Hide extracted resume text' : 'View extracted resume text'}</summary>
              {showResumeText && <pre className="resume-text">{resumeText}</pre>}
            </details>
          </section>
        )}

        <section id="job-match" className="matching-section">
          <div className="section-intro">
            <div><span className="section-kicker">{analysis ? '03' : '02'} — FIND YOUR FIT</span><h2>Match a role that matters</h2></div>
            <p>Compare your resume with a job description and get a grounded, evidence-led match.</p>
          </div>
          <div className="matching-layout">
            <form className="job-description-card" onSubmit={handleJobMatch}>
              <label htmlFor="job-description">Job description</label>
              <p>Paste the role details below. The more context you include, the more useful your match will be.</p>
              <textarea
                id="job-description"
                placeholder="Paste the job description here…"
                value={jobDescription}
                onChange={(event) => { setJobDescription(event.target.value); setJobAnalysis(null) }}
                maxLength={20000}
                rows={8}
                disabled={isBusy}
              />
              <div className="textarea-meta"><span>{jobDescription.length.toLocaleString()} / 20,000 characters</span><span>Keep company-sensitive details out</span></div>
              <button className="button button-primary" type="submit" disabled={!resumeText.trim() || !jobDescription.trim() || isBusy}>
                {isBusy && stage.includes('Comparing') ? 'Finding your fit…' : 'Match my resume'} <Icon name="arrow" size={16} />
              </button>
              {!resumeText && <p className="form-hint">Analyze a resume first to unlock job matching.</p>}
            </form>
            <aside className="match-explainer">
              <span className="explainer-icon"><Icon name="target" size={21} /></span>
              <h3>A match with context</h3>
              <p>See the skills your resume demonstrates, the requirements it may be missing, and practical steps to close the gap.</p>
              <div className="evidence-note"><Icon name="check" size={16} /><span>Matched skills are based on evidence in your resume—not just keywords in the job post.</span></div>
            </aside>
          </div>

          {jobAnalysis && (
            <div className="job-results">
              <div className="job-result-top">
                <div><span className="section-kicker">YOUR ROLE MATCH</span><h3>Here’s how you line up</h3></div>
                <div className="match-score"><strong>{jobAnalysis.matchPercentage}<span>%</span></strong><small>match</small></div>
              </div>
              <div className="match-progress" role="progressbar" aria-label="Job match percentage" aria-valuenow={jobAnalysis.matchPercentage} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${jobAnalysis.matchPercentage}%` }} /></div>
              <p className="match-summary">{jobAnalysis.summary}</p>
              <div className="match-result-grid">
                <section className="match-result-card match-good"><h4><Icon name="check" size={17} /> Skills found in your resume</h4>
                  {jobAnalysis.matchedSkills.length ? <div className="skill-tags">{jobAnalysis.matchedSkills.map((skill, index) => <span className="skill-tag" key={`${skill}-${index}`}>{skill}</span>)}</div> : <p>No directly evidenced skills were identified.</p>}
                </section>
                <section className="match-result-card match-gap"><h4><Icon name="target" size={17} /> Skills to develop</h4>
                  {jobAnalysis.missingSkills.length ? <div className="skill-tags">{jobAnalysis.missingSkills.map((skill, index) => <span className="skill-tag" key={`${skill}-${index}`}>{skill}</span>)}</div> : <p>No notable skill gaps were identified.</p>}
                </section>
                <ItemSection title="Relevant qualifications" items={jobAnalysis.strengths} tone="strength" emptyText="No directly relevant qualifications were identified." />
                <ItemSection title="Ways to strengthen your fit" items={jobAnalysis.recommendations} tone="suggestion" emptyText="No additional recommendations were returned." ordered />
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top"><span className="brand-mark"><Icon name="spark" size={18} /></span><span>Resume<span className="brand-accent">ly</span></span></a>
        <p>Made to help good work get noticed.</p>
        <span className="footer-note">AI feedback is a helpful starting point—not a hiring decision.</span>
      </footer>
    </div>
  )
}

export default App
