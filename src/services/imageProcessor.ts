export interface ImageProcessOptions {
  grayscale?: boolean
  contrast?: number
  brightness?: number
  binarize?: boolean
  binarizeThreshold?: number
  denoise?: boolean
  scale?: number
  sharpen?: boolean
}

export async function processImage(
  file: File,
  options: ImageProcessOptions = {}
): Promise<File> {
  const {
    grayscale = true,
    contrast = 1.2,
    brightness = 0,
    binarize = false,
    binarizeThreshold = 128,
    denoise = true,
    scale = 1.5,
    sharpen = true
  } = options

  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const scaledWidth = Math.round(image.width * scale)
  const scaledHeight = Math.round(image.height * scale)
  canvas.width = scaledWidth
  canvas.height = scaledHeight

  ctx.drawImage(image, 0, 0, scaledWidth, scaledHeight)

  const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight)
  const data = imageData.data

  if (grayscale) {
    applyGrayscale(data)
  }

  if (contrast !== 1 || brightness !== 0) {
    applyContrastBrightness(data, contrast, brightness)
  }

  if (denoise) {
    applyMedianFilter(imageData)
  }

  if (sharpen) {
    applySharpen(imageData)
  }

  if (binarize) {
    applyBinarize(data, binarizeThreshold)
  }

  ctx.putImageData(imageData, 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(new File([blob], `processed_${file.name}`, { type: 'image/png' }))
      } else {
        resolve(file)
      }
    }, 'image/png', 0.95)
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function applyGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }
}

function applyContrastBrightness(data: Uint8ClampedArray, contrast: number, brightness: number): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness))
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness))
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness))
  }
}

function applyBinarize(data: Uint8ClampedArray, threshold: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i]
    const val = gray >= threshold ? 255 : 0
    data[i] = val
    data[i + 1] = val
    data[i + 2] = val
  }
}

function applyMedianFilter(imageData: ImageData): void {
  const { width, height, data } = imageData
  const output = new Uint8ClampedArray(data)
  const neighbors: number[] = []

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      neighbors.length = 0

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nIdx = ((y + dy) * width + (x + dx)) * 4
          neighbors.push(data[nIdx])
        }
      }

      neighbors.sort((a, b) => a - b)
      const median = neighbors[4]
      output[idx] = median
      output[idx + 1] = median
      output[idx + 2] = median
    }
  }

  for (let i = 0; i < data.length; i++) {
    data[i] = output[i]
  }
}

function applySharpen(imageData: ImageData): void {
  const { width, height, data } = imageData
  const output = new Uint8ClampedArray(data)
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      let r = 0, g = 0, b = 0

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nIdx = ((y + dy) * width + (x + dx)) * 4
          const kIdx = (dy + 1) * 3 + (dx + 1)
          r += data[nIdx] * kernel[kIdx]
          g += data[nIdx + 1] * kernel[kIdx]
          b += data[nIdx + 2] * kernel[kIdx]
        }
      }

      output[idx] = Math.min(255, Math.max(0, r))
      output[idx + 1] = Math.min(255, Math.max(0, g))
      output[idx + 2] = Math.min(255, Math.max(0, b))
    }
  }

  for (let i = 0; i < data.length; i++) {
    data[i] = output[i]
  }
}

export function enhanceForTextRecognition(file: File): Promise<File> {
  return processImage(file, {
    grayscale: true,
    contrast: 1.3,
    brightness: 10,
    denoise: true,
    scale: 2,
    sharpen: true,
    binarize: false
  })
}