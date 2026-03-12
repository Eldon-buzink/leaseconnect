'use client';

import React from 'react';
import { getImaginImageUrl } from '@/lib/imagin';

export interface CarImageProps {
  make: string;
  model: string;
  trim?: string | null;
  year?: number | null;
  fuelType?: string | null;
  className?: string;
  angle?: string;
}

export function CarImage({ make, model, trim, year, fuelType, className, angle }: CarImageProps) {
  const url = getImaginImageUrl({
    make,
    model,
    trim,
    year,
    fuelType,
    angle: angle ?? '01',
  });

  if (!url) {
    return (
      <div className={`car-img-placeholder ${className ?? ''}`.trim()} aria-hidden>
        Image
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={className}
      loading="lazy"
      decoding="async"
      style={{ objectFit: 'cover', backgroundColor: '#eee' }}
    />
  );
}
