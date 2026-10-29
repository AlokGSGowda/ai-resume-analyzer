
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
  const [analysis, setAnalysis] = useState("");

  const fileInputRef = useRef(null)

  // Handle PDF selection
  function handleFileChange(event) {
    const selectedFile = event.target.files[0]

    setResumeText('')
    setMessage('')

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
    setMessage("Please upload a resume first.");
    return;
  }

  setIsAnalyzing(true);
  setMessage("Analyzing your resume with AI...");
  setResumeText("");

  try {
    const extractedText = await extractPdfText(resume);

    if (!extractedText.trim()) {
      setMessage(
        "No readable text found. Please upload a text-based PDF."
      );
      return;
    }

    setResumeText(extractedText);

    const response = await fetch(
      "http://localhost:5000/api/analyze",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText: extractedText,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Analysis failed.");
    }

    setMessage("AI resume analysis completed successfully.");
    setAnalysis(data.analysis);
  } catch (error) {
    console.error("Resume analysis error:", error);
    setMessage(error.message || "Something went wrong.");
  } finally {
    setIsAnalyzing(false);
  }
}


  // Remove the selected PDF and clear previous results
  function handleRemove() {
    setResume(null)
    setResumeText('')
    setMessage('')

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
          {isAnalyzing ? 'Reading PDF...' : 'Analyze Resume'}
        </button>

        {message && <p role="status">{message}</p>}

        {resumeText && (
          <div>
            <h2>Extracted Resume Text</h2>
            <pre className="resume-text">{resumeText}</pre>
          </div>
        )}
        {analysis && (
        <div className="analysis-result">
          <h2>AI Resume Analysis</h2>
          <pre>{analysis}</pre>
        </div>
        )}
      </div>
    </div>
  )
}

export default App
