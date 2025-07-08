import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const filename = formData.get("filename") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log(`Uploading file: ${filename}, size: ${file.size} bytes`)

    // For development without Vercel Blob, simulate upload
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.log("No BLOB_READ_WRITE_TOKEN found, simulating upload...")

      // Simulate upload delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Return mock response
      return NextResponse.json({
        url: `/mock-files/${filename}`,
        filename: filename,
        size: file.size,
        type: file.type,
      })
    }

    // Real Vercel Blob upload
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: true,
      multipart: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    console.log(`Successfully uploaded: ${filename}`)

    return NextResponse.json({
      url: blob.url,
      filename: filename,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    )
  }
}
