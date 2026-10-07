// Generado por scripts/gen-db-types.mjs (npm run db:types). No editar a mano.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ai_suggestions: {
        Row: {
          id: string;
          user_id: string;
          entry_id: string | null;
          kind: string;
          input_ref: Json;
          output: Json | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          entry_id?: string | null;
          kind: string;
          input_ref: Json;
          output?: Json | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_id?: string | null;
          kind?: string;
          input_ref?: Json;
          output?: Json | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
        ];
      };
      attachments: {
        Row: {
          id: string;
          user_id: string;
          entry_id: string | null;
          kind: string;
          storage_path: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          duration_seconds: number | null;
          text_content: string | null;
          caption: string | null;
          ai_description: string | null;
          ai_extracted_text: string | null;
          ai_tags: string[];
          ai_status: string;
          captured_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          entry_id?: string | null;
          kind: string;
          storage_path?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          duration_seconds?: number | null;
          text_content?: string | null;
          caption?: string | null;
          ai_description?: string | null;
          ai_extracted_text?: string | null;
          ai_tags: string[];
          ai_status?: string;
          captured_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_id?: string | null;
          kind?: string;
          storage_path?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          duration_seconds?: number | null;
          text_content?: string | null;
          caption?: string | null;
          ai_description?: string | null;
          ai_extracted_text?: string | null;
          ai_tags?: string[];
          ai_status?: string;
          captured_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attachments_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
        ];
      };
      capture_groups: {
        Row: {
          id: string;
          user_id: string;
          attachment_ids: string[];
          suggested_activity_type: string | null;
          suggested_template_id: string | null;
          confidence: number | null;
          suggested_target: string | null;
          target_entry_id: string | null;
          suggested_title: string | null;
          reasoning: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          attachment_ids: string[];
          suggested_activity_type?: string | null;
          suggested_template_id?: string | null;
          confidence?: number | null;
          suggested_target?: string | null;
          target_entry_id?: string | null;
          suggested_title?: string | null;
          reasoning?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          attachment_ids?: string[];
          suggested_activity_type?: string | null;
          suggested_template_id?: string | null;
          confidence?: number | null;
          suggested_target?: string | null;
          target_entry_id?: string | null;
          suggested_title?: string | null;
          reasoning?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capture_groups_suggested_template_id_fkey";
            columns: ["suggested_template_id"];
            isOneToOne: false;
            referencedRelation: "templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capture_groups_target_entry_id_fkey";
            columns: ["target_entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
        ];
      };
      entries: {
        Row: {
          id: string;
          user_id: string;
          entry_date: string;
          started_at: string | null;
          ended_at: string | null;
          template_id: string;
          template_version: number;
          title: string;
          objective: string | null;
          data: Json;
          observations: string | null;
          results: string | null;
          next_steps: string | null;
          data_location: string | null;
          status: string;
          closed_at: string | null;
          void_reason: string | null;
          ai_flags: Json;
          change_source: string;
          search_vector: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          entry_date: string;
          started_at?: string | null;
          ended_at?: string | null;
          template_id: string;
          template_version: number;
          title?: string;
          objective?: string | null;
          data: Json;
          observations?: string | null;
          results?: string | null;
          next_steps?: string | null;
          data_location?: string | null;
          status?: string;
          closed_at?: string | null;
          void_reason?: string | null;
          ai_flags: Json;
          change_source?: string;
          search_vector?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_date?: string;
          started_at?: string | null;
          ended_at?: string | null;
          template_id?: string;
          template_version?: number;
          title?: string;
          objective?: string | null;
          data?: Json;
          observations?: string | null;
          results?: string | null;
          next_steps?: string | null;
          data_location?: string | null;
          status?: string;
          closed_at?: string | null;
          void_reason?: string | null;
          ai_flags?: Json;
          change_source?: string;
          search_vector?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      entry_addenda: {
        Row: {
          id: string;
          user_id: string;
          entry_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          entry_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entry_addenda_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
        ];
      };
      entry_revisions: {
        Row: {
          id: string;
          user_id: string;
          entry_id: string;
          revision: number;
          snapshot: Json;
          changed_at: string;
          change_source: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_id: string;
          revision: number;
          snapshot: Json;
          changed_at?: string;
          change_source?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_id?: string;
          revision?: number;
          snapshot?: Json;
          changed_at?: string;
          change_source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entry_revisions_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
        ];
      };
      entry_samples: {
        Row: {
          entry_id: string;
          sample_id: string;
          role: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          entry_id: string;
          sample_id: string;
          role: string;
          user_id?: string;
          created_at?: string;
        };
        Update: {
          entry_id?: string;
          sample_id?: string;
          role?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entry_samples_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entry_samples_sample_id_fkey";
            columns: ["sample_id"];
            isOneToOne: false;
            referencedRelation: "samples";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          timezone: string;
          lab_name: string | null;
          auto_close_hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          display_name?: string | null;
          timezone?: string;
          lab_name?: string | null;
          auto_close_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          display_name?: string | null;
          timezone?: string;
          lab_name?: string | null;
          auto_close_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_success_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string | null;
          kind: string;
          schedule: Json | null;
          fire_at: string | null;
          enabled: boolean;
          last_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          body?: string | null;
          kind: string;
          schedule?: Json | null;
          fire_at?: string | null;
          enabled?: boolean;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string | null;
          kind?: string;
          schedule?: Json | null;
          fire_at?: string | null;
          enabled?: boolean;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      samples: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          sample_type: string;
          parent_id: string | null;
          metadata: Json;
          status: string;
          storage_location: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          code: string;
          sample_type: string;
          parent_id?: string | null;
          metadata: Json;
          status?: string;
          storage_location?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          sample_type?: string;
          parent_id?: string | null;
          metadata?: Json;
          status?: string;
          storage_location?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "samples_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "samples";
            referencedColumns: ["id"];
          },
        ];
      };
      template_versions: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          version: number;
          fields: Json;
          protocol_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          template_id: string;
          version: number;
          fields: Json;
          protocol_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_id?: string;
          version?: number;
          fields?: Json;
          protocol_notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "templates";
            referencedColumns: ["id"];
          },
        ];
      };
      templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          activity_type: string;
          description: string | null;
          icon: string | null;
          color: string | null;
          is_archived: boolean;
          current_version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          activity_type?: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          is_archived?: boolean;
          current_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          activity_type?: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          is_archived?: boolean;
          current_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transcriptions: {
        Row: {
          id: string;
          user_id: string;
          attachment_id: string;
          text: string | null;
          language: string;
          model: string | null;
          status: string;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          attachment_id: string;
          text?: string | null;
          language?: string;
          model?: string | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          attachment_id?: string;
          text?: string | null;
          language?: string;
          model?: string | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transcriptions_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_reviews: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          summary: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          week_start: string;
          summary?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          summary?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      unaccent_es: { Args: { value: string }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
