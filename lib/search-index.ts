// Shared search index that can be accessed across API routes
interface FileData {
  filename: string
  fileType: string
  content: string
  lines: string[]
  pages: { pageNumber: number; content: string; startLine: number; endLine: number }[]
  fileUrl: string
  fileId: string
}

interface SearchMatch {
  line?: number
  page?: number
  snippet: string
  context: string
  exactMatch: boolean
  matchType: "exact" | "partial" | "fuzzy"
}

declare global {
  // eslint-disable-next-line no-var
  var __searchIndexInstance: SearchIndex | undefined
}

class SearchIndex {
  private static instance: SearchIndex
  private index: Map<string, FileData> = new Map()

  static getInstance(): SearchIndex {
    if (globalThis.__searchIndexInstance === undefined) {
      globalThis.__searchIndexInstance = new SearchIndex()
    }
    return globalThis.__searchIndexInstance
  }

  addFile(filename: string, data: FileData) {
    this.index.set(filename, data)
    console.log(`Added ${filename} to search index. Total files: ${this.index.size}`)
  }

  searchFiles(query: string): { fileData: FileData; matches: SearchMatch[] }[] {
    const results: { fileData: FileData; matches: SearchMatch[] }[] = []
    const searchTerm = query.toLowerCase().trim()

    for (const [filename, fileData] of this.index.entries()) {
      const matches = this.findMatches(fileData, searchTerm)

      if (matches.length > 0) {
        results.push({ fileData, matches })
      }
    }

    // Sort by relevance (exact matches first, then by number of matches)
    results.sort((a, b) => {
      const aExactMatches = a.matches.filter((m) => m.exactMatch).length
      const bExactMatches = b.matches.filter((m) => m.exactMatch).length

      if (aExactMatches !== bExactMatches) {
        return bExactMatches - aExactMatches
      }

      return b.matches.length - a.matches.length
    })

    console.log(`Search for "${query}" found ${results.length} files with matches`)
    return results
  }

  private findMatches(fileData: FileData, searchTerm: string): SearchMatch[] {
    const matches: SearchMatch[] = []
    const isPhrase = searchTerm.includes(" ")

    // Search through lines for exact line numbers
    fileData.lines.forEach((line, lineIndex) => {
      const lowerLine = line.toLowerCase()

      if (isPhrase) {
        // Phrase search - look for exact phrase matches
        const phraseIndex = lowerLine.indexOf(searchTerm)
        if (phraseIndex !== -1) {
          const match = this.createMatch(line, searchTerm, lineIndex + 1, fileData, true, "exact")
          matches.push(match)
        } else {
          // Check for partial phrase matches (all words present)
          const searchWords = searchTerm.split(/\s+/)
          const allWordsPresent = searchWords.every((word) => lowerLine.includes(word.toLowerCase()))

          if (allWordsPresent) {
            const match = this.createMatch(line, searchTerm, lineIndex + 1, fileData, false, "partial")
            matches.push(match)
          }
        }
      } else {
        // Single word search
        const wordIndex = lowerLine.indexOf(searchTerm)
        if (wordIndex !== -1) {
          // Check if it's an exact word match (not part of another word)
          const isExactWord = this.isExactWordMatch(lowerLine, searchTerm, wordIndex)
          const match = this.createMatch(
            line,
            searchTerm,
            lineIndex + 1,
            fileData,
            isExactWord,
            isExactWord ? "exact" : "partial",
          )
          matches.push(match)
        }
      }
    })

    // Limit matches per file to avoid overwhelming results
    return matches.slice(0, 10)
  }

  private createMatch(
    line: string,
    searchTerm: string,
    lineNumber: number,
    fileData: FileData,
    exactMatch: boolean,
    matchType: "exact" | "partial" | "fuzzy",
  ): SearchMatch {
    // Find which page this line belongs to
    let pageNumber = 1
    for (const page of fileData.pages) {
      if (lineNumber >= page.startLine && lineNumber <= page.endLine) {
        pageNumber = page.pageNumber
        break
      }
    }

    // Create context around the match
    const termIndex = line.toLowerCase().indexOf(searchTerm.toLowerCase())
    const start = Math.max(0, termIndex - 50)
    const end = Math.min(line.length, termIndex + searchTerm.length + 50)
    let context = line.substring(start, end)

    // Add ellipsis if needed
    if (start > 0) context = "..." + context
    if (end < line.length) context = context + "..."

    // Highlight the search term in context
    const highlightedContext = context.replace(
      new RegExp(searchTerm, "gi"),
      (match) => `<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">${match}</mark>`,
    )

    return {
      line: lineNumber,
      page: pageNumber,
      snippet: line.trim(),
      context: highlightedContext,
      exactMatch,
      matchType,
    }
  }

  private isExactWordMatch(text: string, searchTerm: string, index: number): boolean {
    const beforeChar = index > 0 ? text[index - 1] : " "
    const afterChar = index + searchTerm.length < text.length ? text[index + searchTerm.length] : " "

    // Check if the characters before and after are word boundaries
    const isWordBoundary = (char: string) => /\s|[^\w]/.test(char)

    return isWordBoundary(beforeChar) && isWordBoundary(afterChar)
  }

  getAllFiles(): FileData[] {
    return Array.from(this.index.values())
  }

  getFileCount(): number {
    return this.index.size
  }

  clear() {
    this.index.clear()
  }
}

export const searchIndex = SearchIndex.getInstance()
