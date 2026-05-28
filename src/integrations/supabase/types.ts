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
      account_cold_storage: {
        Row: {
          archived_at: string
          created_at: string
          email: string | null
          id: string
          payload: Json
          purge_after: string
          reason: string
          user_id: string
        }
        Insert: {
          archived_at?: string
          created_at?: string
          email?: string | null
          id?: string
          payload?: Json
          purge_after?: string
          reason?: string
          user_id: string
        }
        Update: {
          archived_at?: string
          created_at?: string
          email?: string | null
          id?: string
          payload?: Json
          purge_after?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      account_deletion_requests: {
        Row: {
          admin_notes: string | null
          cancelled_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          ip_address: string | null
          processed_at: string | null
          reason: string | null
          requested_at: string
          scheduled_for: string
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          cancelled_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          ip_address?: string | null
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          cancelled_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          ip_address?: string | null
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      account_types: {
        Row: {
          active: boolean
          color: string
          created_at: string
          description: string
          display_order: number
          id: string
          max_users: number
          name: string
          price: number
          resources: Json
          storage_limit_mb: number
          tier_key: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          max_users?: number
          name: string
          price?: number
          resources?: Json
          storage_limit_mb?: number
          tier_key?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          max_users?: number
          name?: string
          price?: number
          resources?: Json
          storage_limit_mb?: number
          tier_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ad_slot_assignments: {
        Row: {
          active: boolean
          created_at: string
          end_date: string | null
          id: string
          priority: number
          slot_id: string
          sponsor_id: string
          start_date: string | null
          target_category: string | null
          target_city: string | null
          target_keywords: string | null
          target_state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          priority?: number
          slot_id: string
          sponsor_id: string
          start_date?: string | null
          target_category?: string | null
          target_city?: string | null
          target_keywords?: string | null
          target_state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          priority?: number
          slot_id?: string
          sponsor_id?: string
          start_date?: string | null
          target_category?: string | null
          target_city?: string | null
          target_keywords?: string | null
          target_state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_slot_assignments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "ad_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_slot_assignments_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_slots: {
        Row: {
          active: boolean
          created_at: string
          description: string
          display_order: number
          id: string
          max_ads: number
          name: string
          page_type: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          max_ads?: number
          name: string
          page_type?: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          max_ads?: number
          name?: string
          page_type?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      agencies: {
        Row: {
          city: string | null
          cnpj: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          slug: string
          state: string | null
          status: string
          updated_at: string
          user_id: string
          user_ref: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          slug: string
          state?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_ref?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          slug?: string
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_ref?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          resource_id: string | null
          resource_type: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string
          user_id?: string
        }
        Relationships: []
      }
      auth_profile_metrics: {
        Row: {
          attempts: number
          duration_ms: number
          environment: string | null
          id: string
          lock_broken_count: number
          outcome: string | null
          recorded_at: string
          succeeded: boolean
          user_id: string | null
        }
        Insert: {
          attempts?: number
          duration_ms?: number
          environment?: string | null
          id?: string
          lock_broken_count?: number
          outcome?: string | null
          recorded_at?: string
          succeeded?: boolean
          user_id?: string | null
        }
        Update: {
          attempts?: number
          duration_ms?: number
          environment?: string | null
          id?: string
          lock_broken_count?: number
          outcome?: string | null
          recorded_at?: string
          succeeded?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      auth_rate_limits: {
        Row: {
          attempt_count: number
          cooldown_until: string | null
          email_normalized: string | null
          flow: string
          id: string
          ip_hash: string | null
          last_attempt_at: string
          last_success_at: string | null
          metadata: Json
          window_started_at: string
        }
        Insert: {
          attempt_count?: number
          cooldown_until?: string | null
          email_normalized?: string | null
          flow: string
          id?: string
          ip_hash?: string | null
          last_attempt_at?: string
          last_success_at?: string | null
          metadata?: Json
          window_started_at?: string
        }
        Update: {
          attempt_count?: number
          cooldown_until?: string | null
          email_normalized?: string | null
          flow?: string
          id?: string
          ip_hash?: string | null
          last_attempt_at?: string
          last_success_at?: string | null
          metadata?: Json
          window_started_at?: string
        }
        Relationships: []
      }
      bet_drafts: {
        Row: {
          created_at: string
          payload: Json
          phase: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          payload?: Json
          phase?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          payload?: Json
          phase?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_discover_previews: {
        Row: {
          created_at: string
          description_variant: string
          id: string
          image_variant_url: string
          post_id: string
          ready_for_publish: boolean
          title_variant: string
          updated_at: string
          variant_name: string
        }
        Insert: {
          created_at?: string
          description_variant: string
          id?: string
          image_variant_url: string
          post_id: string
          ready_for_publish?: boolean
          title_variant: string
          updated_at?: string
          variant_name?: string
        }
        Update: {
          created_at?: string
          description_variant?: string
          id?: string
          image_variant_url?: string
          post_id?: string
          ready_for_publish?: boolean
          title_variant?: string
          updated_at?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_discover_previews_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string
          content: string
          cover_image_url: string | null
          created_at: string
          deleted_at: string | null
          excerpt: string
          featured: boolean
          id: string
          published: boolean
          slug: string
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string
          featured?: boolean
          id?: string
          published?: boolean
          slug: string
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string
          featured?: boolean
          id?: string
          published?: boolean
          slug?: string
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          icon: string
          id: string
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          blocked: boolean
          blocked_by: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_text: string | null
          participant_a: string
          participant_b: string
          unread_count_a: number
          unread_count_b: number
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          blocked_by?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          participant_a: string
          participant_b: string
          unread_count_a?: number
          unread_count_b?: number
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          blocked_by?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          participant_a?: string
          participant_b?: string
          unread_count_a?: number
          unread_count_b?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          read: boolean
          sender_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_settings: {
        Row: {
          allow_images: boolean
          allowed_profile_types: Json
          blocked_message: string
          created_at: string
          enabled: boolean
          id: string
          max_message_length: number
          min_portfolio_albums: number
          min_services: number
          updated_at: string
          welcome_message: string
        }
        Insert: {
          allow_images?: boolean
          allowed_profile_types?: Json
          blocked_message?: string
          created_at?: string
          enabled?: boolean
          id?: string
          max_message_length?: number
          min_portfolio_albums?: number
          min_services?: number
          updated_at?: string
          welcome_message?: string
        }
        Update: {
          allow_images?: boolean
          allowed_profile_types?: Json
          blocked_message?: string
          created_at?: string
          enabled?: boolean
          id?: string
          max_message_length?: number
          min_portfolio_albums?: number
          min_services?: number
          updated_at?: string
          welcome_message?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          has_providers: boolean
          ibge_code: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          provider_count: number
          slug: string
          state: string
          state_uf: string | null
        }
        Insert: {
          created_at?: string
          has_providers?: boolean
          ibge_code?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          provider_count?: number
          slug: string
          state?: string
          state_uf?: string | null
        }
        Update: {
          created_at?: string
          has_providers?: boolean
          ibge_code?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          provider_count?: number
          slug?: string
          state?: string
          state_uf?: string | null
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
      consent_revocations: {
        Row: {
          anon_id: string | null
          created_at: string
          current_state: Json | null
          id: string
          previous_state: Json | null
          read_by_admin: boolean
          revoked_categories: string[]
          source: string
          user_agent: string | null
          user_id: string | null
          version: number
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          current_state?: Json | null
          id?: string
          previous_state?: Json | null
          read_by_admin?: boolean
          revoked_categories?: string[]
          source?: string
          user_agent?: string | null
          user_id?: string | null
          version?: number
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          current_state?: Json | null
          id?: string
          previous_state?: Json | null
          read_by_admin?: boolean
          revoked_categories?: string[]
          source?: string
          user_agent?: string | null
          user_id?: string | null
          version?: number
        }
        Relationships: []
      }
      contact_clicks: {
        Row: {
          contact_type: string
          created_at: string
          id: string
          page_path: string | null
          provider_id: string
          visitor_id: string | null
        }
        Insert: {
          contact_type?: string
          created_at?: string
          id?: string
          page_path?: string | null
          provider_id: string
          visitor_id?: string | null
        }
        Update: {
          contact_type?: string
          created_at?: string
          id?: string
          page_path?: string | null
          provider_id?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_clicks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_clicks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "contact_clicks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "contact_clicks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_clicks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_clicks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_clicks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      cookie_consent_log: {
        Row: {
          analytics: boolean
          anon_id: string | null
          created_at: string
          essential: boolean
          functional: boolean
          id: string
          ip_address: string | null
          marketing: boolean
          source: string
          user_agent: string | null
          user_id: string | null
          version: number
        }
        Insert: {
          analytics?: boolean
          anon_id?: string | null
          created_at?: string
          essential?: boolean
          functional?: boolean
          id?: string
          ip_address?: string | null
          marketing?: boolean
          source?: string
          user_agent?: string | null
          user_id?: string | null
          version?: number
        }
        Update: {
          analytics?: boolean
          anon_id?: string | null
          created_at?: string
          essential?: boolean
          functional?: boolean
          id?: string
          ip_address?: string | null
          marketing?: boolean
          source?: string
          user_agent?: string | null
          user_id?: string | null
          version?: number
        }
        Relationships: []
      }
      courses: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string
          display_order: number
          duration: string
          featured: boolean
          has_certificate: boolean
          icon: string
          id: string
          image_url: string | null
          level: string
          provider: string
          provider_logo_url: string | null
          tags: string[] | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          display_order?: number
          duration?: string
          featured?: boolean
          has_certificate?: boolean
          icon?: string
          id?: string
          image_url?: string | null
          level?: string
          provider?: string
          provider_logo_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          url?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          display_order?: number
          duration?: string
          featured?: boolean
          has_certificate?: boolean
          icon?: string
          id?: string
          image_url?: string | null
          level?: string
          provider?: string
          provider_logo_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      coverage_search_log: {
        Row: {
          category_slug: string | null
          city_hint: string | null
          created_at: string
          id: string
          ip: string | null
          lat: number | null
          lng: number | null
          radius_m: number | null
          result_count: number | null
          user_agent: string | null
        }
        Insert: {
          category_slug?: string | null
          city_hint?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          lat?: number | null
          lng?: number | null
          radius_m?: number | null
          result_count?: number | null
          user_agent?: string | null
        }
        Update: {
          category_slug?: string | null
          city_hint?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          lat?: number | null
          lng?: number | null
          radius_m?: number | null
          result_count?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          id: string
          streak_count: number
          user_id: string
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          id?: string
          streak_count?: number
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          id?: string
          streak_count?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_posts: {
        Row: {
          caption: string
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          provider_id: string
          user_id: string
        }
        Insert: {
          caption: string
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          provider_id: string
          user_id: string
        }
        Update: {
          caption?: string
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          provider_id?: string
          user_id?: string
        }
        Relationships: []
      }
      db_perf_snapshots: {
        Row: {
          captured_at: string
          created_by: string | null
          id: string
          index_usage: Json
          nearby_calls: number | null
          nearby_max_ms: number | null
          nearby_mean_ms: number | null
          nearby_p95_ms: number | null
          reason: string
          reset_after: boolean
          table_sizes: Json
          top_queries: Json
        }
        Insert: {
          captured_at?: string
          created_by?: string | null
          id?: string
          index_usage?: Json
          nearby_calls?: number | null
          nearby_max_ms?: number | null
          nearby_mean_ms?: number | null
          nearby_p95_ms?: number | null
          reason?: string
          reset_after?: boolean
          table_sizes?: Json
          top_queries?: Json
        }
        Update: {
          captured_at?: string
          created_by?: string | null
          id?: string
          index_usage?: Json
          nearby_calls?: number | null
          nearby_max_ms?: number | null
          nearby_mean_ms?: number | null
          nearby_p95_ms?: number | null
          reason?: string
          reset_after?: boolean
          table_sizes?: Json
          top_queries?: Json
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message_id: string | null
          occurred_at: string
          payload: Json
          provider: string
          recipient: string | null
          subject: string | null
          template: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string
          recipient?: string | null
          subject?: string | null
          template?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string
          recipient?: string | null
          subject?: string | null
          template?: string | null
        }
        Relationships: []
      }
      engagement_log: {
        Row: {
          action_key: string
          created_at: string
          id: string
          metadata: Json | null
          points_awarded: number
          user_id: string
        }
        Insert: {
          action_key: string
          created_at?: string
          id?: string
          metadata?: Json | null
          points_awarded?: number
          user_id: string
        }
        Update: {
          action_key?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          points_awarded?: number
          user_id?: string
        }
        Relationships: []
      }
      error_page_events: {
        Row: {
          code: number
          id: string
          occurred_at: string
          path: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          code?: number
          id?: string
          occurred_at?: string
          path?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          code?: number
          id?: string
          occurred_at?: string
          path?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      error_reports: {
        Row: {
          action_context: string
          action_history: Json | null
          admin_notes: string | null
          app_version: string | null
          build_id: string | null
          component_name: string | null
          created_at: string
          error_message: string
          error_stack: string | null
          id: string
          page_path: string
          release_channel: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          screenshot_url: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
          viewport: string | null
        }
        Insert: {
          action_context?: string
          action_history?: Json | null
          admin_notes?: string | null
          app_version?: string | null
          build_id?: string | null
          component_name?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          page_path?: string
          release_channel?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_url?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
          viewport?: string | null
        }
        Update: {
          action_context?: string
          action_history?: Json | null
          admin_notes?: string | null
          app_version?: string | null
          build_id?: string | null
          component_name?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          page_path?: string
          release_channel?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_url?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
          viewport?: string | null
        }
        Relationships: []
      }
      exit_intent_events: {
        Row: {
          city: string | null
          created_at: string
          id: string
          kind: string
          meta: Json
          neighborhood: string | null
          page_kind: string | null
          pathname: string
          session_id: string | null
          source: string | null
          state: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          neighborhood?: string | null
          page_kind?: string | null
          pathname: string
          session_id?: string | null
          source?: string | null
          state?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          neighborhood?: string | null
          page_kind?: string | null
          pathname?: string
          session_id?: string | null
          source?: string | null
          state?: string | null
          user_agent?: string | null
          user_id?: string | null
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
      forbidden_service_terms: {
        Row: {
          active: boolean
          created_at: string
          id: string
          suggestion: string | null
          term: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          suggestion?: string | null
          term: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          suggestion?: string | null
          term?: string
        }
        Relationships: []
      }
      gamification_levels: {
        Row: {
          active: boolean
          badge_class: string
          benefits: Json
          color: string
          created_at: string
          feature_unlocks: Json
          icon: string
          id: string
          max_points: number | null
          min_points: number
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          badge_class?: string
          benefits?: Json
          color?: string
          created_at?: string
          feature_unlocks?: Json
          icon?: string
          id?: string
          max_points?: number | null
          min_points?: number
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          badge_class?: string
          benefits?: Json
          color?: string
          created_at?: string
          feature_unlocks?: Json
          icon?: string
          id?: string
          max_points?: number | null
          min_points?: number
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      governance_approvals: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          proposed_value: Json | null
          reason: string | null
          requested_by: string | null
          resolved_at: string | null
          rule_id: string | null
          status: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          proposed_value?: Json | null
          reason?: string | null
          requested_by?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          status?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          proposed_value?: Json | null
          reason?: string | null
          requested_by?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_approvals_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "governance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_changes_log: {
        Row: {
          action: string
          after_value: Json | null
          before_value: Json | null
          created_at: string
          id: string
          rule_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          rule_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          rule_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_changes_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "governance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string
          scope: string
          status: string
          updated_at: string
          value: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key: string
          scope: string
          status?: string
          updated_at?: string
          value?: Json
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string
          scope?: string
          status?: string
          updated_at?: string
          value?: Json
          version?: number
        }
        Relationships: []
      }
      health_check_history: {
        Row: {
          created_at: string
          failed_columns: Json
          failed_rpcs: string[]
          id: string
          ok: boolean
          raw: Json | null
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          failed_columns?: Json
          failed_rpcs?: string[]
          id?: string
          ok: boolean
          raw?: Json | null
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          failed_columns?: Json
          failed_rpcs?: string[]
          id?: string
          ok?: boolean
          raw?: Json | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      hero_banners: {
        Row: {
          active: boolean
          animation_delay: number
          animation_duration: number
          animation_type: string
          created_at: string
          cta_link: string
          cta_text: string
          display_order: number
          end_date: string | null
          id: string
          image_url: string | null
          overlay_opacity: number
          start_date: string | null
          subtitle: string
          target_city: string | null
          target_device: string
          target_state: string | null
          text_alignment: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          animation_delay?: number
          animation_duration?: number
          animation_type?: string
          created_at?: string
          cta_link?: string
          cta_text?: string
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          overlay_opacity?: number
          start_date?: string | null
          subtitle?: string
          target_city?: string | null
          target_device?: string
          target_state?: string | null
          text_alignment?: string
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          animation_delay?: number
          animation_duration?: number
          animation_type?: string
          created_at?: string
          cta_link?: string
          cta_text?: string
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          overlay_opacity?: number
          start_date?: string | null
          subtitle?: string
          target_city?: string | null
          target_device?: string
          target_state?: string | null
          text_alignment?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      highlights: {
        Row: {
          active: boolean
          button_text: string | null
          click_count: number | null
          created_at: string
          description: string
          display_order: number
          end_date: string | null
          icon: string | null
          id: string
          image_url: string | null
          link_url: string | null
          start_date: string | null
          theme_color: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          button_text?: string | null
          click_count?: number | null
          created_at?: string
          description?: string
          display_order?: number
          end_date?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          start_date?: string | null
          theme_color?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          button_text?: string | null
          click_count?: number | null
          created_at?: string
          description?: string
          display_order?: number
          end_date?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          start_date?: string | null
          theme_color?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      home_cta_blocks: {
        Row: {
          active: boolean
          button_link: string
          button_text: string
          created_at: string
          display_order: number
          icon: string
          id: string
          section: string
          subtitle: string
          title: string
          updated_at: string
          variant: string
        }
        Insert: {
          active?: boolean
          button_link?: string
          button_text?: string
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          section?: string
          subtitle?: string
          title?: string
          updated_at?: string
          variant?: string
        }
        Update: {
          active?: boolean
          button_link?: string
          button_text?: string
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          section?: string
          subtitle?: string
          title?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      home_steps: {
        Row: {
          active: boolean
          created_at: string
          description: string
          display_order: number
          icon: string
          id: string
          step: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          icon?: string
          id?: string
          step?: number
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          icon?: string
          id?: string
          step?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      home_testimonials: {
        Row: {
          active: boolean
          city: string
          created_at: string
          display_order: number
          id: string
          name: string
          rating: number
          text: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          rating?: number
          text?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          rating?: number
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      impersonation_sessions: {
        Row: {
          admin_id: string
          ended_at: string | null
          id: string
          ip_address: string | null
          reason: string | null
          started_at: string
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          admin_id: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      institutional_pages: {
        Row: {
          content: string
          created_at: string
          display_order: number
          id: string
          meta_description: string
          meta_title: string
          published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          display_order?: number
          id?: string
          meta_description?: string
          meta_title?: string
          published?: boolean
          slug: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          display_order?: number
          id?: string
          meta_description?: string
          meta_title?: string
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrity_reports: {
        Row: {
          created_at: string
          details: Json
          finding_count: number
          id: string
          ran_at: string
          scope: string
        }
        Insert: {
          created_at?: string
          details?: Json
          finding_count?: number
          id?: string
          ran_at?: string
          scope: string
        }
        Update: {
          created_at?: string
          details?: Json
          finding_count?: number
          id?: string
          ran_at?: string
          scope?: string
        }
        Relationships: []
      }
      ip_blocks: {
        Row: {
          blocked_until: string
          created_at: string
          id: string
          ip_address: string
          reason: string
          signup_count: number
        }
        Insert: {
          blocked_until?: string
          created_at?: string
          id?: string
          ip_address: string
          reason?: string
          signup_count?: number
        }
        Update: {
          blocked_until?: string
          created_at?: string
          id?: string
          ip_address?: string
          reason?: string
          signup_count?: number
        }
        Relationships: []
      }
      job_import_log: {
        Row: {
          created_at: string
          details: Json | null
          duplicate_count: number
          error_count: number
          error_message: string | null
          found_count: number
          id: string
          inserted_count: number
          source_id: string | null
          source_name: string | null
          trigger_mode: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          duplicate_count?: number
          error_count?: number
          error_message?: string | null
          found_count?: number
          id?: string
          inserted_count?: number
          source_id?: string | null
          source_name?: string | null
          trigger_mode?: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          duplicate_count?: number
          error_count?: number
          error_message?: string | null
          found_count?: number
          id?: string
          inserted_count?: number
          source_id?: string | null
          source_name?: string | null
          trigger_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_import_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_import_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      job_import_sources: {
        Row: {
          created_at: string
          default_category_id: string | null
          default_city: string | null
          default_opportunity_type: string
          default_state: string | null
          feed_url: string | null
          id: string
          is_active: boolean
          is_trusted: boolean
          last_run_at: string | null
          last_status: string | null
          name: string
          notes: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_category_id?: string | null
          default_city?: string | null
          default_opportunity_type?: string
          default_state?: string | null
          feed_url?: string | null
          id?: string
          is_active?: boolean
          is_trusted?: boolean
          last_run_at?: string | null
          last_status?: string | null
          name: string
          notes?: string | null
          source_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_category_id?: string | null
          default_city?: string | null
          default_opportunity_type?: string
          default_state?: string | null
          feed_url?: string | null
          id?: string
          is_active?: boolean
          is_trusted?: boolean
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          notes?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_import_sources_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
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
          deleted_at: string | null
          description: string
          external_id: string | null
          id: string
          import_source_id: string | null
          job_type: string
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
          user_ref: string | null
          view_count: number
          whatsapp: string
          work_model: string
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
          deleted_at?: string | null
          description?: string
          external_id?: string | null
          id?: string
          import_source_id?: string | null
          job_type?: string
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
          user_ref?: string | null
          view_count?: number
          whatsapp?: string
          work_model?: string
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
          deleted_at?: string | null
          description?: string
          external_id?: string | null
          id?: string
          import_source_id?: string | null
          job_type?: string
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
          user_ref?: string | null
          view_count?: number
          whatsapp?: string
          work_model?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_import_source_id_fkey"
            columns: ["import_source_id"]
            isOneToOne: false
            referencedRelation: "job_import_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      k6_runs: {
        Row: {
          avg_ms: number | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          error_rate: number | null
          http_reqs: number | null
          id: string
          iterations: number | null
          notes: string | null
          p95_ms: number | null
          p99_ms: number | null
          passed_slo: boolean | null
          raw_summary: Json
          scenario: string
          vus_max: number | null
        }
        Insert: {
          avg_ms?: number | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          error_rate?: number | null
          http_reqs?: number | null
          id?: string
          iterations?: number | null
          notes?: string | null
          p95_ms?: number | null
          p99_ms?: number | null
          passed_slo?: boolean | null
          raw_summary?: Json
          scenario: string
          vus_max?: number | null
        }
        Update: {
          avg_ms?: number | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          error_rate?: number | null
          http_reqs?: number | null
          id?: string
          iterations?: number | null
          notes?: string | null
          p95_ms?: number | null
          p99_ms?: number | null
          passed_slo?: boolean | null
          raw_summary?: Json
          scenario?: string
          vus_max?: number | null
        }
        Relationships: []
      }
      lead_alert_preferences: {
        Row: {
          created_at: string
          min_interval_seconds: number
          mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          min_interval_seconds?: number
          mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          min_interval_seconds?: number
          mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_contacts: {
        Row: {
          agreed_terms: boolean
          created_at: string
          email: string | null
          id: string
          page_path: string | null
          target_id: string | null
          target_label: string | null
          target_type: string
          user_agent: string | null
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          agreed_terms?: boolean
          created_at?: string
          email?: string | null
          id?: string
          page_path?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type?: string
          user_agent?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          agreed_terms?: boolean
          created_at?: string
          email?: string | null
          id?: string
          page_path?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type?: string
          user_agent?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      lead_history: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          author_id: string
          created_at: string
          entry_type: string
          id: string
          lead_id: string
          message: string | null
          new_status: string | null
          old_status: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          author_id: string
          created_at?: string
          entry_type?: string
          id?: string
          lead_id: string
          message?: string | null
          new_status?: string | null
          old_status?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          author_id?: string
          created_at?: string
          entry_type?: string
          id?: string
          lead_id?: string
          message?: string | null
          new_status?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_interactions: {
        Row: {
          created_at: string
          id: string
          interaction_type: string
          provider_id: string
          service_id: string | null
          source: string | null
          ua_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_type: string
          provider_id: string
          service_id?: string | null
          source?: string | null
          ua_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interaction_type?: string
          provider_id?: string
          service_id?: string | null
          source?: string | null
          ua_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_interactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "lead_interactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "lead_interactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "lead_interactions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          client_name: string
          closed_at: string | null
          created_at: string
          followup_window_hours: number
          id: string
          last_followup_notified_at: string | null
          last_status_at: string
          lead_context: Json
          lead_score: number
          lead_type: string
          lost_reason: string | null
          message: string | null
          next_followup_at: string | null
          phone: string
          preferred_match: string
          preferred_window: Json | null
          provider_id: string
          score_factors: Json | null
          service_needed: string | null
          status: string
          user_id: string | null
          user_ref: string | null
        }
        Insert: {
          client_name: string
          closed_at?: string | null
          created_at?: string
          followup_window_hours?: number
          id?: string
          last_followup_notified_at?: string | null
          last_status_at?: string
          lead_context?: Json
          lead_score?: number
          lead_type?: string
          lost_reason?: string | null
          message?: string | null
          next_followup_at?: string | null
          phone: string
          preferred_match?: string
          preferred_window?: Json | null
          provider_id: string
          score_factors?: Json | null
          service_needed?: string | null
          status?: string
          user_id?: string | null
          user_ref?: string | null
        }
        Update: {
          client_name?: string
          closed_at?: string | null
          created_at?: string
          followup_window_hours?: number
          id?: string
          last_followup_notified_at?: string | null
          last_status_at?: string
          lead_context?: Json
          lead_score?: number
          lead_type?: string
          lost_reason?: string | null
          message?: string | null
          next_followup_at?: string | null
          phone?: string
          preferred_match?: string
          preferred_window?: Json | null
          provider_id?: string
          score_factors?: Json | null
          service_needed?: string | null
          status?: string
          user_id?: string | null
          user_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "leads_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "leads_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      media: {
        Row: {
          blur_data_url: string | null
          created_at: string
          entity_ref: string | null
          entity_type: string
          hash: string | null
          height: number | null
          id: string
          is_active: boolean
          mime_type: string
          original_name: string
          public_url: string
          size_optimized: number | null
          size_original: number | null
          storage_path: string
          user_ref: string | null
          width: number | null
        }
        Insert: {
          blur_data_url?: string | null
          created_at?: string
          entity_ref?: string | null
          entity_type?: string
          hash?: string | null
          height?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string
          original_name?: string
          public_url?: string
          size_optimized?: number | null
          size_original?: number | null
          storage_path?: string
          user_ref?: string | null
          width?: number | null
        }
        Update: {
          blur_data_url?: string | null
          created_at?: string
          entity_ref?: string | null
          entity_type?: string
          hash?: string | null
          height?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string
          original_name?: string
          public_url?: string
          size_optimized?: number | null
          size_original?: number | null
          storage_path?: string
          user_ref?: string | null
          width?: number | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          icon: string
          id: string
          label: string
          menu_location: string
          open_in_new_tab: boolean
          parent_id: string | null
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          label?: string
          menu_location?: string
          open_in_new_tab?: boolean
          parent_id?: string | null
          updated_at?: string
          url?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          label?: string
          menu_location?: string
          open_in_new_tab?: boolean
          parent_id?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_completions: {
        Row: {
          completed_at: string
          id: string
          mission_key: string
          points_awarded: number
          provider_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          mission_key: string
          points_awarded?: number
          provider_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          mission_key?: string
          points_awarded?: number
          provider_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_completions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "mission_completions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "mission_completions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          city_id: string
          created_at: string
          geom: unknown
          id: string
          name: string
          slug: string
        }
        Insert: {
          city_id: string
          created_at?: string
          geom?: unknown
          id?: string
          name: string
          slug: string
        }
        Update: {
          city_id?: string
          created_at?: string
          geom?: unknown
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
          {
            foreignKeyName: "neighborhoods_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "city_provider_stats"
            referencedColumns: ["city_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          fts_pt: unknown
          id: string
          image_url: string | null
          link: string | null
          message: string
          metadata: Json
          read: boolean
          sent_by: string | null
          target_group: string | null
          title: string
          type: string
          user_id: string
          user_ref: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          fts_pt?: unknown
          id?: string
          image_url?: string | null
          link?: string | null
          message?: string
          metadata?: Json
          read?: boolean
          sent_by?: string | null
          target_group?: string | null
          title?: string
          type?: string
          user_id: string
          user_ref?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          fts_pt?: unknown
          id?: string
          image_url?: string | null
          link?: string | null
          message?: string
          metadata?: Json
          read?: boolean
          sent_by?: string | null
          target_group?: string | null
          title?: string
          type?: string
          user_id?: string
          user_ref?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      onboarding_events: {
        Row: {
          created_at: string
          event: string
          id: string
          meta: Json
          phase: string
          session_id: string
          user_id: string | null
          variant: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          meta?: Json
          phase: string
          session_id: string
          user_id?: string | null
          variant?: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          meta?: Json
          phase?: string
          session_id?: string
          user_id?: string | null
          variant?: string
        }
        Relationships: []
      }
      onboarding_events_daily_stats: {
        Row: {
          created_at: string
          day: string
          error_code: string
          event: string
          phase: string
          total_count: number
          unique_users: number
        }
        Insert: {
          created_at?: string
          day: string
          error_code: string
          event: string
          phase: string
          total_count?: number
          unique_users?: number
        }
        Update: {
          created_at?: string
          day?: string
          error_code?: string
          event?: string
          phase?: string
          total_count?: number
          unique_users?: number
        }
        Relationships: []
      }
      onboarding_experiment_snapshots: {
        Row: {
          captured_at: string
          experiment_id: string
          experiment_key: string
          id: string
          kind: string
          meta: Json
          rollout_reached: number
          status_at_capture: string
          variants: Json
        }
        Insert: {
          captured_at?: string
          experiment_id: string
          experiment_key: string
          id?: string
          kind: string
          meta?: Json
          rollout_reached?: number
          status_at_capture: string
          variants?: Json
        }
        Update: {
          captured_at?: string
          experiment_id?: string
          experiment_key?: string
          id?: string
          kind?: string
          meta?: Json
          rollout_reached?: number
          status_at_capture?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_experiment_snapshots_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "onboarding_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_experiments: {
        Row: {
          audience: Json
          auto_kill_enabled: boolean
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          experiment_key: string
          id: string
          last_evaluated_at: string | null
          last_kill_reason: string | null
          name: string
          rollout_percentage: number
          start_at: string | null
          status: string
          type: string
          updated_at: string
          variants: Json
        }
        Insert: {
          audience?: Json
          auto_kill_enabled?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          experiment_key: string
          id?: string
          last_evaluated_at?: string | null
          last_kill_reason?: string | null
          name: string
          rollout_percentage?: number
          start_at?: string | null
          status?: string
          type: string
          updated_at?: string
          variants?: Json
        }
        Update: {
          audience?: Json
          auto_kill_enabled?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          experiment_key?: string
          id?: string
          last_evaluated_at?: string | null
          last_kill_reason?: string | null
          name?: string
          rollout_percentage?: number
          start_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          variants?: Json
        }
        Relationships: []
      }
      onboarding_incidents: {
        Row: {
          actions: Json
          app_version: string | null
          baseline_value: number | null
          created_at: string
          duration_seconds: number | null
          flags_changed: Json
          id: string
          notes: string | null
          opened_at: string
          release_channel: string | null
          resolution_kind: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          state: string
          threshold_value: number | null
          trigger_metric: string
          trigger_value: number | null
        }
        Insert: {
          actions?: Json
          app_version?: string | null
          baseline_value?: number | null
          created_at?: string
          duration_seconds?: number | null
          flags_changed?: Json
          id?: string
          notes?: string | null
          opened_at?: string
          release_channel?: string | null
          resolution_kind?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          state?: string
          threshold_value?: number | null
          trigger_metric: string
          trigger_value?: number | null
        }
        Update: {
          actions?: Json
          app_version?: string | null
          baseline_value?: number | null
          created_at?: string
          duration_seconds?: number | null
          flags_changed?: Json
          id?: string
          notes?: string | null
          opened_at?: string
          release_channel?: string | null
          resolution_kind?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          state?: string
          threshold_value?: number | null
          trigger_metric?: string
          trigger_value?: number | null
        }
        Relationships: []
      }
      onboarding_release_snapshots: {
        Row: {
          app_version: string | null
          block_reasons: Json
          blocked: boolean
          captured_at: string
          classification: string
          created_by: string | null
          critical_regressions: number
          flags: Json
          health_score: number
          id: string
          metrics: Json
          notes: string | null
          open_incidents: number
          open_regressions: number
          release_channel: string
          stage: string
          window_hours: number
        }
        Insert: {
          app_version?: string | null
          block_reasons?: Json
          blocked?: boolean
          captured_at?: string
          classification: string
          created_by?: string | null
          critical_regressions?: number
          flags?: Json
          health_score: number
          id?: string
          metrics?: Json
          notes?: string | null
          open_incidents?: number
          open_regressions?: number
          release_channel?: string
          stage?: string
          window_hours?: number
        }
        Update: {
          app_version?: string | null
          block_reasons?: Json
          blocked?: boolean
          captured_at?: string
          classification?: string
          created_by?: string | null
          critical_regressions?: number
          flags?: Json
          health_score?: number
          id?: string
          metrics?: Json
          notes?: string | null
          open_incidents?: number
          open_regressions?: number
          release_channel?: string
          stage?: string
          window_hours?: number
        }
        Relationships: []
      }
      onboarding_settings: {
        Row: {
          active: boolean
          card1_description: string
          card1_icon: string
          card1_profile_type: string
          card1_title: string
          card2_description: string
          card2_icon: string
          card2_profile_type: string
          card2_title: string
          card3_description: string
          card3_icon: string
          card3_profile_type: string
          card3_title: string
          created_at: string
          id: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          card1_description?: string
          card1_icon?: string
          card1_profile_type?: string
          card1_title?: string
          card2_description?: string
          card2_icon?: string
          card2_profile_type?: string
          card2_title?: string
          card3_description?: string
          card3_icon?: string
          card3_profile_type?: string
          card3_title?: string
          created_at?: string
          id?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          card1_description?: string
          card1_icon?: string
          card1_profile_type?: string
          card1_title?: string
          card2_description?: string
          card2_icon?: string
          card2_profile_type?: string
          card2_title?: string
          card3_description?: string
          card3_icon?: string
          card3_profile_type?: string
          card3_title?: string
          created_at?: string
          id?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_v2_drafts: {
        Row: {
          payload: Json
          phase: string
          updated_at: string
          user_id: string
        }
        Insert: {
          payload: Json
          phase: string
          updated_at?: string
          user_id: string
        }
        Update: {
          payload?: Json
          phase?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      open_lead_responses: {
        Row: {
          created_at: string
          id: string
          open_lead_id: string
          provider_id: string
          provider_user_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          open_lead_id: string
          provider_id: string
          provider_user_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          open_lead_id?: string
          provider_id?: string
          provider_user_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_lead_responses_open_lead_id_fkey"
            columns: ["open_lead_id"]
            isOneToOne: false
            referencedRelation: "open_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      open_leads: {
        Row: {
          category_slug: string | null
          city: string
          client_name: string
          client_user_id: string | null
          client_whatsapp: string
          created_at: string
          description: string
          expires_at: string
          id: string
          service_query: string
          state: string
          status: string
        }
        Insert: {
          category_slug?: string | null
          city?: string
          client_name?: string
          client_user_id?: string | null
          client_whatsapp?: string
          created_at?: string
          description?: string
          expires_at?: string
          id?: string
          service_query: string
          state?: string
          status?: string
        }
        Update: {
          category_slug?: string | null
          city?: string
          client_name?: string
          client_user_id?: string | null
          client_whatsapp?: string
          created_at?: string
          description?: string
          expires_at?: string
          id?: string
          service_query?: string
          state?: string
          status?: string
        }
        Relationships: []
      }
      page_blocks: {
        Row: {
          active: boolean
          block_type: string
          content: Json
          created_at: string
          display_order: number
          end_date: string | null
          id: string
          page_slug: string
          sponsor_id: string | null
          start_date: string | null
          subtitle: string
          target_campaign: string | null
          target_category: string | null
          target_city: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          block_type?: string
          content?: Json
          created_at?: string
          display_order?: number
          end_date?: string | null
          id?: string
          page_slug?: string
          sponsor_id?: string | null
          start_date?: string | null
          subtitle?: string
          target_campaign?: string | null
          target_category?: string | null
          target_city?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          block_type?: string
          content?: Json
          created_at?: string
          display_order?: number
          end_date?: string | null
          id?: string
          page_slug?: string
          sponsor_id?: string | null
          start_date?: string | null
          subtitle?: string
          target_campaign?: string | null
          target_category?: string | null
          target_city?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_blocks_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reports: {
        Row: {
          backend: Json
          bottlenecks: Json
          connection_type: string | null
          created_at: string
          id: string
          navigation_type: string
          resources: Json
          route: string
          user_agent: string | null
          user_id: string | null
          viewport: string | null
          vitals: Json
        }
        Insert: {
          backend?: Json
          bottlenecks?: Json
          connection_type?: string | null
          created_at?: string
          id?: string
          navigation_type?: string
          resources?: Json
          route?: string
          user_agent?: string | null
          user_id?: string | null
          viewport?: string | null
          vitals?: Json
        }
        Update: {
          backend?: Json
          bottlenecks?: Json
          connection_type?: string | null
          created_at?: string
          id?: string
          navigation_type?: string
          resources?: Json
          route?: string
          user_agent?: string | null
          user_id?: string | null
          viewport?: string | null
          vitals?: Json
        }
        Relationships: []
      }
      plan_resources: {
        Row: {
          active: boolean
          created_at: string
          description: string
          display_order: number
          icon: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          icon?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          icon?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
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
      portability_snapshots: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          created_by: string | null
          file_count: number
          id: string
          kind: string
          label: string
          manifest: Json
          notes: string | null
          size_bytes: number
          status: string
          storage_path: string
          validated_at: string | null
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          created_by?: string | null
          file_count?: number
          id?: string
          kind?: string
          label: string
          manifest?: Json
          notes?: string | null
          size_bytes?: number
          status?: string
          storage_path: string
          validated_at?: string | null
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          created_by?: string | null
          file_count?: number
          id?: string
          kind?: string
          label?: string
          manifest?: Json
          notes?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string
          validated_at?: string | null
        }
        Relationships: []
      }
      portfolio_albums: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string
          display_order: number
          id: string
          name: string
          provider_id: string
          updated_at: string
          user_id: string
          user_ref: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          name?: string
          provider_id: string
          updated_at?: string
          user_id: string
          user_ref?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          name?: string
          provider_id?: string
          updated_at?: string
          user_id?: string
          user_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_albums_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_albums_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "portfolio_albums_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "portfolio_albums_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_albums_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_albums_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_albums_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      portfolio_photos: {
        Row: {
          album_id: string
          created_at: string
          display_order: number
          id: string
          image_url: string
          original_name: string
          storage_path: string
          user_id: string
          user_ref: string | null
        }
        Insert: {
          album_id: string
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          original_name?: string
          storage_path?: string
          user_id: string
          user_ref?: string | null
        }
        Update: {
          album_id?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          original_name?: string
          storage_path?: string
          user_id?: string
          user_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "portfolio_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_change_suggestions: {
        Row: {
          created_at: string
          field: string
          id: string
          resolved_at: string | null
          source: string
          status: string
          suggested_value: string
          user_id: string
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          resolved_at?: string | null
          source: string
          status?: string
          suggested_value: string
          user_id: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          resolved_at?: string | null
          source?: string
          status?: string
          suggested_value?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_type_settings: {
        Row: {
          active: boolean
          capabilities: Json
          color: string
          created_at: string
          default_account_type_id: string | null
          default_level_id: string | null
          description: string
          display_order: number
          icon: string
          id: string
          label: string
          profile_key: string
          role: string
          tier_key: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          capabilities?: Json
          color?: string
          created_at?: string
          default_account_type_id?: string | null
          default_level_id?: string | null
          description?: string
          display_order?: number
          icon?: string
          id?: string
          label: string
          profile_key: string
          role?: string
          tier_key?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          capabilities?: Json
          color?: string
          created_at?: string
          default_account_type_id?: string | null
          default_level_id?: string | null
          description?: string
          display_order?: number
          icon?: string
          id?: string
          label?: string
          profile_key?: string
          role?: string
          tier_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_type_settings_default_account_type_id_fkey"
            columns: ["default_account_type_id"]
            isOneToOne: false
            referencedRelation: "account_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_type_settings_default_level_id_fkey"
            columns: ["default_level_id"]
            isOneToOne: false
            referencedRelation: "public_user_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_type_settings_default_level_id_fkey"
            columns: ["default_level_id"]
            isOneToOne: false
            referencedRelation: "user_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type_id: string | null
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          bio: string | null
          celebration_muted: boolean
          city: string | null
          commercial_plan: string | null
          created_at: string
          department: string | null
          email: string | null
          engagement_points: number
          full_name: string
          id: string
          is_suspicious: boolean
          level_id: string | null
          neighborhood: string | null
          onboarding_checklist_completed_at: string | null
          onboarding_completed: boolean
          onboarding_step: number
          permissions: Json
          phone: string | null
          preferred_category_ids: string[] | null
          profile_type: string | null
          referral_code: string | null
          registration_ip: string | null
          registration_user_agent: string | null
          role: string | null
          staff_role: Database["public"]["Enums"]["app_role"] | null
          state: string | null
          status: string
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          suspicious_at: string | null
          suspicious_ip: string | null
          suspicious_reason: string | null
          tax_id: string | null
          tax_id_encrypted: string | null
          tax_id_kind: string | null
          tax_id_last4: string | null
          trial_boost_until: string | null
          updated_at: string
          user_ref: string
          whatsapp: string | null
        }
        Insert: {
          account_type_id?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          celebration_muted?: boolean
          city?: string | null
          commercial_plan?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          engagement_points?: number
          full_name?: string
          id: string
          is_suspicious?: boolean
          level_id?: string | null
          neighborhood?: string | null
          onboarding_checklist_completed_at?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          permissions?: Json
          phone?: string | null
          preferred_category_ids?: string[] | null
          profile_type?: string | null
          referral_code?: string | null
          registration_ip?: string | null
          registration_user_agent?: string | null
          role?: string | null
          staff_role?: Database["public"]["Enums"]["app_role"] | null
          state?: string | null
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          suspicious_at?: string | null
          suspicious_ip?: string | null
          suspicious_reason?: string | null
          tax_id?: string | null
          tax_id_encrypted?: string | null
          tax_id_kind?: string | null
          tax_id_last4?: string | null
          trial_boost_until?: string | null
          updated_at?: string
          user_ref: string
          whatsapp?: string | null
        }
        Update: {
          account_type_id?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          celebration_muted?: boolean
          city?: string | null
          commercial_plan?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          engagement_points?: number
          full_name?: string
          id?: string
          is_suspicious?: boolean
          level_id?: string | null
          neighborhood?: string | null
          onboarding_checklist_completed_at?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          permissions?: Json
          phone?: string | null
          preferred_category_ids?: string[] | null
          profile_type?: string | null
          referral_code?: string | null
          registration_ip?: string | null
          registration_user_agent?: string | null
          role?: string | null
          staff_role?: Database["public"]["Enums"]["app_role"] | null
          state?: string | null
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          suspicious_at?: string | null
          suspicious_ip?: string | null
          suspicious_reason?: string | null
          tax_id?: string | null
          tax_id_encrypted?: string | null
          tax_id_kind?: string | null
          tax_id_last4?: string | null
          trial_boost_until?: string | null
          updated_at?: string
          user_ref?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_type_id_fkey"
            columns: ["account_type_id"]
            isOneToOne: false
            referencedRelation: "account_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "gamification_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_daily_stats: {
        Row: {
          created_at: string
          date: string
          id: string
          phone_clicks: number
          provider_id: string
          updated_at: string
          views: number
          whatsapp_clicks: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          phone_clicks?: number
          provider_id: string
          updated_at?: string
          views?: number
          whatsapp_clicks?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          phone_clicks?: number
          provider_id?: string
          updated_at?: string
          views?: number
          whatsapp_clicks?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_daily_stats_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_daily_stats_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_daily_stats_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_daily_stats_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_daily_stats_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_daily_stats_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_daily_stats_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      provider_dashboard_sessions: {
        Row: {
          id: string
          provider_id: string
          route: string | null
          session_started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          provider_id: string
          route?: string | null
          session_started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          provider_id?: string
          route?: string | null
          session_started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_dashboard_sessions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_dashboard_sessions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_dashboard_sessions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_dashboard_sessions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_dashboard_sessions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_dashboard_sessions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_dashboard_sessions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      provider_geo_audit: {
        Row: {
          actor_user_id: string | null
          city: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          payload: Json
          provider_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          city?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          payload?: Json
          provider_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          city?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          payload?: Json
          provider_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_geo_audit_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_geo_audit_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_geo_audit_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_geo_audit_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_geo_audit_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_geo_audit_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_geo_audit_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      provider_impressions: {
        Row: {
          date: string
          id: string
          impressions: number
          provider_id: string
        }
        Insert: {
          date?: string
          id?: string
          impressions?: number
          provider_id: string
        }
        Update: {
          date?: string
          id?: string
          impressions?: number
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_impressions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_impressions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_impressions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_impressions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_impressions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_impressions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_impressions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      provider_neighborhood_corrections: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          new_neighborhood: string
          previous_neighborhood: string | null
          previous_source: string | null
          provider_id: string
          reason: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          new_neighborhood: string
          previous_neighborhood?: string | null
          previous_source?: string | null
          provider_id: string
          reason: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          new_neighborhood?: string
          previous_neighborhood?: string | null
          previous_source?: string | null
          provider_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_neighborhood_corrections_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_neighborhood_corrections_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_neighborhood_corrections_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_neighborhood_corrections_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_neighborhood_corrections_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_neighborhood_corrections_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_neighborhood_corrections_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
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
          user_ref: string | null
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
          user_ref?: string | null
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
          user_ref?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_page_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_page_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_page_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_page_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_page_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_page_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_page_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      provider_presence_sessions: {
        Row: {
          ended_at: string | null
          id: string
          last_heartbeat_at: string
          provider_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string
          provider_id?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          last_heartbeat_at?: string
          provider_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          accepts_on_demand: boolean
          account_type: string
          address_complete: boolean | null
          avg_response_minutes: number | null
          birth_date: string | null
          business_name: string | null
          business_segment: string | null
          category_custom: string | null
          category_id: string | null
          city: string
          cnpj: string | null
          community_verified: boolean
          community_verified_at: string | null
          complement: string | null
          completion_boost_until: string | null
          contact_hours: Json
          content_flags: Json | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          description: string
          featured: boolean
          geo_source: string
          geo_source_confidence: number | null
          geo_source_notes: Json
          geo_source_updated_at: string | null
          geog: unknown
          ibge_code: string | null
          id: string
          is_24h: boolean
          is_verified: boolean
          last_active_at: string | null
          last_response_calc_at: string | null
          latitude: number | null
          lead_followup_hours: number
          legal_name: string | null
          longitude: number | null
          meta_description: string | null
          meta_title: string | null
          meta_tracking: Json
          mission_answers: Json
          neighborhood: string
          neighborhood_source: string | null
          neighborhood_source_at: string | null
          notification_channels: Json
          onboarding_progress: Json | null
          opens_late_night: boolean
          opens_overnight: boolean
          opens_weekend: boolean
          phone: string
          photo_url: string | null
          plan: string
          portfolio_album_count: number
          portfolio_photo_count: number
          postal_code: string | null
          rating_avg: number
          response_time: string | null
          review_count: number
          service_radius: string | null
          services_count: number
          show_full_address: boolean
          slug: string | null
          social_links: Json
          state: string
          status: string
          street: string | null
          street_number: string | null
          updated_at: string
          user_id: string
          user_ref: string | null
          verified_at: string | null
          verified_by: string | null
          verified_criteria: Json
          verified_manual: boolean
          verified_reason: string | null
          website: string | null
          whatsapp: string
          working_hours: string | null
          working_hours_struct: Json | null
          years_experience: number
        }
        Insert: {
          accepts_on_demand?: boolean
          account_type?: string
          address_complete?: boolean | null
          avg_response_minutes?: number | null
          birth_date?: string | null
          business_name?: string | null
          business_segment?: string | null
          category_custom?: string | null
          category_id?: string | null
          city?: string
          cnpj?: string | null
          community_verified?: boolean
          community_verified_at?: string | null
          complement?: string | null
          completion_boost_until?: string | null
          contact_hours?: Json
          content_flags?: Json | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          featured?: boolean
          geo_source?: string
          geo_source_confidence?: number | null
          geo_source_notes?: Json
          geo_source_updated_at?: string | null
          geog?: unknown
          ibge_code?: string | null
          id?: string
          is_24h?: boolean
          is_verified?: boolean
          last_active_at?: string | null
          last_response_calc_at?: string | null
          latitude?: number | null
          lead_followup_hours?: number
          legal_name?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          meta_tracking?: Json
          mission_answers?: Json
          neighborhood?: string
          neighborhood_source?: string | null
          neighborhood_source_at?: string | null
          notification_channels?: Json
          onboarding_progress?: Json | null
          opens_late_night?: boolean
          opens_overnight?: boolean
          opens_weekend?: boolean
          phone?: string
          photo_url?: string | null
          plan?: string
          portfolio_album_count?: number
          portfolio_photo_count?: number
          postal_code?: string | null
          rating_avg?: number
          response_time?: string | null
          review_count?: number
          service_radius?: string | null
          services_count?: number
          show_full_address?: boolean
          slug?: string | null
          social_links?: Json
          state?: string
          status?: string
          street?: string | null
          street_number?: string | null
          updated_at?: string
          user_id: string
          user_ref?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verified_criteria?: Json
          verified_manual?: boolean
          verified_reason?: string | null
          website?: string | null
          whatsapp?: string
          working_hours?: string | null
          working_hours_struct?: Json | null
          years_experience?: number
        }
        Update: {
          accepts_on_demand?: boolean
          account_type?: string
          address_complete?: boolean | null
          avg_response_minutes?: number | null
          birth_date?: string | null
          business_name?: string | null
          business_segment?: string | null
          category_custom?: string | null
          category_id?: string | null
          city?: string
          cnpj?: string | null
          community_verified?: boolean
          community_verified_at?: string | null
          complement?: string | null
          completion_boost_until?: string | null
          contact_hours?: Json
          content_flags?: Json | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          featured?: boolean
          geo_source?: string
          geo_source_confidence?: number | null
          geo_source_notes?: Json
          geo_source_updated_at?: string | null
          geog?: unknown
          ibge_code?: string | null
          id?: string
          is_24h?: boolean
          is_verified?: boolean
          last_active_at?: string | null
          last_response_calc_at?: string | null
          latitude?: number | null
          lead_followup_hours?: number
          legal_name?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          meta_tracking?: Json
          mission_answers?: Json
          neighborhood?: string
          neighborhood_source?: string | null
          neighborhood_source_at?: string | null
          notification_channels?: Json
          onboarding_progress?: Json | null
          opens_late_night?: boolean
          opens_overnight?: boolean
          opens_weekend?: boolean
          phone?: string
          photo_url?: string | null
          plan?: string
          portfolio_album_count?: number
          portfolio_photo_count?: number
          postal_code?: string | null
          rating_avg?: number
          response_time?: string | null
          review_count?: number
          service_radius?: string | null
          services_count?: number
          show_full_address?: boolean
          slug?: string | null
          social_links?: Json
          state?: string
          status?: string
          street?: string | null
          street_number?: string | null
          updated_at?: string
          user_id?: string
          user_ref?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verified_criteria?: Json
          verified_manual?: boolean
          verified_reason?: string | null
          website?: string | null
          whatsapp?: string
          working_hours?: string | null
          working_hours_struct?: Json | null
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
      public_activities: {
        Row: {
          action_text: string
          actor_alias: string
          category_name: string | null
          city: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_seed: boolean | null
          profile_type: string | null
        }
        Insert: {
          action_text: string
          actor_alias: string
          category_name?: string | null
          city?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_seed?: boolean | null
          profile_type?: string | null
        }
        Update: {
          action_text?: string
          actor_alias?: string
          category_name?: string | null
          city?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_seed?: boolean | null
          profile_type?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      pwa_install_events: {
        Row: {
          created_at: string
          device_type: string
          event_type: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          device_type?: string
          event_type: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          device_type?: string
          event_type?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      pwa_install_settings: {
        Row: {
          accent_color: string
          animation_duration: number
          animation_type: string
          created_at: string
          cta_text: string
          dismiss_cooldown_days: number
          dismiss_text: string
          enabled: boolean
          footer_cta_text: string
          homepage_section_cta: string
          homepage_section_subtitle: string
          homepage_section_title: string
          id: string
          ios_instruction: string
          max_impressions: number
          min_visits: number
          show_delay_seconds: number
          show_floating_banner: boolean
          show_for_logged_in: boolean
          show_for_visitors: boolean
          show_homepage_section: boolean
          show_in_footer: boolean
          show_on_desktop: boolean
          show_on_mobile: boolean
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          animation_duration?: number
          animation_type?: string
          created_at?: string
          cta_text?: string
          dismiss_cooldown_days?: number
          dismiss_text?: string
          enabled?: boolean
          footer_cta_text?: string
          homepage_section_cta?: string
          homepage_section_subtitle?: string
          homepage_section_title?: string
          id?: string
          ios_instruction?: string
          max_impressions?: number
          min_visits?: number
          show_delay_seconds?: number
          show_floating_banner?: boolean
          show_for_logged_in?: boolean
          show_for_visitors?: boolean
          show_homepage_section?: boolean
          show_in_footer?: boolean
          show_on_desktop?: boolean
          show_on_mobile?: boolean
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          animation_duration?: number
          animation_type?: string
          created_at?: string
          cta_text?: string
          dismiss_cooldown_days?: number
          dismiss_text?: string
          enabled?: boolean
          footer_cta_text?: string
          homepage_section_cta?: string
          homepage_section_subtitle?: string
          homepage_section_title?: string
          id?: string
          ios_instruction?: string
          max_impressions?: number
          min_visits?: number
          show_delay_seconds?: number
          show_floating_banner?: boolean
          show_for_logged_in?: boolean
          show_for_visitors?: boolean
          show_homepage_section?: boolean
          show_in_footer?: boolean
          show_on_desktop?: boolean
          show_on_mobile?: boolean
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      query_telemetry: {
        Row: {
          created_at: string
          duration_ms: number
          id: string
          label: string
          meta: Json
          rows_returned: number | null
          user_ref: string | null
        }
        Insert: {
          created_at?: string
          duration_ms: number
          id?: string
          label: string
          meta?: Json
          rows_returned?: number | null
          user_ref?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number
          id?: string
          label?: string
          meta?: Json
          rows_returned?: number | null
          user_ref?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_key: string
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          action_key: string
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          action_key?: string
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          metadata: Json
          points_awarded: number
          qualified_at: string | null
          referral_code: string
          referred_id: string
          referrer_id: string
          rewarded_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          points_awarded?: number
          qualified_at?: string | null
          referral_code: string
          referred_id: string
          referrer_id: string
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          points_awarded?: number
          qualified_at?: string | null
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          rewarded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      registration_blocks: {
        Row: {
          blocked_at: string
          blocked_user_id: string | null
          device_fingerprint: string | null
          email: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_permanent: boolean
          postal_code: string | null
          reason: string | null
          street_number: string | null
          whatsapp: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_user_id?: string | null
          device_fingerprint?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_permanent?: boolean
          postal_code?: string | null
          reason?: string | null
          street_number?: string | null
          whatsapp?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_user_id?: string | null
          device_fingerprint?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_permanent?: boolean
          postal_code?: string | null
          reason?: string | null
          street_number?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      registration_snapshots: {
        Row: {
          accuracy_m: number | null
          auth_provider: string | null
          battery_charging: boolean | null
          battery_level: number | null
          browser_name: string | null
          browser_version: string | null
          came_from_link: boolean | null
          captured_at: string
          city: string | null
          city_geoip: string | null
          connection_downlink_mbps: number | null
          connection_rtt_ms: number | null
          connection_type: string | null
          country: string | null
          created_at: string
          device_brand: string | null
          device_fingerprint: string | null
          device_imei: string | null
          device_model: string | null
          device_pixel_ratio: number | null
          email: string | null
          id: string
          ip_address: string | null
          isp: string | null
          landing_url: string | null
          language: string | null
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          online_at_signup: boolean | null
          origin_summary: Json | null
          os_name: string | null
          os_version: string | null
          postal_code: string | null
          raw_meta: Json | null
          region: string | null
          screen_height: number | null
          screen_width: number | null
          signup_method: string | null
          signup_referrer: string | null
          state: string | null
          street: string | null
          street_number: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          timezone: string | null
          user_agent: string | null
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          velocity_mps: number | null
          was_moving: boolean | null
          whatsapp: string | null
        }
        Insert: {
          accuracy_m?: number | null
          auth_provider?: string | null
          battery_charging?: boolean | null
          battery_level?: number | null
          browser_name?: string | null
          browser_version?: string | null
          came_from_link?: boolean | null
          captured_at?: string
          city?: string | null
          city_geoip?: string | null
          connection_downlink_mbps?: number | null
          connection_rtt_ms?: number | null
          connection_type?: string | null
          country?: string | null
          created_at?: string
          device_brand?: string | null
          device_fingerprint?: string | null
          device_imei?: string | null
          device_model?: string | null
          device_pixel_ratio?: number | null
          email?: string | null
          id?: string
          ip_address?: string | null
          isp?: string | null
          landing_url?: string | null
          language?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          online_at_signup?: boolean | null
          origin_summary?: Json | null
          os_name?: string | null
          os_version?: string | null
          postal_code?: string | null
          raw_meta?: Json | null
          region?: string | null
          screen_height?: number | null
          screen_width?: number | null
          signup_method?: string | null
          signup_referrer?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          velocity_mps?: number | null
          was_moving?: boolean | null
          whatsapp?: string | null
        }
        Update: {
          accuracy_m?: number | null
          auth_provider?: string | null
          battery_charging?: boolean | null
          battery_level?: number | null
          browser_name?: string | null
          browser_version?: string | null
          came_from_link?: boolean | null
          captured_at?: string
          city?: string | null
          city_geoip?: string | null
          connection_downlink_mbps?: number | null
          connection_rtt_ms?: number | null
          connection_type?: string | null
          country?: string | null
          created_at?: string
          device_brand?: string | null
          device_fingerprint?: string | null
          device_imei?: string | null
          device_model?: string | null
          device_pixel_ratio?: number | null
          email?: string | null
          id?: string
          ip_address?: string | null
          isp?: string | null
          landing_url?: string | null
          language?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          online_at_signup?: boolean | null
          origin_summary?: Json | null
          os_name?: string | null
          os_version?: string | null
          postal_code?: string | null
          raw_meta?: Json | null
          region?: string | null
          screen_height?: number | null
          screen_width?: number | null
          signup_method?: string | null
          signup_referrer?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          velocity_mps?: number | null
          was_moving?: boolean | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          admin_note: string
          approval_status: string
          comment: string
          created_at: string
          id: string
          provider_id: string
          punctuality_rating: number
          quality_rating: number
          rating: number
          service_rating: number
          user_id: string
          user_ref: string | null
        }
        Insert: {
          admin_note?: string
          approval_status?: string
          comment?: string
          created_at?: string
          id?: string
          provider_id: string
          punctuality_rating?: number
          quality_rating?: number
          rating?: number
          service_rating?: number
          user_id: string
          user_ref?: string | null
        }
        Update: {
          admin_note?: string
          approval_status?: string
          comment?: string
          created_at?: string
          id?: string
          provider_id?: string
          punctuality_rating?: number
          quality_rating?: number
          rating?: number
          service_rating?: number
          user_id?: string
          user_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      rls_policy_snapshots: {
        Row: {
          captured_at: string
          cmd: string | null
          id: string
          is_permissive_write: boolean
          is_public_or_anon: boolean
          policyname: string
          qual: string | null
          roles: string[] | null
          schemaname: string
          snapshot_date: string
          tablename: string
          with_check: string | null
        }
        Insert: {
          captured_at?: string
          cmd?: string | null
          id?: string
          is_permissive_write?: boolean
          is_public_or_anon?: boolean
          policyname: string
          qual?: string | null
          roles?: string[] | null
          schemaname: string
          snapshot_date?: string
          tablename: string
          with_check?: string | null
        }
        Update: {
          captured_at?: string
          cmd?: string | null
          id?: string
          is_permissive_write?: boolean
          is_public_or_anon?: boolean
          policyname?: string
          qual?: string | null
          roles?: string[] | null
          schemaname?: string
          snapshot_date?: string
          tablename?: string
          with_check?: string | null
        }
        Relationships: []
      }
      runtime_component_health: {
        Row: {
          component_name: string
          created_at: string
          failure_count: number
          id: string
          last_checked_at: string | null
          last_error: string | null
          status: string
        }
        Insert: {
          component_name: string
          created_at?: string
          failure_count?: number
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          status?: string
        }
        Update: {
          component_name?: string
          created_at?: string
          failure_count?: number
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          status?: string
        }
        Relationships: []
      }
      runtime_fallback_registry: {
        Row: {
          component: string
          created_at: string
          fallback_type: string
          id: string
          strategy_json: Json
          updated_at: string
        }
        Insert: {
          component: string
          created_at?: string
          fallback_type?: string
          id?: string
          strategy_json?: Json
          updated_at?: string
        }
        Update: {
          component?: string
          created_at?: string
          fallback_type?: string
          id?: string
          strategy_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      score_rules: {
        Row: {
          action_key: string
          active: boolean
          category: string
          cooldown_hours: number | null
          created_at: string
          description: string
          id: string
          label: string
          max_per_day: number | null
          points: number
          updated_at: string
        }
        Insert: {
          action_key: string
          active?: boolean
          category?: string
          cooldown_hours?: number | null
          created_at?: string
          description?: string
          id?: string
          label: string
          max_per_day?: number | null
          points?: number
          updated_at?: string
        }
        Update: {
          action_key?: string
          active?: boolean
          category?: string
          cooldown_hours?: number | null
          created_at?: string
          description?: string
          id?: string
          label?: string
          max_per_day?: number | null
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      search_demand_logs: {
        Row: {
          category_slug: string | null
          city: string | null
          created_at: string
          geog: unknown
          id: string
          latitude: number | null
          longitude: number | null
          query: string | null
        }
        Insert: {
          category_slug?: string | null
          city?: string | null
          created_at?: string
          geog?: unknown
          id?: string
          latitude?: number | null
          longitude?: number | null
          query?: string | null
        }
        Update: {
          category_slug?: string | null
          city?: string | null
          created_at?: string
          geog?: unknown
          id?: string
          latitude?: number | null
          longitude?: number | null
          query?: string | null
        }
        Relationships: []
      }
      search_intent_log: {
        Row: {
          category_name: string | null
          category_slug: string | null
          city: string | null
          created_at: string
          id: string
          state: string | null
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          category_name?: string | null
          category_slug?: string | null
          city?: string | null
          created_at?: string
          id?: string
          state?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          category_name?: string | null
          category_slug?: string | null
          city?: string | null
          created_at?: string
          id?: string
          state?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      seo_audit_reports: {
        Row: {
          duration_ms: number | null
          error_count: number
          findings: Json
          id: string
          ok_count: number
          ran_at: string
          robots_issues: Json
          robots_ok: boolean
          sitemap_url: string | null
          total_urls: number
          triggered_by: string | null
          warning_count: number
        }
        Insert: {
          duration_ms?: number | null
          error_count?: number
          findings?: Json
          id?: string
          ok_count?: number
          ran_at?: string
          robots_issues?: Json
          robots_ok?: boolean
          sitemap_url?: string | null
          total_urls?: number
          triggered_by?: string | null
          warning_count?: number
        }
        Update: {
          duration_ms?: number | null
          error_count?: number
          findings?: Json
          id?: string
          ok_count?: number
          ran_at?: string
          robots_issues?: Json
          robots_ok?: boolean
          sitemap_url?: string | null
          total_urls?: number
          triggered_by?: string | null
          warning_count?: number
        }
        Relationships: []
      }
      service_area_corrections: {
        Row: {
          attempt_payload: Json | null
          blocked: boolean
          corrected_by: string | null
          created_at: string
          id: string
          new_value: string | null
          previous_value: string | null
          provider_id: string | null
          reason: string
          service_id: string
          source: string
        }
        Insert: {
          attempt_payload?: Json | null
          blocked?: boolean
          corrected_by?: string | null
          created_at?: string
          id?: string
          new_value?: string | null
          previous_value?: string | null
          provider_id?: string | null
          reason?: string
          service_id: string
          source?: string
        }
        Update: {
          attempt_payload?: Json | null
          blocked?: boolean
          corrected_by?: string | null
          created_at?: string
          id?: string
          new_value?: string | null
          previous_value?: string | null
          provider_id?: string | null
          reason?: string
          service_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_area_corrections_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_area_sync_runs: {
        Row: {
          affected_count: number
          created_at: string
          dry_run: boolean
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          timezone: string | null
          triggered_by: string
          triggered_user_id: string | null
        }
        Insert: {
          affected_count?: number
          created_at?: string
          dry_run?: boolean
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          timezone?: string | null
          triggered_by?: string
          triggered_user_id?: string | null
        }
        Update: {
          affected_count?: number
          created_at?: string
          dry_run?: boolean
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          timezone?: string | null
          triggered_by?: string
          triggered_user_id?: string | null
        }
        Relationships: []
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
          is_cover: boolean
          service_id: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_cover?: boolean
          service_id: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_cover?: boolean
          service_id?: string
          storage_path?: string | null
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
      service_quality_log: {
        Row: {
          category_keywords_hit: string[] | null
          created_at: string
          description_length: number | null
          final_score: number
          forbidden_hits: string[] | null
          id: string
          initial_score: number | null
          provider_id: string | null
          reason: string | null
          service_id: string | null
          user_id: string | null
        }
        Insert: {
          category_keywords_hit?: string[] | null
          created_at?: string
          description_length?: number | null
          final_score: number
          forbidden_hits?: string[] | null
          id?: string
          initial_score?: number | null
          provider_id?: string | null
          reason?: string | null
          service_id?: string | null
          user_id?: string | null
        }
        Update: {
          category_keywords_hit?: string[] | null
          created_at?: string
          description_length?: number | null
          final_score?: number
          forbidden_hits?: string[] | null
          id?: string
          initial_score?: number | null
          provider_id?: string | null
          reason?: string | null
          service_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          accepts_on_demand: boolean
          address: string
          category_id: string
          created_at: string
          deleted_at: string | null
          description: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_24h: boolean
          is_emergency: boolean
          meta_description: string | null
          meta_title: string | null
          opens_late_night: boolean
          opens_overnight: boolean
          opens_weekend: boolean
          price: string | null
          provider_id: string
          seo_tags: string[]
          service_area: string
          service_name: string
          service_radius: string
          updated_at: string
          user_ref: string | null
          view_count: number
          website: string | null
          whatsapp: string
          working_hours: string
          working_hours_struct: Json | null
          youtube_url: string | null
        }
        Insert: {
          accepts_on_demand?: boolean
          address?: string
          category_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_24h?: boolean
          is_emergency?: boolean
          meta_description?: string | null
          meta_title?: string | null
          opens_late_night?: boolean
          opens_overnight?: boolean
          opens_weekend?: boolean
          price?: string | null
          provider_id: string
          seo_tags?: string[]
          service_area?: string
          service_name: string
          service_radius?: string
          updated_at?: string
          user_ref?: string | null
          view_count?: number
          website?: string | null
          whatsapp?: string
          working_hours?: string
          working_hours_struct?: Json | null
          youtube_url?: string | null
        }
        Update: {
          accepts_on_demand?: boolean
          address?: string
          category_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_24h?: boolean
          is_emergency?: boolean
          meta_description?: string | null
          meta_title?: string | null
          opens_late_night?: boolean
          opens_overnight?: boolean
          opens_weekend?: boolean
          price?: string | null
          provider_id?: string
          seo_tags?: string[]
          service_area?: string
          service_name?: string
          service_radius?: string
          updated_at?: string
          user_ref?: string | null
          view_count?: number
          website?: string | null
          whatsapp?: string
          working_hours?: string
          working_hours_struct?: Json | null
          youtube_url?: string | null
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
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      site_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          label?: string
          updated_at?: string
          value?: string
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      sponsor_billing_cycles: {
        Row: {
          admin_note: string | null
          amount: number | null
          auto_renew: boolean
          base_amount: number | null
          breakdown: Json
          created_at: string
          created_by: string | null
          cycle_end: string
          cycle_start: string
          grace_until: string | null
          id: string
          invoice_reference: string | null
          paid_at: string | null
          payment_method: string | null
          performance_amount: number
          performance_leads: number
          renewal_requested: boolean
          renewal_requested_at: string | null
          sponsor_id: string
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount?: number | null
          auto_renew?: boolean
          base_amount?: number | null
          breakdown?: Json
          created_at?: string
          created_by?: string | null
          cycle_end: string
          cycle_start?: string
          grace_until?: string | null
          id?: string
          invoice_reference?: string | null
          paid_at?: string | null
          payment_method?: string | null
          performance_amount?: number
          performance_leads?: number
          renewal_requested?: boolean
          renewal_requested_at?: string | null
          sponsor_id: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number | null
          auto_renew?: boolean
          base_amount?: number | null
          breakdown?: Json
          created_at?: string
          created_by?: string | null
          cycle_end?: string
          cycle_start?: string
          grace_until?: string | null
          id?: string
          invoice_reference?: string | null
          paid_at?: string | null
          payment_method?: string | null
          performance_amount?: number
          performance_leads?: number
          renewal_requested?: boolean
          renewal_requested_at?: string | null
          sponsor_id?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_billing_cycles_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_billing_cycles_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "sponsor_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_campaigns: {
        Row: {
          budget: number | null
          created_at: string
          description: string
          end_date: string | null
          id: string
          name: string
          sponsor_id: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          name: string
          sponsor_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          name?: string
          sponsor_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_campaigns_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_change_requests: {
        Row: {
          admin_comment: string | null
          changes: Json
          created_at: string
          current_snapshot: Json
          id: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          sponsor_id: string
          status: string
          storage_paths: string[]
          updated_at: string
        }
        Insert: {
          admin_comment?: string | null
          changes?: Json
          created_at?: string
          current_snapshot?: Json
          id?: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sponsor_id: string
          status?: string
          storage_paths?: string[]
          updated_at?: string
        }
        Update: {
          admin_comment?: string | null
          changes?: Json
          created_at?: string
          current_snapshot?: Json
          id?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sponsor_id?: string
          status?: string
          storage_paths?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_change_requests_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_contacts: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          email: string | null
          id: string
          permissions: Json
          phone: string | null
          role: string
          sponsor_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string | null
          id?: string
          permissions?: Json
          phone?: string | null
          role?: string
          sponsor_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string | null
          id?: string
          permissions?: Json
          phone?: string | null
          role?: string
          sponsor_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_contacts_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_contracts: {
        Row: {
          contract_number: string
          created_at: string
          end_date: string | null
          id: string
          notes: string
          sponsor_id: string
          start_date: string | null
          status: string
          updated_at: string
          value: number | null
        }
        Insert: {
          contract_number?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string
          sponsor_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          contract_number?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string
          sponsor_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_contracts_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_docs_history: {
        Row: {
          action: string
          created_at: string
          doc_type: string
          id: string
          lead_id: string
          metadata: Json
          new_value: string | null
          old_value: string | null
          performed_by: string | null
          performed_ip: string | null
          reason: string | null
          status: string | null
        }
        Insert: {
          action: string
          created_at?: string
          doc_type: string
          id?: string
          lead_id: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          performed_ip?: string | null
          reason?: string | null
          status?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          doc_type?: string
          id?: string
          lead_id?: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          performed_ip?: string | null
          reason?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_docs_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sponsor_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_invoices: {
        Row: {
          billing_cycle_id: string | null
          change_request_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_at: string | null
          id: string
          invoice_number: number
          issued_at: string
          items: Json
          notes: string | null
          paid_at: string | null
          pdf_url: string | null
          sponsor_id: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          billing_cycle_id?: string | null
          change_request_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number?: number
          issued_at?: string
          items?: Json
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          sponsor_id: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          billing_cycle_id?: string | null
          change_request_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number?: number
          issued_at?: string
          items?: Json
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          sponsor_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_invoices_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "sponsor_billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_invoices_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "sponsor_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_invoices_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_leads: {
        Row: {
          additional_docs: Json
          banner_url: string | null
          category: string | null
          checklist_confirmed: boolean
          city: string | null
          cnpj: string
          cnpj_document_url: string | null
          company_name: string
          contract_accepted: boolean
          created_at: string
          docs_review_notes: string | null
          docs_reviewed_at: string | null
          docs_reviewed_by: string | null
          docs_status: string
          docs_submitted_at: string | null
          email: string
          id: string
          notes: string | null
          pending_items: string[] | null
          phone: string
          plan: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          additional_docs?: Json
          banner_url?: string | null
          category?: string | null
          checklist_confirmed?: boolean
          city?: string | null
          cnpj: string
          cnpj_document_url?: string | null
          company_name: string
          contract_accepted?: boolean
          created_at?: string
          docs_review_notes?: string | null
          docs_reviewed_at?: string | null
          docs_reviewed_by?: string | null
          docs_status?: string
          docs_submitted_at?: string | null
          email: string
          id?: string
          notes?: string | null
          pending_items?: string[] | null
          phone: string
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          additional_docs?: Json
          banner_url?: string | null
          category?: string | null
          checklist_confirmed?: boolean
          city?: string | null
          cnpj?: string
          cnpj_document_url?: string | null
          company_name?: string
          contract_accepted?: boolean
          created_at?: string
          docs_review_notes?: string | null
          docs_reviewed_at?: string | null
          docs_reviewed_by?: string | null
          docs_status?: string
          docs_submitted_at?: string | null
          email?: string
          id?: string
          notes?: string | null
          pending_items?: string[] | null
          phone?: string
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sponsor_metrics: {
        Row: {
          count: number
          created_at: string
          event_date: string
          event_type: string
          id: string
          page_path: string | null
          slot_slug: string
          sponsor_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          page_path?: string | null
          slot_slug?: string
          sponsor_id: string
        }
        Update: {
          count?: number
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          page_path?: string | null
          slot_slug?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_metrics_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          sponsor_id: string
        }
        Insert: {
          author_id: string
          content?: string
          created_at?: string
          id?: string
          sponsor_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_notes_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          sponsor_id: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          sponsor_id: string
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          sponsor_id?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_notifications_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          external_reference: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string
          period_end: string | null
          period_start: string | null
          plan_id: string | null
          receipt_url: string | null
          sponsor_id: string
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          external_reference?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          receipt_url?: string | null
          sponsor_id: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          external_reference?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          receipt_url?: string | null
          sponsor_id?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "sponsor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_payments_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "sponsor_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_plans: {
        Row: {
          active: boolean | null
          budget_limit: number | null
          created_at: string
          description: string | null
          display_order: number | null
          duration_days: number
          features: Json | null
          id: string
          included_categories: Json
          included_cities: Json
          max_impressions: number | null
          max_slots: number | null
          max_slots_per_category: number
          max_slots_per_city: number
          name: string
          performance_rate_per_lead: number
          price_monthly: number | null
          price_yearly: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          budget_limit?: number | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_days?: number
          features?: Json | null
          id?: string
          included_categories?: Json
          included_cities?: Json
          max_impressions?: number | null
          max_slots?: number | null
          max_slots_per_category?: number
          max_slots_per_city?: number
          name: string
          performance_rate_per_lead?: number
          price_monthly?: number | null
          price_yearly?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          budget_limit?: number | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_days?: number
          features?: Json | null
          id?: string
          included_categories?: Json
          included_cities?: Json
          max_impressions?: number | null
          max_slots?: number | null
          max_slots_per_category?: number
          max_slots_per_city?: number
          name?: string
          performance_rate_per_lead?: number
          price_monthly?: number | null
          price_yearly?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      sponsor_regions: {
        Row: {
          city_id: string | null
          created_at: string
          exclusive: boolean | null
          id: string
          notes: string | null
          sponsor_id: string
          state_uf: string | null
          updated_at: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          exclusive?: boolean | null
          id?: string
          notes?: string | null
          sponsor_id: string
          state_uf?: string | null
          updated_at?: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          exclusive?: boolean | null
          id?: string
          notes?: string | null
          sponsor_id?: string
          state_uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_regions_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_regions_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "city_provider_stats"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "sponsor_regions_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_slot_limits: {
        Row: {
          context_type: string
          context_value: string
          created_at: string
          id: string
          max_slots: number
          updated_at: string
        }
        Insert: {
          context_type?: string
          context_value?: string
          created_at?: string
          id?: string
          max_slots?: number
          updated_at?: string
        }
        Update: {
          context_type?: string
          context_value?: string
          created_at?: string
          id?: string
          max_slots?: number
          updated_at?: string
        }
        Relationships: []
      }
      sponsor_subscriptions: {
        Row: {
          amount_paid: number | null
          billing_cycle: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          notes: string | null
          payment_method: string | null
          pending_change_at: string | null
          pending_plan_id: string | null
          plan_id: string
          sponsor_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          pending_change_at?: string | null
          pending_plan_id?: string | null
          plan_id: string
          sponsor_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          pending_change_at?: string | null
          pending_plan_id?: string | null
          plan_id?: string
          sponsor_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_subscriptions_pending_plan_id_fkey"
            columns: ["pending_plan_id"]
            isOneToOne: false
            referencedRelation: "sponsor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "sponsor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_subscriptions_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          active: boolean
          ad_format: string
          approved_at: string | null
          approved_by: string | null
          badge_type: string
          campaign_end: string | null
          campaign_start: string | null
          clicks: number
          cnpj: string | null
          company_name: string
          created_at: string
          deleted_at: string | null
          delivered_impressions: number
          display_order: number
          email: string | null
          end_date: string | null
          external_link: string | null
          full_description: string
          guaranteed_impressions: number | null
          id: string
          image_url: string | null
          impressions: number
          last_delivery_check_at: string | null
          last_viewed_status: string | null
          link_url: string | null
          linked_category: string | null
          linked_category_slug: string | null
          linked_city: string | null
          linked_city_slug: string | null
          logo_url: string | null
          max_height: number
          max_width: number
          needs_compensation: boolean
          pacing_status: string
          phone: string | null
          plan: string
          plan_tier: string
          position: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          short_description: string
          slug: string | null
          sponsor_type: string
          start_date: string | null
          status: string
          target_pages: string
          tier: string
          title: string
          user_id: string | null
          user_ref: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          ad_format?: string
          approved_at?: string | null
          approved_by?: string | null
          badge_type?: string
          campaign_end?: string | null
          campaign_start?: string | null
          clicks?: number
          cnpj?: string | null
          company_name?: string
          created_at?: string
          deleted_at?: string | null
          delivered_impressions?: number
          display_order?: number
          email?: string | null
          end_date?: string | null
          external_link?: string | null
          full_description?: string
          guaranteed_impressions?: number | null
          id?: string
          image_url?: string | null
          impressions?: number
          last_delivery_check_at?: string | null
          last_viewed_status?: string | null
          link_url?: string | null
          linked_category?: string | null
          linked_category_slug?: string | null
          linked_city?: string | null
          linked_city_slug?: string | null
          logo_url?: string | null
          max_height?: number
          max_width?: number
          needs_compensation?: boolean
          pacing_status?: string
          phone?: string | null
          plan?: string
          plan_tier?: string
          position?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          short_description?: string
          slug?: string | null
          sponsor_type?: string
          start_date?: string | null
          status?: string
          target_pages?: string
          tier?: string
          title: string
          user_id?: string | null
          user_ref?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          ad_format?: string
          approved_at?: string | null
          approved_by?: string | null
          badge_type?: string
          campaign_end?: string | null
          campaign_start?: string | null
          clicks?: number
          cnpj?: string | null
          company_name?: string
          created_at?: string
          deleted_at?: string | null
          delivered_impressions?: number
          display_order?: number
          email?: string | null
          end_date?: string | null
          external_link?: string | null
          full_description?: string
          guaranteed_impressions?: number | null
          id?: string
          image_url?: string | null
          impressions?: number
          last_delivery_check_at?: string | null
          last_viewed_status?: string | null
          link_url?: string | null
          linked_category?: string | null
          linked_category_slug?: string | null
          linked_city?: string | null
          linked_city_slug?: string | null
          logo_url?: string | null
          max_height?: number
          max_width?: number
          needs_compensation?: boolean
          pacing_status?: string
          phone?: string | null
          plan?: string
          plan_tier?: string
          position?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          short_description?: string
          slug?: string | null
          sponsor_type?: string
          start_date?: string | null
          status?: string
          target_pages?: string
          tier?: string
          title?: string
          user_id?: string | null
          user_ref?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      states: {
        Row: {
          created_at: string
          id: string
          name: string
          region: string
          uf: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region?: string
          uf: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region?: string
          uf?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          account_type_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          plan: string
          provider_id: string
          starts_at: string
          status: string
        }
        Insert: {
          account_type_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          plan?: string
          provider_id: string
          starts_at?: string
          status?: string
        }
        Update: {
          account_type_id?: string | null
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
            foreignKeyName: "subscriptions_account_type_id_fkey"
            columns: ["account_type_id"]
            isOneToOne: false
            referencedRelation: "account_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "subscriptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "subscriptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      support_context_snapshot_log: {
        Row: {
          account_level: string | null
          created_at: string
          current_plan: string | null
          id: string
          profile_slug: string | null
          snapshot: Json
          ticket_id: string
          user_id: string
        }
        Insert: {
          account_level?: string | null
          created_at?: string
          current_plan?: string | null
          id?: string
          profile_slug?: string | null
          snapshot?: Json
          ticket_id: string
          user_id: string
        }
        Update: {
          account_level?: string | null
          created_at?: string
          current_plan?: string | null
          id?: string
          profile_slug?: string | null
          snapshot?: Json
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_context_snapshot_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
          sender_role: Database["public"]["Enums"]["support_message_role"]
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
          sender_role: Database["public"]["Enums"]["support_message_role"]
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
          sender_role?: Database["public"]["Enums"]["support_message_role"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          blocked: boolean
          consecutive_user_msgs: number
          context: Json
          created_at: string
          id: string
          last_message_at: string | null
          last_message_text: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          unread_admin: number
          unread_user: number
          updated_at: string
          user_city: string | null
          user_full_name: string | null
          user_id: string
        }
        Insert: {
          blocked?: boolean
          consecutive_user_msgs?: number
          context?: Json
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          unread_admin?: number
          unread_user?: number
          updated_at?: string
          user_city?: string | null
          user_full_name?: string | null
          user_id: string
        }
        Update: {
          blocked?: boolean
          consecutive_user_msgs?: number
          context?: Json
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          unread_admin?: number
          unread_user?: number
          updated_at?: string
          user_city?: string | null
          user_full_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_audit_logs: {
        Row: {
          acted_as_admin_id: string | null
          action: string
          context_metadata: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          staff_id: string | null
          target_user_id: string | null
        }
        Insert: {
          acted_as_admin_id?: string | null
          action: string
          context_metadata?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          staff_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          acted_as_admin_id?: string | null
          action?: string
          context_metadata?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          staff_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      system_contract_map: {
        Row: {
          contract_json: Json
          created_at: string
          entity_name: string
          entity_type: string
          id: string
          last_verified_at: string | null
          status: string
        }
        Insert: {
          contract_json?: Json
          created_at?: string
          entity_name: string
          entity_type: string
          id?: string
          last_verified_at?: string | null
          status?: string
        }
        Update: {
          contract_json?: Json
          created_at?: string
          entity_name?: string
          entity_type?: string
          id?: string
          last_verified_at?: string | null
          status?: string
        }
        Relationships: []
      }
      system_drift_reports: {
        Row: {
          description: string
          detected_at: string
          id: string
          resolution_note: string | null
          resolved: boolean
          severity: string
          type: string
        }
        Insert: {
          description: string
          detected_at?: string
          id?: string
          resolution_note?: string | null
          resolved?: boolean
          severity?: string
          type: string
        }
        Update: {
          description?: string
          detected_at?: string
          id?: string
          resolution_note?: string | null
          resolved?: boolean
          severity?: string
          type?: string
        }
        Relationships: []
      }
      tier_rules: {
        Row: {
          can_access_crm: boolean
          can_access_featured: boolean
          can_access_reports: boolean
          can_create_services: boolean
          can_receive_leads: boolean
          can_use_advanced_dashboard: boolean
          can_view_client_phone: boolean
          created_at: string
          id: string
          max_ads: number
          max_leads: number
          max_services: number
          max_slots: number
          radius_km: number
          ranking_priority: number
          search_boost: number
          tier_key: string
          tier_label: string
          top_search_placement: boolean
          updated_at: string
          verified_badge: boolean
        }
        Insert: {
          can_access_crm?: boolean
          can_access_featured?: boolean
          can_access_reports?: boolean
          can_create_services?: boolean
          can_receive_leads?: boolean
          can_use_advanced_dashboard?: boolean
          can_view_client_phone?: boolean
          created_at?: string
          id?: string
          max_ads?: number
          max_leads?: number
          max_services?: number
          max_slots?: number
          radius_km?: number
          ranking_priority?: number
          search_boost?: number
          tier_key: string
          tier_label?: string
          top_search_placement?: boolean
          updated_at?: string
          verified_badge?: boolean
        }
        Update: {
          can_access_crm?: boolean
          can_access_featured?: boolean
          can_access_reports?: boolean
          can_create_services?: boolean
          can_receive_leads?: boolean
          can_use_advanced_dashboard?: boolean
          can_view_client_phone?: boolean
          created_at?: string
          id?: string
          max_ads?: number
          max_leads?: number
          max_services?: number
          max_slots?: number
          radius_km?: number
          ranking_priority?: number
          search_boost?: number
          tier_key?: string
          tier_label?: string
          top_search_placement?: boolean
          updated_at?: string
          verified_badge?: boolean
        }
        Relationships: []
      }
      uf_normalization_audit: {
        Row: {
          created_at: string
          id: string
          new_state: string | null
          old_state: string | null
          row_id: string
          source: string
          table_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_state?: string | null
          old_state?: string | null
          row_id: string
          source?: string
          table_name: string
        }
        Update: {
          created_at?: string
          id?: string
          new_state?: string | null
          old_state?: string | null
          row_id?: string
          source?: string
          table_name?: string
        }
        Relationships: []
      }
      ui_bottom_nav_config: {
        Row: {
          animation_duration: number
          animation_type: string
          background_color: string
          blur: boolean
          border_color: string
          created_at: string
          height: number
          hidden_paths: Json
          id: string
          is_active: boolean
          layout_type: string
          mobile_only: boolean
          padding: number
          shadow: boolean
          updated_at: string
        }
        Insert: {
          animation_duration?: number
          animation_type?: string
          background_color?: string
          blur?: boolean
          border_color?: string
          created_at?: string
          height?: number
          hidden_paths?: Json
          id?: string
          is_active?: boolean
          layout_type?: string
          mobile_only?: boolean
          padding?: number
          shadow?: boolean
          updated_at?: string
        }
        Update: {
          animation_duration?: number
          animation_type?: string
          background_color?: string
          blur?: boolean
          border_color?: string
          created_at?: string
          height?: number
          hidden_paths?: Json
          id?: string
          is_active?: boolean
          layout_type?: string
          mobile_only?: boolean
          padding?: number
          shadow?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ui_bottom_nav_items: {
        Row: {
          action_type: string
          active_color: string
          animation: string
          background_color: string
          badge: string
          badge_color: string
          border_radius: string
          config_id: string
          created_at: string
          external_url: string
          icon: string
          icon_active: string
          id: string
          is_active: boolean
          label: string
          order_index: number
          requires_auth: boolean
          route_path: string
          size: string
          text_color: string
          updated_at: string
        }
        Insert: {
          action_type?: string
          active_color?: string
          animation?: string
          background_color?: string
          badge?: string
          badge_color?: string
          border_radius?: string
          config_id: string
          created_at?: string
          external_url?: string
          icon?: string
          icon_active?: string
          id?: string
          is_active?: boolean
          label?: string
          order_index?: number
          requires_auth?: boolean
          route_path?: string
          size?: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          active_color?: string
          animation?: string
          background_color?: string
          badge?: string
          badge_color?: string
          border_radius?: string
          config_id?: string
          created_at?: string
          external_url?: string
          icon?: string
          icon_active?: string
          id?: string
          is_active?: boolean
          label?: string
          order_index?: number
          requires_auth?: boolean
          route_path?: string
          size?: string
          text_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ui_bottom_nav_items_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "ui_bottom_nav_config"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_test_results: {
        Row: {
          attempts: number
          created_at: string
          device_ua: string | null
          downlink_mbps: number | null
          effective_type: string | null
          error_code: string | null
          error_kind: string | null
          fallback_level: number | null
          file_size_bytes: number | null
          id: string
          scenario: string
          stage: string | null
          stage_latency_ms: number | null
          success: boolean
          total_ms: number
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          device_ua?: string | null
          downlink_mbps?: number | null
          effective_type?: string | null
          error_code?: string | null
          error_kind?: string | null
          fallback_level?: number | null
          file_size_bytes?: number | null
          id?: string
          scenario: string
          stage?: string | null
          stage_latency_ms?: number | null
          success: boolean
          total_ms: number
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          device_ua?: string | null
          downlink_mbps?: number | null
          effective_type?: string | null
          error_code?: string | null
          error_kind?: string | null
          fallback_level?: number | null
          file_size_bytes?: number | null
          id?: string
          scenario?: string
          stage?: string | null
          stage_latency_ms?: number | null
          success?: boolean
          total_ms?: number
          user_id?: string | null
        }
        Relationships: []
      }
      user_access_logs: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          ip_address: string | null
          isp: string | null
          metadata: Json | null
          os: string | null
          region: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          isp?: string | null
          metadata?: Json | null
          os?: string | null
          region?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          isp?: string | null
          metadata?: Json | null
          os?: string | null
          region?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "export_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_state: {
        Row: {
          created_at: string
          dismissed_widgets: string[]
          first_visit_at: string
          last_visit_at: string | null
          preferred_tier: string | null
          updated_at: string
          user_id: string
          visits_count: number
        }
        Insert: {
          created_at?: string
          dismissed_widgets?: string[]
          first_visit_at?: string
          last_visit_at?: string | null
          preferred_tier?: string | null
          updated_at?: string
          user_id: string
          visits_count?: number
        }
        Update: {
          created_at?: string
          dismissed_widgets?: string[]
          first_visit_at?: string
          last_visit_at?: string | null
          preferred_tier?: string | null
          updated_at?: string
          user_id?: string
          visits_count?: number
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          provider_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_levels: {
        Row: {
          color: string
          created_at: string
          description: string
          id: string
          name: string
          permissions: Json
          priority: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          permissions?: Json
          priority?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          permissions?: Json
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_privacy_history: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          user_ref: string | null
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          user_ref?: string | null
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          user_ref?: string | null
        }
        Relationships: []
      }
      user_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          notes: string | null
          tag_name: string
          user_id: string
          user_ref: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          notes?: string | null
          tag_name: string
          user_id: string
          user_ref?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          notes?: string | null
          tag_name?: string
          user_id?: string
          user_ref?: string | null
        }
        Relationships: []
      }
      web_vitals_log: {
        Row: {
          connection_type: string | null
          created_at: string
          device_pixel_ratio: number | null
          id: string
          metric: string
          navigation_type: string | null
          rating: string | null
          route: string
          user_agent: string | null
          user_id: string | null
          value: number
          viewport: string | null
        }
        Insert: {
          connection_type?: string | null
          created_at?: string
          device_pixel_ratio?: number | null
          id?: string
          metric: string
          navigation_type?: string | null
          rating?: string | null
          route: string
          user_agent?: string | null
          user_id?: string | null
          value: number
          viewport?: string | null
        }
        Update: {
          connection_type?: string | null
          created_at?: string
          device_pixel_ratio?: number | null
          id?: string
          metric?: string
          navigation_type?: string | null
          rating?: string | null
          route?: string
          user_agent?: string | null
          user_id?: string | null
          value?: number
          viewport?: string | null
        }
        Relationships: []
      }
      whatsapp_clicks_log: {
        Row: {
          clicked_at: string
          clicked_on_utc: string | null
          id: string
          provider_id: string
          user_id: string
        }
        Insert: {
          clicked_at?: string
          clicked_on_utc?: string | null
          id?: string
          provider_id: string
          user_id: string
        }
        Update: {
          clicked_at?: string
          clicked_on_utc?: string | null
          id?: string
          provider_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_clicks_log_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "featured_providers_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_clicks_log_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "lead_conversion_daily"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "whatsapp_clicks_log_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_audit_view"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "whatsapp_clicks_log_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_clicks_log_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_clicks_log_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_clicks_log_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      account_limits_view: {
        Row: {
          account_tier: string | null
          can_access_crm: boolean | null
          can_access_featured: boolean | null
          can_access_reports: boolean | null
          can_create_services: boolean | null
          can_receive_leads: boolean | null
          email: string | null
          max_ads: number | null
          max_leads: number | null
          max_services: number | null
          max_slots: number | null
          ranking_priority: number | null
          search_boost: number | null
          user_ref: string | null
        }
        Relationships: []
      }
      account_model_view: {
        Row: {
          account_tier: string | null
          email: string | null
          is_premium: boolean | null
          is_provider: boolean | null
          is_rh: boolean | null
          plan: string | null
          profile_type: string | null
          user_ref: string | null
        }
        Relationships: []
      }
      admin_sponsor_docs_history_view: {
        Row: {
          action: string | null
          company_name: string | null
          created_at: string | null
          current_status: string | null
          doc_type: string | null
          email: string | null
          id: string | null
          lead_id: string | null
          metadata: Json | null
          performed_by: string | null
          reason: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_docs_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sponsor_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      city_provider_stats: {
        Row: {
          city_id: string | null
          city_name: string | null
          city_slug: string | null
          has_active_providers: boolean | null
          providers_count: number | null
          state_uf: string | null
        }
        Insert: {
          city_id?: string | null
          city_name?: string | null
          city_slug?: string | null
          has_active_providers?: boolean | null
          providers_count?: number | null
          state_uf?: string | null
        }
        Update: {
          city_id?: string | null
          city_name?: string | null
          city_slug?: string | null
          has_active_providers?: boolean | null
          providers_count?: number | null
          state_uf?: string | null
        }
        Relationships: []
      }
      export_users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          user_ref: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          user_ref?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          user_ref?: string | null
        }
        Relationships: []
      }
      featured_providers_mv: {
        Row: {
          account_type: string | null
          business_name: string | null
          business_segment: string | null
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          city: string | null
          complement: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          id: string | null
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          phone: string | null
          photo_url: string | null
          plan: string | null
          portfolio_album_count: number | null
          portfolio_photo_count: number | null
          postal_code: string | null
          rating_avg: number | null
          review_count: number | null
          services_count: number | null
          show_full_address: boolean | null
          slug: string | null
          social_links: Json | null
          state: string | null
          street: string | null
          street_number: string | null
          user_id: string | null
          user_ref: string | null
          whatsapp: string | null
          years_experience: number | null
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
      lead_conversion_daily: {
        Row: {
          contact_clicks: number | null
          day: string | null
          phone_clicks: number | null
          profile_clicks: number | null
          provider_id: string | null
          whatsapp_clicks: number | null
        }
        Relationships: []
      }
      provider_audit_view: {
        Row: {
          business_name: string | null
          first_access_at: string | null
          last_access_at: string | null
          last_browser: string | null
          last_device: string | null
          last_ip: string | null
          last_os: string | null
          provider_created_at: string | null
          provider_id: string | null
          registration_browser: string | null
          registration_city: string | null
          registration_country: string | null
          registration_device: string | null
          registration_ip: string | null
          registration_isp: string | null
          registration_os: string | null
          registration_region: string | null
          registration_user_agent: string | null
          slug: string | null
          user_id: string | null
        }
        Relationships: []
      }
      provider_health_view: {
        Row: {
          avatar_url: string | null
          business_name: string | null
          city: string | null
          completion_score: number | null
          created_at: string | null
          email: string | null
          engagement_points: number | null
          featured: boolean | null
          full_name: string | null
          health_label: string | null
          id: string | null
          missing_fields: string[] | null
          photo_url: string | null
          plan: string | null
          portfolio_album_count: number | null
          portfolio_photo_count: number | null
          rating_avg: number | null
          review_count: number | null
          services_count: number | null
          state: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: []
      }
      public_jobs: {
        Row: {
          activities: string | null
          approval_status: string | null
          benefits: string | null
          category_id: string | null
          city: string | null
          contact_name: string | null
          contact_phone: string | null
          cover_image_url: string | null
          created_at: string | null
          deadline: string | null
          deleted_at: string | null
          description: string | null
          id: string | null
          job_type: string | null
          neighborhood: string | null
          opportunity_type: string | null
          requirements: string | null
          salary: string | null
          schedule: string | null
          slug: string | null
          state: string | null
          status: string | null
          subtitle: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          view_count: number | null
          whatsapp: string | null
          work_model: string | null
        }
        Insert: {
          activities?: string | null
          approval_status?: string | null
          benefits?: string | null
          category_id?: string | null
          city?: string | null
          contact_name?: never
          contact_phone?: never
          cover_image_url?: string | null
          created_at?: string | null
          deadline?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          job_type?: string | null
          neighborhood?: string | null
          opportunity_type?: string | null
          requirements?: string | null
          salary?: string | null
          schedule?: string | null
          slug?: string | null
          state?: string | null
          status?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          view_count?: number | null
          whatsapp?: never
          work_model?: string | null
        }
        Update: {
          activities?: string | null
          approval_status?: string | null
          benefits?: string | null
          category_id?: string | null
          city?: string | null
          contact_name?: never
          contact_phone?: never
          cover_image_url?: string | null
          created_at?: string | null
          deadline?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          job_type?: string | null
          neighborhood?: string | null
          opportunity_type?: string | null
          requirements?: string | null
          salary?: string | null
          schedule?: string | null
          slug?: string | null
          state?: string | null
          status?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          view_count?: number | null
          whatsapp?: never
          work_model?: string | null
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
      public_providers: {
        Row: {
          accepts_on_demand: boolean | null
          account_type: string | null
          address_complete: boolean | null
          avg_response_minutes: number | null
          business_name: string | null
          business_segment: string | null
          category_custom: string | null
          category_id: string | null
          city: string | null
          community_verified: boolean | null
          community_verified_at: string | null
          complement: string | null
          completion_boost_until: string | null
          contact_hours: Json | null
          content_flags: Json | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          featured: boolean | null
          geo_source: string | null
          geo_source_confidence: number | null
          geo_source_notes: Json | null
          geo_source_updated_at: string | null
          geog: unknown
          ibge_code: string | null
          id: string | null
          is_24h: boolean | null
          is_verified: boolean | null
          last_active_at: string | null
          last_response_calc_at: string | null
          latitude: number | null
          lead_followup_hours: number | null
          legal_name: string | null
          longitude: number | null
          meta_description: string | null
          meta_title: string | null
          meta_tracking: Json | null
          neighborhood: string | null
          neighborhood_source: string | null
          neighborhood_source_at: string | null
          notification_channels: Json | null
          onboarding_progress: Json | null
          opens_late_night: boolean | null
          opens_overnight: boolean | null
          opens_weekend: boolean | null
          phone: string | null
          photo_url: string | null
          plan: string | null
          portfolio_album_count: number | null
          portfolio_photo_count: number | null
          postal_code: string | null
          rating_avg: number | null
          response_time: string | null
          review_count: number | null
          service_radius: string | null
          services_count: number | null
          show_full_address: boolean | null
          slug: string | null
          social_links: Json | null
          state: string | null
          status: string | null
          street: string | null
          street_number: string | null
          updated_at: string | null
          user_id: string | null
          user_ref: string | null
          verified_at: string | null
          verified_by: string | null
          verified_criteria: Json | null
          verified_manual: boolean | null
          verified_reason: string | null
          website: string | null
          whatsapp: string | null
          working_hours: string | null
          working_hours_struct: Json | null
          years_experience: number | null
        }
        Insert: {
          accepts_on_demand?: boolean | null
          account_type?: string | null
          address_complete?: boolean | null
          avg_response_minutes?: number | null
          business_name?: string | null
          business_segment?: string | null
          category_custom?: string | null
          category_id?: string | null
          city?: string | null
          community_verified?: boolean | null
          community_verified_at?: string | null
          complement?: string | null
          completion_boost_until?: string | null
          contact_hours?: Json | null
          content_flags?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          featured?: boolean | null
          geo_source?: string | null
          geo_source_confidence?: number | null
          geo_source_notes?: Json | null
          geo_source_updated_at?: string | null
          geog?: unknown
          ibge_code?: string | null
          id?: string | null
          is_24h?: boolean | null
          is_verified?: boolean | null
          last_active_at?: string | null
          last_response_calc_at?: string | null
          latitude?: number | null
          lead_followup_hours?: number | null
          legal_name?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          meta_tracking?: Json | null
          neighborhood?: string | null
          neighborhood_source?: string | null
          neighborhood_source_at?: string | null
          notification_channels?: Json | null
          onboarding_progress?: Json | null
          opens_late_night?: boolean | null
          opens_overnight?: boolean | null
          opens_weekend?: boolean | null
          phone?: string | null
          photo_url?: string | null
          plan?: string | null
          portfolio_album_count?: number | null
          portfolio_photo_count?: number | null
          postal_code?: string | null
          rating_avg?: number | null
          response_time?: string | null
          review_count?: number | null
          service_radius?: string | null
          services_count?: number | null
          show_full_address?: boolean | null
          slug?: string | null
          social_links?: Json | null
          state?: string | null
          status?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_ref?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verified_criteria?: Json | null
          verified_manual?: boolean | null
          verified_reason?: string | null
          website?: string | null
          whatsapp?: string | null
          working_hours?: string | null
          working_hours_struct?: Json | null
          years_experience?: number | null
        }
        Update: {
          accepts_on_demand?: boolean | null
          account_type?: string | null
          address_complete?: boolean | null
          avg_response_minutes?: number | null
          business_name?: string | null
          business_segment?: string | null
          category_custom?: string | null
          category_id?: string | null
          city?: string | null
          community_verified?: boolean | null
          community_verified_at?: string | null
          complement?: string | null
          completion_boost_until?: string | null
          contact_hours?: Json | null
          content_flags?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          featured?: boolean | null
          geo_source?: string | null
          geo_source_confidence?: number | null
          geo_source_notes?: Json | null
          geo_source_updated_at?: string | null
          geog?: unknown
          ibge_code?: string | null
          id?: string | null
          is_24h?: boolean | null
          is_verified?: boolean | null
          last_active_at?: string | null
          last_response_calc_at?: string | null
          latitude?: number | null
          lead_followup_hours?: number | null
          legal_name?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          meta_tracking?: Json | null
          neighborhood?: string | null
          neighborhood_source?: string | null
          neighborhood_source_at?: string | null
          notification_channels?: Json | null
          onboarding_progress?: Json | null
          opens_late_night?: boolean | null
          opens_overnight?: boolean | null
          opens_weekend?: boolean | null
          phone?: string | null
          photo_url?: string | null
          plan?: string | null
          portfolio_album_count?: number | null
          portfolio_photo_count?: number | null
          postal_code?: string | null
          rating_avg?: number | null
          response_time?: string | null
          review_count?: number | null
          service_radius?: string | null
          services_count?: number | null
          show_full_address?: boolean | null
          slug?: string | null
          social_links?: Json | null
          state?: string | null
          status?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_ref?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verified_criteria?: Json | null
          verified_manual?: boolean | null
          verified_reason?: string | null
          website?: string | null
          whatsapp?: string | null
          working_hours?: string | null
          working_hours_struct?: Json | null
          years_experience?: number | null
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
      public_user_levels: {
        Row: {
          color: string | null
          description: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          color?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          color?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      user_master_view: {
        Row: {
          account_type_id: string | null
          avatar_url: string | null
          business_name: string | null
          city: string | null
          created_at: string | null
          email: string | null
          engagement_points: number | null
          featured: boolean | null
          full_name: string | null
          id: string | null
          level_id: string | null
          phone: string | null
          portfolio_album_count: number | null
          portfolio_photo_count: number | null
          profile_type: string | null
          provider_id: string | null
          provider_plan: string | null
          provider_slug: string | null
          provider_status: string | null
          rating_avg: number | null
          review_count: number | null
          role: string | null
          services_count: number | null
          state: string | null
          status: string | null
          system_role: Database["public"]["Enums"]["app_role"] | null
          total_jobs: number | null
          total_leads: number | null
          total_reviews: number | null
          total_services: number | null
          unread_notifications: number | null
          updated_at: string | null
          user_ref: string | null
          whatsapp: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_type_id_fkey"
            columns: ["account_type_id"]
            isOneToOne: false
            referencedRelation: "account_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "gamification_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      web_vitals_weekly_summary: {
        Row: {
          avg_value: number | null
          day: string | null
          metric: string | null
          p75_value: number | null
          p95_value: number | null
          route: string | null
          samples: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _is_blank_text: { Args: { v: string }; Returns: boolean }
      _strip_accents: { Args: { t: string }; Returns: string }
      _sync_in_progress: { Args: never; Returns: boolean }
      activate_sponsor_with_gate: {
        Args: {
          _override?: boolean
          _override_reason?: string
          _sponsor_id: string
        }
        Returns: Json
      }
      add_portfolio_photo_atomic: {
        Args: {
          _album_id: string
          _image_url: string
          _original_name?: string
          _storage_path: string
        }
        Returns: Json
      }
      admin_adjust_points: {
        Args: {
          point_delta: number
          reset_to_zero?: boolean
          target_user_id: string
        }
        Returns: number
      }
      admin_assign_user_level: {
        Args: { _level_id: string; _user_id: string }
        Returns: undefined
      }
      admin_auth_health_summary: {
        Args: { _bucket?: string; _since: string }
        Returns: Json
      }
      admin_ban_suspicious: { Args: { _user_ids: string[] }; Returns: number }
      admin_broken_links_by_referrer: {
        Args: { _days?: number }
        Returns: {
          distinct_paths: number
          hits: number
          last_seen: string
          referrer: string
        }[]
      }
      admin_broken_links_stats: {
        Args: { _days?: number }
        Returns: {
          distinct_users: number
          hits: number
          last_seen: string
          path: string
          top_referrer: string
        }[]
      }
      admin_bulk_fix_provider_neighborhood: {
        Args: {
          _new_neighborhood: string
          _provider_ids: string[]
          _reason: string
        }
        Returns: Json
      }
      admin_capture_db_perf_snapshot: {
        Args: { _reason?: string; _reset_after?: boolean }
        Returns: string
      }
      admin_capture_db_perf_snapshot_system: {
        Args: { _reason?: string; _reset_after?: boolean }
        Returns: string
      }
      admin_capture_onboarding_experiment_snapshot: {
        Args: { _experiment_key: string; _hours?: number; _kind?: string }
        Returns: {
          captured_at: string
          experiment_id: string
          experiment_key: string
          id: string
          kind: string
          meta: Json
          rollout_reached: number
          status_at_capture: string
          variants: Json
        }
        SetofOptions: {
          from: "*"
          to: "onboarding_experiment_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_capture_rls_snapshot: {
        Args: never
        Returns: {
          out_inserted_count: number
          out_snapshot_date: string
        }[]
      }
      admin_clear_suspicion: { Args: { _user_ids: string[] }; Returns: number }
      admin_conversion_metrics: {
        Args: { _category_slug?: string; _days?: number; _tier?: string }
        Returns: {
          category_name: string
          category_slug: string
          conversion_rate: number
          providers_count: number
          tier: string
          total_dismisses: number
          total_leads: number
          total_views: number
          total_visits: number
          total_whatsapp_clicks: number
        }[]
      }
      admin_db_perf_dashboard: { Args: never; Returns: Json }
      admin_diff_rls_snapshots: {
        Args: { from_date: string; to_date: string }
        Returns: {
          cmd_new: string
          cmd_old: string
          is_permissive_write_new: boolean
          is_public_or_anon_new: boolean
          policyname: string
          qual_new: string
          qual_old: string
          roles_new: string[]
          roles_old: string[]
          schemaname: string
          status: string
          tablename: string
          with_check_new: string
          with_check_old: string
        }[]
      }
      admin_error_500_recent: {
        Args: { _limit?: number }
        Returns: {
          id: string
          occurred_at: string
          path: string
          referrer: string
          user_agent: string
          user_id: string
        }[]
      }
      admin_error_500_summary: { Args: { _hours?: number }; Returns: Json }
      admin_exit_intent_funnel: {
        Args: { p_since?: string; p_until?: string }
        Returns: {
          city: string
          cta_secondary: number
          cta_signup: number
          cta_whatsapp: number
          dismiss: number
          impressions: number
          page_kind: string
          post_signup_conversion: number
          signup_rate: number
        }[]
      }
      admin_experiment_variant_metrics: {
        Args: { _experiment_key: string; _hours?: number }
        Returns: {
          abandons: number
          completes: number
          enters: number
          hesitations: number
          rage_clicks: number
          recoveries: number
          refreshes: number
          units_assigned: number
          validation_failed: number
          variant_id: string
        }[]
      }
      admin_explain_query: {
        Args: { _sql: string }
        Returns: {
          plan: string
        }[]
      }
      admin_export_audit_logs: {
        Args: { _days?: number }
        Returns: {
          action: string
          created_at: string
          id: string
          new_values: Json
          old_values: Json
          staff_email: string
          staff_id: string
          target_email: string
          target_user_id: string
        }[]
      }
      admin_fix_provider_neighborhood: {
        Args: {
          _new_neighborhood: string
          _provider_id: string
          _reason: string
        }
        Returns: Json
      }
      admin_generate_invoice_for_change_request: {
        Args: { _amount?: number; _note?: string; _request_id: string }
        Returns: string
      }
      admin_get_level_distribution: {
        Args: never
        Returns: {
          level_color: string
          level_icon: string
          level_id: string
          level_name: string
          min_points: number
          user_count: number
        }[]
      }
      admin_list_default_neighborhood_providers: {
        Args: { _city?: string; _limit?: number; _state?: string }
        Returns: {
          city: string
          full_name: string
          has_coords: boolean
          id: string
          neighborhood: string
          neighborhood_source: string
          neighborhood_source_at: string
          state: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_list_kill_switch_blocks: {
        Args: {
          p_from?: string
          p_limit?: number
          p_provider_id?: string
          p_to?: string
        }
        Returns: {
          attempt_payload: Json
          created_at: string
          id: string
          new_value: string
          previous_value: string
          provider_id: string
          provider_name: string
          reason: string
          service_id: string
          source: string
        }[]
      }
      admin_list_onboarding_experiments: {
        Args: never
        Returns: {
          audience: Json
          auto_kill_enabled: boolean
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          experiment_key: string
          id: string
          last_evaluated_at: string | null
          last_kill_reason: string | null
          name: string
          rollout_percentage: number
          start_at: string | null
          status: string
          type: string
          updated_at: string
          variants: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "onboarding_experiments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_onboarding_incidents: {
        Args: { _hours?: number; _only_open?: boolean }
        Returns: {
          actions: Json
          app_version: string | null
          baseline_value: number | null
          created_at: string
          duration_seconds: number | null
          flags_changed: Json
          id: string
          notes: string | null
          opened_at: string
          release_channel: string | null
          resolution_kind: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          state: string
          threshold_value: number | null
          trigger_metric: string
          trigger_value: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "onboarding_incidents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_orphan_profiles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          last_sign_in_at: string
          raw_user_meta_data: Json
          user_id: string
        }[]
      }
      admin_list_rls_policies: {
        Args: never
        Returns: {
          cmd: string
          permissive: string
          policyname: string
          qual: string
          roles: string[]
          schemaname: string
          table_owner: string
          tablename: string
          with_check: string
        }[]
      }
      admin_list_rls_snapshot_dates: {
        Args: never
        Returns: {
          out_snapshot_date: string
          permissive_write_count: number
          policy_count: number
        }[]
      }
      admin_list_service_area_corrections:
        | {
            Args: { _limit?: number; _offset?: number }
            Returns: {
              created_at: string
              id: string
              new_value: string
              previous_value: string
              provider_id: string
              provider_name: string
              reason: string
              service_id: string
              service_name: string
              source: string
            }[]
          }
        | {
            Args: {
              p_city?: string
              p_from?: string
              p_limit?: number
              p_provider_id?: string
              p_to?: string
            }
            Returns: {
              corrected_by: string
              corrector_name: string
              created_at: string
              id: string
              new_value: string
              previous_value: string
              provider_id: string
              provider_name: string
              reason: string
              service_id: string
              source: string
            }[]
          }
      admin_list_service_area_sync_runs: {
        Args: { p_limit?: number }
        Returns: {
          affected_count: number
          created_at: string
          dry_run: boolean
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          timezone: string | null
          triggered_by: string
          triggered_user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "service_area_sync_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_log_impersonation_end: {
        Args: { _session_id: string }
        Returns: undefined
      }
      admin_log_impersonation_start: {
        Args: {
          _ip?: string
          _reason?: string
          _target_user_id: string
          _ua?: string
        }
        Returns: string
      }
      admin_log_sponsor_doc_access: {
        Args: { _doc_type: string; _lead_id: string; _path: string }
        Returns: undefined
      }
      admin_mark_billing_paid: {
        Args: {
          _admin_note?: string
          _cycle_id: string
          _invoice_reference?: string
          _payment_method?: string
        }
        Returns: Json
      }
      admin_meta_tracking_quality: { Args: never; Returns: Json }
      admin_notify_users: {
        Args: {
          _link?: string
          _message: string
          _title: string
          _user_ids: string[]
        }
        Returns: number
      }
      admin_onboarding_behavioral_summary: {
        Args: { _hours?: number }
        Returns: Json
      }
      admin_onboarding_funnel: {
        Args: { _days?: number; _variant?: string }
        Returns: {
          event: string
          phase: string
          total: number
          unique_sessions: number
          unique_users: number
        }[]
      }
      admin_onboarding_funnel_by_source: {
        Args: { _days?: number }
        Returns: {
          advances: number
          draft_source: string
          enters: number
          errors: number
          phase: string
          unique_users: number
        }[]
      }
      admin_onboarding_ops_funnel: {
        Args: { _hours?: number }
        Returns: {
          abandons: number
          autosave_failed: number
          completes: number
          enters: number
          exits: number
          phase: string
          recoveries: number
          refreshes: number
          regressions: number
          unique_sessions: number
          unique_users: number
          validation_failed: number
        }[]
      }
      admin_onboarding_release_compare: {
        Args: { _hours?: number }
        Returns: {
          abandons: number
          app_version: string
          autosave_failed: number
          completes: number
          first_seen: string
          last_seen: string
          regressions: number
          release_channel: string
          total_events: number
          unique_sessions: number
          unique_users: number
          validation_failed: number
        }[]
      }
      admin_onboarding_session_timeline: {
        Args: { _limit?: number; _session_id: string }
        Returns: {
          created_at: string
          event: string
          id: string
          meta: Json
          phase: string
          user_id: string
          variant: string
        }[]
      }
      admin_onboarding_stats: { Args: { _days?: number }; Returns: Json }
      admin_onboarding_user_funnel: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          completed: boolean
          draft_source: string
          errors_total: number
          first_seen: string
          last_phase: string
          last_seen: string
          phases_advanced: number
          phases_entered: number
          user_id: string
        }[]
      }
      admin_provider_conversion_insights: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          bucket: string
          business_name: string
          category_slug: string
          city: string
          contacts: number
          ctr: number
          lead_rate: number
          lead_submits: number
          profile_views: number
          provider_id: string
        }[]
      }
      admin_providers_same_ip: {
        Args: { _min_count?: number }
        Returns: {
          ip_address: string
          provider_count: number
          providers: Json
        }[]
      }
      admin_pwa_install_stats_by_city: {
        Args: never
        Returns: {
          city: string
          install_rate: number
          installed_providers: number
          total_providers: number
        }[]
      }
      admin_recalc_provider_levels_from_account: {
        Args: never
        Returns: number
      }
      admin_recalculate_all_engagement: {
        Args: never
        Returns: {
          processed_count: number
          total_points: number
        }[]
      }
      admin_recent_ip_blocks: {
        Args: { _limit?: number }
        Returns: {
          active: boolean
          blocked_until: string
          created_at: string
          id: string
          ip_address: string
          reason: string
          signup_count: number
        }[]
      }
      admin_reconcile_orphan_profile: {
        Args: { _user_id: string }
        Returns: Json
      }
      admin_reopen_sponsor_checklist: {
        Args: { _lead_id: string; _pending_items?: string[]; _reason: string }
        Returns: Json
      }
      admin_reprocess_kill_switch_block: {
        Args: { p_correction_id: string }
        Returns: Json
      }
      admin_resolve_onboarding_incident: {
        Args: { _incident_id: string; _notes?: string }
        Returns: {
          actions: Json
          app_version: string | null
          baseline_value: number | null
          created_at: string
          duration_seconds: number | null
          flags_changed: Json
          id: string
          notes: string | null
          opened_at: string
          release_channel: string | null
          resolution_kind: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          state: string
          threshold_value: number | null
          trigger_metric: string
          trigger_value: number | null
        }
        SetofOptions: {
          from: "*"
          to: "onboarding_incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_anchor_audit: { Args: { _days?: number }; Returns: Json }
      admin_review_sponsor_change_request: {
        Args: { _comment?: string; _decision: string; _id: string }
        Returns: undefined
      }
      admin_review_sponsor_docs: {
        Args: { _decision: string; _lead_id: string; _reason?: string }
        Returns: Json
      }
      admin_set_onboarding_experiment_status: {
        Args: { _experiment_key: string; _reason?: string; _status: string }
        Returns: {
          audience: Json
          auto_kill_enabled: boolean
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          experiment_key: string
          id: string
          last_evaluated_at: string | null
          last_kill_reason: string | null
          name: string
          rollout_percentage: number
          start_at: string | null
          status: string
          type: string
          updated_at: string
          variants: Json
        }
        SetofOptions: {
          from: "*"
          to: "onboarding_experiments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_profile_tax_id: {
        Args: { _profile_id: string; _tax_id: string }
        Returns: undefined
      }
      admin_set_provider_verified: {
        Args: { _provider_id: string; _reason: string; _verified: boolean }
        Returns: Json
      }
      admin_set_staff_permission: {
        Args: {
          _enabled: boolean
          _permission_key: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      admin_signup_funnel: {
        Args: { _days?: number }
        Returns: {
          day: string
          drafts_saved: number
          profiles_created: number
          providers_created: number
          visitors: number
          wizard_started: number
        }[]
      }
      admin_sponsor_metrics_summary: {
        Args: { _sponsor_ids: string[] }
        Returns: {
          sponsor_id: string
          total_clicks: number
          total_impressions: number
        }[]
      }
      admin_suspicious_summary: { Args: { _limit?: number }; Returns: Json }
      admin_sync_provider_city_with_services:
        | {
            Args: { p_dry_run?: boolean }
            Returns: {
              after_value: string
              before_value: string
              provider_id: string
              service_id: string
            }[]
          }
        | {
            Args: {
              p_dry_run?: boolean
              p_timezone?: string
              p_triggered_by?: string
            }
            Returns: {
              after_value: string
              before_value: string
              provider_id: string
              service_id: string
            }[]
          }
      admin_system_health: { Args: { _limit?: number }; Returns: Json }
      admin_system_health_full: { Args: never; Returns: Json }
      admin_update_billing_cycle: {
        Args: {
          _admin_note?: string
          _cycle_id: string
          _grace_until?: string
          _status: string
        }
        Returns: Json
      }
      admin_upsert_onboarding_experiment: {
        Args: {
          _audience?: Json
          _auto_kill_enabled?: boolean
          _description?: string
          _end_at?: string
          _experiment_key: string
          _name: string
          _rollout_percentage: number
          _start_at?: string
          _type: string
          _variants: Json
        }
        Returns: {
          audience: Json
          auto_kill_enabled: boolean
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          experiment_key: string
          id: string
          last_evaluated_at: string | null
          last_kill_reason: string | null
          name: string
          rollout_percentage: number
          start_at: string | null
          status: string
          type: string
          updated_at: string
          variants: Json
        }
        SetofOptions: {
          from: "*"
          to: "onboarding_experiments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_sponsor_scope_fix: {
        Args: {
          _new_category?: string
          _new_city?: string
          _sponsor_id: string
        }
        Returns: Json
      }
      archive_stale_incomplete_providers: {
        Args: never
        Returns: {
          archived_count: number
        }[]
      }
      audit_incomplete_providers_3d: {
        Args: never
        Returns: {
          ambos_faltando: number
          cidade_sem_bairro: number
          cidade_sem_geosource: number
          total_3d: number
        }[]
      }
      audit_sponsor_scope_consistency: {
        Args: never
        Returns: {
          auto_fixable: boolean
          confidence: string
          issue_type: string
          linked_category: string
          linked_category_slug: string
          linked_city: string
          linked_city_slug: string
          sponsor_id: string
          sponsor_name: string
          sponsor_type: string
          suggested_category: string
          suggested_category_slug: string
          suggested_city: string
          suggested_city_slug: string
        }[]
      }
      audit_user_ref_full: {
        Args: never
        Returns: {
          invalid_refs: number
          table_name: string
          total_records: number
        }[]
      }
      audit_user_ref_full_detailed: {
        Args: never
        Returns: {
          coverage_pct: number
          data_type: string
          filled: number
          has_index: boolean
          is_sponsor_table: boolean
          missing: number
          sample_missing_ids: string[]
          table_name: string
          total_rows: number
        }[]
      }
      audit_user_ref_health: {
        Args: never
        Returns: {
          data_type: string
          filled: number
          has_index: boolean
          missing: number
          table_name: string
          total_rows: number
        }[]
      }
      auto_degrade_expired_sponsors: { Args: never; Returns: Json }
      award_engagement_points: {
        Args: { _action_key: string; _metadata?: Json; _user_id: string }
        Returns: number
      }
      bump_auth_rate_limit: {
        Args: {
          _cooldown_minutes?: number
          _email_normalized: string
          _flow: string
          _ip_hash: string
          _max_attempts?: number
          _success?: boolean
          _window_minutes?: number
        }
        Returns: Json
      }
      calc_provider_avg_response: {
        Args: { _provider_id: string }
        Returns: number
      }
      calculate_user_level: { Args: { _user_id: string }; Returns: string }
      check_and_log_whatsapp_click: {
        Args: { p_provider_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          _action: string
          _identifier: string
          _max_attempts: number
          _window_minutes: number
        }
        Returns: boolean
      }
      check_registration_block:
        | { Args: { _email?: string; _whatsapp?: string }; Returns: Json }
        | {
            Args: {
              _device_fingerprint?: string
              _email?: string
              _whatsapp?: string
            }
            Returns: Json
          }
      claim_sponsor_lead: { Args: { _lead_id: string }; Returns: Json }
      close_presence_session: { Args: never; Returns: Json }
      compare_onboarding_release_snapshots: {
        Args: { _a: string; _b: string }
        Returns: Json
      }
      complete_app_install_mission: { Args: never; Returns: Json }
      complete_first_contact_mission: {
        Args: { _provider_id: string }
        Returns: Json
      }
      complete_mission: { Args: { _key: string; _value: Json }; Returns: Json }
      complete_onboarding_checklist: { Args: never; Returns: Json }
      complete_referral: { Args: { _referred_id: string }; Returns: boolean }
      compute_onboarding_release_health: {
        Args: { _channel?: string; _hours?: number }
        Returns: Json
      }
      compute_sponsor_cycle_amount: {
        Args: { _cycle_id: string }
        Returns: Json
      }
      count_unread_notifications: { Args: never; Returns: number }
      create_album_atomic: {
        Args: { _description?: string; _name: string }
        Returns: Json
      }
      create_daily_post: {
        Args: { _caption: string; _image_url: string }
        Returns: Json
      }
      create_onboarding_release_snapshot: {
        Args: {
          _app_version?: string
          _channel?: string
          _hours?: number
          _notes?: string
          _stage?: string
        }
        Returns: {
          app_version: string | null
          block_reasons: Json
          blocked: boolean
          captured_at: string
          classification: string
          created_by: string | null
          critical_regressions: number
          flags: Json
          health_score: number
          id: string
          metrics: Json
          notes: string | null
          open_incidents: number
          open_regressions: number
          release_channel: string
          stage: string
          window_hours: number
        }
        SetofOptions: {
          from: "*"
          to: "onboarding_release_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_service_atomic: {
        Args: {
          _address?: string
          _category_id?: string
          _category_ids?: string[]
          _description?: string
          _facebook_url?: string
          _instagram_url?: string
          _provider_id: string
          _service_area?: string
          _service_name: string
          _website?: string
          _whatsapp?: string
          _working_hours?: string
          _youtube_url?: string
        }
        Returns: Json
      }
      current_user_owns_sponsor: {
        Args: { _sponsor_id: string }
        Returns: boolean
      }
      delete_daily_post: { Args: never; Returns: Json }
      derive_provider_primary_category: {
        Args: { _provider_id: string }
        Returns: string
      }
      derive_user_ref: { Args: { _uuid: string }; Returns: string }
      derive_working_hours_flags: {
        Args: { _struct: Json }
        Returns: {
          accepts_on_demand: boolean
          is_24h: boolean
          opens_late_night: boolean
          opens_overnight: boolean
          opens_weekend: boolean
        }[]
      }
      detect_onboarding_regressions: {
        Args: {
          _baseline_days?: number
          _debounce_hours?: number
          _window_minutes?: number
        }
        Returns: Json
      }
      dismiss_dashboard_widget: {
        Args: { _widget: string }
        Returns: {
          created_at: string
          dismissed_widgets: string[]
          first_visit_at: string
          last_visit_at: string | null
          preferred_tier: string | null
          updated_at: string
          user_id: string
          visits_count: number
        }
        SetofOptions: {
          from: "*"
          to: "user_dashboard_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      distribute_open_lead: { Args: { _open_lead_id: string }; Returns: number }
      effective_user_permissions: { Args: { _user_id: string }; Returns: Json }
      evaluate_onboarding_auto_response: {
        Args: {
          _auto_resolve_minutes?: number
          _debounce_minutes?: number
          _window_minutes?: number
        }
        Returns: {
          opened_count: number
          resolved_count: number
          skipped_disabled: boolean
        }[]
      }
      evaluate_onboarding_experiments_kill_switch: {
        Args: never
        Returns: Json
      }
      expire_registration_blocks_180d: { Args: never; Returns: number }
      finalize_onboarding_atomic: {
        Args: { _profile_type: string; _user_id: string }
        Returns: Json
      }
      find_orphan_media: {
        Args: { _min_age_hours?: number }
        Returns: {
          created_at: string
          id: string
          public_url: string
          size_bytes: number
          storage_path: string
          user_ref: string
        }[]
      }
      format_city_state: {
        Args: { _city: string; _state: string }
        Returns: string
      }
      generate_invoice_for_cycle: {
        Args: { _cycle_id: string }
        Returns: string
      }
      generate_referral_code: { Args: never; Returns: string }
      get_active_today_providers: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_admin_sponsor_roi: { Args: { _days?: number }; Returns: Json }
      get_app_version_config: { Args: never; Returns: Json }
      get_community_feed: {
        Args: { _limit?: number }
        Returns: {
          action_text: string
          actor_alias: string
          category_name: string
          city: string
          created_at: string
          icon: string
          id: string
          is_seed: boolean
          profile_type: string
        }[]
      }
      get_contact_impact_24h: {
        Args: { _user_id: string }
        Returns: {
          phone_clicks: number
          total_views: number
          unique_visitors: number
          whatsapp_clicks: number
        }[]
      }
      get_demand_signal: {
        Args: { _user_id: string }
        Returns: {
          category_name: string
          city: string
          search_count: number
        }[]
      }
      get_engagement_ranking: {
        Args: { _limit?: number; _period_days?: number }
        Returns: {
          avatar_url: string
          business_name: string
          city: string
          full_name: string
          is_me: boolean
          rank_position: number
          slug: string
          state: string
          total_points: number
          user_id: string
        }[]
      }
      get_featured_providers: {
        Args: { _account_type?: string; _limit?: number }
        Returns: {
          account_type: string | null
          business_name: string | null
          business_segment: string | null
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          city: string | null
          complement: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          id: string | null
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          phone: string | null
          photo_url: string | null
          plan: string | null
          portfolio_album_count: number | null
          portfolio_photo_count: number | null
          postal_code: string | null
          rating_avg: number | null
          review_count: number | null
          services_count: number | null
          show_full_address: boolean | null
          slug: string | null
          social_links: Json | null
          state: string | null
          street: string | null
          street_number: string | null
          user_id: string | null
          user_ref: string | null
          whatsapp: string | null
          years_experience: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "featured_providers_mv"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_gamification_level: {
        Args: { _points: number }
        Returns: {
          level_badge_class: string
          level_color: string
          level_icon: string
          level_name: string
        }[]
      }
      get_home_bootstrap: { Args: never; Returns: Json }
      get_latest_user_access_logs: {
        Args: never
        Returns: {
          browser: string
          city: string
          country: string
          created_at: string
          device_type: string
          event_type: string
          ip_address: string
          isp: string
          os: string
          region: string
          user_id: string
        }[]
      }
      get_lead_conversion_stats: {
        Args: { _days?: number; _provider_id?: string }
        Returns: {
          contact_clicks: number
          conversion_pct: number
          leads_sent: number
          provider_id: string
          window_days: number
        }[]
      }
      get_lead_history_authors: {
        Args: { p_author_ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
      get_lead_stats: { Args: { provider_id: string }; Returns: Json }
      get_missed_opportunities: {
        Args: { _provider_id: string }
        Returns: {
          category_name: string
          hours_offline: number
          missed_searches: number
          top_city: string
          top_location_label: string
          top_neighborhood: string
          total_searches: number
        }[]
      }
      get_my_engagement_rank: {
        Args: { _period_days?: number }
        Returns: {
          rank_position: number
          total_participants: number
          total_points: number
        }[]
      }
      get_my_profile_status: { Args: never; Returns: Json }
      get_my_provider_details: {
        Args: never
        Returns: {
          account_type: string
          business_name: string
          city: string
          cnpj: string
          cpf: string
          id: string
          legal_name: string
          neighborhood: string
          slug: string
          state: string
          status: string
          user_id: string
          working_hours_struct: Json
        }[]
      }
      get_my_referral_points_timeline: {
        Args: { _period_days?: number }
        Returns: Json
      }
      get_my_referrals_full: { Args: never; Returns: Json }
      get_my_referrals_summary: { Args: never; Returns: Json }
      get_neighborhood_by_point: {
        Args: { _lat: number; _lng: number }
        Returns: string
      }
      get_pinned_sponsor_for_search: {
        Args: { _category_slug?: string; _city?: string; _state?: string }
        Returns: {
          assignment_id: string
          company_name: string
          image_url: string
          link_url: string
          logo_url: string
          phone: string
          short_description: string
          sponsor_id: string
          title: string
          whatsapp: string
        }[]
      }
      get_profile_completeness: { Args: { _user_id: string }; Returns: Json }
      get_profile_health_score: { Args: { _user_id: string }; Returns: Json }
      get_profile_tax_id: {
        Args: { _profile_id?: string }
        Returns: {
          profile_id: string
          tax_id: string
          tax_id_kind: string
          tax_id_last4: string
        }[]
      }
      get_provider_activity_signals: {
        Args: { _user_id: string }
        Returns: Json
      }
      get_provider_clicks_24h: {
        Args: { _provider_id: string }
        Returns: number
      }
      get_provider_conversion_stats: {
        Args: { _days?: number; _provider_ids: string[] }
        Returns: {
          ctr_view_to_contact: number
          lead_rate: number
          lead_submits: number
          phone_clicks: number
          profile_views: number
          provider_id: string
          whatsapp_clicks: number
        }[]
      }
      get_provider_daily_post: {
        Args: { _provider_id: string }
        Returns: {
          caption: string
          created_at: string
          expires_at: string
          hours_remaining: number
          id: string
          image_url: string
        }[]
      }
      get_provider_lead_stats: {
        Args: { _provider_id: string }
        Returns: {
          clicks_30d: number
          clicks_7d: number
          last_click_at: string
          phone_30d: number
          phone_7d: number
          whatsapp_30d: number
          whatsapp_7d: number
        }[]
      }
      get_provider_retention: {
        Args: { _days?: number }
        Returns: {
          cohort_day: string
          cohort_size: number
          pct_d1: number
          pct_d30: number
          pct_d7: number
          retained_d1: number
          retained_d30: number
          retained_d7: number
        }[]
      }
      get_provider_verification_status: {
        Args: { _user_id: string }
        Returns: {
          account_age_days: number
          account_age_ok: boolean
          conversion_ok: boolean
          is_verified: boolean
          onboarding_ok: boolean
          verified_since: string
        }[]
      }
      get_provider_weekly_stats: {
        Args: { _provider_id: string }
        Returns: Json
      }
      get_public_funnel_health: { Args: { _days?: number }; Returns: Json }
      get_public_funnel_telemetry: { Args: { _days?: number }; Returns: Json }
      get_review_short_link: { Args: { _provider_id: string }; Returns: Json }
      get_rss_import_headers: { Args: never; Returns: Json }
      get_search_demand_stats: {
        Args: { _provider_id: string }
        Returns: {
          city: string
          location_label: string
          neighborhood: string
          search_count: number
        }[]
      }
      get_smart_ads: {
        Args: {
          _location_key: string
          _visitor_city?: string
          _visitor_state?: string
        }
        Returns: {
          company_name: string
          id: string
          image_url: string
          link_url: string
          priority: number
          title: string
          user_ref: string
        }[]
      }
      get_sponsor_billing_status: {
        Args: { _sponsor_id: string }
        Returns: Json
      }
      get_sponsor_delivery_status: {
        Args: { _only_active?: boolean }
        Returns: {
          active_slots: number
          company_name: string
          ctr: number
          days_remaining: number
          delivered_today: number
          delivered_total: number
          guaranteed_impressions: number
          last_delivery_check_at: string
          pacing_percentage: number
          pacing_status: string
          plan: string
          sponsor_id: string
          target_today: number
          title: string
        }[]
      }
      get_sponsor_delivery_telemetry: {
        Args: { _days?: number }
        Returns: Json
      }
      get_sponsor_docs_status: { Args: { _lead_id: string }; Returns: Json }
      get_sponsor_health_status: {
        Args: { _sponsor_id?: string }
        Returns: {
          blockers: string[]
          current_status: string
          expires_in_days: number
          has_asset: boolean
          health_status: string
          is_active: boolean
          pacing_status: string
          scope_consistent: boolean
          sponsor_id: string
          title: string
          warnings: string[]
        }[]
      }
      get_sponsor_inventory_forecast: {
        Args: { _days?: number }
        Returns: {
          active_sponsors: number
          avg_new_per_day: number
          category: string
          city: string
          ending_soon: number
          forecast: string
          max_capacity: number
          projected_active: number
          projected_occupancy_rate: number
          slot_slug: string
        }[]
      }
      get_sponsor_inventory_status: {
        Args: never
        Returns: {
          active_sponsors: number
          available_slots: number
          category: string
          city: string
          max_capacity: number
          occupancy_rate: number
          slot_slug: string
          status: string
        }[]
      }
      get_sponsor_performance: {
        Args: { _from?: string; _sponsor_id?: string; _to?: string }
        Returns: {
          clicks: number
          ctr: number
          impressions: number
          slot_slug: string
          sponsor_id: string
        }[]
      }
      get_sponsor_roi: {
        Args: { _days?: number; _sponsor_id: string }
        Returns: Json
      }
      get_sponsor_usage: { Args: { _sponsor_id: string }; Returns: Json }
      get_staff_permissions: { Args: { _user_id: string }; Returns: Json }
      get_user_maturity_tier: { Args: { _user_id?: string }; Returns: Json }
      get_user_sponsor_id: { Args: { _user_id: string }; Returns: string }
      get_user_storage_usage: { Args: { _user_ref: string }; Returns: number }
      get_weekly_summary: { Args: { _user_id: string }; Returns: Json }
      get_whatsapp_clicks_today: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_highlight_clicks: {
        Args: { highlight_id: string }
        Returns: undefined
      }
      increment_job_view: { Args: { job_id: string }; Returns: undefined }
      increment_provider_impression: {
        Args: { _provider_id: string }
        Returns: undefined
      }
      increment_service_view: {
        Args: { p_service_id: string }
        Returns: undefined
      }
      increment_sponsor_click: {
        Args: { sponsor_id: string }
        Returns: undefined
      }
      increment_sponsor_impression: {
        Args: { sponsor_id: string }
        Returns: undefined
      }
      is_caller_admin: { Args: never; Returns: boolean }
      is_sponsor: { Args: { _user_id: string }; Returns: boolean }
      is_sponsor_member: {
        Args: { _sponsor_id: string; _user_id: string }
        Returns: boolean
      }
      is_top_professional: { Args: { _user_id: string }; Returns: boolean }
      list_consent_revocations: {
        Args: { _limit?: number; _offset?: number; _only_unread?: boolean }
        Returns: {
          anon_id: string
          created_at: string
          current_state: Json
          id: string
          previous_state: Json
          read_by_admin: boolean
          revoked_categories: string[]
          source: string
          total_count: number
          user_email: string
          user_id: string
          version: number
        }[]
      }
      list_my_geo_audit: {
        Args: { _limit?: number }
        Returns: {
          accuracy_m: number
          city: string
          created_at: string
          error_message: string
          event_type: string
          id: string
          latency_ms: number
          latitude: number
          longitude: number
          neighborhood: string
          source: string
          state: string
          status: string
        }[]
      }
      list_onboarding_release_snapshots: {
        Args: { _limit?: number; _stage?: string }
        Returns: {
          app_version: string | null
          block_reasons: Json
          blocked: boolean
          captured_at: string
          classification: string
          created_by: string | null
          critical_regressions: number
          flags: Json
          health_score: number
          id: string
          metrics: Json
          notes: string | null
          open_incidents: number
          open_regressions: number
          release_channel: string
          stage: string
          window_hours: number
        }[]
        SetofOptions: {
          from: "*"
          to: "onboarding_release_snapshots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_provider_geo_fallbacks: {
        Args: { _limit?: number; _status?: string }
        Returns: {
          audit_id: string
          city: string
          created_at: string
          error_message: string
          event_type: string
          latitude: number
          longitude: number
          neighborhood: string
          payload: Json
          provider_id: string
          provider_name: string
          reviewed_at: string
          source: string
          state: string
          status: string
        }[]
      }
      list_sponsor_invoices: {
        Args: { _limit?: number; _sponsor_id: string }
        Returns: {
          billing_cycle_id: string | null
          change_request_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_at: string | null
          id: string
          invoice_number: number
          issued_at: string
          items: Json
          notes: string | null
          paid_at: string | null
          pdf_url: string | null
          sponsor_id: string
          status: string
          total_amount: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sponsor_invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_user_notification_types: {
        Args: never
        Returns: {
          count: number
          type: string
        }[]
      }
      list_whatsapp_contacts_history: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _sort?: string
        }
        Returns: Json
      }
      log_contact_click: {
        Args: {
          _contact_type?: string
          _page_path?: string
          _provider_id: string
          _visitor_id?: string
        }
        Returns: string
      }
      log_error_page_event: {
        Args: {
          _code: number
          _path: string
          _referrer?: string
          _user_agent?: string
          _visitor_id?: string
        }
        Returns: string
      }
      log_exit_intent_event: {
        Args: {
          _city?: string
          _kind: string
          _meta?: Json
          _neighborhood?: string
          _page_kind?: string
          _pathname: string
          _session_id?: string
          _source?: string
          _state?: string
          _user_agent?: string
          _visitor_id?: string
        }
        Returns: string
      }
      log_provider_geo_issue: {
        Args: {
          _actor_user_id?: string
          _error_message?: string
          _event_type: string
          _payload?: Json
          _provider_id: string
          _source?: string
          _status?: string
        }
        Returns: undefined
      }
      log_provider_public_event:
        | {
            Args: {
              event_action: string
              page_path?: string
              provider_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              event_action: string
              page_path?: string
              provider_id: string
              service_name?: string
              source_marker?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              cta_origin?: string
              event_action: string
              page_path?: string
              provider_id: string
              service_name?: string
              source_marker?: string
            }
            Returns: undefined
          }
      log_pwa_install_event: {
        Args: { _event: string; _meta?: Json }
        Returns: undefined
      }
      log_query_telemetry: {
        Args: {
          _duration_ms: number
          _label: string
          _meta?: Json
          _rows?: number
        }
        Returns: undefined
      }
      log_search_intent: {
        Args: {
          _category_name?: string
          _category_slug?: string
          _city?: string
          _state?: string
          _visitor_id?: string
        }
        Returns: string
      }
      log_sponsor_access_event: {
        Args: {
          _details?: Json
          _event_type: string
          _resource_path: string
          _sponsor_id: string
        }
        Returns: undefined
      }
      log_sponsor_doc_validation_failure: {
        Args: {
          _doc_type: string
          _lead_id: string
          _metadata?: Json
          _reason: string
        }
        Returns: undefined
      }
      log_web_vitals: {
        Args: { _samples: Json; _visitor_id?: string }
        Returns: number
      }
      mark_consent_revocations_read: {
        Args: { _ids: string[] }
        Returns: number
      }
      mark_ghost_providers: {
        Args: never
        Returns: {
          marked_count: number
        }[]
      }
      mark_lead_as_concluded: { Args: { _lead_id: string }; Returns: Json }
      mark_notification_read: {
        Args: { _notification_id: string }
        Returns: boolean
      }
      mark_notifications_read_bulk: {
        Args: { _ids: string[] }
        Returns: number
      }
      mark_provider_geo_reviewed: {
        Args: {
          _audit_id: string
          _provider_lat?: number
          _provider_lng?: number
          _review_notes?: string
          _source?: string
          _status: string
        }
        Returns: {
          actor_user_id: string | null
          city: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          payload: Json
          provider_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          state: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "provider_geo_audit"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      nearby_providers: {
        Args: {
          _account_type?: string
          _category_slug?: string
          _lat?: number
          _limit?: number
          _lng?: number
          _online_user_ids?: string[]
          _radius_m?: number
        }
        Returns: {
          account_type: string
          activity_signal: string
          business_name: string
          business_segment: string
          category_icon: string
          category_name: string
          category_slug: string
          city: string
          complement: string
          description: string
          distance_m: number
          featured: boolean
          id: string
          is_online: boolean
          latitude: number
          longitude: number
          neighborhood: string
          phone: string
          photo_url: string
          plan: string
          portfolio_album_count: number
          portfolio_photo_count: number
          postal_code: string
          rating_avg: number
          review_count: number
          services_count: number
          show_full_address: boolean
          slug: string
          social_links: Json
          state: string
          street: string
          street_number: string
          user_id: string
          visibility_score: number
          whatsapp: string
          years_experience: number
        }[]
      }
      normalize_service_area_text: { Args: { _raw: string }; Returns: string }
      normalize_slug: { Args: { _input: string }; Returns: string }
      normalize_uf: { Args: { _input: string }; Returns: string }
      notify_admins_about_sponsor: {
        Args: {
          _link?: string
          _message: string
          _sponsor_id: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      notify_admins_geo_alert: {
        Args: {
          _link?: string
          _message: string
          _title: string
          _type?: string
        }
        Returns: undefined
      }
      notify_sponsor_contacts: {
        Args: {
          _message: string
          _sponsor_id: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      peek_auth_rate_limit: {
        Args: { _email_normalized: string; _flow: string; _ip_hash: string }
        Returns: Json
      }
      process_daily_stats: { Args: never; Returns: number }
      process_lead_followup_reminders: { Args: never; Returns: Json }
      publish_my_provider: { Args: never; Returns: Json }
      purge_cold_storage_91d: { Args: never; Returns: number }
      purge_onboarding_events: { Args: never; Returns: Json }
      purge_telemetry_tables: { Args: never; Returns: Json }
      realign_first_service: {
        Args: {
          _category_id: string
          _provider_id: string
          _service_id: string
        }
        Returns: Json
      }
      recalc_provider_community_verified: {
        Args: { _provider_id: string }
        Returns: boolean
      }
      recalculate_engagement_points: {
        Args: { target_user_id: string }
        Returns: number
      }
      recompute_provider_verified: {
        Args: { _provider_id: string }
        Returns: Json
      }
      record_dashboard_session: {
        Args: { _route?: string; _ua?: string }
        Returns: undefined
      }
      record_my_geo_event:
        | {
            Args: {
              _accuracy_m?: number
              _city?: string
              _error_message?: string
              _event_type: string
              _latency_ms?: number
              _latitude?: number
              _longitude?: number
              _neighborhood?: string
              _source: string
              _state?: string
              _status?: string
            }
            Returns: string
          }
        | {
            Args: {
              _accuracy_m?: number
              _city?: string
              _error_message?: string
              _event_type: string
              _latency_ms?: number
              _latitude?: number
              _longitude?: number
              _neighborhood?: string
              _source: string
              _state?: string
              _status?: string
            }
            Returns: string
          }
      record_privacy_event: {
        Args: {
          _event_type: string
          _ip_address?: string
          _metadata?: Json
          _reason?: string
          _user_agent?: string
        }
        Returns: string
      }
      record_public_funnel_event: {
        Args: {
          _action: string
          _category?: string
          _city?: string
          _pathname?: string
          _resource_id?: string
          _result_count?: number
          _source?: string
          _sponsor_ref?: string
          _term?: string
        }
        Returns: undefined
      }
      record_registration_snapshot: {
        Args: { _payload: Json }
        Returns: string
      }
      record_sponsor_delivery_block: {
        Args: {
          _pathname?: string
          _reason: string
          _slot: string
          _sponsor_id: string
        }
        Returns: undefined
      }
      refresh_all_sponsor_pacing: {
        Args: never
        Returns: {
          critical_count: number
          updated_count: number
          warning_count: number
        }[]
      }
      refresh_featured_providers_mv: { Args: never; Returns: undefined }
      refresh_sponsor_billing_status: { Args: never; Returns: Json }
      register_click_lead: {
        Args: {
          _contact_kind: string
          _lead_context?: Json
          _provider_id: string
          _service_needed?: string
        }
        Returns: string
      }
      register_daily_checkin: { Args: never; Returns: Json }
      register_dashboard_visit: {
        Args: never
        Returns: {
          created_at: string
          dismissed_widgets: string[]
          first_visit_at: string
          last_visit_at: string | null
          preferred_tier: string | null
          updated_at: string
          user_id: string
          visits_count: number
        }
        SetofOptions: {
          from: "*"
          to: "user_dashboard_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_referral:
        | { Args: { _code: string }; Returns: Json }
        | {
            Args: { _referral_code: string; _referred_id: string }
            Returns: boolean
          }
      register_service_completion: { Args: never; Returns: Json }
      request_self_account_ban: { Args: never; Returns: Json }
      reschedule_lead_followup: {
        Args: { _lead_id: string; _next_at: string; _note?: string }
        Returns: undefined
      }
      resolve_city_slug: {
        Args: { _input: string }
        Returns: {
          matched_exact: boolean
          name: string
          slug: string
          state: string
          state_uf: string
        }[]
      }
      resolve_identity_suggestion: {
        Args: { _action: string; _suggestion_id: string }
        Returns: Json
      }
      resolve_sponsor_slot_capacity: {
        Args: { _category: string; _city: string; _position: string }
        Returns: number
      }
      restore_dashboard_widget: {
        Args: { _widget: string }
        Returns: {
          created_at: string
          dismissed_widgets: string[]
          first_visit_at: string
          last_visit_at: string | null
          preferred_tier: string | null
          updated_at: string
          user_id: string
          visits_count: number
        }
        SetofOptions: {
          from: "*"
          to: "user_dashboard_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_integrity_check: { Args: never; Returns: Json }
      search_cities: {
        Args: { term: string }
        Returns: {
          id: string
          name: string
          state: string
          state_uf: string
        }[]
      }
      search_cities_prioritized: {
        Args: { preferred_uf?: string; term: string }
        Returns: {
          id: string
          name: string
          priority: number
          state: string
          state_uf: string
        }[]
      }
      search_sponsor_inventory: {
        Args: { _category?: string; _city?: string; _slot?: string }
        Returns: {
          active_sponsors: number
          available_slots: number
          category: string
          city: string
          max_capacity: number
          occupancy_rate: number
          slot_slug: string
          status: string
        }[]
      }
      search_user_notifications: {
        Args: {
          _from?: string
          _limit?: number
          _offset?: number
          _order?: string
          _provider_id?: string
          _query?: string
          _status?: string
          _to?: string
          _type?: string
        }
        Returns: {
          created_at: string
          id: string
          link: string
          message: string
          rank: number
          read: boolean
          title: string
          total_count: number
          type: string
        }[]
      }
      self_delete_account: { Args: { _reason?: string }; Returns: Json }
      service_area_is_in_catalog: { Args: { p_city: string }; Returns: boolean }
      service_description_first_forbidden_term: {
        Args: { p_text: string }
        Returns: string
      }
      set_profile_tax_id: { Args: { _tax_id: string }; Returns: undefined }
      set_provider_geo_source: {
        Args: {
          _actor_user_id?: string
          _confidence?: number
          _error_message?: string
          _event_type?: string
          _payload?: Json
          _provider_id: string
          _source: string
          _status?: string
        }
        Returns: undefined
      }
      slugify_text: { Args: { _text: string }; Returns: string }
      sponsor_can_create_campaign: {
        Args: { _sponsor_id: string }
        Returns: boolean
      }
      sponsor_cancel_change_request: {
        Args: { _id: string }
        Returns: undefined
      }
      sponsor_has_active_plan: {
        Args: { _sponsor_id: string }
        Returns: boolean
      }
      sponsor_request_renewal: { Args: { _sponsor_id: string }; Returns: Json }
      sponsor_submit_change_request: {
        Args: { _changes: Json; _sponsor_id: string; _storage_paths?: string[] }
        Returns: string
      }
      suggest_nearby_cities: {
        Args: {
          _base_city: string
          _base_state: string
          _limit?: number
          _max_km?: number
        }
        Returns: {
          bucket: string
          distance_km: number
          id: string
          latitude: number
          longitude: number
          name: string
          state_uf: string
        }[]
      }
      suggest_next_contact_slot: {
        Args: { _from_ts?: string; _provider_id: string }
        Returns: {
          day: number
          iso_date: string
          period: string
        }[]
      }
      touch_my_provider_activity: { Args: never; Returns: undefined }
      track_lead_interaction: {
        Args: {
          _provider_id: string
          _service_id: string
          _source: string
          _type: string
          _ua_hash: string
        }
        Returns: string
      }
      track_presence_heartbeat: { Args: never; Returns: Json }
      track_sponsor_metric: {
        Args: {
          _event_type: string
          _page_path?: string
          _slot_slug: string
          _sponsor_id: string
        }
        Returns: undefined
      }
      update_album_atomic: {
        Args: { p_album_id: string; p_data: Json }
        Returns: Json
      }
      update_photo_atomic: {
        Args: { p_data: Json; p_photo_id: string }
        Returns: Json
      }
      update_service_atomic: {
        Args: { p_category_ids?: string[]; p_data: Json; p_service_id: string }
        Returns: Json
      }
      update_site_setting_audited: {
        Args: { p_key: string; p_value: string }
        Returns: undefined
      }
      upload_failure_stats: {
        Args: { _lookback_hours?: number }
        Returns: {
          avg_attempts: number
          avg_total_ms: number
          device_family: string
          downlink_band: string
          effective_type: string
          fail_rate: number
          failures: number
          total: number
        }[]
      }
      user_lead_quota: { Args: { _user_id: string }; Returns: number }
      user_lead_quota_usage: { Args: { _user_id: string }; Returns: Json }
      validate_db_health: { Args: never; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "gerente"
        | "supervisor"
        | "analista"
      support_message_role: "user" | "admin"
      support_ticket_status: "open_user" | "open_admin" | "closed"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "gerente",
        "supervisor",
        "analista",
      ],
      support_message_role: ["user", "admin"],
      support_ticket_status: ["open_user", "open_admin", "closed"],
    },
  },
} as const
