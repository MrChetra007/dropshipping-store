import { createBrowserRouter } from "react-router-dom";

import { App } from "@/App";
import { RequireAuth } from "@/features/auth/require-auth";
import { AdminDashboardPage } from "@/pages/admin/dashboard";
import { AdminLayout } from "@/pages/admin/layout";
import { AdminProductEditPage } from "@/pages/admin/products/edit";
import { AdminImportPage } from "@/pages/admin/products/import";
import { AdminProductsPage } from "@/pages/admin/products/list";
import { AdminOrderDetailPage } from "@/pages/admin/orders/detail";
import { AdminOrdersPage } from "@/pages/admin/orders/list";
import { AccountPage } from "@/pages/account/account";
import { AuthCallbackPage } from "@/pages/account/callback";
import { LoginPage } from "@/pages/account/login";
import { SignupPage } from "@/pages/account/signup";
import { NotFoundPage } from "@/pages/not-found";
import { CartPage } from "@/pages/storefront/cart";
import { CategoryPage } from "@/pages/storefront/category";
import { CheckoutManualPage } from "@/pages/storefront/checkout-manual";
import { CheckoutMockPage } from "@/pages/storefront/checkout-mock";
import { CheckoutPage } from "@/pages/storefront/checkout";
import { CheckoutSuccessPage } from "@/pages/storefront/checkout-success";
import { HomePage } from "@/pages/storefront/home";
import { OrderPage } from "@/pages/storefront/order";
import { ProductDetailPage } from "@/pages/storefront/product-detail";
import { ProductsPage } from "@/pages/storefront/products";

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "products/:slug", element: <ProductDetailPage /> },
      { path: "categories/:slug", element: <CategoryPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "checkout", element: <CheckoutPage /> },
      { path: "checkout/manual", element: <CheckoutManualPage /> },
      { path: "checkout/mock", element: <CheckoutMockPage /> },
      { path: "checkout/success", element: <CheckoutSuccessPage /> },
      { path: "orders/:orderNumber", element: <OrderPage /> },
      {
        path: "account",
        element: (
          <RequireAuth>
            <AccountPage />
          </RequireAuth>
        ),
      },
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "auth/callback", element: <AuthCallbackPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    path: "admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: "products", element: <AdminProductsPage /> },
      { path: "products/import", element: <AdminImportPage /> },
      { path: "products/:id", element: <AdminProductEditPage /> },
      { path: "orders", element: <AdminOrdersPage /> },
      { path: "orders/:id", element: <AdminOrderDetailPage /> },
    ],
  },
]);
