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
      admin_audit_log: {
        Row: {
          acao: string
          admin_user_id: string
          created_at: string
          entidade: string | null
          entidade_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          acao: string
          admin_user_id: string
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          acao?: string
          admin_user_id?: string
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
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
      cnab_config: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: Database["public"]["Enums"]["cnab_banco"]
          carteira: string | null
          cedente_documento: string | null
          cedente_nome: string | null
          condominio_id: string
          conta: string | null
          conta_dv: string | null
          convenio: string | null
          created_at: string
          proximo_nosso_numero: number
          proximo_sequencial: number
          updated_at: string
          variacao: string | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: Database["public"]["Enums"]["cnab_banco"]
          carteira?: string | null
          cedente_documento?: string | null
          cedente_nome?: string | null
          condominio_id: string
          conta?: string | null
          conta_dv?: string | null
          convenio?: string | null
          created_at?: string
          proximo_nosso_numero?: number
          proximo_sequencial?: number
          updated_at?: string
          variacao?: string | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: Database["public"]["Enums"]["cnab_banco"]
          carteira?: string | null
          cedente_documento?: string | null
          cedente_nome?: string | null
          condominio_id?: string
          conta?: string | null
          conta_dv?: string | null
          convenio?: string | null
          created_at?: string
          proximo_nosso_numero?: number
          proximo_sequencial?: number
          updated_at?: string
          variacao?: string | null
        }
        Relationships: []
      }
      cnab_remessa_itens: {
        Row: {
          cobranca_id: string
          created_at: string
          id: string
          nosso_numero: string
          remessa_id: string
          valor: number
          vencimento: string
        }
        Insert: {
          cobranca_id: string
          created_at?: string
          id?: string
          nosso_numero: string
          remessa_id: string
          valor: number
          vencimento: string
        }
        Update: {
          cobranca_id?: string
          created_at?: string
          id?: string
          nosso_numero?: string
          remessa_id?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cnab_remessa_itens_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "cnab_remessas"
            referencedColumns: ["id"]
          },
        ]
      }
      cnab_remessas: {
        Row: {
          banco: Database["public"]["Enums"]["cnab_banco"]
          condominio_id: string
          conteudo: string | null
          enviada_em: string | null
          gerada_em: string
          gerada_por: string | null
          id: string
          nome_arquivo: string
          observacoes: string | null
          sequencial: number
          status: Database["public"]["Enums"]["cnab_remessa_status"]
          total_titulos: number
          valor_total: number
        }
        Insert: {
          banco: Database["public"]["Enums"]["cnab_banco"]
          condominio_id: string
          conteudo?: string | null
          enviada_em?: string | null
          gerada_em?: string
          gerada_por?: string | null
          id?: string
          nome_arquivo: string
          observacoes?: string | null
          sequencial: number
          status?: Database["public"]["Enums"]["cnab_remessa_status"]
          total_titulos?: number
          valor_total?: number
        }
        Update: {
          banco?: Database["public"]["Enums"]["cnab_banco"]
          condominio_id?: string
          conteudo?: string | null
          enviada_em?: string | null
          gerada_em?: string
          gerada_por?: string | null
          id?: string
          nome_arquivo?: string
          observacoes?: string | null
          sequencial?: number
          status?: Database["public"]["Enums"]["cnab_remessa_status"]
          total_titulos?: number
          valor_total?: number
        }
        Relationships: []
      }
      cnab_retorno_eventos: {
        Row: {
          cobranca_id: string | null
          created_at: string
          data_evento: string | null
          id: string
          motivo: string | null
          nosso_numero: string | null
          pagamento_id: string | null
          retorno_id: string
          tipo: Database["public"]["Enums"]["cnab_evento_tipo"]
          valor: number | null
        }
        Insert: {
          cobranca_id?: string | null
          created_at?: string
          data_evento?: string | null
          id?: string
          motivo?: string | null
          nosso_numero?: string | null
          pagamento_id?: string | null
          retorno_id: string
          tipo: Database["public"]["Enums"]["cnab_evento_tipo"]
          valor?: number | null
        }
        Update: {
          cobranca_id?: string | null
          created_at?: string
          data_evento?: string | null
          id?: string
          motivo?: string | null
          nosso_numero?: string | null
          pagamento_id?: string | null
          retorno_id?: string
          tipo?: Database["public"]["Enums"]["cnab_evento_tipo"]
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cnab_retorno_eventos_retorno_id_fkey"
            columns: ["retorno_id"]
            isOneToOne: false
            referencedRelation: "cnab_retornos"
            referencedColumns: ["id"]
          },
        ]
      }
      cnab_retornos: {
        Row: {
          banco: Database["public"]["Enums"]["cnab_banco"]
          condominio_id: string
          conteudo: string | null
          id: string
          importado_em: string
          importado_por: string | null
          nome_arquivo: string
          total_eventos: number
          valor_total_liquidado: number
        }
        Insert: {
          banco: Database["public"]["Enums"]["cnab_banco"]
          condominio_id: string
          conteudo?: string | null
          id?: string
          importado_em?: string
          importado_por?: string | null
          nome_arquivo: string
          total_eventos?: number
          valor_total_liquidado?: number
        }
        Update: {
          banco?: Database["public"]["Enums"]["cnab_banco"]
          condominio_id?: string
          conteudo?: string | null
          id?: string
          importado_em?: string
          importado_por?: string | null
          nome_arquivo?: string
          total_eventos?: number
          valor_total_liquidado?: number
        }
        Relationships: []
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
          assinatura_fim: string | null
          assinatura_inicio: string | null
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
          motivo_suspensao: string | null
          nome: string
          plano: Database["public"]["Enums"]["plano_tipo"]
          suspenso: boolean
          total_unidades: number
          updated_at: string
          valor_mensal: number | null
          whatsapp_numero: string | null
        }
        Insert: {
          assinatura_fim?: string | null
          assinatura_inicio?: string | null
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
          motivo_suspensao?: string | null
          nome: string
          plano?: Database["public"]["Enums"]["plano_tipo"]
          suspenso?: boolean
          total_unidades?: number
          updated_at?: string
          valor_mensal?: number | null
          whatsapp_numero?: string | null
        }
        Update: {
          assinatura_fim?: string | null
          assinatura_inicio?: string | null
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
          motivo_suspensao?: string | null
          nome?: string
          plano?: Database["public"]["Enums"]["plano_tipo"]
          suspenso?: boolean
          total_unidades?: number
          updated_at?: string
          valor_mensal?: number | null
          whatsapp_numero?: string | null
        }
        Relationships: []
      }
      config_pagamento: {
        Row: {
          ativo: boolean
          banco_agencia: string | null
          banco_cnpj: string | null
          banco_conta: string | null
          banco_nome: string | null
          banco_tipo_conta: string | null
          banco_titular: string | null
          condominio_id: string
          created_at: string
          dias_envio_lembrete: number
          instrucoes_boleto: string | null
          juros_dia_percentual: number
          multa_percentual: number
          pix_chave: string | null
          updated_at: string
          wa_automacao_ativa: boolean
          wa_dias_pos_vencimento: number[]
          wa_dias_pre_vencimento: number[]
          wa_template_lembrete: string
          wa_template_vencida: string
        }
        Insert: {
          ativo?: boolean
          banco_agencia?: string | null
          banco_cnpj?: string | null
          banco_conta?: string | null
          banco_nome?: string | null
          banco_tipo_conta?: string | null
          banco_titular?: string | null
          condominio_id: string
          created_at?: string
          dias_envio_lembrete?: number
          instrucoes_boleto?: string | null
          juros_dia_percentual?: number
          multa_percentual?: number
          pix_chave?: string | null
          updated_at?: string
          wa_automacao_ativa?: boolean
          wa_dias_pos_vencimento?: number[]
          wa_dias_pre_vencimento?: number[]
          wa_template_lembrete?: string
          wa_template_vencida?: string
        }
        Update: {
          ativo?: boolean
          banco_agencia?: string | null
          banco_cnpj?: string | null
          banco_conta?: string | null
          banco_nome?: string | null
          banco_tipo_conta?: string | null
          banco_titular?: string | null
          condominio_id?: string
          created_at?: string
          dias_envio_lembrete?: number
          instrucoes_boleto?: string | null
          juros_dia_percentual?: number
          multa_percentual?: number
          pix_chave?: string | null
          updated_at?: string
          wa_automacao_ativa?: boolean
          wa_dias_pos_vencimento?: number[]
          wa_dias_pre_vencimento?: number[]
          wa_template_lembrete?: string
          wa_template_vencida?: string
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
      documentos: {
        Row: {
          aprovado: boolean
          aprovado_em: string | null
          aprovado_por: string | null
          categoria: Database["public"]["Enums"]["documento_categoria"]
          condominio_id: string
          created_at: string
          descricao: string | null
          disponivel_whatsapp: boolean
          enviado_por: string
          id: string
          mime_type: string | null
          storage_path: string
          tamanho_bytes: number | null
          titulo: string
          updated_at: string
          visivel_publico: boolean
        }
        Insert: {
          aprovado?: boolean
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria?: Database["public"]["Enums"]["documento_categoria"]
          condominio_id: string
          created_at?: string
          descricao?: string | null
          disponivel_whatsapp?: boolean
          enviado_por: string
          id?: string
          mime_type?: string | null
          storage_path: string
          tamanho_bytes?: number | null
          titulo: string
          updated_at?: string
          visivel_publico?: boolean
        }
        Update: {
          aprovado?: boolean
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria?: Database["public"]["Enums"]["documento_categoria"]
          condominio_id?: string
          created_at?: string
          descricao?: string | null
          disponivel_whatsapp?: boolean
          enviado_por?: string
          id?: string
          mime_type?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
          titulo?: string
          updated_at?: string
          visivel_publico?: boolean
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
      leads: {
        Row: {
          condominio: string
          consent_lgpd: boolean
          created_at: string
          id: string
          mensagem: string | null
          nome: string
          observacoes_internas: string | null
          origem: string
          quer_demo: boolean
          status: string
          telefone: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          condominio: string
          consent_lgpd?: boolean
          created_at?: string
          id?: string
          mensagem?: string | null
          nome: string
          observacoes_internas?: string | null
          origem?: string
          quer_demo?: boolean
          status?: string
          telefone: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          condominio?: string
          consent_lgpd?: boolean
          created_at?: string
          id?: string
          mensagem?: string | null
          nome?: string
          observacoes_internas?: string | null
          origem?: string
          quer_demo?: boolean
          status?: string
          telefone?: string
          updated_at?: string
          user_agent?: string | null
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
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      wa_bot_estado: {
        Row: {
          conversa_id: string
          dados: Json
          expira_em: string
          intent: Database["public"]["Enums"]["wa_intent"]
          passo: string | null
          updated_at: string
        }
        Insert: {
          conversa_id: string
          dados?: Json
          expira_em?: string
          intent?: Database["public"]["Enums"]["wa_intent"]
          passo?: string | null
          updated_at?: string
        }
        Update: {
          conversa_id?: string
          dados?: Json
          expira_em?: string
          intent?: Database["public"]["Enums"]["wa_intent"]
          passo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_bot_estado_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: true
            referencedRelation: "wa_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_config: {
        Row: {
          access_token: string | null
          app_secret: string | null
          ativo: boolean
          business_account_id: string | null
          condominio_id: string
          created_at: string
          display_phone: string | null
          phone_number_id: string | null
          saudacao: string | null
          template_comunicado: string | null
          template_encomenda: string | null
          template_reserva_status: string | null
          template_segunda_via: string | null
          template_visitante: string | null
          updated_at: string
          webhook_verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          app_secret?: string | null
          ativo?: boolean
          business_account_id?: string | null
          condominio_id: string
          created_at?: string
          display_phone?: string | null
          phone_number_id?: string | null
          saudacao?: string | null
          template_comunicado?: string | null
          template_encomenda?: string | null
          template_reserva_status?: string | null
          template_segunda_via?: string | null
          template_visitante?: string | null
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          app_secret?: string | null
          ativo?: boolean
          business_account_id?: string | null
          condominio_id?: string
          created_at?: string
          display_phone?: string | null
          phone_number_id?: string | null
          saudacao?: string | null
          template_comunicado?: string | null
          template_encomenda?: string | null
          template_reserva_status?: string | null
          template_segunda_via?: string | null
          template_visitante?: string | null
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Relationships: []
      }
      wa_conversas: {
        Row: {
          condominio_id: string
          created_at: string
          id: string
          janela_24h_expira: string | null
          nome: string | null
          telefone: string
          ultimo_contato: string
          unidade_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          condominio_id: string
          created_at?: string
          id?: string
          janela_24h_expira?: string | null
          nome?: string | null
          telefone: string
          ultimo_contato?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          condominio_id?: string
          created_at?: string
          id?: string
          janela_24h_expira?: string | null
          nome?: string | null
          telefone?: string
          ultimo_contato?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      wa_mensagens: {
        Row: {
          condominio_id: string
          contexto: string | null
          contexto_id: string | null
          conversa_id: string
          created_at: string
          direcao: Database["public"]["Enums"]["wa_direcao"]
          entregue_em: string | null
          enviado_em: string | null
          erro: string | null
          id: string
          lido_em: string | null
          payload: Json | null
          status: Database["public"]["Enums"]["wa_msg_status"]
          texto: string | null
          tipo: Database["public"]["Enums"]["wa_msg_tipo"]
          wa_message_id: string | null
        }
        Insert: {
          condominio_id: string
          contexto?: string | null
          contexto_id?: string | null
          conversa_id: string
          created_at?: string
          direcao: Database["public"]["Enums"]["wa_direcao"]
          entregue_em?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          lido_em?: string | null
          payload?: Json | null
          status?: Database["public"]["Enums"]["wa_msg_status"]
          texto?: string | null
          tipo?: Database["public"]["Enums"]["wa_msg_tipo"]
          wa_message_id?: string | null
        }
        Update: {
          condominio_id?: string
          contexto?: string | null
          contexto_id?: string | null
          conversa_id?: string
          created_at?: string
          direcao?: Database["public"]["Enums"]["wa_direcao"]
          entregue_em?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          lido_em?: string | null
          payload?: Json | null
          status?: Database["public"]["Enums"]["wa_msg_status"]
          texto?: string | null
          tipo?: Database["public"]["Enums"]["wa_msg_tipo"]
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "wa_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_notif_jobs: {
        Row: {
          condominio_id: string
          contexto: string
          created_at: string
          destinatario_nome: string | null
          destinatario_telefone: string
          destinatario_user_id: string | null
          documento_id: string | null
          enviado_em: string | null
          id: string
          max_tentativas: number
          mensagem: string
          proxima_tentativa: string
          status: Database["public"]["Enums"]["wa_job_status"]
          tentativas: number
          ultimo_erro: string | null
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          condominio_id: string
          contexto?: string
          created_at?: string
          destinatario_nome?: string | null
          destinatario_telefone: string
          destinatario_user_id?: string | null
          documento_id?: string | null
          enviado_em?: string | null
          id?: string
          max_tentativas?: number
          mensagem: string
          proxima_tentativa?: string
          status?: Database["public"]["Enums"]["wa_job_status"]
          tentativas?: number
          ultimo_erro?: string | null
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          condominio_id?: string
          contexto?: string
          created_at?: string
          destinatario_nome?: string | null
          destinatario_telefone?: string
          destinatario_user_id?: string | null
          documento_id?: string | null
          enviado_em?: string | null
          id?: string
          max_tentativas?: number
          mensagem?: string
          proxima_tentativa?: string
          status?: Database["public"]["Enums"]["wa_job_status"]
          tentativas?: number
          ultimo_erro?: string | null
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: []
      }
      wa_preferencias: {
        Row: {
          condominio_id: string
          created_at: string
          id: string
          receber_cobrancas: boolean
          receber_comunicados: boolean
          receber_encomendas: boolean
          receber_visitantes: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          condominio_id: string
          created_at?: string
          id?: string
          receber_cobrancas?: boolean
          receber_comunicados?: boolean
          receber_encomendas?: boolean
          receber_visitantes?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          condominio_id?: string
          created_at?: string
          id?: string
          receber_cobrancas?: boolean
          receber_comunicados?: boolean
          receber_encomendas?: boolean
          receber_visitantes?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      config_pagamento_safe: {
        Row: {
          ativo: boolean | null
          banco_agencia: string | null
          banco_cnpj: string | null
          banco_conta_mascarada: string | null
          banco_nome: string | null
          banco_tipo_conta: string | null
          banco_titular: string | null
          condominio_id: string | null
          dias_envio_lembrete: number | null
          instrucoes_boleto: string | null
          juros_dia_percentual: number | null
          multa_percentual: number | null
          pix_chave_mascarada: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          banco_agencia?: string | null
          banco_cnpj?: string | null
          banco_conta_mascarada?: never
          banco_nome?: string | null
          banco_tipo_conta?: string | null
          banco_titular?: string | null
          condominio_id?: string | null
          dias_envio_lembrete?: number | null
          instrucoes_boleto?: string | null
          juros_dia_percentual?: number | null
          multa_percentual?: number | null
          pix_chave_mascarada?: never
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          banco_agencia?: string | null
          banco_cnpj?: string | null
          banco_conta_mascarada?: never
          banco_nome?: string | null
          banco_tipo_conta?: string | null
          banco_titular?: string | null
          condominio_id?: string | null
          dias_envio_lembrete?: number | null
          instrucoes_boleto?: string | null
          juros_dia_percentual?: number | null
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
      admin_metricas_globais: { Args: never; Returns: Json }
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
      claim_platform_admin: { Args: never; Returns: boolean }
      cnab_alocar_nosso_numero: {
        Args: { _condominio_id: string; _quantidade: number }
        Returns: {
          fim: number
          inicio: number
        }[]
      }
      cnab_baixar_cobranca: {
        Args: {
          _cobranca_id: string
          _data_pagamento: string
          _retorno_id: string
          _valor: number
        }
        Returns: string
      }
      cnab_proximo_sequencial: {
        Args: { _condominio_id: string }
        Returns: number
      }
      comentar_ocorrencia: {
        Args: { _interno: boolean; _mensagem: string; _ocorrencia_id: string }
        Returns: string
      }
      contar_usuarios_empresa: {
        Args: { _condominio_id: string }
        Returns: number
      }
      criar_condominio: {
        Args: {
          _cep: string
          _cidade: string
          _cnpj: string
          _codigo_publico: string
          _endereco: string
          _estado: string
          _nome: string
          _whatsapp_numero: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_documento_comunicado: {
        Args: { _documento_id: string }
        Returns: number
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      is_admin: {
        Args: { _condominio_id: string; _user_id: string }
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
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
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
      limite_usuarios_plano: {
        Args: { _condominio_id: string }
        Returns: number
      }
      marcar_encomenda_retirada: {
        Args: { _encomenda_id: string; _retirado_por_nome: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      pode_gerir_financeiro: {
        Args: { _condominio_id: string; _user_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
      app_role:
        | "sindico"
        | "morador"
        | "contador"
        | "porteiro"
        | "admin"
        | "financeiro"
        | "gestor"
        | "vendedor"
        | "comercial"
        | "consulta"
      cnab_banco:
        | "sicoob"
        | "itau"
        | "bradesco"
        | "bb"
        | "caixa"
        | "santander"
        | "generico"
      cnab_evento_tipo:
        | "liquidacao"
        | "baixa"
        | "rejeicao"
        | "protesto"
        | "outros"
      cnab_remessa_status: "gerada" | "enviada" | "processada" | "erro"
      cobranca_status: "pendente" | "paga" | "vencida" | "cancelada" | "parcial"
      convite_status: "pendente" | "aceito" | "expirado" | "cancelado"
      documento_categoria:
        | "convencao"
        | "regimento"
        | "ata"
        | "comunicado"
        | "informativo"
        | "contrato"
        | "financeiro"
        | "outros"
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
      plano_tipo: "basico" | "profissional" | "admin" | "enterprise"
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
      wa_direcao: "entrada" | "saida"
      wa_intent:
        | "menu"
        | "segunda_via_boleto"
        | "status_reserva"
        | "abrir_ocorrencia"
        | "confirmar_visitante"
        | "desconhecido"
      wa_job_status: "pendente" | "enviando" | "enviado" | "falha" | "desistido"
      wa_msg_status:
        | "pendente"
        | "enviada"
        | "entregue"
        | "lida"
        | "falha"
        | "recebida"
      wa_msg_tipo:
        | "texto"
        | "template"
        | "interativo"
        | "midia"
        | "localizacao"
        | "sistema"
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
      app_role: [
        "sindico",
        "morador",
        "contador",
        "porteiro",
        "admin",
        "financeiro",
        "gestor",
        "vendedor",
        "comercial",
        "consulta",
      ],
      cnab_banco: [
        "sicoob",
        "itau",
        "bradesco",
        "bb",
        "caixa",
        "santander",
        "generico",
      ],
      cnab_evento_tipo: [
        "liquidacao",
        "baixa",
        "rejeicao",
        "protesto",
        "outros",
      ],
      cnab_remessa_status: ["gerada", "enviada", "processada", "erro"],
      cobranca_status: ["pendente", "paga", "vencida", "cancelada", "parcial"],
      convite_status: ["pendente", "aceito", "expirado", "cancelado"],
      documento_categoria: [
        "convencao",
        "regimento",
        "ata",
        "comunicado",
        "informativo",
        "contrato",
        "financeiro",
        "outros",
      ],
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
      plano_tipo: ["basico", "profissional", "admin", "enterprise"],
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
      wa_direcao: ["entrada", "saida"],
      wa_intent: [
        "menu",
        "segunda_via_boleto",
        "status_reserva",
        "abrir_ocorrencia",
        "confirmar_visitante",
        "desconhecido",
      ],
      wa_job_status: ["pendente", "enviando", "enviado", "falha", "desistido"],
      wa_msg_status: [
        "pendente",
        "enviada",
        "entregue",
        "lida",
        "falha",
        "recebida",
      ],
      wa_msg_tipo: [
        "texto",
        "template",
        "interativo",
        "midia",
        "localizacao",
        "sistema",
      ],
      wa_status: ["pendente", "enviado", "falhou"],
    },
  },
} as const
