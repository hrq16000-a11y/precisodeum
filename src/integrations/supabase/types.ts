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
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
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
      error_reports: {
        Row: {
          action_context: string
          action_history: Json | null
          admin_notes: string | null
          component_name: string | null
          created_at: string
          error_message: string
          error_stack: string | null
          id: string
          page_path: string
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
          component_name?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          page_path?: string
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
          component_name?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          page_path?: string
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
          id: string
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
          id?: string
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
          id?: string
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
        ]
      }
      leads: {
        Row: {
          client_name: string
          created_at: string
          id: string
          lead_score: number
          message: string | null
          phone: string
          provider_id: string
          score_factors: Json | null
          service_needed: string | null
          status: string
          user_id: string | null
          user_ref: string | null
        }
        Insert: {
          client_name: string
          created_at?: string
          id?: string
          lead_score?: number
          message?: string | null
          phone: string
          provider_id: string
          score_factors?: Json | null
          service_needed?: string | null
          status?: string
          user_id?: string | null
          user_ref?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string
          id?: string
          lead_score?: number
          message?: string | null
          phone?: string
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
          id: string
          image_url: string | null
          link: string | null
          message: string
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
          id?: string
          image_url?: string | null
          link?: string | null
          message?: string
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
          id?: string
          image_url?: string | null
          link?: string | null
          message?: string
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
          commercial_plan: string | null
          created_at: string
          department: string | null
          email: string | null
          engagement_points: number
          full_name: string
          id: string
          is_suspicious: boolean
          level_id: string | null
          onboarding_completed: boolean
          permissions: Json
          phone: string | null
          profile_type: string | null
          role: string | null
          staff_role: Database["public"]["Enums"]["app_role"] | null
          status: string
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          suspicious_at: string | null
          suspicious_ip: string | null
          suspicious_reason: string | null
          updated_at: string
          user_ref: string
          whatsapp: string | null
        }
        Insert: {
          account_type_id?: string | null
          avatar_url?: string | null
          commercial_plan?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          engagement_points?: number
          full_name?: string
          id: string
          is_suspicious?: boolean
          level_id?: string | null
          onboarding_completed?: boolean
          permissions?: Json
          phone?: string | null
          profile_type?: string | null
          role?: string | null
          staff_role?: Database["public"]["Enums"]["app_role"] | null
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          suspicious_at?: string | null
          suspicious_ip?: string | null
          suspicious_reason?: string | null
          updated_at?: string
          user_ref: string
          whatsapp?: string | null
        }
        Update: {
          account_type_id?: string | null
          avatar_url?: string | null
          commercial_plan?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          engagement_points?: number
          full_name?: string
          id?: string
          is_suspicious?: boolean
          level_id?: string | null
          onboarding_completed?: boolean
          permissions?: Json
          phone?: string | null
          profile_type?: string | null
          role?: string | null
          staff_role?: Database["public"]["Enums"]["app_role"] | null
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          suspicious_at?: string | null
          suspicious_ip?: string | null
          suspicious_reason?: string | null
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
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      providers: {
        Row: {
          business_name: string | null
          category_custom: string | null
          category_id: string | null
          city: string
          cnpj: string | null
          content_flags: Json | null
          created_at: string
          deleted_at: string | null
          description: string
          featured: boolean
          geog: unknown
          ibge_code: string | null
          id: string
          latitude: number | null
          longitude: number | null
          meta_description: string | null
          meta_title: string | null
          neighborhood: string
          onboarding_progress: Json | null
          phone: string
          photo_url: string | null
          plan: string
          portfolio_album_count: number
          portfolio_photo_count: number
          rating_avg: number
          response_time: string | null
          review_count: number
          service_radius: string | null
          services_count: number
          slug: string | null
          state: string
          status: string
          updated_at: string
          user_id: string
          user_ref: string | null
          website: string | null
          whatsapp: string
          working_hours: string | null
          years_experience: number
        }
        Insert: {
          business_name?: string | null
          category_custom?: string | null
          category_id?: string | null
          city?: string
          cnpj?: string | null
          content_flags?: Json | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          featured?: boolean
          geog?: unknown
          ibge_code?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          neighborhood?: string
          onboarding_progress?: Json | null
          phone?: string
          photo_url?: string | null
          plan?: string
          portfolio_album_count?: number
          portfolio_photo_count?: number
          rating_avg?: number
          response_time?: string | null
          review_count?: number
          service_radius?: string | null
          services_count?: number
          slug?: string | null
          state?: string
          status?: string
          updated_at?: string
          user_id: string
          user_ref?: string | null
          website?: string | null
          whatsapp?: string
          working_hours?: string | null
          years_experience?: number
        }
        Update: {
          business_name?: string | null
          category_custom?: string | null
          category_id?: string | null
          city?: string
          cnpj?: string | null
          content_flags?: Json | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          featured?: boolean
          geog?: unknown
          ibge_code?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          neighborhood?: string
          onboarding_progress?: Json | null
          phone?: string
          photo_url?: string | null
          plan?: string
          portfolio_album_count?: number
          portfolio_photo_count?: number
          rating_avg?: number
          response_time?: string | null
          review_count?: number
          service_radius?: string | null
          services_count?: number
          slug?: string | null
          state?: string
          status?: string
          updated_at?: string
          user_id?: string
          user_ref?: string | null
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
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
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
          deleted_at: string | null
          description: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_emergency: boolean
          price: string | null
          provider_id: string
          seo_tags: string[]
          service_area: string
          service_name: string
          service_radius: string
          user_ref: string | null
          view_count: number
          website: string | null
          whatsapp: string
          working_hours: string
          youtube_url: string | null
        }
        Insert: {
          address?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_emergency?: boolean
          price?: string | null
          provider_id: string
          seo_tags?: string[]
          service_area?: string
          service_name: string
          service_radius?: string
          user_ref?: string | null
          view_count?: number
          website?: string | null
          whatsapp?: string
          working_hours?: string
          youtube_url?: string | null
        }
        Update: {
          address?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_emergency?: boolean
          price?: string | null
          provider_id?: string
          seo_tags?: string[]
          service_area?: string
          service_name?: string
          service_radius?: string
          user_ref?: string | null
          view_count?: number
          website?: string | null
          whatsapp?: string
          working_hours?: string
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
      sponsor_leads: {
        Row: {
          cnpj: string
          company_name: string
          contract_accepted: boolean
          created_at: string
          email: string
          id: string
          notes: string | null
          phone: string
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          company_name: string
          contract_accepted?: boolean
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          phone: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          company_name?: string
          contract_accepted?: boolean
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          phone?: string
          plan?: string
          status?: string
          updated_at?: string
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
      sponsor_plans: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          max_impressions: number | null
          max_slots: number | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          max_impressions?: number | null
          max_slots?: number | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          max_impressions?: number | null
          max_slots?: number | null
          name?: string
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
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          notes: string | null
          payment_method: string | null
          plan_id: string
          sponsor_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          billing_cycle?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          plan_id: string
          sponsor_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          billing_cycle?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          plan_id?: string
          sponsor_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
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
          link_url: string | null
          linked_category: string | null
          linked_city: string | null
          logo_url: string | null
          max_height: number
          max_width: number
          needs_compensation: boolean
          phone: string | null
          plan: string
          plan_tier: string
          position: string
          short_description: string
          sponsor_type: string
          start_date: string | null
          status: string
          target_pages: string
          tier: string
          title: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          ad_format?: string
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
          link_url?: string | null
          linked_category?: string | null
          linked_city?: string | null
          logo_url?: string | null
          max_height?: number
          max_width?: number
          needs_compensation?: boolean
          phone?: string | null
          plan?: string
          plan_tier?: string
          position?: string
          short_description?: string
          sponsor_type?: string
          start_date?: string | null
          status?: string
          target_pages?: string
          tier?: string
          title: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          ad_format?: string
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
          link_url?: string | null
          linked_category?: string | null
          linked_city?: string | null
          logo_url?: string | null
          max_height?: number
          max_width?: number
          needs_compensation?: boolean
          phone?: string | null
          plan?: string
          plan_tier?: string
          position?: string
          short_description?: string
          sponsor_type?: string
          start_date?: string | null
          status?: string
          target_pages?: string
          tier?: string
          title?: string
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
            referencedRelation: "user_master_view"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      system_audit_logs: {
        Row: {
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
          business_name: string | null
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          city: string | null
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
          rating_avg: number | null
          review_count: number | null
          services_count: number | null
          slug: string | null
          state: string | null
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
    }
    Functions: {
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
      admin_ban_suspicious: { Args: { _user_ids: string[] }; Returns: number }
      admin_clear_suspicion: { Args: { _user_ids: string[] }; Returns: number }
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
      admin_notify_users: {
        Args: {
          _link?: string
          _message: string
          _title: string
          _user_ids: string[]
        }
        Returns: number
      }
      admin_providers_same_ip: {
        Args: { _min_count?: number }
        Returns: {
          ip_address: string
          provider_count: number
          providers: Json
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
      admin_set_staff_permission: {
        Args: {
          _enabled: boolean
          _permission_key: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      admin_suspicious_summary: { Args: { _limit?: number }; Returns: Json }
      admin_system_health: { Args: { _limit?: number }; Returns: Json }
      admin_system_health_full: { Args: never; Returns: Json }
      audit_user_ref_full: {
        Args: never
        Returns: {
          invalid_refs: number
          table_name: string
          total_records: number
        }[]
      }
      award_engagement_points: {
        Args: { _action_key: string; _metadata?: Json; _user_id: string }
        Returns: number
      }
      calculate_user_level: { Args: { _user_id: string }; Returns: string }
      check_rate_limit: {
        Args: {
          _action: string
          _identifier: string
          _max_attempts: number
          _window_minutes: number
        }
        Returns: boolean
      }
      effective_user_permissions: { Args: { _user_id: string }; Returns: Json }
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
      get_community_feed: {
        Args: { _limit?: number }
        Returns: {
          action_text: string
          actor_alias: string
          category_name: string | null
          city: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_seed: boolean | null
          profile_type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "public_activities"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_featured_providers: {
        Args: { _limit?: number }
        Returns: {
          business_name: string | null
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          city: string | null
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
          rating_avg: number | null
          review_count: number | null
          services_count: number | null
          slug: string | null
          state: string | null
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
      get_neighborhood_by_point: {
        Args: { _lat: number; _lng: number }
        Returns: string
      }
      get_rss_import_headers: { Args: never; Returns: Json }
      get_staff_permissions: { Args: { _user_id: string }; Returns: Json }
      get_user_sponsor_id: { Args: { _user_id: string }; Returns: string }
      get_user_storage_usage: { Args: { _user_ref: string }; Returns: number }
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
        Args: { service_id: string }
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
      nearby_providers: {
        Args: {
          _category_slug?: string
          _lat: number
          _limit?: number
          _lng: number
          _radius_m?: number
        }
        Returns: {
          business_name: string
          category_icon: string
          category_name: string
          category_slug: string
          city: string
          description: string
          distance_m: number
          featured: boolean
          id: string
          latitude: number
          longitude: number
          neighborhood: string
          phone: string
          photo_url: string
          plan: string
          portfolio_album_count: number
          portfolio_photo_count: number
          rating_avg: number
          review_count: number
          services_count: number
          slug: string
          state: string
          user_id: string
          whatsapp: string
          years_experience: number
        }[]
      }
      recalculate_engagement_points: {
        Args: { target_user_id: string }
        Returns: number
      }
      refresh_featured_providers_mv: { Args: never; Returns: undefined }
      track_sponsor_metric: {
        Args: {
          _event_type: string
          _page_path?: string
          _slot_slug: string
          _sponsor_id: string
        }
        Returns: undefined
      }
      user_lead_quota: { Args: { _user_id: string }; Returns: number }
      user_lead_quota_usage: { Args: { _user_id: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "gerente"
        | "supervisor"
        | "analista"
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
    },
  },
} as const
