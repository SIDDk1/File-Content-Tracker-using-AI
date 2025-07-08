// app/api/process/utils.ts

import pdfParse from "pdf-parse"
import mammoth from "mammoth"

async function extractTextFromFile(fileUrl: string, fileType: string): Promise<string> {
  try {
    if (fileType.includes("pdf")) {
      return await extractFromPdf(fileUrl)
    } else if (fileType.includes("msword")) {
      return await extractFromDocx(fileUrl)
    } else {
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.text()
    }
  } catch (error) {
    console.error(`Error extracting text from ${fileUrl}:`, error)
    throw error
  }
}

async function extractFromPdf(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    const buffer = await response.arrayBuffer()
    const pdfData = await pdfParse(Buffer.from(buffer))
    return pdfData.text
  } catch (error) {
    console.error(`Error extracting text from PDF ${fileUrl}:`, error)
    throw error
  }
}

async function extractFromDocx(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    const buffer = await response.arrayBuffer()
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return result.value
  } catch (error) {
    console.error(`Error extracting text from DOCX ${fileUrl}:`, error)
    throw error
  }
}

function generateDocMockContent(): string {
  return `
Mock DOCX Content:

This is mock content for a DOCX file. It includes sections on project goals, team members, and timelines. The document outlines key deliverables and milestones.

The project aims to improve efficiency and reduce costs. Team members are responsible for various tasks including research, development, and testing.

The timeline includes multiple phases with specific deadlines. Key milestones include project kickoff, design review, and final delivery.
`
}

function generatePdfMockContent(): string {
  return `
Mock PDF Content:

This is mock content for a PDF file. It includes sections on system architecture, API endpoints, and database schemas. The document outlines technical specifications and implementation details.

The system architecture follows a microservices design pattern. API endpoints are documented with request and response formats.

The database schema includes tables for users, products, and orders. Technical specifications cover security protocols and performance metrics.
`
}

export { extractTextFromFile, extractFromDocx, extractFromPdf, generateDocMockContent, generatePdfMockContent }
