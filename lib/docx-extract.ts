import mammoth from "mammoth"

export async function extractDocxText(buffer: ArrayBuffer): Promise<{ text: string; lines: string[] }> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    const text = result.value || ""
    const lines = text.split(/\\r?\\n/).filter(line => line.trim().length > 0)
    return { text, lines }
  } catch (error) {
    console.error("Error extracting DOCX text:", error)
    return { text: "", lines: [] }
  }
}
