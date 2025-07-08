import { type NextRequest, NextResponse } from "next/server"
import { searchIndex } from "@/lib/search-index"

export async function GET(request: NextRequest) {
  try {
    const allFiles = searchIndex.getAllFiles()

    return NextResponse.json({
      totalFiles: searchIndex.getFileCount(),
      files: allFiles.map((file) => ({
        filename: file.filename,
        fileType: file.fileType,
        contentPreview: file.content.substring(0, 200) + "...",
        fileUrl: file.fileUrl,
      })),
    })
  } catch (error) {
    console.error("Debug error:", error)
    return NextResponse.json({ error: "Debug failed" }, { status: 500 })
  }
}
