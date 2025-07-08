import { type NextRequest, NextResponse } from "next/server"
import { searchIndex } from "@/lib/search-index"

interface ProcessedContent {
  text: string
  lines: string[]
  pages: { pageNumber: number; content: string; startLine: number; endLine: number }[]
}

export async function POST(request: NextRequest) {
  try {
    const { filename, fileUrl, fileType, fileContent, extractedLines, extractedPages } = await request.json()

    console.log(`Processing file: ${filename}`)

    // Determine file type from filename if not provided
    const fileExtension = filename.split(".").pop()?.toLowerCase()
    let detectedFileType = fileType || "unknown"

    switch (fileExtension) {
      case "pdf":
        detectedFileType = "application/pdf"
        break
      case "doc":
      case "docx":
        detectedFileType = "application/msword"
        break
      case "txt":
        detectedFileType = "text/plain"
        break
    }

    let processedContent: ProcessedContent = {
      text: "",
      lines: [],
      pages: [],
    }

    // Use provided extracted content if available
    if (fileContent && fileContent.trim().length > 0) {
      processedContent = {
        text: fileContent,
        lines: extractedLines || fileContent.split(/\r?\n/).filter((line: string) => line.trim().length > 0),
        pages: extractedPages || [],
      }
      console.log(
        `Using extracted content: ${processedContent.text.length} characters, ${processedContent.lines.length} lines`,
      )
    } else {
      // Fallback to mock content if no real content available
      console.log(`No real content available, using fallback content for: ${filename}`)
      const fallbackText = generateFallbackContent(filename, detectedFileType)
      processedContent = {
        text: fallbackText,
        lines: fallbackText.split(/\r?\n/).filter((line) => line.trim().length > 0),
        pages: [
          {
            pageNumber: 1,
            content: fallbackText,
            startLine: 1,
            endLine: fallbackText.split(/\r?\n/).length,
          },
        ],
      }
    }

    // Add to search index with structured content
    searchIndex.addFile(filename, {
      filename,
      fileType: detectedFileType,
      content: processedContent.text,
      lines: processedContent.lines,
      pages: processedContent.pages,
      fileUrl: fileUrl || `/files/${filename}`,
      fileId: Date.now().toString(),
    })

    console.log(`Successfully processed: ${filename}`)
    console.log(
      `Content: ${processedContent.text.length} chars, ${processedContent.lines.length} lines, ${processedContent.pages.length} pages`,
    )
    console.log(`Search index now contains ${searchIndex.getFileCount()} files`)

    return NextResponse.json({
      success: true,
      processed: filename,
      indexSize: searchIndex.getFileCount(),
      contentLength: processedContent.text.length,
      lineCount: processedContent.lines.length,
      pageCount: processedContent.pages.length,
      isRealContent: !!(fileContent && fileContent.trim().length > 0),
    })
  } catch (error) {
    console.error("Processing error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Processing failed",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    )
  }
}

function generateFallbackContent(filename: string, fileType: string): string {
  return `Fallback content for ${filename}. Real text extraction was not available for this file type: ${fileType}.`
}
