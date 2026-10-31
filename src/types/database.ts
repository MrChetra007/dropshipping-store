export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          parent_id: string | null;
          image_url: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          parent_id?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          parent_id?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          category_id: string | null;
          status: Database["public"]["Enums"]["product_status"];
          tags: string[];
          is_featured: boolean;
          seo_title: string | null;
          seo_description: string | null;
          search: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          category_id?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          tags?: string[];
          is_featured?: boolean;
          seo_title?: string | null;
          seo_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          category_id?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          tags?: string[];
          is_featured?: boolean;
          seo_title?: string | null;
          seo_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          title: string;
          options: Json;
          price: number;
          compare_at_price: number | null;
          currency: string;
          stock: number | null;
          weight_g: number | null;
          is_active: boolean;
          auto_disabled_at: string | null;
          needs_review: boolean;
          review_reason: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku: string;
          title?: string;
          options?: Json;
          price: number;
          compare_at_price?: number | null;
          currency?: string;
          stock?: number | null;
          weight_g?: number | null;
          is_active?: boolean;
          auto_disabled_at?: string | null;
          needs_review?: boolean;
          review_reason?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string;
          title?: string;
          options?: Json;
          price?: number;
          compare_at_price?: number | null;
          currency?: string;
          stock?: number | null;
          weight_g?: number | null;
          is_active?: boolean;
          auto_disabled_at?: string | null;
          needs_review?: boolean;
          review_reason?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          variant_id: string | null;
          url: string;
          alt: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          variant_id?: string | null;
          url: string;
          alt?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          variant_id?: string | null;
          url?: string;
          alt?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      supplier_variants: {
        Row: {
          variant_id: string;
          supplier: string;
          supplier_product_id: string;
          supplier_variant_id: string;
          supplier_sku: string | null;
          cost_price: number;
          cost_currency: string;
          last_synced_at: string | null;
          raw: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          variant_id: string;
          supplier?: string;
          supplier_product_id: string;
          supplier_variant_id: string;
          supplier_sku?: string | null;
          cost_price: number;
          cost_currency?: string;
          last_synced_at?: string | null;
          raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          variant_id?: string;
          supplier?: string;
          supplier_product_id?: string;
          supplier_variant_id?: string;
          supplier_sku?: string | null;
          cost_price?: number;
          cost_currency?: string;
          last_synced_at?: string | null;
          raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipping_rates: {
        Row: {
          id: string;
          name: string;
          country_code: string;
          amount: number;
          free_over: number | null;
          min_days: number | null;
          max_days: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country_code?: string;
          amount: number;
          free_over?: number | null;
          min_days?: number | null;
          max_days?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          country_code?: string;
          amount?: number;
          free_over?: number | null;
          min_days?: number | null;
          max_days?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      discount_codes: {
        Row: {
          id: string;
          code: string;
          type: Database["public"]["Enums"]["discount_type"];
          value: number;
          min_subtotal: number | null;
          max_uses: number | null;
          used_count: number;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          type: Database["public"]["Enums"]["discount_type"];
          value: number;
          min_subtotal?: number | null;
          max_uses?: number | null;
          used_count?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          type?: Database["public"]["Enums"]["discount_type"];
          value?: number;
          min_subtotal?: number | null;
          max_uses?: number | null;
          used_count?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          full_name: string;
          phone: string | null;
          line1: string;
          line2: string | null;
          city: string;
          state: string | null;
          postal_code: string;
          country_code: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          full_name: string;
          phone?: string | null;
          line1: string;
          line2?: string | null;
          city: string;
          state?: string | null;
          postal_code: string;
          country_code: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string | null;
          full_name?: string;
          phone?: string | null;
          line1?: string;
          line2?: string | null;
          city?: string;
          state?: string | null;
          postal_code?: string;
          country_code?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      carts: {
        Row: {
          id: string;
          user_id: string | null;
          email: string | null;
          currency: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          email?: string | null;
          currency?: string;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          email?: string | null;
          currency?: string;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          variant_id: string;
          quantity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          variant_id: string;
          quantity: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          variant_id?: string;
          quantity?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string | null;
          email: string;
          access_token: string;
          status: Database["public"]["Enums"]["order_status"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"];
          currency: string;
          subtotal: number;
          shipping_total: number;
          discount_total: number;
          tax_total: number;
          total: number;
          discount_code_id: string | null;
          shipping_rate_name: string | null;
          ship_name: string;
          ship_phone: string | null;
          ship_line1: string;
          ship_line2: string | null;
          ship_city: string;
          ship_state: string | null;
          ship_postal_code: string;
          ship_country_code: string;
          payment_provider: string | null;
          provider_checkout_id: string | null;
          customer_note: string | null;
          paid_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          email: string;
          access_token?: string;
          status?: Database["public"]["Enums"]["order_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"];
          currency?: string;
          subtotal?: number;
          shipping_total?: number;
          discount_total?: number;
          tax_total?: number;
          total?: number;
          discount_code_id?: string | null;
          shipping_rate_name?: string | null;
          ship_name: string;
          ship_phone?: string | null;
          ship_line1: string;
          ship_line2?: string | null;
          ship_city: string;
          ship_state?: string | null;
          ship_postal_code: string;
          ship_country_code: string;
          payment_provider?: string | null;
          provider_checkout_id?: string | null;
          customer_note?: string | null;
          paid_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          email?: string;
          access_token?: string;
          status?: Database["public"]["Enums"]["order_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"];
          currency?: string;
          subtotal?: number;
          shipping_total?: number;
          discount_total?: number;
          tax_total?: number;
          total?: number;
          discount_code_id?: string | null;
          shipping_rate_name?: string | null;
          ship_name?: string;
          ship_phone?: string | null;
          ship_line1?: string;
          ship_line2?: string | null;
          ship_city?: string;
          ship_state?: string | null;
          ship_postal_code?: string;
          ship_country_code?: string;
          payment_provider?: string | null;
          provider_checkout_id?: string | null;
          customer_note?: string | null;
          paid_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          title: string;
          variant_title: string | null;
          sku: string | null;
          image_url: string | null;
          unit_price: number;
          quantity: number;
          line_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          title: string;
          variant_title?: string | null;
          sku?: string | null;
          image_url?: string | null;
          unit_price: number;
          quantity: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          title?: string;
          variant_title?: string | null;
          sku?: string | null;
          image_url?: string | null;
          unit_price?: number;
          quantity?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      order_item_costs: {
        Row: {
          order_item_id: string;
          unit_cost: number;
          currency: string;
        };
        Insert: {
          order_item_id: string;
          unit_cost: number;
          currency?: string;
        };
        Update: {
          order_item_id?: string;
          unit_cost?: number;
          currency?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          provider: string;
          provider_payment_id: string;
          amount: number;
          currency: string;
          status: Database["public"]["Enums"]["payment_status"];
          raw: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          provider: string;
          provider_payment_id: string;
          amount: number;
          currency: string;
          status?: Database["public"]["Enums"]["payment_status"];
          raw?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          provider?: string;
          provider_payment_id?: string;
          amount?: number;
          currency?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          raw?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          provider: string;
          event_id: string;
          event_type: string | null;
          payload: Json;
          status: string;
          error: string | null;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          provider: string;
          event_id: string;
          event_type?: string | null;
          payload: Json;
          status?: string;
          error?: string | null;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          provider?: string;
          event_id?: string;
          event_type?: string | null;
          payload?: Json;
          status?: string;
          error?: string | null;
          received_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      supplier_orders: {
        Row: {
          id: string;
          order_id: string;
          supplier: string;
          supplier_order_id: string | null;
          status: Database["public"]["Enums"]["supplier_order_status"];
          shipping_method: string | null;
          supplier_cost_total: number | null;
          request: Json | null;
          response: Json | null;
          error: string | null;
          attempts: number;
          next_attempt_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          supplier?: string;
          supplier_order_id?: string | null;
          status?: Database["public"]["Enums"]["supplier_order_status"];
          shipping_method?: string | null;
          supplier_cost_total?: number | null;
          request?: Json | null;
          response?: Json | null;
          error?: string | null;
          attempts?: number;
          next_attempt_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          supplier?: string;
          supplier_order_id?: string | null;
          status?: Database["public"]["Enums"]["supplier_order_status"];
          shipping_method?: string | null;
          supplier_cost_total?: number | null;
          request?: Json | null;
          response?: Json | null;
          error?: string | null;
          attempts?: number;
          next_attempt_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipments: {
        Row: {
          id: string;
          order_id: string;
          supplier_order_id: string | null;
          carrier: string | null;
          tracking_number: string;
          tracking_url: string | null;
          status: string;
          shipped_at: string | null;
          delivered_at: string | null;
          notified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          supplier_order_id?: string | null;
          carrier?: string | null;
          tracking_number: string;
          tracking_url?: string | null;
          status?: string;
          shipped_at?: string | null;
          delivered_at?: string | null;
          notified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          supplier_order_id?: string | null;
          carrier?: string | null;
          tracking_number?: string;
          tracking_url?: string | null;
          status?: string;
          shipped_at?: string | null;
          delivered_at?: string | null;
          notified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_events: {
        Row: {
          id: number;
          order_id: string;
          type: string;
          message: string | null;
          is_public: boolean;
          data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          order_id: string;
          type: string;
          message?: string | null;
          is_public?: boolean;
          data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          order_id?: string;
          type?: string;
          message?: string | null;
          is_public?: boolean;
          data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      refunds: {
        Row: {
          id: string;
          order_id: string;
          payment_id: string | null;
          amount: number;
          currency: string;
          reason: string | null;
          status: Database["public"]["Enums"]["refund_status"];
          provider_refund_id: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          payment_id?: string | null;
          amount: number;
          currency?: string;
          reason?: string | null;
          status?: Database["public"]["Enums"]["refund_status"];
          provider_refund_id?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          payment_id?: string | null;
          amount?: number;
          currency?: string;
          reason?: string | null;
          status?: Database["public"]["Enums"]["refund_status"];
          provider_refund_id?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      supplier_tokens: {
        Row: {
          supplier: string;
          access_token: string | null;
          refresh_token: string | null;
          access_expires_at: string | null;
          refresh_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          supplier: string;
          access_token?: string | null;
          refresh_token?: string | null;
          access_expires_at?: string | null;
          refresh_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          supplier?: string;
          access_token?: string | null;
          refresh_token?: string | null;
          access_expires_at?: string | null;
          refresh_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_order_profit: {
        Row: {
          order_id: string | null;
          order_number: string | null;
          created_at: string | null;
          currency: string | null;
          total: number | null;
          tax_total: number | null;
          supplier_cost: number | null;
          refunded: number | null;
          gross_profit: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      mark_order_paid: {
        Args: {
          p_order_id: string;
          p_provider: string;
          p_provider_payment_id: string;
          p_amount: number;
          p_currency: string;
          p_raw?: Json;
        };
        Returns: string;
      };
      claim_supplier_orders: {
        Args: {
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["supplier_orders"]["Row"][];
      };
      claim_supplier_order: {
        Args: {
          p_id: string;
        };
        Returns: Database["public"]["Tables"]["supplier_orders"]["Row"];
      };
      mark_supplier_order_submitted: {
        Args: {
          p_supplier_order_id: string;
          p_cj_order_id: string;
          p_shipping_method: string | null;
          p_supplier_cost: number | null;
          p_request: Json | null;
          p_response: Json | null;
        };
        Returns: undefined;
      };
      apply_supplier_order_update: {
        Args: {
          p_order_id: string;
          p_supplier_order_id: string;
          p_carrier: string | null;
          p_tracking_number: string | null;
          p_tracking_url: string | null;
          p_shipment_status: string | null;
          p_supplier_status: Database["public"]["Enums"]["supplier_order_status"];
          p_order_status: Database["public"]["Enums"]["order_status"] | null;
          p_fulfillment_status:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null;
          p_event_type: string | null;
          p_event_message: string | null;
        };
        Returns: Array<{ shipment_id: string | null; should_notify: boolean }>;
      };
    };
    Enums: {
      user_role: "customer" | "admin";
      product_status: "draft" | "active" | "archived";
      order_status:
        | "pending_payment"
        | "paid"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded";
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "partially_refunded"
        | "refunded";
      fulfillment_status:
        | "unfulfilled"
        | "queued"
        | "submitted"
        | "shipped"
        | "delivered"
        | "failed"
        | "cancelled";
      supplier_order_status:
        | "queued"
        | "submitted"
        | "confirmed"
        | "shipped"
        | "delivered"
        | "failed"
        | "cancelled";
      refund_status: "requested" | "approved" | "processed" | "rejected";
      discount_type: "percent" | "fixed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never;
