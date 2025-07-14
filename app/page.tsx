"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, Search } from "lucide-react"

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
  errorMessage?: string
}

export default function FileSearchSystem() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchMode, setSearchMode] = useState<"line" | "page">("line")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [activeSection, setActiveSection] = useState<"upload" | "search">("upload")

  const processFiles = useCallback(
    async (fileArray: File[]) => {
      setIsUploading(true)

      const initialProgress = fileArray.map((file) => ({
        filename: file.name,
        progress: 0,
        status: "uploading" as const,
      }))
      setUploadProgress(initialProgress)

      try {
        for (let i = 0; i < fileArray.length; i++) {
          const file = fileArray[i]

          setUploadProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "uploading" } : p)))

          try {
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
                extractedContent = extractResult.text || ""
                extractedLines = extractResult.lines || []
                extractedPages = extractResult.pages || []
                lineCount = extractResult.lines?.length || 0
                pageCount = extractResult.pages?.length || 0
                if (extractResult.isFallback !== undefined) {
                  isRealContent = !extractResult.isFallback
                } else {
                  const lowerContent = extractedContent.toLowerCase()
                  if (
                    lowerContent.startsWith("fallback content") ||
                    lowerContent.includes("real text extraction was not available")
                  ) {
                    isRealContent = false
                  } else {
                    isRealContent = extractedContent.length > 50
                  }
                }

              } else {
                if (extractedContent && extractedContent.length > 0 && extractedContent.startsWith("Fallback content")) {
                  setUploadProgress((prev) =>
                    prev.map((p, idx) =>
                      idx === i
                        ? { ...p, progress: 66, status: "complete", isRealContent: false, lineCount, pageCount }
                        : p,
                    ),
                  )
                } else {
                  setUploadProgress((prev) =>
                    prev.map((p, idx) => (idx === i ? { ...p, status: "error" } : p)),
                  )
                }
              }

              setUploadProgress((prev) =>
                prev.map((p, idx) =>
                  idx === i ? { ...p, progress: 66, status: "processing", isRealContent, lineCount, pageCount } : p,
                ),
              )

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
                setUploadProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "error" } : p)))
              }
            } else {
              setUploadProgress((prev) =>
                prev.map((p, idx) =>
                  idx === i ? { ...p, status: "error", errorMessage: uploadResult.error || "Unknown upload error" } : p,
                ),
              )
            }
          } catch (fileError) {
            setUploadProgress((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, status: "error", errorMessage: String(fileError) } : p)),
            )
          }
        }
      } catch (error) {
        setUploadProgress((prev) =>
          prev.map((p) => ({ ...p, status: "error", errorMessage: String(error) })),
        )
      } finally {
        setIsUploading(false)
      }
    },
    [setUploadProgress, setIsUploading],
  )

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    await processFiles(fileArray)
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const items = event.dataTransfer.items
    if (!items) return

    const files: File[] = []

    const traverseFileTree = (item: any, path = "") => {
      return new Promise<void>((resolve) => {
        if (item.isFile) {
          item.file((file: File) => {
            files.push(file)
            resolve()
          })
        } else if (item.isDirectory) {
          const dirReader = item.createReader()
          dirReader.readEntries(async (entries: any[]) => {
            for (const entry of entries) {
              await traverseFileTree(entry, path + item.name + "/")
            }
            resolve()
          })
        } else {
          resolve()
        }
      })
    }

    const traversePromises: Promise<void>[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i].webkitGetAsEntry()
      if (item) {
        traversePromises.push(traverseFileTree(item))
      }
    }

    await Promise.all(traversePromises)

    if (files.length > 0) {
      await processFiles(files)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
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
      }
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8 p-6 bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-900 rounded-xl border border-blue-500 shadow-[0_0_20px_#4f46e5]">
          <h1 className="text-4xl font-bold text-white mb-2">Document Keyword Search</h1>
          <p className="text-blue-300">Upload and search your documents</p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
              activeSection === "upload"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-blue-800 text-blue-300 hover:bg-blue-700"
            }`}
            onClick={() => setActiveSection("upload")}
          >
            <Upload size={20} />
            Upload
          </button>
          <button
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
              activeSection === "search"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-blue-800 text-blue-300 hover:bg-blue-700"
            }`}
            onClick={() => setActiveSection("search")}
          >
            <Search size={20} />
            Search
          </button>
        </div>

        {/* Conditional rendering based on activeSection */}
        {activeSection === "upload" && (
          <>
            <div className="w-full max-w-xl">
              <div
                className="border-2 border-blue-600 rounded-xl p-8 mb-8 text-center cursor-pointer shadow-[0_0_20px_#3b82f6] hover:shadow-[0_0_30px_#60a5fa] transition-transform hover:scale-[1.02]"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <p className="text-blue-300 mb-4">Upload Folder or Files</p>
                <p className="text-blue-400 mb-6">Drag &amp; drop files here, or select</p>
                <p className="text-blue-400 mb-6 font-semibold">Supported file types: PDF, DOCX, PPTX, CSV, XLSX</p>
                <div className="flex justify-center gap-4">
                  <label
                    htmlFor="folder-upload"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-[0_0_15px_#3b82f6] cursor-pointer transition"
                  >
                    Upload Folder
                  </label>
                  <input
                    type="file"
                    multiple
                    // @ts-ignore
                    webkitdirectory=""
                    onChange={handleFolderUpload}
                    className="hidden"
                    id="folder-upload"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg shadow-[0_0_15px_#a855f7] cursor-pointer transition"
                  >
                    Upload Files
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={async (e) => {
                      const files = e.target.files
                      if (!files) return
                      await processFiles(Array.from(files))
                    }}
                    className="hidden"
                    id="file-upload"
                    disabled={isUploading}
                  />
                </div>
              </div>

              {uploadProgress.length > 0 && (
                <div className="mt-8 max-w-xl mx-auto bg-indigo-900 rounded-lg p-4 border border-blue-500 shadow-[0_0_15px_#4f46e5]">
                  <h2 className="text-white text-xl font-semibold mb-4">Uploaded Files</h2>
                  <ul className="space-y-3">
                    {uploadProgress.map((file, index) => (
                      <li key={index} className="text-white">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{file.filename}</span>
                          <span className="text-sm">
                            {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                          </span>
                        </div>
                        <div className="w-full bg-blue-700 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${
                              file.status === "error" ? "bg-red-600" : "bg-green-500"
                            }`}
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        {file.errorMessage && (
                          <p className="text-red-400 text-sm mt-1">{file.errorMessage}</p>
                        )}
                        {(file.lineCount !== undefined || file.pageCount !== undefined) && (
                          <p className="text-blue-300 text-sm mt-1">
                            {file.lineCount !== undefined && <>Lines: {file.lineCount} </>}
                            {file.pageCount !== undefined && <>Pages: {file.pageCount}</>}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="w-full max-w-xl">
                <div className="relative mb-6">
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearch()
                      }
                    }}
                    className="w-full rounded-lg bg-transparent border border-blue-500 text-white placeholder-blue-400 px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 shadow-[0_0_10px_#3b82f6]"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={20} />
                </div>
              </div>
            </div>
          </>
        )}

        {activeSection === "search" && (
          <div className="mt-12 max-w-xl mx-auto p-8 rounded-xl shadow-lg bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-900 text-white">
            <h2 className="text-2xl font-semibold mb-6 text-center">Search Content</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Type and search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch()
                  }
                }}
                className="w-full rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 placeholder-blue-300 text-white px-6 py-3 pl-12 focus:outline-none focus:ring-4 focus:ring-blue-500 shadow-lg"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={20} />
            </div>
            <div className="mt-4 flex justify-center space-x-4">
              <button
                className={`px-4 py-2 rounded-full font-semibold transition ${
                  searchMode === "line"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-blue-800 text-blue-300 hover:bg-blue-700"
                }`}
                onClick={() => setSearchMode("line")}
              >
                Line
              </button>
              <button
                className={`px-4 py-2 rounded-full font-semibold transition ${
                  searchMode === "page"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-blue-800 text-blue-300 hover:bg-blue-700"
                }`}
                onClick={() => setSearchMode("page")}
              >
                Page
              </button>
            </div>

            {/* Render search results */}
            <div className="mt-8 max-h-96 overflow-y-auto">
              {searchResults.length === 0 && !isSearching && (
                <p className="text-center text-blue-300">No search results to display.</p>
              )}
              {isSearching && (
                <p className="text-center text-blue-300">Searching...</p>
              )}
              {searchResults.map((result) => (
                <div key={result.fileId} className="mb-6 p-4 bg-blue-800 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-2">{result.filename}</h3>
                  <p className="text-sm text-blue-300 mb-2">
                    Total Matches: {result.totalMatches} | Exact Matches: {result.exactMatches}
                  </p>
                  <ul className="list-disc list-inside max-h-48 overflow-y-auto">
                    {result.matches.map((match, index) => (
                      <li key={index} className={`mb-1 ${match.exactMatch ? "text-green-400" : "text-yellow-400"}`}>
                        <p>
                          <span className="font-semibold">Snippet:</span> {match.snippet}
                        </p>
                        <p className="text-xs text-blue-300">
                          Match Type: {match.matchType} {match.line !== undefined ? `| Line: ${match.line}` : ""}{" "}
                          {match.page !== undefined ? `| Page: ${match.page}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
