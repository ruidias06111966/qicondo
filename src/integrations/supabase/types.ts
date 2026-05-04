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
      area_bloqueios: {
        Row: {
          area_id: string
          condominio_id: string
          created_at: string
          criado_por: string | null
          fim: string
          id: string
          inicio: string
          motivo: string
        }
        Insert: {
          area_id: string
          condominio_id: string
          created_at?: string
          criado_por?: string | null
          fim: string
          id?: string
          inicio: string
          motivo: string
        }
        Update: {
          area_id?: string
          condominio_id?: string
          created_at?: string
          criado_por?: string | null
          fim?: string
          id?: string
          inicio?: string
          motivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_bloqueios_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas_comuns"
            referencedColumns: ["id"]
          },
        ]
      }
      areas_comuns: {
        Row: {
          antecedencia_max_dias: number
          antecedencia_min_horas: number
          ativo: boolean
          capacidade: number | null
          condominio_id: string
          cor: string
          created_at: string
          descricao: string | null
          dias_permitidos: number[]
          duracao_max_minutos: number
          duracao_min_minutos: number
          foto_url: string | null
          hora_abertura: string
          hora_fechamento: string
          id: string
          intervalo_entre_reservas_min: number
          max_reservas_por_unidade_mes: number
          nome: string
          ordem: number
          regulamento: string | null
          requer_aprovacao: boolean
          taxa_uso: number
          updated_at: string
        }
        Insert: {
          antecedencia_max_dias?: number
          antecedencia_min_horas?: number
          ativo?: boolean
          capacidade?: number | null
          condominio_id: string
          cor?: string
          created_at?: string
          descricao?: string | null
          dias_permitidos?: number[]
          duracao_max_minutos?: number
          duracao_min_minutos?: number
          foto_url?: string | null
          hora_abertura?: string
          hora_fechamento?: string
          id?: string
          intervalo_entre_reservas_min?: number
          max_reservas_por_unidade_mes?: number
          nome: string
          ordem?: number
          regulamento?: string | null
          requer_aprovacao?: boolean
          taxa_uso?: number
          updated_at?: string
        }
        Update: {
          antecedencia_max_dias?: number
          antecedencia_min_horas?: number
          ativo?: boolean
          capacidade?: number | null
          condominio_id?: string
          cor?: string
          created_at?: string
          descricao?: string | null
          dias_permitidos?: number[]
          duracao_max_minutos?: number
          duracao_min_minutos?: number
          foto_url?: string | null
          hora_abertura?: string
          hora_fechamento?: string
          id?: string
          intervalo_entre_reservas_min?: number
          max_reservas_por_unidade_mes?: number
          nome?: string
          ordem?: number
          regulamento?: string | null
          requer_aprovacao?: boolean
          taxa_uso?: number
          updated_at?: string
        }
        Relationships: []
      }
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
      categorias_financeiras: {
        Row: {
          ativo: boolean
          condominio_id: string
          cor: string | null
          created_at: string
          id: string
          nome: string
          ordem: number
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          condominio_id: string
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          condominio_id?: string
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          categoria_id: string | null
          competencia: string
          condominio_id: string
          created_at: string
          criado_por: string | null
          desconto: number
          descricao: string | null
          id: string
          juros: number
          mp_payment_id: string | null
          mp_qr_code: string | null
          mp_qr_code_base64: string | null
          mp_ticket_url: string | null
          multa: number
          pago_em: string | null
          status: Database["public"]["Enums"]["cobranca_status"]
          unidade_id: string
          updated_at: string
          valor: number
          valor_pago: number
          vencimento: string
        }
        Insert: {
          categoria_id?: string | null
          competencia: string
          condominio_id: string
          created_at?: string
          criado_por?: string | null
          desconto?: number
          descricao?: string | null
          id?: string
          juros?: number
          mp_payment_id?: string | null
          mp_qr_code?: string | null
          mp_qr_code_base64?: string | null
          mp_ticket_url?: string | null
          multa?: number
          pago_em?: string | null
          status?: Database["public"]["Enums"]["cobranca_status"]
          unidade_id: string
          updated_at?: string
          valor: number
          valor_pago?: number
          vencimento: string
        }
        Update: {
          categoria_id?: string | null
          competencia?: string
          condominio_id?: string
          created_at?: string
          criado_por?: string | null
          desconto?: number
          descricao?: string | null
          id?: string
          juros?: number
          mp_payment_id?: string | null
          mp_qr_code?: string | null
          mp_qr_code_base64?: string | null
          mp_ticket_url?: string | null
          multa?: number
          pago_em?: string | null
          status?: Database["public"]["Enums"]["cobranca_status"]
          unidade_id?: string
          updated_at?: string
          valor?: number
          valor_pago?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
      config_pagamento: {
        Row: {
          ativo: boolean
          condominio_id: string
          created_at: string
          dias_envio_lembrete: number
          juros_dia_percentual: number
          mp_access_token: string | null
          mp_public_key: string | null
          mp_user_id: string | null
          mp_webhook_secret: string | null
          multa_percentual: number
          pix_chave: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          condominio_id: string
          created_at?: string
          dias_envio_lembrete?: number
          juros_dia_percentual?: number
          mp_access_token?: string | null
          mp_public_key?: string | null
          mp_user_id?: string | null
          mp_webhook_secret?: string | null
          multa_percentual?: number
          pix_chave?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          condominio_id?: string
          created_at?: string
          dias_envio_lembrete?: number
          juros_dia_percentual?: number
          mp_access_token?: string | null
          mp_public_key?: string | null
          mp_user_id?: string | null
          mp_webhook_secret?: string | null
          multa_percentual?: number
          pix_chave?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_pagamento_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: true
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
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
          token_hash: string | null
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
          token_hash?: string | null
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
          token_hash?: string | null
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
      despesas: {
        Row: {
          anexo_url: string | null
          categoria_id: string | null
          condominio_id: string
          created_at: string
          data: string
          descricao: string
          forma: Database["public"]["Enums"]["forma_pagamento"] | null
          fornecedor: string | null
          id: string
          registrado_por: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          anexo_url?: string | null
          categoria_id?: string | null
          condominio_id: string
          created_at?: string
          data?: string
          descricao: string
          forma?: Database["public"]["Enums"]["forma_pagamento"] | null
          fornecedor?: string | null
          id?: string
          registrado_por?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          anexo_url?: string | null
          categoria_id?: string | null
          condominio_id?: string
          created_at?: string
          data?: string
          descricao?: string
          forma?: Database["public"]["Enums"]["forma_pagamento"] | null
          fornecedor?: string | null
          id?: string
          registrado_por?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      encomendas: {
        Row: {
          codigo_rastreio: string | null
          condominio_id: string
          created_at: string
          descricao: string
          foto_url: string | null
          id: string
          local_armazenamento: string | null
          notificado_em: string | null
          observacoes: string | null
          recebido_em: string
          recebido_por: string | null
          remetente: string | null
          retirado_em: string | null
          retirado_por: string | null
          retirado_por_nome: string | null
          status: Database["public"]["Enums"]["encomenda_status"]
          transportadora: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          codigo_rastreio?: string | null
          condominio_id: string
          created_at?: string
          descricao: string
          foto_url?: string | null
          id?: string
          local_armazenamento?: string | null
          notificado_em?: string | null
          observacoes?: string | null
          recebido_em?: string
          recebido_por?: string | null
          remetente?: string | null
          retirado_em?: string | null
          retirado_por?: string | null
          retirado_por_nome?: string | null
          status?: Database["public"]["Enums"]["encomenda_status"]
          transportadora?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          codigo_rastreio?: string | null
          condominio_id?: string
          created_at?: string
          descricao?: string
          foto_url?: string | null
          id?: string
          local_armazenamento?: string | null
          notificado_em?: string | null
          observacoes?: string | null
          recebido_em?: string
          recebido_por?: string | null
          remetente?: string | null
          retirado_em?: string | null
          retirado_por?: string | null
          retirado_por_nome?: string | null
          status?: Database["public"]["Enums"]["encomenda_status"]
          transportadora?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes_whatsapp: {
        Row: {
          condominio_id: string
          contexto: string | null
          contexto_id: string | null
          created_at: string
          destinatario_nome: string | null
          destinatario_telefone: string
          destinatario_user_id: string | null
          enviado_em: string | null
          erro: string | null
          id: string
          link_wa: string | null
          mensagem: string
          status: Database["public"]["Enums"]["wa_status"]
          unidade_id: string | null
        }
        Insert: {
          condominio_id: string
          contexto?: string | null
          contexto_id?: string | null
          created_at?: string
          destinatario_nome?: string | null
          destinatario_telefone: string
          destinatario_user_id?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          link_wa?: string | null
          mensagem: string
          status?: Database["public"]["Enums"]["wa_status"]
          unidade_id?: string | null
        }
        Update: {
          condominio_id?: string
          contexto?: string | null
          contexto_id?: string | null
          created_at?: string
          destinatario_nome?: string | null
          destinatario_telefone?: string
          destinatario_user_id?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          link_wa?: string | null
          mensagem?: string
          status?: Database["public"]["Enums"]["wa_status"]
          unidade_id?: string | null
        }
        Relationships: []
      }
      ocorrencia_anexos: {
        Row: {
          condominio_id: string
          created_at: string
          enviado_por: string
          id: string
          nome: string | null
          ocorrencia_id: string
          url: string
        }
        Insert: {
          condominio_id: string
          created_at?: string
          enviado_por: string
          id?: string
          nome?: string | null
          ocorrencia_id: string
          url: string
        }
        Update: {
          condominio_id?: string
          created_at?: string
          enviado_por?: string
          id?: string
          nome?: string | null
          ocorrencia_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencia_anexos_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencia_comentarios: {
        Row: {
          autor_id: string
          condominio_id: string
          created_at: string
          id: string
          interno: boolean
          mensagem: string
          ocorrencia_id: string
        }
        Insert: {
          autor_id: string
          condominio_id: string
          created_at?: string
          id?: string
          interno?: boolean
          mensagem: string
          ocorrencia_id: string
        }
        Update: {
          autor_id?: string
          condominio_id?: string
          created_at?: string
          id?: string
          interno?: boolean
          mensagem?: string
          ocorrencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencia_comentarios_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          aberta_por: string
          atribuido_a: string | null
          atribuido_em: string | null
          atribuido_por: string | null
          categoria: Database["public"]["Enums"]["ocorrencia_categoria"]
          comentario_satisfacao: string | null
          condominio_id: string
          created_at: string
          descricao: string
          fechado_em: string | null
          foto_url: string | null
          id: string
          local: string | null
          nota_satisfacao: number | null
          prioridade: Database["public"]["Enums"]["ocorrencia_prioridade"]
          resolucao: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          status: Database["public"]["Enums"]["ocorrencia_status"]
          titulo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          aberta_por: string
          atribuido_a?: string | null
          atribuido_em?: string | null
          atribuido_por?: string | null
          categoria?: Database["public"]["Enums"]["ocorrencia_categoria"]
          comentario_satisfacao?: string | null
          condominio_id: string
          created_at?: string
          descricao: string
          fechado_em?: string | null
          foto_url?: string | null
          id?: string
          local?: string | null
          nota_satisfacao?: number | null
          prioridade?: Database["public"]["Enums"]["ocorrencia_prioridade"]
          resolucao?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: Database["public"]["Enums"]["ocorrencia_status"]
          titulo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          aberta_por?: string
          atribuido_a?: string | null
          atribuido_em?: string | null
          atribuido_por?: string | null
          categoria?: Database["public"]["Enums"]["ocorrencia_categoria"]
          comentario_satisfacao?: string | null
          condominio_id?: string
          created_at?: string
          descricao?: string
          fechado_em?: string | null
          foto_url?: string | null
          id?: string
          local?: string | null
          nota_satisfacao?: number | null
          prioridade?: Database["public"]["Enums"]["ocorrencia_prioridade"]
          resolucao?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: Database["public"]["Enums"]["ocorrencia_status"]
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          cobranca_id: string | null
          comprovante_url: string | null
          condominio_id: string
          created_at: string
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          mp_payment_id: string | null
          observacoes: string | null
          pago_em: string
          registrado_por: string | null
          valor: number
        }
        Insert: {
          cobranca_id?: string | null
          comprovante_url?: string | null
          condominio_id: string
          created_at?: string
          forma?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          mp_payment_id?: string | null
          observacoes?: string | null
          pago_em?: string
          registrado_por?: string | null
          valor: number
        }
        Update: {
          cobranca_id?: string | null
          comprovante_url?: string | null
          condominio_id?: string
          created_at?: string
          forma?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          mp_payment_id?: string | null
          observacoes?: string | null
          pago_em?: string
          registrado_por?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
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
      reservas: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          area_id: string
          cancelado_em: string | null
          cancelado_por: string | null
          cobranca_id: string | null
          condominio_id: string
          created_at: string
          fim: string
          id: string
          inicio: string
          motivo_recusa: string | null
          num_convidados: number
          observacoes: string | null
          solicitante_id: string
          status: Database["public"]["Enums"]["reserva_status"]
          taxa: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          area_id: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          cobranca_id?: string | null
          condominio_id: string
          created_at?: string
          fim: string
          id?: string
          inicio: string
          motivo_recusa?: string | null
          num_convidados?: number
          observacoes?: string | null
          solicitante_id: string
          status?: Database["public"]["Enums"]["reserva_status"]
          taxa?: number
          unidade_id: string
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          area_id?: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          cobranca_id?: string | null
          condominio_id?: string
          created_at?: string
          fim?: string
          id?: string
          inicio?: string
          motivo_recusa?: string | null
          num_convidados?: number
          observacoes?: string | null
          solicitante_id?: string
          status?: Database["public"]["Enums"]["reserva_status"]
          taxa?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas_comuns"
            referencedColumns: ["id"]
          },
        ]
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
      visitantes: {
        Row: {
          autorizado_em: string | null
          autorizado_por: string | null
          condominio_id: string
          created_at: string
          documento: string | null
          empresa: string | null
          entrada_em: string | null
          foto_url: string | null
          id: string
          motivo_recusa: string | null
          nome: string
          notificado_em: string | null
          observacoes: string | null
          placa_veiculo: string | null
          registrado_por: string | null
          saida_em: string | null
          status: Database["public"]["Enums"]["visitante_status"]
          tipo: Database["public"]["Enums"]["visitante_tipo"]
          unidade_id: string
          updated_at: string
          valido_ate: string | null
        }
        Insert: {
          autorizado_em?: string | null
          autorizado_por?: string | null
          condominio_id: string
          created_at?: string
          documento?: string | null
          empresa?: string | null
          entrada_em?: string | null
          foto_url?: string | null
          id?: string
          motivo_recusa?: string | null
          nome: string
          notificado_em?: string | null
          observacoes?: string | null
          placa_veiculo?: string | null
          registrado_por?: string | null
          saida_em?: string | null
          status?: Database["public"]["Enums"]["visitante_status"]
          tipo?: Database["public"]["Enums"]["visitante_tipo"]
          unidade_id: string
          updated_at?: string
          valido_ate?: string | null
        }
        Update: {
          autorizado_em?: string | null
          autorizado_por?: string | null
          condominio_id?: string
          created_at?: string
          documento?: string | null
          empresa?: string | null
          entrada_em?: string | null
          foto_url?: string | null
          id?: string
          motivo_recusa?: string | null
          nome?: string
          notificado_em?: string | null
          observacoes?: string | null
          placa_veiculo?: string | null
          registrado_por?: string | null
          saida_em?: string | null
          status?: Database["public"]["Enums"]["visitante_status"]
          tipo?: Database["public"]["Enums"]["visitante_tipo"]
          unidade_id?: string
          updated_at?: string
          valido_ate?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      config_pagamento_safe: {
        Row: {
          ativo: boolean | null
          condominio_id: string | null
          dias_envio_lembrete: number | null
          juros_dia_percentual: number | null
          mp_public_key: string | null
          mp_token_configured: boolean | null
          multa_percentual: number | null
          pix_chave_mascarada: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          condominio_id?: string | null
          dias_envio_lembrete?: number | null
          juros_dia_percentual?: number | null
          mp_public_key?: string | null
          mp_token_configured?: never
          multa_percentual?: number | null
          pix_chave_mascarada?: never
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          condominio_id?: string | null
          dias_envio_lembrete?: number | null
          juros_dia_percentual?: number | null
          mp_public_key?: string | null
          mp_token_configured?: never
          multa_percentual?: number | null
          pix_chave_mascarada?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_pagamento_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: true
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      convites_safe: {
        Row: {
          aceito_em: string | null
          aceito_por: string | null
          condominio_id: string | null
          created_at: string | null
          email: string | null
          enviado_por: string | null
          expira_em: string | null
          id: string | null
          nome: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          status: Database["public"]["Enums"]["convite_status"] | null
          telefone: string | null
          unidade_id: string | null
        }
        Insert: {
          aceito_em?: string | null
          aceito_por?: string | null
          condominio_id?: string | null
          created_at?: string | null
          email?: string | null
          enviado_por?: string | null
          expira_em?: string | null
          id?: string | null
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: Database["public"]["Enums"]["convite_status"] | null
          telefone?: string | null
          unidade_id?: string | null
        }
        Update: {
          aceito_em?: string | null
          aceito_por?: string | null
          condominio_id?: string | null
          created_at?: string | null
          email?: string | null
          enviado_por?: string | null
          expira_em?: string | null
          id?: string | null
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: Database["public"]["Enums"]["convite_status"] | null
          telefone?: string | null
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
    }
    Functions: {
      abrir_ocorrencia: {
        Args: {
          _categoria: Database["public"]["Enums"]["ocorrencia_categoria"]
          _condominio_id: string
          _descricao: string
          _foto_url: string
          _local: string
          _prioridade: Database["public"]["Enums"]["ocorrencia_prioridade"]
          _titulo: string
          _unidade_id: string
        }
        Returns: string
      }
      aceitar_convite: { Args: { _token: string }; Returns: string }
      aprovar_reserva: { Args: { _reserva_id: string }; Returns: undefined }
      atribuir_ocorrencia: {
        Args: { _atribuido_a: string; _ocorrencia_id: string }
        Returns: undefined
      }
      atualizar_status_ocorrencia: {
        Args: {
          _novo_status: Database["public"]["Enums"]["ocorrencia_status"]
          _ocorrencia_id: string
          _resolucao: string
        }
        Returns: undefined
      }
      autorizar_visitante: {
        Args: { _visitante_id: string }
        Returns: undefined
      }
      avaliar_ocorrencia: {
        Args: { _comentario: string; _nota: number; _ocorrencia_id: string }
        Returns: undefined
      }
      cancelar_reserva: { Args: { _reserva_id: string }; Returns: undefined }
      comentar_ocorrencia: {
        Args: { _interno: boolean; _mensagem: string; _ocorrencia_id: string }
        Returns: string
      }
      gerar_cobrancas_lote: {
        Args: {
          _categoria_id: string
          _competencia: string
          _condominio_id: string
          _descricao: string
          _usar_taxa_unidade: boolean
          _valor_padrao: number
          _vencimento: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _condominio_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_contador: {
        Args: { _condominio_id: string; _user_id: string }
        Returns: boolean
      }
      is_member_of: {
        Args: { _condominio_id: string; _user_id: string }
        Returns: boolean
      }
      is_morador_da_unidade: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
      is_sindico: {
        Args: { _condominio_id: string; _user_id: string }
        Returns: boolean
      }
      join_condominio_by_code: {
        Args: { _codigo: string }
        Returns: {
          condominio_id: string
          nome: string
        }[]
      }
      marcar_encomenda_retirada: {
        Args: { _encomenda_id: string; _retirado_por_nome: string }
        Returns: undefined
      }
      recusar_reserva: {
        Args: { _motivo: string; _reserva_id: string }
        Returns: undefined
      }
      recusar_visitante: {
        Args: { _motivo: string; _visitante_id: string }
        Returns: undefined
      }
      registrar_encomenda: {
        Args: {
          _codigo_rastreio: string
          _descricao: string
          _foto_url: string
          _local_armazenamento: string
          _observacoes: string
          _remetente: string
          _transportadora: string
          _unidade_id: string
        }
        Returns: string
      }
      registrar_entrada_visitante: {
        Args: { _visitante_id: string }
        Returns: undefined
      }
      registrar_pagamento_manual: {
        Args: {
          _cobranca_id: string
          _forma: Database["public"]["Enums"]["forma_pagamento"]
          _observacoes: string
          _pago_em: string
          _valor: number
        }
        Returns: string
      }
      registrar_saida_visitante: {
        Args: { _visitante_id: string }
        Returns: undefined
      }
      registrar_visitante: {
        Args: {
          _documento: string
          _empresa: string
          _foto_url: string
          _nome: string
          _observacoes: string
          _placa_veiculo: string
          _pre_autorizar: boolean
          _tipo: Database["public"]["Enums"]["visitante_tipo"]
          _unidade_id: string
          _valido_ate: string
        }
        Returns: string
      }
      solicitar_reserva: {
        Args: {
          _area_id: string
          _fim: string
          _inicio: string
          _num_convidados: number
          _observacoes: string
          _unidade_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "sindico" | "morador" | "contador" | "porteiro"
      cobranca_status: "pendente" | "paga" | "vencida" | "cancelada" | "parcial"
      convite_status: "pendente" | "aceito" | "expirado" | "cancelado"
      encomenda_status: "aguardando" | "retirada" | "devolvida"
      forma_pagamento:
        | "pix"
        | "boleto"
        | "dinheiro"
        | "transferencia"
        | "cartao"
        | "outro"
      ocorrencia_categoria:
        | "manutencao"
        | "barulho"
        | "seguranca"
        | "limpeza"
        | "area_comum"
        | "infraestrutura"
        | "outros"
      ocorrencia_prioridade: "baixa" | "media" | "alta" | "urgente"
      ocorrencia_status:
        | "aberta"
        | "em_andamento"
        | "aguardando_morador"
        | "resolvida"
        | "fechada"
        | "cancelada"
      plano_tipo: "basico" | "profissional" | "admin"
      reserva_status:
        | "pendente"
        | "confirmada"
        | "recusada"
        | "cancelada"
        | "concluida"
      tipo_lancamento: "receita" | "despesa"
      vinculo_tipo: "proprietario" | "inquilino" | "familiar"
      visitante_status:
        | "aguardando"
        | "autorizado"
        | "recusado"
        | "dentro"
        | "saiu"
        | "expirado"
      visitante_tipo: "visita" | "prestador" | "delivery" | "mudanca" | "outro"
      wa_status: "pendente" | "enviado" | "falhou"
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
      cobranca_status: ["pendente", "paga", "vencida", "cancelada", "parcial"],
      convite_status: ["pendente", "aceito", "expirado", "cancelado"],
      encomenda_status: ["aguardando", "retirada", "devolvida"],
      forma_pagamento: [
        "pix",
        "boleto",
        "dinheiro",
        "transferencia",
        "cartao",
        "outro",
      ],
      ocorrencia_categoria: [
        "manutencao",
        "barulho",
        "seguranca",
        "limpeza",
        "area_comum",
        "infraestrutura",
        "outros",
      ],
      ocorrencia_prioridade: ["baixa", "media", "alta", "urgente"],
      ocorrencia_status: [
        "aberta",
        "em_andamento",
        "aguardando_morador",
        "resolvida",
        "fechada",
        "cancelada",
      ],
      plano_tipo: ["basico", "profissional", "admin"],
      reserva_status: [
        "pendente",
        "confirmada",
        "recusada",
        "cancelada",
        "concluida",
      ],
      tipo_lancamento: ["receita", "despesa"],
      vinculo_tipo: ["proprietario", "inquilino", "familiar"],
      visitante_status: [
        "aguardando",
        "autorizado",
        "recusado",
        "dentro",
        "saiu",
        "expirado",
      ],
      visitante_tipo: ["visita", "prestador", "delivery", "mudanca", "outro"],
      wa_status: ["pendente", "enviado", "falhou"],
    },
  },
} as const
