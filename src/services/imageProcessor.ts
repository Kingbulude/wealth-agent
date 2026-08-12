export interface ImageProcessOptions {
  grayscale?: boolean
  contrast?: number
  brightness?: number
  binarize?: boolean
  binarizeThreshold?: number
  denoise?: boolean
  scale?: number
  sharpen?: boolean
  invertIfDark?: boolean
}

export interface ImageAnalysisResult {
  isDarkTheme: boolean
  avgBrightness: number
  contrastScore: number
  width: number
  height: number
}

export async function analyzeImage(file: File): Promise<ImageAnalysisResult> {
  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const maxDim = 800
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height))
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let totalBrightness = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    totalBrightness += luma
  }

  const pixelCount = data.length / 4
  const avgBrightness = totalBrightness / pixelCount

  // 计算对比度（相邻像素亮度差的均值）
  const w = canvas.width
  const h = canvas.height
  let diffSum = 0
  let diffCount = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const l1 = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      if (x + 1 < w) {
        const idx2 = (y * w + (x + 1)) * 4
        const l2 = 0.299 * data[idx2] + 0.587 * data[idx2 + 1] + 0.114 * data[idx2 + 2]
        diffSum += Math.abs(l1 - l2)
        diffCount++
      }
      if (y + 1 < h) {
        const idx3 = ((y + 1) * w + x) * 4
        const l3 = 0.299 * data[idx3] + 0.587 * data[idx3 + 1] + 0.114 * data[idx3 + 2]
        diffSum += Math.abs(l1 - l3)
        diffCount++
      }
    }
  }
  const contrastScore = diffCount > 0 ? diffSum / diffCount : 0

  // 判断暗色主题：平均亮度 < 128 视为暗色
  const isDarkTheme = avgBrightness < 128

  return {
    isDarkTheme,
    avgBrightness,
    contrastScore,
    width: canvas.width,
    height: canvas.height
  }
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
    sharpen = true,
    invertIfDark = true
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

  // 暗色主题自动反色，将白底黑字变为黑底白字
  if (invertIfDark) {
    const brightness = computeAverageBrightness(data)
    if (brightness < 128) {
      applyInvert(data)
    }
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

function computeAverageBrightness(data: Uint8ClampedArray): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    count++
  }
  return count > 0 ? sum / count : 128
}

function applyInvert(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]
    data[i + 1] = 255 - data[i + 1]
    data[i + 2] = 255 - data[i + 2]
  }
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

/**
 * 针对券商持仓截图的自适应图像增强（轻量版）
 *
 * 之前用 2x 放大 + 中值滤波 + 锐化，手机上处理 200-500万像素需要 2-5 分钟。
 * 百度 OCR 本身是专业级引擎，过度预处理反而降低识别率。
 *
 * 新策略：
 * 1. 最大尺寸限制为 1500px（足够 OCR 识别）
 * 2. 只做暗色主题检测与反色（白底黑字比黑底白字识别率高）
 * 3. 移除所有像素级滤波（灰度/去噪/锐化/二值化）
 * 4. JPEG 压缩到质量 0.85，降低上传流量和后端处理时间
 */
export async function enhanceForTextRecognition(file: File): Promise<File> {
  // 快速判断：小图直接返回，避免无意义处理
  if (file.size < 200 * 1024) return file

  const image = await loadImage(file)

  // 限制最长边为 1500px
  const MAX_DIM = 1500
  const scale = Math.min(1, MAX_DIM / Math.max(image.width, image.height))
  const w = Math.round(image.width * scale)
  const h = Math.round(image.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, w, h)

  // 暗色主题检测 + 反色（仅针对图片平均亮度 < 100 的深黑主题）
  // 用抽样计算亮度（步长 5），比全量计算快 25 倍
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data
  let sum = 0
  let count = 0
  const STEP = 5
  for (let i = 0; i < data.length; i += 4 * STEP) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    count++
  }
  const avgBrightness = count > 0 ? sum / count : 128

  if (avgBrightness < 100) {
    // 暗色主题：逐像素反色
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]
      data[i + 1] = 255 - data[i + 1]
      data[i + 2] = 255 - data[i + 2]
    }
    ctx.putImageData(imgData, 0, 0)
  }

  // 用 JPEG 0.85 输出，比 PNG 体积小 5-10 倍，上传和后端处理都更快
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const processedName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
          resolve(new File([blob], processedName, { type: 'image/jpeg' }))
        } else {
          resolve(file)
        }
      },
      'image/jpeg',
      0.85
    )
  })
}
