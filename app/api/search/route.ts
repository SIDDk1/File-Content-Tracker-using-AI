import { type NextRequest, NextResponse } from "next/server"
import { searchIndex } from "@/lib/search-index"

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    if (!query || typeof query !== "string" || query.trim() === "") {
      return NextResponse.json({ error: "Invalid or missing query" }, { status: 400 })
    }

    const results = searchIndex.searchFiles(query.trim())

    // Map results to frontend SearchResult interface
    const mappedResults = results.map(({ fileData, matches }) => ({
      filename: fileData.filename,
      fileType: fileData.fileType,
      matches: matches.map((m) => ({
        line: m.line,
        page: m.page,
        snippet: m.snippet,
        context: m.context,
        exactMatch: m.exactMatch,
        matchType: m.matchType,
      })),
      fileUrl: fileData.fileUrl,
      fileId: fileData.fileId,
      totalMatches: matches.length,
      exactMatches: matches.filter((m) => m.exactMatch).length,
    }))

    return NextResponse.json(mappedResults)
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
