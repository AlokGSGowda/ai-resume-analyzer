function printableText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function downloadAnalysisReport({ analysis, jobAnalysis, fileName }) {
  if (!analysis) throw new Error('Resume analysis is required to create a report.')
  const { jsPDF } = await import('jspdf')

  const document = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = document.internal.pageSize.getWidth()
  const pageHeight = document.internal.pageSize.getHeight()
  const margin = 52
  const contentWidth = pageWidth - margin * 2
  let cursorY = 58

  function addPageChrome() {
    document.setTextColor(93, 112, 75)
    document.setFont('helvetica', 'bold')
    document.setFontSize(9)
    document.text('RESUMELY  /  RESUME INSIGHTS', margin, 31)
    document.setDrawColor(228, 231, 222)
    document.line(margin, 41, pageWidth - margin, 41)
    document.setTextColor(130, 136, 125)
    document.setFont('helvetica', 'normal')
    document.setFontSize(8)
    document.text('AI-generated feedback - Review before making changes', margin, pageHeight - 28)
    document.text(`Page ${document.internal.getNumberOfPages()}`, pageWidth - margin, pageHeight - 28, { align: 'right' })
  }

  function ensureSpace(height) {
    if (cursorY + height > pageHeight - margin) {
      document.addPage()
      cursorY = 62
      addPageChrome()
    }
  }

  function addParagraph(text, options = {}) {
    const safeText = printableText(text)
    if (!safeText) return
    const fontSize = options.fontSize || 10
    const lineHeight = fontSize * 1.55
    document.setFont('helvetica', options.bold ? 'bold' : 'normal')
    document.setFontSize(fontSize)
    document.setTextColor(...(options.color || [74, 81, 72]))
    const lines = document.splitTextToSize(safeText, contentWidth - (options.indent || 0))
    ensureSpace(lines.length * lineHeight + 4)
    document.text(lines, margin + (options.indent || 0), cursorY)
    cursorY += lines.length * lineHeight + (options.gap ?? 7)
  }

  function addSection(title, items, numbered = false) {
    ensureSpace(38)
    cursorY += 7
    document.setFont('helvetica', 'bold')
    document.setFontSize(12)
    document.setTextColor(37, 43, 37)
    document.text(printableText(title), margin, cursorY)
    cursorY += 19
    if (!items.length) {
      addParagraph('No items were returned for this section.', { color: [130, 136, 125], fontSize: 9 })
      return
    }
    items.forEach((item, index) => {
      addParagraph(`${numbered ? `${index + 1}.` : '-'}  ${item}`, { indent: 5, fontSize: 9.5, gap: 5 })
    })
  }

  addPageChrome()
  document.setFont('helvetica', 'bold')
  document.setFontSize(23)
  document.setTextColor(37, 43, 37)
  document.text('Your resume, reviewed.', margin, cursorY + 13)
  cursorY += 32
  addParagraph(`Prepared ${new Date().toLocaleDateString()}${fileName ? ` · ${fileName}` : ''}`, { color: [130, 136, 125], fontSize: 9 })
  cursorY += 7

  document.setFillColor(245, 247, 240)
  document.roundedRect(margin, cursorY, contentWidth, 85, 10, 10, 'F')
  document.setFont('helvetica', 'bold')
  document.setFontSize(9)
  document.setTextColor(93, 112, 75)
  document.text('RESUME SCORE', margin + 18, cursorY + 23)
  document.setFontSize(27)
  document.setTextColor(37, 43, 37)
  document.text(`${analysis.score}/100`, margin + 18, cursorY + 54)
  document.setFont('helvetica', 'normal')
  document.setFontSize(9)
  document.setTextColor(74, 81, 72)
  const reason = document.splitTextToSize(printableText(analysis.scoreReason), contentWidth - 125)
  document.text(reason, margin + 115, cursorY + 38)
  cursorY += 103

  addSection('Strengths', analysis.strengths)
  addSection('Weaknesses', analysis.weaknesses)
  addSection('Skills to consider', analysis.missingSkills)
  addSection('Improvement suggestions', analysis.suggestions, true)

  if (jobAnalysis) {
    ensureSpace(52)
    cursorY += 8
    document.setDrawColor(228, 231, 222)
    document.line(margin, cursorY, pageWidth - margin, cursorY)
    cursorY += 22
    document.setFont('helvetica', 'bold')
    document.setFontSize(15)
    document.setTextColor(37, 43, 37)
    document.text(`Job description match · ${jobAnalysis.matchPercentage}%`, margin, cursorY)
    cursorY += 22
    addParagraph(jobAnalysis.summary, { fontSize: 9.5 })
    addSection('Skills evidenced in your resume', jobAnalysis.matchedSkills)
    addSection('Skills to develop', jobAnalysis.missingSkills)
    addSection('Relevant qualifications and experience', jobAnalysis.strengths)
    addSection('Recommendations', jobAnalysis.recommendations, true)
  }

  for (let page = 1; page <= document.internal.getNumberOfPages(); page += 1) {
    document.setPage(page)
    addPageChrome()
  }

  document.save('resumely-analysis-report.pdf')
}
