export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          margin_target_pct: number | null
          name: string
          notification_settings: Json | null
          plan: string
          pricing_rule: Json | null
          shopify_subscription_id: string | null
          stripe_customer_id: string | null
          subscription_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          margin_target_pct?: number | null
          name: string
          notification_settings?: Json | null
          plan?: string
          pricing_rule?: Json | null
          shopify_subscription_id?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          margin_target_pct?: number | null
          name?: string
          notification_settings?: Json | null
          plan?: string
          pricing_rule?: Json | null
          shopify_subscription_id?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      reprice_run_items: {
        Row: {
          error: string | null
          flag: 'ok' | 'cost_up' | 'below_margin' | 'unmatched' | null
          id: string
          margin_pct: number | null
          new_cost: number | null
          new_price: number | null
          old_cost: number | null
          old_price: number | null
          organization_id: string
          product_title: string | null
          run_id: string
          selected: boolean
          shopify_variant_id: string | null
          supplier_sku: string
          synced: boolean
          variant_title: string | null
        }
        Insert: {
          error?: string | null
          flag?: 'ok' | 'cost_up' | 'below_margin' | 'unmatched' | null
          id?: string
          margin_pct?: number | null
          new_cost?: number | null
          new_price?: number | null
          old_cost?: number | null
          old_price?: number | null
          organization_id: string
          product_title?: string | null
          run_id: string
          selected?: boolean
          shopify_variant_id?: string | null
          supplier_sku: string
          synced?: boolean
          variant_title?: string | null
        }
        Update: {
          error?: string | null
          flag?: 'ok' | 'cost_up' | 'below_margin' | 'unmatched' | null
          id?: string
          margin_pct?: number | null
          new_cost?: number | null
          new_price?: number | null
          old_cost?: number | null
          old_price?: number | null
          organization_id?: string
          product_title?: string | null
          run_id?: string
          selected?: boolean
          shopify_variant_id?: string | null
          supplier_sku?: string
          synced?: boolean
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reprice_run_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprice_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reprice_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      reprice_runs: {
        Row: {
          column_config: Json | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          items_below_margin: number | null
          items_changed: number | null
          items_total: number | null
          organization_id: string
          pricing_rule: Json
          rolled_back_at: string | null
          source_filename: string | null
          status: 'pending' | 'parsed' | 'previewed' | 'syncing' | 'completed' | 'failed'
        }
        Insert: {
          column_config?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          items_below_margin?: number | null
          items_changed?: number | null
          items_total?: number | null
          organization_id: string
          pricing_rule?: Json
          rolled_back_at?: string | null
          source_filename?: string | null
          status?: 'pending' | 'parsed' | 'previewed' | 'syncing' | 'completed' | 'failed'
        }
        Update: {
          column_config?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          items_below_margin?: number | null
          items_changed?: number | null
          items_total?: number | null
          organization_id?: string
          pricing_rule?: Json
          rolled_back_at?: string | null
          source_filename?: string | null
          status?: 'pending' | 'parsed' | 'previewed' | 'syncing' | 'completed' | 'failed'
        }
        Relationships: [
          {
            foreignKeyName: "reprice_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprice_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_connections: {
        Row: {
          access_token_encrypted: string
          id: string
          installed_at: string
          organization_id: string
          shop_domain: string
        }
        Insert: {
          access_token_encrypted: string
          id?: string
          installed_at?: string
          organization_id: string
          shop_domain: string
        }
        Update: {
          access_token_encrypted?: string
          id?: string
          installed_at?: string
          organization_id?: string
          shop_domain?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_mappings: {
        Row: {
          catalog_cache: Json | null
          created_at: string
          id: string
          organization_id: string
          shopify_sku: string | null
          shopify_variant_id: string
          supplier_sku: string
          target_margin_pct: number | null
        }
        Insert: {
          catalog_cache?: Json | null
          created_at?: string
          id?: string
          organization_id: string
          shopify_sku?: string | null
          shopify_variant_id: string
          supplier_sku: string
          target_margin_pct?: number | null
        }
        Update: {
          catalog_cache?: Json | null
          created_at?: string
          id?: string
          organization_id?: string
          shopify_sku?: string | null
          shopify_variant_id?: string
          supplier_sku?: string
          target_margin_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sku_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_org_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
