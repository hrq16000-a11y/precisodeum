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
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          profile_type: string
          role: string
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          profile_type?: string
          role?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          profile_type?: string
          role?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      sponsors: {
        Row: {
          active: boolean
          clicks: number
          created_at: string
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      get_rss_import_headers: { Args: never; Returns: Json }
      get_user_sponsor_id: { Args: { _user_id: string }; Returns: string }
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
      is_sponsor: { Args: { _user_id: string }; Returns: boolean }
      track_sponsor_metric: {
        Args: {
          _event_type: string
          _page_path?: string
          _slot_slug: string
          _sponsor_id: string
        }
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
