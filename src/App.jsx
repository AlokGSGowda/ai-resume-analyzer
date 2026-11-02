
import { useState, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

function App() {
  const [resume, setResume] = useState(null)
  const [message, setMessage] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)

  const fileInputRef = useRef(null)

  // Handle PDF selection
  function handleFileChange(event) {
    const selectedFile = event.target.files[0]

    setResumeText('')
    setMessage('')
    setAnalysis(null)

    if (!selectedFile) {
      setResume(null)
      return
    }

    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setResume(null)
      setMessage('Please select a PDF file only.')

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      return
    }

    setResume(selectedFile)
  }

  // Extract text from every page of the PDF
  async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer()

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
    }).promise

    const pageTexts = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()

      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')

      pageTexts.push(text)
    }

    return pageTexts.join('\n\n').trim()
  }

  // Analyze the selected PDF
  async function handleAnalyze() {
    if (!resume) {
      setMessage('Please upload a resume first.')
      return
    }

    setIsAnalyzing(true)
    setMessage('Analyzing your resume with AI...')
    setResumeText('')
    setAnalysis(null)

    try {
      const extractedText = await extractPdfText(resume)

      if (!extractedText.trim()) {
        setMessage(
          'No readable text found. Please upload a text-based PDF.'
        )
        return
      }

      setResumeText(extractedText)

      const response = await fetch(
        'http://localhost:5000/api/analyze',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resumeText: extractedText,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'Resume analysis failed.'
        )
      }

      // Store the structured JSON analysis
      setAnalysis(data.analysis)
      setMessage('AI resume analysis completed successfully.')
    } catch (error) {
      console.error('Resume analysis error:', error)
      setMessage(error.message || 'Something went wrong.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Remove the selected PDF and clear previous results
  function handleRemove() {
    setResume(null)
    setResumeText('')
    setMessage('')
    setAnalysis(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <h1>AI Resume Analyzer</h1>

      <p>
        Upload your resume and discover how to improve it with AI.
      </p>

      <div className="upload-card">
        <label htmlFor="resume">
          Upload your resume (PDF)
        </label>

        <input
          ref={fileInputRef}
          id="resume"
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          disabled={isAnalyzing}
        />

        {resume ? (
          <p>Selected: {resume.name}</p>
        ) : (
          <p>No resume selected</p>
        )}

        {resume && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isAnalyzing}
          >
            Remove Resume
          </button>
        )}

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Resume'}
        </button>

        {message && <p role="status">{message}</p>}

        {/* Extracted Resume Text */}
        {resumeText && (
          <div>
            <h2>Extracted Resume Text</h2>
            <pre className="resume-text">{resumeText}</pre>
          </div>
        )}

        {/* AI Resume Dashboard */}
        {analysis && (
          <div className="analysis-result">
            <h2>AI Resume Analysis</h2>

            {/* Resume Score */}
            <div className="score-card">
              <h3>Resume Score</h3>

              <div className="score-number">
                {analysis.score}
                <span>/100</span>
              </div>

              <div className="score-progress">
                <div
                  className="score-progress-fill"
                  style={{
                    width: `${analysis.score}%`,
                  }}
                ></div>
              </div>

              <p>{analysis.scoreReason}</p>
            </div>
            {/* Analysis Overview */}
            <div className="summary-grid">
              <div className="summary-card">
                <h3>{analysis.strengths.length}</h3>
                <p>Strengths</p>
              </div>

              <div className="summary-card">
                <h3>{analysis.weaknesses.length}</h3>
                <p>Weaknesses</p>
              </div>

              <div className="summary-card">
                <h3>{analysis.missingSkills.length}</h3>
                <p>Missing Skills</p>
              </div>

              <div className="summary-card">
                <h3>{analysis.suggestions.length}</h3>
                <p>Suggestions</p>
              </div>
            </div>

            {/* Strengths */}
            <div className="analysis-section">
              <h3>Strengths</h3>

              <ul>
                {analysis.strengths.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div className="analysis-section">
              <h3>Weaknesses</h3>

              <ul>
                {analysis.weaknesses.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Missing Skills */}
            <div className="analysis-section">
              <h3>Missing Skills</h3>

              <ul>
                {analysis.missingSkills.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Improvement Suggestions */}
            <div className="analysis-section">
              <h3>Improvement Suggestions</h3>

              <ol>
                {analysis.suggestions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
