/**
 * Crop an image from a Data URI and return new cropped Data URI.
 *
 * @param dataUri - The source image as a data URI (base64).
 * @param crop - Crop region.
 * @returns Cropped image as data URI.
 */

interface CropRegion {
  x: number
  y: number
  width: number
  height: number
  mimeType?: string // Optional MIME type for the output image
}

export function cropImageFromDataURI(dataUri: string, crop: CropRegion): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = crop.width
      canvas.height = crop.height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
      //use format option from crop
      if (crop.mimeType) {
        resolve(canvas.toDataURL(crop.mimeType))
      } else resolve(canvas.toDataURL()) // default is PNG
    }
    img.onerror = reject
    img.src = dataUri
  })
}

import { GenerativePart } from '../types'

export const urlToGenerativePart = async (url: string): Promise<GenerativePart> => {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve({
          inlineData: {
            data: reader.result.split(',')[1],
            mimeType: blob.type,
          },
        })
      } else {
        reject(new Error('Failed to read blob as data URL'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
