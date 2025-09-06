import React, { useState, useEffect } from 'react'
import UrlCache from '../../database/url_cache'

interface CachedImageProps {
  src: string
  alt: string
  className: string
  messageId: string | number
  imgIdx: number
}

const CachedImage = ({ src, alt, className, messageId, imgIdx }: CachedImageProps) => {
  const [imgSrc, setImgSrc] = useState('')

  useEffect(() => {
    const loadImage = async () => {
      try {
        const cachedImage = await UrlCache.getUrl(src)
        if (cachedImage) {
          const blobUrl = URL.createObjectURL(cachedImage.blob)
          setImgSrc(blobUrl)
        } else {
          setImgSrc(src)
        }
      } catch (error) {
        console.error('Error loading image from cache:', error)
        setImgSrc(src)
      }
    }

    loadImage()
  }, [src])

  const handleImageError = async () => {
    try {
      const cachedImage = await UrlCache.getUrl(src)
      if (cachedImage) {
        const blobUrl = URL.createObjectURL(cachedImage.blob)
        setImgSrc(blobUrl)
      }
    } catch (error) {
      console.error('Error loading image from cache on error:', error)
    }
  }

  const handleImageLoad = async () => {
    try {
      const cachedImage = await UrlCache.getUrl(src)
      if (!cachedImage) {
        const response = await fetch(src)
        const blob = await response.blob()
        await UrlCache.addUrl(src, blob)
      }
    } catch (error) {
      console.error('Error caching image:', error)
    }
  }

  return (
    <img
      key={`${messageId}-img-${imgIdx}`}
      src={imgSrc}
      alt={alt}
      onLoad={handleImageLoad}
      onError={handleImageError}
      className={className}
    />
  )
}

export default CachedImage
