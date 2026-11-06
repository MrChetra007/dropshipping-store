import { useState } from "react";

import { cn } from "@/lib/utils";

export type EditableImage = {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  variantId: string | null;
};

export function reorderImages(
  images: EditableImage[],
  from: number,
  to: number,
): EditableImage[] {
  if (from === to || from < 0 || to < 0) {
    return images;
  }

  const next = [...images];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ImageOrderList({
  images,
  onMove,
}: {
  images: EditableImage[];
  onMove: (from: number, to: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No images imported.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {images.map((image, index) => (
        <li
          key={image.id}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragIndex !== null) {
              onMove(dragIndex, index);
            }

            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
          className={cn(
            "flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-3 transition-opacity dark:border-zinc-800 dark:bg-zinc-950",
            dragIndex === index && "opacity-50",
          )}
        >
          <span
            aria-hidden
            className="cursor-grab select-none text-lg leading-none text-zinc-300 dark:text-zinc-600"
          >
            ⠿
          </span>
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <img
              src={image.url}
              alt={image.alt ?? ""}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {index === 0 ? "Main image" : `Image ${index + 1}`}
            </p>
            <p className="truncate font-mono text-xs text-zinc-400">
              {image.url}
            </p>
            {image.variantId ? (
              <p className="text-xs text-zinc-400">Variant image</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onMove(index, index - 1)}
              disabled={index === 0}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-zinc-700"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => onMove(index, index + 1)}
              disabled={index === images.length - 1}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-zinc-700"
            >
              Down
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
