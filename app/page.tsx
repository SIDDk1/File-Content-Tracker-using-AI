"use client"

import type React from "react"

import { useState } from "react"
import { Upload, Search, ChevronDown, ChevronUp, Target, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SearchResult {
  filename: string
  fileType: string
  matches: {
    line?: number
    page?: number
    snippet: string
    context: string
    exactMatch: boolean
    matchType: "exact" | "partial" | "fuzzy"
  }[]
  fileUrl: string
  fileId: string
  totalMatches: number
  exactMatches: number
}

interface UploadProgress {
  filename: string
  progress: number
  status: "uploading" | "extracting" | "processing" | "complete" | "error"
  isRealContent?: boolean
  lineCount?: number
  pageCount?: number
}

export default function FileSearchSystem() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({})
  const [previewContent, setPreviewContent] = useState<Record<string, string>>({})

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const fileArray = Array.from(files)

    // Initialize progress tracking
    const initialProgress = fileArray.map((file) => ({
      filename: file.name,
      progress: 0,
      status: "uploading" as const,
    }))
    setUploadProgress(initialProgress)

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]

        // Update progress - uploading
        setUploadProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "uploading" } : p)))

        try {
          // Step 1: Upload the file
          const formData = new FormData()
          formData.append("file", file)
          formData.append("filename", file.name)

          const uploadResponse = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          })

          const uploadResult = await uploadResponse.json()

          if (uploadResponse.ok) {
            setUploadProgress((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, progress: 33, status: "extracting" } : p)),
            )

            // Step 2: Extract text from the file
            const extractFormData = new FormData()
            extractFormData.append("file", file)

            const extractResponse = await fetch("/api/extract-text", {
              method: "POST",
              body: extractFormData,
            })

            let extractedContent = ""
            let extractedLines: string[] = []
            let extractedPages: any[] = []
            let isRealContent = false
            let lineCount = 0
            let pageCount = 0

            if (extractResponse.ok) {
              const extractResult = await extractResponse.json()
              extractedContent = extractResult.extractedText || ""
              extractedLines = extractResult.extractedLines || []
              extractedPages = extractResult.extractedPages || []
              lineCount = extractResult.lineCount || 0
              pageCount = extractResult.pageCount || 0
              isRealContent = extractedContent.length > 50
              console.log(
                `Extracted ${extractedContent.length} characters, ${lineCount} lines, ${pageCount} pages from ${file.name}`,
              )

              // Store the extracted content for preview
              setPreviewContent((prev) => ({
                ...prev,
                [file.name]: extractedContent,
              }))
            } else {
              console.error(`Text extraction failed for ${file.name}`)
            }

            setUploadProgress((prev) =>
              prev.map((p, idx) =>
                idx === i ? { ...p, progress: 66, status: "processing", isRealContent, lineCount, pageCount } : p,
              ),
            )

            // Step 3: Process the file for search indexing
            const processResponse = await fetch("/api/process", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename: file.name,
                fileUrl: uploadResult.url,
                fileType: file.type,
                fileContent: extractedContent,
                extractedLines,
                extractedPages,
              }),
            })

            if (processResponse.ok) {
              const processResult = await processResponse.json()
              setUploadProgress((prev) =>
                prev.map((p, idx) =>
                  idx === i
                    ? {
                        ...p,
                        progress: 100,
                        status: "complete",
                        isRealContent: processResult.isRealContent,
                        lineCount: processResult.lineCount,
                        pageCount: processResult.pageCount,
                      }
                    : p,
                ),
              )
            } else {
              console.error(`Processing failed for ${file.name}:`, await processResponse.text())
              setUploadProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "error" } : p)))
            }
          } else {
            console.error(`Upload failed for ${file.name}:`, uploadResult.error || "Unknown error")
            setUploadProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "error" } : p)))
          }
        } catch (fileError) {
          console.error(`Error processing ${file.name}:`, fileError)
          setUploadProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "error" } : p)))
        }
      }
    } catch (error) {
      console.error("Upload error:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      })

      if (response.ok) {
        const results = await response.json()
        setSearchResults(results)

        // Reset expanded state for new search results
        const newExpandedState: Record<string, boolean> = {}
        results.forEach((result: SearchResult) => {
          newExpandedState[result.fileId] = false
        })
        setExpandedResults(newExpandedState)
      }
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const toggleResultExpansion = (fileId: string) => {
    setExpandedResults((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }))
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return "📄"
    if (fileType.includes("doc")) return "📝"
    if (fileType.includes("txt")) return "📃"
    return "📁"
  }

  const getStatusBadgeVariant = (status: string, isRealContent?: boolean) => {
    switch (status) {
      case "complete":
        return isRealContent ? "default" : "secondary"
      case "error":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const getStatusText = (status: string, isRealContent?: boolean) => {
    if (status === "complete") {
      return isRealContent ? "✓ Real Content" : "⚠ Fallback Content"
    }
    return status
  }

  const getMatchTypeBadge = (matchType: string, exactMatch: boolean) => {
    if (exactMatch) {
      return (
        <Badge variant="default" className="text-xs">
          <Target className="h-3 w-3 mr-1" />
          Exact Match
        </Badge>
      )
    } else if (matchType === "partial") {
      return (
        <Badge variant="secondary" className="text-xs">
          Partial Match
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-xs">
        Fuzzy Match
      </Badge>
    )
  }

  const formatPreviewContent = (content: string, searchTerm: string) => {
    if (!content) return "No preview available"

    // Find the first occurrence of the search term
    const searchTermLower = searchTerm.toLowerCase()
    const contentLower = content.toLowerCase()
    const termIndex = contentLower.indexOf(searchTermLower)

    if (termIndex === -1) {
      // If term not found, return the first 500 characters
      return content.substring(0, 500) + (content.length > 500 ? "..." : "")
    }

    // Get context around the search term
    const startIndex = Math.max(0, termIndex - 150)
    const endIndex = Math.min(content.length, termIndex + searchTerm.length + 150)
    let previewText = content.substring(startIndex, endIndex)

    // Add ellipsis if we're not showing from the beginning or to the end
    if (startIndex > 0) previewText = "..." + previewText
    if (endIndex < content.length) previewText = previewText + "..."

    // Highlight the search term
    const highlightedText = previewText.replace(
      new RegExp(searchTerm, "gi"),
      (match) => `<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">${match}</mark>`,
    )

    return highlightedText
  }

  return (
    <div className="min-h-screen bg-background bg-gray-500 text-foreground">
      <div className="container mx-auto p-6">
        <div className="mb-8 bg-">
          <h1 className="text-4xl font-bold mb-2">FILE-CONTENT-TRACKER</h1>
          <p className="text-black-foreground">
            Upload documents and search with high accuracy - supports exact phrases, line numbers, and page numbers
          </p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bor">
            <TabsTrigger className="border-2 border-black" value="upload">Upload Files</TabsTrigger>
            <TabsTrigger className="bg-red-500 border-2 border-red-500 text-black hover:bg-red-600" value="search">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Folder
                </CardTitle>
                <CardDescription>
                  Select a folder containing documents. The system will extract text with line and page tracking.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    multiple
                    webkitdirectory=""
                    onChange={handleFolderUpload}
                    className="hidden"
                    id="folder-upload"
                    disabled={isUploading}
                  />
                  <label htmlFor="folder-upload" className="cursor-pointer flex flex-col items-center gap-4">
                    <div className="p-4 bg-muted rounded-full">
                      <Upload className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">Choose Folder</p>
                      <p className="text-sm text-muted-foreground">Advanced text extraction with line/page tracking</p>
                    </div>
                  </label>
                </div>

                {uploadProgress.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="font-medium">Upload Progress</h3>
                    {uploadProgress.map((file, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="truncate">{file.filename}</span>
                          <div className="flex gap-2">
                            {file.lineCount && (
                              <Badge variant="outline" className="text-xs">
                                {file.lineCount} lines
                              </Badge>
                            )}
                            {file.pageCount && (
                              <Badge variant="outline" className="text-xs">
                                {file.pageCount} pages
                              </Badge>
                            )}
                            <Badge variant={getStatusBadgeVariant(file.status, file.isRealContent)}>
                              {getStatusText(file.status, file.isRealContent)}
                            </Badge>
                          </div>
                        </div>
                        <Progress value={file.progress} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Advanced Search
                </CardTitle>
                <CardDescription>
                  Search for single words or complete phrases with high accuracy matching
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder='Try "project timeline" or single words like "budget"...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? "Searching..." : "Search"}
                  </Button>
                </div>

                <Alert className="mb-4">
                  <Target className="h-4 w-4" />
                  <AlertDescription>
                    <strong>High Accuracy Search:</strong> Use quotes for exact phrases like "project timeline" or
                    search single words. Results show exact line and page numbers.
                  </AlertDescription>
                </Alert>

                {/* Debug section */}
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-sm">Debug Info</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const response = await fetch("/api/debug")
                        const data = await response.json()
                        console.log("Search Index Debug:", data)
                        alert(`Search index contains ${data.totalFiles} files. Check console for details.`)
                      }}
                    >
                      Check Search Index
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {searchResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Search Results</CardTitle>
                  <CardDescription>
                    Found {searchResults.length} files containing "{searchQuery}" with{" "}
                    {searchResults.reduce((sum, r) => sum + r.totalMatches, 0)} total matches
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {searchResults.map((result, index) => (
                      <div key={index} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div
                          className="flex items-start justify-between mb-2 cursor-pointer"
                          onClick={() => toggleResultExpansion(result.fileId)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getFileIcon(result.fileType)}</span>
                            <div>
                              <h3 className="font-medium">{result.filename}</h3>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {result.fileType}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {result.totalMatches} matches
                                </Badge>
                                {result.exactMatches > 0 && (
                                  <Badge variant="default" className="text-xs">
                                    {result.exactMatches} exact
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            {expandedResults[result.fileId] ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {result.matches.slice(0, 3).map((match, matchIndex) => (
                            <div key={matchIndex} className="bg-muted/30 p-3 rounded text-sm">
                              <div className="flex items-center gap-2 mb-2">
                                {match.line && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Hash className="h-3 w-3 mr-1" />
                                    Line {match.line}
                                  </Badge>
                                )}
                                {match.page && (
                                  <Badge variant="secondary" className="text-xs">
                                    Page {match.page}
                                  </Badge>
                                )}
                                {getMatchTypeBadge(match.matchType, match.exactMatch)}
                              </div>
                              <p
                                className="text-muted-foreground"
                                dangerouslySetInnerHTML={{ __html: match.context }}
                              />
                            </div>
                          ))}
                          {result.matches.length > 3 && (
                            <p className="text-sm text-muted-foreground text-center">
                              +{result.matches.length - 3} more matches (expand to see all)
                            </p>
                          )}
                        </div>

                        {/* File Preview Section */}
                        {expandedResults[result.fileId] && (
                          <div className="mt-4 border-t pt-4">
                            <h4 className="font-medium mb-2">All Matches & File Preview</h4>

                            {/* Show all matches when expanded */}
                            {result.matches.length > 3 && (
                              <div className="mb-4 space-y-2">
                                <h5 className="text-sm font-medium">Additional Matches:</h5>
                                {result.matches.slice(3).map((match, matchIndex) => (
                                  <div key={matchIndex + 3} className="bg-muted/20 p-2 rounded text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                      {match.line && (
                                        <Badge variant="secondary" className="text-xs">
                                          <Hash className="h-3 w-3 mr-1" />
                                          Line {match.line}
                                        </Badge>
                                      )}
                                      {match.page && (
                                        <Badge variant="secondary" className="text-xs">
                                          Page {match.page}
                                        </Badge>
                                      )}
                                      {getMatchTypeBadge(match.matchType, match.exactMatch)}
                                    </div>
                                    <p
                                      className="text-muted-foreground text-xs"
                                      dangerouslySetInnerHTML={{ __html: match.context }}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="bg-muted p-4 rounded-md max-h-96 overflow-auto">
                              {previewContent[result.filename] ? (
                                <div
                                  className="whitespace-pre-wrap text-sm"
                                  dangerouslySetInnerHTML={{
                                    __html: formatPreviewContent(previewContent[result.filename], searchQuery),
                                  }}
                                />
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  Preview not available for this file. The file may be in a format that doesn't support
                                  text extraction.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
