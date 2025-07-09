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

    // Simple Levenshtein distance for fuzzy matching
    function levenshtein(a: string, b: string): number {
      const matrix = Array.from({ length: b.length + 1 }, () => new Array(a.length + 1).fill(0))
      for (let i = 0; i <= b.length; i++) matrix[i][0] = i
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b[i - 1] === a[j - 1]) matrix[i][j] = matrix[i - 1][j - 1]
          else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        }
      }
      return matrix[b.length][a.length]
    }

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
          // Check for partial phrase matches (significant portion of words present)
          const searchWords = searchTerm.split(/\s+/)
          const matchedWordsCount = searchWords.reduce((count, word) => {
            return lowerLine.includes(word.toLowerCase()) ? count + 1 : count
          }, 0)
          const matchRatio = matchedWordsCount / searchWords.length

          if (matchRatio >= 0.7) { // 70% words present
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
        } else {
          // Fuzzy match for single words with max distance 2
          const words = lowerLine.split(/\s+/)
          for (const word of words) {
            if (levenshtein(word, searchTerm) <= 2) {
              const match = this.createMatch(line, searchTerm, lineIndex + 1, fileData, false, "fuzzy")
              matches.push(match)
              break
            }
          }
        }
      }
    })

    // Limit matches per file to avoid overwhelming results, increased to 20
    return matches.slice(0, 20)
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
