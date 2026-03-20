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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          state: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          state?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          state?: string
        }
        Relationships: []
      }
      community_links: {
        Row: {
          active: boolean
          created_at: string
          description: string
          display_order: number
          icon: string
          id: string
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          icon?: string
          id?: string
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          icon?: string
          id?: string
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          active: boolean
          answer: string
          created_at: string
          display_order: number
          id: string
          question: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          answer: string
          created_at?: string
          display_order?: number
          id?: string
          question: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          answer?: string
          created_at?: string
          display_order?: number
          id?: string
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      highlights: {
        Row: {
          active: boolean
          created_at: string
          description: string
          display_order: number
          id: string
          image_url: string | null
          link_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          image_url?: string | null
          link_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          image_url?: string | null
          link_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          activities: string | null
          approval_status: string
          benefits: string | null
          category_id: string | null
          city: string
          contact_name: string
          contact_phone: string
          cover_image_url: string | null
          created_at: string
          deadline: string | null
          description: string
          id: string
          neighborhood: string
          opportunity_type: string
          requirements: string | null
          salary: string | null
          schedule: string | null
          slug: string | null
          state: string
          status: string
          subtitle: string | null
          title: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          activities?: string | null
          approval_status?: string
          benefits?: string | null
          category_id?: string | null
          city?: string
          contact_name?: string
          contact_phone?: string
          cover_image_url?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          neighborhood?: string
          opportunity_type?: string
          requirements?: string | null
          salary?: string | null
          schedule?: string | null
          slug?: string | null
          state?: string
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          activities?: string | null
          approval_status?: string
          benefits?: string | null
          category_id?: string | null
          city?: string
          contact_name?: string
          contact_phone?: string
          cover_image_url?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          neighborhood?: string
          opportunity_type?: string
          requirements?: string | null
          salary?: string | null
          schedule?: string | null
          slug?: string | null
          state?: string
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          client_name: string
          created_at: string
          id: string
          message: string | null
          phone: string
          provider_id: string
          service_needed: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          client_name: string
          created_at?: string
          id?: string
          message?: string | null
          phone: string
          provider_id: string
          service_needed?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string
          id?: string
          message?: string | null
          phone?: string
          provider_id?: string
          service_needed?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          city_id: string
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      popular_services: {
        Row: {
          active: boolean
          category_name: string
          category_slug: string | null
          created_at: string
          description: string
          display_order: number
          icon: string
          id: string
          min_price: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_name?: string
          category_slug?: string | null
          created_at?: string
          description?: string
          display_order?: number
          icon?: string
          id?: string
          min_price?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_name?: string
          category_slug?: string | null
          created_at?: string
          description?: string
          display_order?: number
          icon?: string
          id?: string
          min_price?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_page_settings: {
        Row: {
          accent_color: string | null
          cover_image_url: string | null
          created_at: string
          cta_text: string | null
          cta_whatsapp_text: string | null
          facebook_url: string | null
          headline: string | null
          hidden_sections: Json
          id: string
          instagram_url: string | null
          provider_id: string
          sections_order: Json
          tagline: string | null
          theme: string | null
          tiktok_url: string | null
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          accent_color?: string | null
          cover_image_url?: string | null
          created_at?: string
          cta_text?: string | null
          cta_whatsapp_text?: string | null
          facebook_url?: string | null
          headline?: string | null
          hidden_sections?: Json
          id?: string
          instagram_url?: string | null
          provider_id: string
          sections_order?: Json
          tagline?: string | null
          theme?: string | null
          tiktok_url?: string | null
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          accent_color?: string | null
          cover_image_url?: string | null
          created_at?: string
          cta_text?: string | null
          cta_whatsapp_text?: string | null
          facebook_url?: string | null
          headline?: string | null
          hidden_sections?: Json
          id?: string
          instagram_url?: string | null
          provider_id?: string
          sections_order?: Json
          tagline?: string | null
          theme?: string | null
          tiktok_url?: string | null
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_page_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          business_name: string | null
          category_id: string | null
          city: string
          created_at: string
          description: string
          featured: boolean
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood: string
          phone: string
          photo_url: string | null
          plan: string
          rating_avg: number
          response_time: string | null
          review_count: number
          service_radius: string | null
          slug: string | null
          state: string
          status: string
          updated_at: string
          user_id: string
          website: string | null
          whatsapp: string
          working_hours: string | null
          years_experience: number
        }
        Insert: {
          business_name?: string | null
          category_id?: string | null
          city?: string
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string
          phone?: string
          photo_url?: string | null
          plan?: string
          rating_avg?: number
          response_time?: string | null
          review_count?: number
          service_radius?: string | null
          slug?: string | null
          state?: string
          status?: string
          updated_at?: string
          user_id: string
          website?: string | null
          whatsapp?: string
          working_hours?: string | null
          years_experience?: number
        }
        Update: {
          business_name?: string | null
          category_id?: string | null
          city?: string
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string
          phone?: string
          photo_url?: string | null
          plan?: string
          rating_avg?: number
          response_time?: string | null
          review_count?: number
          service_radius?: string | null
          slug?: string | null
          state?: string
          status?: string
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp?: string
          working_hours?: string | null
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "providers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          id: string
          provider_id: string
          punctuality_rating: number
          quality_rating: number
          rating: number
          service_rating: number
          user_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          provider_id: string
          punctuality_rating?: number
          quality_rating?: number
          rating?: number
          service_rating?: number
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          provider_id?: string
          punctuality_rating?: number
          quality_rating?: number
          rating?: number
          service_rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          category_id: string
          id: string
          service_id: string
        }
        Insert: {
          category_id: string
          id?: string
          service_id: string
        }
        Update: {
          category_id?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          service_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          service_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_images_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          address: string
          category_id: string | null
          created_at: string
          description: string
          id: string
          price: string | null
          provider_id: string
          service_area: string
          service_name: string
          website: string | null
          whatsapp: string
          working_hours: string
        }
        Insert: {
          address?: string
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          price?: string | null
          provider_id: string
          service_area?: string
          service_name: string
          website?: string | null
          whatsapp?: string
          working_hours?: string
        }
        Update: {
          address?: string
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          price?: string | null
          provider_id?: string
          service_area?: string
          service_name?: string
          website?: string | null
          whatsapp?: string
          working_hours?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          description: string | null
          key: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          label?: string
          updated_at?: string
          value?: string
        }
        Update: {
          description?: string | null
          key?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          active: boolean
          clicks: number
          created_at: string
          display_order: number
          end_date: string | null
          id: string
          image_url: string | null
          impressions: number
          link_url: string | null
          position: string
          start_date: string | null
          tier: string
          title: string
        }
        Insert: {
          active?: boolean
          clicks?: number
          created_at?: string
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          impressions?: number
          link_url?: string | null
          position?: string
          start_date?: string | null
          tier?: string
          title: string
        }
        Update: {
          active?: boolean
          clicks?: number
          created_at?: string
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          impressions?: number
          link_url?: string | null
          position?: string
          start_date?: string | null
          tier?: string
          title?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          plan: string
          provider_id: string
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          plan?: string
          provider_id: string
          starts_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          plan?: string
          provider_id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_sponsor_click: {
        Args: { sponsor_id: string }
        Returns: undefined
      }
      increment_sponsor_impression: {
        Args: { sponsor_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
