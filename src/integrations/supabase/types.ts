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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      atproto_oauth_state: {
        Row: {
          auth_server_url: string | null
          code_verifier: string
          created_at: string | null
          did: string | null
          dpop_private_key_jwk: string | null
          dpop_public_key_jwk: string | null
          expires_at: string | null
          id: string
          pds_url: string | null
          return_url: string
          state: string
        }
        Insert: {
          auth_server_url?: string | null
          code_verifier: string
          created_at?: string | null
          did?: string | null
          dpop_private_key_jwk?: string | null
          dpop_public_key_jwk?: string | null
          expires_at?: string | null
          id?: string
          pds_url?: string | null
          return_url: string
          state: string
        }
        Update: {
          auth_server_url?: string | null
          code_verifier?: string
          created_at?: string | null
          did?: string | null
          dpop_private_key_jwk?: string | null
          dpop_public_key_jwk?: string | null
          expires_at?: string | null
          id?: string
          pds_url?: string | null
          return_url?: string
          state?: string
        }
        Relationships: []
      }
      atproto_sessions: {
        Row: {
          access_token: string
          auth_server_url: string | null
          created_at: string | null
          did: string
          dpop_private_key_jwk: string | null
          handle: string
          id: string
          pds_url: string
          refresh_token: string | null
          session_token: string
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          auth_server_url?: string | null
          created_at?: string | null
          did: string
          dpop_private_key_jwk?: string | null
          handle: string
          id?: string
          pds_url: string
          refresh_token?: string | null
          session_token: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          auth_server_url?: string | null
          created_at?: string | null
          did?: string
          dpop_private_key_jwk?: string | null
          handle?: string
          id?: string
          pds_url?: string
          refresh_token?: string | null
          session_token?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      comments_index: {
        Row: {
          author_did: string
          cid: string
          contract_name: string
          created_at: string | null
          id: string
          line_number: number | null
          line_range_end: number | null
          line_range_start: number | null
          parent_uri: string | null
          principal: string
          text: string
          uri: string
        }
        Insert: {
          author_did: string
          cid: string
          contract_name: string
          created_at?: string | null
          id?: string
          line_number?: number | null
          line_range_end?: number | null
          line_range_start?: number | null
          parent_uri?: string | null
          principal: string
          text: string
          uri: string
        }
        Update: {
          author_did?: string
          cid?: string
          contract_name?: string
          created_at?: string | null
          id?: string
          line_number?: number | null
          line_range_end?: number | null
          line_range_start?: number | null
          parent_uri?: string | null
          principal?: string
          text?: string
          uri?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          category: string | null
          clarity_version: string | null
          created_at: string | null
          deployed_at: string | null
          description: string | null
          id: string
          name: string
          principal: string
          source_code: string
          source_hash: string | null
          tx_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          clarity_version?: string | null
          created_at?: string | null
          deployed_at?: string | null
          description?: string | null
          id?: string
          name: string
          principal: string
          source_code: string
          source_hash?: string | null
          tx_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          clarity_version?: string | null
          created_at?: string | null
          deployed_at?: string | null
          description?: string | null
          id?: string
          name?: string
          principal?: string
          source_code?: string
          source_hash?: string | null
          tx_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      likes_index: {
        Row: {
          author_did: string
          cid: string
          created_at: string | null
          id: string
          subject_cid: string
          subject_uri: string
          uri: string
        }
        Insert: {
          author_did: string
          cid: string
          created_at?: string | null
          id?: string
          subject_cid: string
          subject_uri: string
          uri: string
        }
        Update: {
          author_did?: string
          cid?: string
          created_at?: string | null
          id?: string
          subject_cid?: string
          subject_uri?: string
          uri?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
