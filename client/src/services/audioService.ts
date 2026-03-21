import type { AudioFile } from '@lava/shared'

export const audioService = {
  async upload(file: File, onProgress?: (pct: number) => void): Promise<AudioFile> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${xhr.responseText}`))
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Upload network error')))
      xhr.open('POST', '/api/audio/upload')
      xhr.send(formData)
    })
  },
}
