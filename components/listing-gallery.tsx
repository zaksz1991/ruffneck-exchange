'use client';

import { useState } from 'react';
type ListingGalleryImage = { id: string; image_url: string; sort_order: number };
type Photo = { id: string; image_url: string; alt: string };

export function ListingGallery({
  title,
  category,
  coverUrl,
  galleryImages = [],
}: {
  title: string;
  category: string;
  coverUrl: string | null;
  galleryImages?: ListingGalleryImage[];
}) {
  const photos: Photo[] = [
    ...(coverUrl ? [{ id: 'cover', image_url: coverUrl, alt: title }] : []),
    ...galleryImages.filter((photo) => Boolean(photo.image_url)).map((photo, index) => ({
      id: photo.id,
      image_url: photo.image_url,
      alt: `${title} — additional photo ${index + 1}`,
    })),
  ];
  const [activeId, setActiveId] = useState('cover');
  const active = photos.find((photo) => photo.id === activeId) ?? photos[0];

  if (!photos.length) {
    return <div className="listing-detail-image listing-image-placeholder" aria-hidden="true">
      <span>{category}</span><strong>RUFFNECK EXCHANGE</strong>
    </div>;
  }

  return <section className="listing-gallery" aria-label={`${title} photos`}>
    <img className="listing-gallery-main" src={active.image_url} alt={active.alt} decoding="async" fetchPriority="high" />
    {photos.length > 1 && <div className="listing-gallery-thumbnails" aria-label="Choose a listing photo">
      {photos.map((photo, index) => <button
        key={photo.id}
        type="button"
        className={`listing-gallery-thumbnail${active.id === photo.id ? ' is-active' : ''}`}
        aria-label={`Show photo ${index + 1} of ${photos.length}`}
        aria-pressed={active.id === photo.id}
        onClick={() => setActiveId(photo.id)}
      >
        <img src={photo.image_url} alt="" loading="lazy" decoding="async" />
      </button>)}
    </div>}
  </section>;
}
