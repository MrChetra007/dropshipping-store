export type AdminProductDetail = {
  product: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    categoryId: string | null;
    status: string;
    updatedAt: string;
  };
  supplierProductId: string | null;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    price: number;
    compareAtPrice: number | null;
    stock: number | null;
    weightG: number | null;
    isActive: boolean;
    autoDisabled: boolean;
    needsReview: boolean;
    reviewReason: string | null;
    sortOrder: number;
    costPrice: number | null;
  }>;
  images: Array<{
    id: string;
    url: string;
    alt: string | null;
    sortOrder: number;
    variantId: string | null;
  }>;
  categories: Array<{ id: string; name: string; slug: string }>;
};
