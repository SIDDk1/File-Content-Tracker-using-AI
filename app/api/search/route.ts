import { type NextRequest, NextResponse } from "next/server"
import { searchIndex } from "@/lib/search-index"

interface SearchMatch {
  line?: number
  page?: number
  snippet: string
  context: string
  exactMatch: boolean
  matchType: "exact" | "partial" | "fuzzy"
}

interface SearchResult {
  filename: string
  fileType: string
  matches: SearchMatch[]
  fileUrl: string
  fileId: string
  totalMatches: number
  exactMatches: number
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    console.log(`Search request received for: "${query}"`)
    console.log(`Search index contains ${searchIndex.getFileCount()} files`)

    if (!query || query.trim().length === 0) {
      return NextResponse.json([])
    }

    const searchTerm = query.trim()
    const results: SearchResult[] = []

    // Get search results with matches
    const searchResults = searchIndex.searchFiles(searchTerm)

    console.log(`Found ${searchResults.length} files with matches for "${query}"`)

    // Process each result
    for (const { fileData, matches } of searchResults) {
      const exactMatches = matches.filter((m) => m.exactMatch).length

      results.push({
        filename: fileData.filename,
        fileType: fileData.fileType,
        matches,
        fileUrl: fileData.fileUrl,
        fileId: fileData.fileId,
        totalMatches: matches.length,
        exactMatches,
      })
    }

    console.log(`Returning ${results.length} search results`)

    return NextResponse.json(results)
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Search failed",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    )
  }
}
