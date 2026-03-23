export const pdfService = {
  async upload(file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/pdf/upload', { method: 'POST', body: formData })
    if (!res.ok) throw new Error(`PDF upload failed: ${res.status}`)
    return res.json() as Promise<{ url: string }>
  },
}
