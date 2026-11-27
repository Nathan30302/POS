/** Turn a phone photo into a JPEG browsers can actually paint. */

const MAX_EDGE = 1600

export function usableImageUrl(url: string | null | undefined): string {
  const value = (url ?? '').trim()
  if (!value) return ''
  const lower = value.toLowerCase()
  if (
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'about:blank' ||
    lower.startsWith('blob:') ||
    lower.startsWith('data:')
  ) {
    return ''
  }
  return value
}

async function decodePhoto(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // HEIC and some camera files only decode via an Image element.
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('unreadable'))
      el.src = url
    })
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error('unreadable')
    }
    return await createImageBitmap(img)
  } catch {
    throw new Error(
      'Couldn’t read that photo. Choose a JPEG or PNG, or take a new picture.',
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function prepareProductPhoto(file: File): Promise<File> {
  if (!file || file.size <= 0) {
    throw new Error('That photo is empty. Try another picture.')
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Photo is too large. Choose one under 15 MB.')
  }
  const bitmap = await decodePhoto(file)
  try {
    if (bitmap.width < 2 || bitmap.height < 2) {
      throw new Error('Couldn’t read that photo. Try JPEG or PNG.')
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Couldn’t prepare that photo on this phone.')
    ctx.fillStyle = '#ece7dc'
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), 'image/jpeg', 0.82)
    })
    if (!blob || blob.size < 400) {
      throw new Error('Couldn’t read that photo. Try JPEG or PNG.')
    }
    const base =
      (file.name || 'product')
        .replace(/\.[^.]+$/, '')
        .replace(/[^\w.-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'product'
    return new File([blob], `${base}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    bitmap.close()
  }
}
