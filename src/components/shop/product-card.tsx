import { Link } from "react-router-dom";

import { PriceTag } from "@/components/shop/price-tag";
import { SmartImage } from "@/components/ui/smart-image";
import type { ProductCard as ProductCardData } from "@/lib/catalog";

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-950">
        {product.imageUrl ? (
          <SmartImage
            src={product.imageUrl}
            alt={product.imageAlt ?? product.title}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No image
          </div>
        )}
        {!product.inStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-slate-900/90 px-2.5 py-1 text-xs font-medium text-white">
            Out of stock
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.categoryName ? (
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
