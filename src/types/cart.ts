export type CartItem = {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  currency: string;
  quantity: number;
  lineTotalCents: number;
  stock: number | null;
  isActive: boolean;
};

export type Cart = {
  id: string;
  currency: string;
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  hasUnavailableItems: boolean;
};
