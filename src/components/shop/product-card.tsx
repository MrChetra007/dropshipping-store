import { Link } from "react-router-dom";

import { PriceTag } from "@/components/shop/price-tag";
import { SmartImage } from "@/components/ui/smart-image";
import type { ProductCard as ProductCardData } from "@/lib/catalog";

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-950">
        {product.imageUrl ? (
          <SmartImage
            src={product.imageUrl}
            alt={product.imageAlt ?? product.title}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            No image
          </div>
        )}
        {!product.inStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-zinc-900/90 px-2.5 py-1 text-xs font-medium text-white">
            Out of stock
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.categoryName ? (
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {product.categoryName}
          </p>
        ) : null}
        <p className="line-clamp-2 text-sm font-medium leading-5">
          {product.title}
        </p>
        <div className="mt-auto pt-2">
          <PriceTag
            priceCents={product.priceCents}
            compareAtCents={product.compareAtCents}
          />
        </div>
      </div>
    </Link>
  );
}
