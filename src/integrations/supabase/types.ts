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
      audit_log: {
        Row: {
          acao: string
          condominio_id: string | null
          created_at: string
          entidade: string | null
          entidade_id: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          acao: string
          condominio_id?: string | null
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          condominio_id?: string | null
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      condominios: {
        Row: {
          cep: string | null
          cidade: string | null
          cnpj: string | null
          codigo_publico: string
          created_at: string
          criado_por: string
          endereco: string | null
          estado: string | null
          id: string
          logo_url: string | null
          nome: string
          plano: Database["public"]["Enums"]["plano_tipo"]
          total_unidades: number
          updated_at: string
          whatsapp_numero: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_publico: string
          created_at?: string
          criado_por: string
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          plano?: Database["public"]["Enums"]["plano_tipo"]
          total_unidades?: number
          updated_at?: string
          whatsapp_numero?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_publico?: string
          created_at?: string
          criado_por?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          plano?: Database["public"]["Enums"]["plano_tipo"]
          total_unidades?: number
          updated_at?: string
          whatsapp_numero?: string | null
        }
        Relationships: []
      }
      convites: {
        Row: {
          aceito_em: string | null
          aceito_por: string | null
          condominio_id: string
          created_at: string
          email: string | null
          enviado_por: string
          expira_em: string
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["convite_status"]
          telefone: string | null
          token: string
          unidade_id: string | null
        }
        Insert: {
          aceito_em?: string | null
          aceito_por?: string | null
          condominio_id: string
          created_at?: string
          email?: string | null
          enviado_por: string
          expira_em?: string
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["convite_status"]
          telefone?: string | null
          token: string
          unidade_id?: string | null
        }
        Update: {
          aceito_em?: string | null
          aceito_por?: string | null
          condominio_id?: string
          created_at?: string
          email?: string | null
          enviado_por?: string
          expira_em?: string
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["convite_status"]
          telefone?: string | null
          token?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nome_completo: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      unidade_moradores: {
        Row: {
          created_at: string
          id: string
          principal: boolean
          unidade_id: string
          user_id: string
          vinculo: Database["public"]["Enums"]["vinculo_tipo"]
        }
        Insert: {
          created_at?: string
          id?: string
          principal?: boolean
          unidade_id: string
          user_id: string
          vinculo?: Database["public"]["Enums"]["vinculo_tipo"]
        }
        Update: {
          created_at?: string
          id?: string
          principal?: boolean
          unidade_id?: string
          user_id?: string
          vinculo?: Database["public"]["Enums"]["vinculo_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "unidade_moradores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          bloco: string | null
          condominio_id: string
          created_at: string
          fracao_ideal: number | null
          id: string
          numero: string
          observacoes: string | null
          taxa_mensal: number | null
          updated_at: string
        }
        Insert: {
          bloco?: string | null
          condominio_id: string
          created_at?: string
          fracao_ideal?: number | null
          id?: string
          numero: string
          observacoes?: string | null
          taxa_mensal?: number | null
          updated_at?: string
        }
        Update: {
          bloco?: string | null
          condominio_id?: string
          created_at?: string
          fracao_ideal?: number | null
          id?: string
          numero?: string
          observacoes?: string | null
          taxa_mensal?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          condominio_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          condominio_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          condominio_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _condominio_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of: {
        Args: { _condominio_id: string; _user_id: string }
        Returns: boolean
      }
      is_sindico: {
        Args: { _condominio_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "sindico" | "morador" | "contador" | "porteiro"
      convite_status: "pendente" | "aceito" | "expirado" | "cancelado"
      plano_tipo: "basico" | "profissional" | "admin"
      vinculo_tipo: "proprietario" | "inquilino" | "familiar"
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
      app_role: ["sindico", "morador", "contador", "porteiro"],
      convite_status: ["pendente", "aceito", "expirado", "cancelado"],
      plano_tipo: ["basico", "profissional", "admin"],
      vinculo_tipo: ["proprietario", "inquilino", "familiar"],
    },
  },
} as const
