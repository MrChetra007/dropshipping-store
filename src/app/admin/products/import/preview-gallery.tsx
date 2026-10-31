"use client";

import Image from "next/image";
import { useState } from "react";

export function PreviewGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const gallery = images.filter(Boolean);
  const [active, setActive] = useState(0);
  const current = gallery[active] ?? gallery[0];

  if (!current) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-400 dark:border-zinc-700">
        No image available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <Image
          src={current}
          alt={title}
          fill
          sizes="(min-width: 1024px) 420px, 100vw"
          className="object-contain"
        />
      </div>

      {gallery.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {gallery.slice(0, 10).map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`View image ${index + 1}`}
              aria-pressed={index === active}
              className={`relative h-16 w-16 overflow-hidden rounded-lg border transition-colors ${
                index === active
                  ? "border-zinc-900 ring-2 ring-zinc-900/10 dark:border-zinc-100 dark:ring-zinc-100/20"
                  : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
              }`}
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
