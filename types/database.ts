export type Database = {
  public: {
    Tables: {
      creators: {
        Row: {
          id: string;
          user_id: string;
          handle: string;
          brand_name: string;
          brand_colors: Record<string, unknown>;
          logo_url: string | null;
          fonts: Record<string, unknown>;
          tone_of_voice: string | null;
          target_audience: string | null;
          preferred_cta: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          handle: string;
          brand_name: string;
          brand_colors?: Record<string, unknown>;
          logo_url?: string | null;
          fonts?: Record<string, unknown>;
          tone_of_voice?: string | null;
          target_audience?: string | null;
          preferred_cta?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          handle?: string;
          brand_name?: string;
          brand_colors?: Record<string, unknown>;
          logo_url?: string | null;
          fonts?: Record<string, unknown>;
          tone_of_voice?: string | null;
          target_audience?: string | null;
          preferred_cta?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      storefronts: {
        Row: {
          id: string;
          creator_id: string;
          sections: Record<string, unknown>;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          sections?: Record<string, unknown>;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          sections?: Record<string, unknown>;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      landing_pages: {
        Row: {
          id: string;
          creator_id: string;
          slug: string;
          type: "sales" | "webinar" | "lead_magnet" | "waitlist" | "thank_you" | "vsl" | "launch";
          content: Record<string, unknown>;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          slug: string;
          type: "sales" | "webinar" | "lead_magnet" | "waitlist" | "thank_you" | "vsl" | "launch";
          content?: Record<string, unknown>;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          slug?: string;
          type?: "sales" | "webinar" | "lead_magnet" | "waitlist" | "thank_you" | "vsl" | "launch";
          content?: Record<string, unknown>;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          creator_id: string;
          type: "pdf" | "ebook" | "template" | "canva" | "notion" | "zip" | "audio" | "membership";
          title: string;
          description: string | null;
          price_cents: number;
          cover_image_url: string | null;
          file_url: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          type: "pdf" | "ebook" | "template" | "canva" | "notion" | "zip" | "audio" | "membership";
          title: string;
          description?: string | null;
          price_cents?: number;
          cover_image_url?: string | null;
          file_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          type?: "pdf" | "ebook" | "template" | "canva" | "notion" | "zip" | "audio" | "membership";
          title?: string;
          description?: string | null;
          price_cents?: number;
          cover_image_url?: string | null;
          file_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      courses: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          description: string | null;
          cover_image_url: string | null;
          price_cents: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          description?: string | null;
          cover_image_url?: string | null;
          price_cents?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          title?: string;
          description?: string | null;
          cover_image_url?: string | null;
          price_cents?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      modules: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          position: number;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          position: number;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          position?: number;
        };
      };
      lessons: {
        Row: {
          id: string;
          module_id: string;
          title: string;
          position: number;
          content: Record<string, unknown>;
          video_url: string | null;
        };
        Insert: {
          id?: string;
          module_id: string;
          title: string;
          position: number;
          content?: Record<string, unknown>;
          video_url?: string | null;
        };
        Update: {
          id?: string;
          module_id?: string;
          title?: string;
          position?: number;
          content?: Record<string, unknown>;
          video_url?: string | null;
        };
      };
      customers: {
        Row: {
          id: string;
          email: string;
          creator_id: string;
          auth_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          creator_id: string;
          auth_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          creator_id?: string;
          auth_user_id?: string | null;
          created_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          customer_id: string;
          product_id: string | null;
          course_id: string | null;
          amount_cents: number;
          status: "pending" | "paid" | "refunded";
          stripe_payment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          product_id?: string | null;
          course_id?: string | null;
          amount_cents: number;
          status?: "pending" | "paid" | "refunded";
          stripe_payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          product_id?: string | null;
          course_id?: string | null;
          amount_cents?: number;
          status?: "pending" | "paid" | "refunded";
          stripe_payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscribers: {
        Row: {
          id: string;
          creator_id: string;
          email: string;
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          email: string;
          source?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          email?: string;
          source?: string | null;
          created_at?: string;
        };
      };
      lesson_progress: {
        Row: {
          id: string;
          customer_id: string;
          lesson_id: string;
          completed_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          lesson_id: string;
          completed_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          lesson_id?: string;
          completed_at?: string;
        };
      };
      ai_conversations: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          tool_calls: Record<string, unknown>[];
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          tool_calls?: Record<string, unknown>[];
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: "user" | "assistant";
          content?: string;
          tool_calls?: Record<string, unknown>[];
          created_at?: string;
        };
      };
      ai_assets: {
        Row: {
          id: string;
          creator_id: string;
          type: "landing_page" | "storefront_layout" | "product_description" | "email_copy" | "course_outline" | "worksheet" | "pdf";
          reference_id: string | null;
          content: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          type: "landing_page" | "storefront_layout" | "product_description" | "email_copy" | "course_outline" | "worksheet" | "pdf";
          reference_id?: string | null;
          content: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          type?: "landing_page" | "storefront_layout" | "product_description" | "email_copy" | "course_outline" | "worksheet" | "pdf";
          reference_id?: string | null;
          content?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      analytics_events: {
        Row: {
          id: string;
          creator_id: string;
          event_type: "page_view" | "sale" | "signup" | "enrollment";
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          event_type: "page_view" | "sale" | "signup" | "enrollment";
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          event_type?: "page_view" | "sale" | "signup" | "enrollment";
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
      };
    };
  };
};
