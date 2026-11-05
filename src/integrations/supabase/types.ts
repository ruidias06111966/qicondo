export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      acordo_itens: {
        Row: {
          acordo_id: string;
          cobranca_id: string;
          created_at: string;
          id: string;
          juros: number;
          multa: number;
          principal: number;
        };
        Insert: {
          acordo_id: string;
          cobranca_id: string;
          created_at?: string;
          id?: string;
          juros: number;
          multa: number;
          principal: number;
        };
        Update: {
          acordo_id?: string;
          cobranca_id?: string;
          created_at?: string;
          id?: string;
          juros?: number;
          multa?: number;
          principal?: number;
        };
        Relationships: [
          {
            foreignKeyName: "acordo_itens_acordo_id_fkey";
            columns: ["acordo_id"];
            isOneToOne: false;
            referencedRelation: "acordos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acordo_itens_cobranca_id_fkey";
            columns: ["cobranca_id"];
            isOneToOne: false;
            referencedRelation: "cobrancas";
            referencedColumns: ["id"];
          },
        ];
      };
      acordos: {
        Row: {
          autorizacao: string | null;
          condominio_id: string;
          created_at: string;
          criado_por: string | null;
          data_acordo: string;
          id: string;
          num_parcelas: number;
          numero: number;
          observacoes: string | null;
          rescindido_em: string | null;
          rescisao_motivo: string | null;
          status: Database["public"]["Enums"]["acordo_status"];
          unidade_id: string;
          updated_at: string;
          valor_desconto: number;
          valor_entrada: number;
          valor_juros: number;
          valor_multa: number;
          valor_principal: number;
          valor_total: number;
        };
        Insert: {
          autorizacao?: string | null;
          condominio_id: string;
          created_at?: string;
          criado_por?: string | null;
          data_acordo?: string;
          id?: string;
          num_parcelas: number;
          numero: number;
          observacoes?: string | null;
          rescindido_em?: string | null;
          rescisao_motivo?: string | null;
          status?: Database["public"]["Enums"]["acordo_status"];
          unidade_id: string;
          updated_at?: string;
          valor_desconto?: number;
          valor_entrada?: number;
          valor_juros: number;
          valor_multa: number;
          valor_principal: number;
          valor_total: number;
        };
        Update: {
          autorizacao?: string | null;
          condominio_id?: string;
          created_at?: string;
          criado_por?: string | null;
          data_acordo?: string;
          id?: string;
          num_parcelas?: number;
          numero?: number;
          observacoes?: string | null;
          rescindido_em?: string | null;
          rescisao_motivo?: string | null;
          status?: Database["public"]["Enums"]["acordo_status"];
          unidade_id?: string;
          updated_at?: string;
          valor_desconto?: number;
          valor_entrada?: number;
          valor_juros?: number;
          valor_multa?: number;
          valor_principal?: number;
          valor_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "acordos_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acordos_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_audit_log: {
        Row: {
          acao: string;
          admin_user_id: string;
          created_at: string;
          entidade: string | null;
          entidade_id: string | null;
          id: string;
          metadata: Json | null;
        };
        Insert: {
          acao: string;
          admin_user_id: string;
          created_at?: string;
          entidade?: string | null;
          entidade_id?: string | null;
          id?: string;
          metadata?: Json | null;
        };
        Update: {
          acao?: string;
          admin_user_id?: string;
          created_at?: string;
          entidade?: string | null;
          entidade_id?: string | null;
          id?: string;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      area_bloqueios: {
        Row: {
          area_id: string;
          condominio_id: string;
          created_at: string;
          criado_por: string | null;
          fim: string;
          id: string;
          inicio: string;
          motivo: string;
        };
        Insert: {
          area_id: string;
          condominio_id: string;
          created_at?: string;
          criado_por?: string | null;
          fim: string;
          id?: string;
          inicio: string;
          motivo: string;
        };
        Update: {
          area_id?: string;
          condominio_id?: string;
          created_at?: string;
          criado_por?: string | null;
          fim?: string;
          id?: string;
          inicio?: string;
          motivo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "area_bloqueios_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas_comuns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "area_bloqueios_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      areas_comuns: {
        Row: {
          antecedencia_max_dias: number;
          antecedencia_min_horas: number;
          ativo: boolean;
          capacidade: number | null;
          condominio_id: string;
          cor: string;
          created_at: string;
          descricao: string | null;
          dias_permitidos: number[];
          duracao_max_minutos: number;
          duracao_min_minutos: number;
          foto_url: string | null;
          hora_abertura: string;
          hora_fechamento: string;
          id: string;
          intervalo_entre_reservas_min: number;
          max_reservas_por_unidade_mes: number;
          nome: string;
          ordem: number;
          regulamento: string | null;
          requer_aprovacao: boolean;
          taxa_uso: number;
          updated_at: string;
        };
        Insert: {
          antecedencia_max_dias?: number;
          antecedencia_min_horas?: number;
          ativo?: boolean;
          capacidade?: number | null;
          condominio_id: string;
          cor?: string;
          created_at?: string;
          descricao?: string | null;
          dias_permitidos?: number[];
          duracao_max_minutos?: number;
          duracao_min_minutos?: number;
          foto_url?: string | null;
          hora_abertura?: string;
          hora_fechamento?: string;
          id?: string;
          intervalo_entre_reservas_min?: number;
          max_reservas_por_unidade_mes?: number;
          nome: string;
          ordem?: number;
          regulamento?: string | null;
          requer_aprovacao?: boolean;
          taxa_uso?: number;
          updated_at?: string;
        };
        Update: {
          antecedencia_max_dias?: number;
          antecedencia_min_horas?: number;
          ativo?: boolean;
          capacidade?: number | null;
          condominio_id?: string;
          cor?: string;
          created_at?: string;
          descricao?: string | null;
          dias_permitidos?: number[];
          duracao_max_minutos?: number;
          duracao_min_minutos?: number;
          foto_url?: string | null;
          hora_abertura?: string;
          hora_fechamento?: string;
          id?: string;
          intervalo_entre_reservas_min?: number;
          max_reservas_por_unidade_mes?: number;
          nome?: string;
          ordem?: number;
          regulamento?: string | null;
          requer_aprovacao?: boolean;
          taxa_uso?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "areas_comuns_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      assembleia_pautas: {
        Row: {
          aberta_em: string | null;
          assembleia_id: string;
          created_at: string;
          descricao: string | null;
          fechada_em: string | null;
          id: string;
          maioria: Database["public"]["Enums"]["maioria_tipo"];
          ordem: number;
          resultado: Json | null;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          aberta_em?: string | null;
          assembleia_id: string;
          created_at?: string;
          descricao?: string | null;
          fechada_em?: string | null;
          id?: string;
          maioria?: Database["public"]["Enums"]["maioria_tipo"];
          ordem?: number;
          resultado?: Json | null;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          aberta_em?: string | null;
          assembleia_id?: string;
          created_at?: string;
          descricao?: string | null;
          fechada_em?: string | null;
          id?: string;
          maioria?: Database["public"]["Enums"]["maioria_tipo"];
          ordem?: number;
          resultado?: Json | null;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assembleia_pautas_assembleia_id_fkey";
            columns: ["assembleia_id"];
            isOneToOne: false;
            referencedRelation: "assembleias";
            referencedColumns: ["id"];
          },
        ];
      };
      assembleia_votos: {
        Row: {
          fracao_ideal: number | null;
          id: string;
          opcao: Database["public"]["Enums"]["voto_opcao"];
          pauta_id: string;
          peso: number;
          registrado_em: string;
          unidade_id: string;
          user_id: string | null;
        };
        Insert: {
          fracao_ideal?: number | null;
          id?: string;
          opcao: Database["public"]["Enums"]["voto_opcao"];
          pauta_id: string;
          peso: number;
          registrado_em?: string;
          unidade_id: string;
          user_id?: string | null;
        };
        Update: {
          fracao_ideal?: number | null;
          id?: string;
          opcao?: Database["public"]["Enums"]["voto_opcao"];
          pauta_id?: string;
          peso?: number;
          registrado_em?: string;
          unidade_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assembleia_votos_pauta_id_fkey";
            columns: ["pauta_id"];
            isOneToOne: false;
            referencedRelation: "assembleia_pautas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assembleia_votos_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      assembleias: {
        Row: {
          ata: Json | null;
          condominio_id: string;
          convocada_em: string | null;
          convocada_por: string | null;
          created_at: string;
          criado_por: string | null;
          edital: string | null;
          encerrada_em: string | null;
          encerrada_por: string | null;
          exige_quitacao: boolean;
          fim: string;
          id: string;
          inicio: string;
          link_videoconferencia: string | null;
          local: string | null;
          modo: Database["public"]["Enums"]["assembleia_modo"];
          peso_por_fracao: boolean;
          quorum_instalacao: number;
          status: Database["public"]["Enums"]["assembleia_status"];
          tipo: Database["public"]["Enums"]["assembleia_tipo"];
          titulo: string;
          updated_at: string;
        };
        Insert: {
          ata?: Json | null;
          condominio_id: string;
          convocada_em?: string | null;
          convocada_por?: string | null;
          created_at?: string;
          criado_por?: string | null;
          edital?: string | null;
          encerrada_em?: string | null;
          encerrada_por?: string | null;
          exige_quitacao?: boolean;
          fim: string;
          id?: string;
          inicio: string;
          link_videoconferencia?: string | null;
          local?: string | null;
          modo?: Database["public"]["Enums"]["assembleia_modo"];
          peso_por_fracao?: boolean;
          quorum_instalacao?: number;
          status?: Database["public"]["Enums"]["assembleia_status"];
          tipo?: Database["public"]["Enums"]["assembleia_tipo"];
          titulo: string;
          updated_at?: string;
        };
        Update: {
          ata?: Json | null;
          condominio_id?: string;
          convocada_em?: string | null;
          convocada_por?: string | null;
          created_at?: string;
          criado_por?: string | null;
          edital?: string | null;
          encerrada_em?: string | null;
          encerrada_por?: string | null;
          exige_quitacao?: boolean;
          fim?: string;
          id?: string;
          inicio?: string;
          link_videoconferencia?: string | null;
          local?: string | null;
          modo?: Database["public"]["Enums"]["assembleia_modo"];
          peso_por_fracao?: boolean;
          quorum_instalacao?: number;
          status?: Database["public"]["Enums"]["assembleia_status"];
          tipo?: Database["public"]["Enums"]["assembleia_tipo"];
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assembleias_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          acao: string;
          condominio_id: string | null;
          created_at: string;
          entidade: string | null;
          entidade_id: string | null;
          id: string;
          metadata: Json | null;
          user_id: string | null;
        };
        Insert: {
          acao: string;
          condominio_id?: string | null;
          created_at?: string;
          entidade?: string | null;
          entidade_id?: string | null;
          id?: string;
          metadata?: Json | null;
          user_id?: string | null;
        };
        Update: {
          acao?: string;
          condominio_id?: string | null;
          created_at?: string;
          entidade?: string | null;
          entidade_id?: string | null;
          id?: string;
          metadata?: Json | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      balancetes: {
        Row: {
          condominio_id: string;
          created_at: string;
          dados: Json;
          fechado_em: string;
          fechado_por: string | null;
          id: string;
          inadimplencia: number;
          observacoes: string | null;
          periodo_fim: string;
          periodo_inicio: string;
          publicado_em: string | null;
          publicado_por: string | null;
          saldo_anterior: number;
          saldo_final: number;
          status: Database["public"]["Enums"]["balancete_status"];
          total_despesas: number;
          total_receitas: number;
          updated_at: string;
        };
        Insert: {
          condominio_id: string;
          created_at?: string;
          dados: Json;
          fechado_em?: string;
          fechado_por?: string | null;
          id?: string;
          inadimplencia?: number;
          observacoes?: string | null;
          periodo_fim: string;
          periodo_inicio: string;
          publicado_em?: string | null;
          publicado_por?: string | null;
          saldo_anterior: number;
          saldo_final: number;
          status?: Database["public"]["Enums"]["balancete_status"];
          total_despesas: number;
          total_receitas: number;
          updated_at?: string;
        };
        Update: {
          condominio_id?: string;
          created_at?: string;
          dados?: Json;
          fechado_em?: string;
          fechado_por?: string | null;
          id?: string;
          inadimplencia?: number;
          observacoes?: string | null;
          periodo_fim?: string;
          periodo_inicio?: string;
          publicado_em?: string | null;
          publicado_por?: string | null;
          saldo_anterior?: number;
          saldo_final?: number;
          status?: Database["public"]["Enums"]["balancete_status"];
          total_despesas?: number;
          total_receitas?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "balancetes_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      categorias_financeiras: {
        Row: {
          ativo: boolean;
          condominio_id: string;
          cor: string | null;
          created_at: string;
          fundo_reserva: boolean;
          id: string;
          nome: string;
          ordem: number;
          tipo: Database["public"]["Enums"]["tipo_lancamento"];
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          condominio_id: string;
          cor?: string | null;
          created_at?: string;
          fundo_reserva?: boolean;
          id?: string;
          nome: string;
          ordem?: number;
          tipo: Database["public"]["Enums"]["tipo_lancamento"];
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          condominio_id?: string;
          cor?: string | null;
          created_at?: string;
          fundo_reserva?: boolean;
          id?: string;
          nome?: string;
          ordem?: number;
          tipo?: Database["public"]["Enums"]["tipo_lancamento"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      certidoes: {
        Row: {
          codigo: string;
          condominio_id: string;
          created_at: string;
          dados: Json;
          emitida_em: string;
          emitida_por: string | null;
          id: string;
          numero: number;
          tipo: Database["public"]["Enums"]["certidao_tipo"];
          unidade_id: string;
          valida_ate: string;
        };
        Insert: {
          codigo: string;
          condominio_id: string;
          created_at?: string;
          dados: Json;
          emitida_em?: string;
          emitida_por?: string | null;
          id?: string;
          numero: number;
          tipo?: Database["public"]["Enums"]["certidao_tipo"];
          unidade_id: string;
          valida_ate: string;
        };
        Update: {
          codigo?: string;
          condominio_id?: string;
          created_at?: string;
          dados?: Json;
          emitida_em?: string;
          emitida_por?: string | null;
          id?: string;
          numero?: number;
          tipo?: Database["public"]["Enums"]["certidao_tipo"];
          unidade_id?: string;
          valida_ate?: string;
        };
        Relationships: [
          {
            foreignKeyName: "certidoes_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "certidoes_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      cnab_config: {
        Row: {
          agencia: string | null;
          ativo: boolean;
          banco: Database["public"]["Enums"]["cnab_banco"];
          carteira: string | null;
          cedente_documento: string | null;
          cedente_nome: string | null;
          condominio_id: string;
          conta: string | null;
          conta_dv: string | null;
          convenio: string | null;
          created_at: string;
          proximo_nosso_numero: number;
          proximo_sequencial: number;
          updated_at: string;
          variacao: string | null;
        };
        Insert: {
          agencia?: string | null;
          ativo?: boolean;
          banco?: Database["public"]["Enums"]["cnab_banco"];
          carteira?: string | null;
          cedente_documento?: string | null;
          cedente_nome?: string | null;
          condominio_id: string;
          conta?: string | null;
          conta_dv?: string | null;
          convenio?: string | null;
          created_at?: string;
          proximo_nosso_numero?: number;
          proximo_sequencial?: number;
          updated_at?: string;
          variacao?: string | null;
        };
        Update: {
          agencia?: string | null;
          ativo?: boolean;
          banco?: Database["public"]["Enums"]["cnab_banco"];
          carteira?: string | null;
          cedente_documento?: string | null;
          cedente_nome?: string | null;
          condominio_id?: string;
          conta?: string | null;
          conta_dv?: string | null;
          convenio?: string | null;
          created_at?: string;
          proximo_nosso_numero?: number;
          proximo_sequencial?: number;
          updated_at?: string;
          variacao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cnab_config_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: true;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      cnab_remessa_itens: {
        Row: {
          cobranca_id: string;
          created_at: string;
          id: string;
          nosso_numero: string;
          remessa_id: string;
          valor: number;
          vencimento: string;
        };
        Insert: {
          cobranca_id: string;
          created_at?: string;
          id?: string;
          nosso_numero: string;
          remessa_id: string;
          valor: number;
          vencimento: string;
        };
        Update: {
          cobranca_id?: string;
          created_at?: string;
          id?: string;
          nosso_numero?: string;
          remessa_id?: string;
          valor?: number;
          vencimento?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cnab_remessa_itens_cobranca_id_fkey";
            columns: ["cobranca_id"];
            isOneToOne: false;
            referencedRelation: "cobrancas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cnab_remessa_itens_remessa_id_fkey";
            columns: ["remessa_id"];
            isOneToOne: false;
            referencedRelation: "cnab_remessas";
            referencedColumns: ["id"];
          },
        ];
      };
      cnab_remessas: {
        Row: {
          banco: Database["public"]["Enums"]["cnab_banco"];
          condominio_id: string;
          conteudo: string | null;
          enviada_em: string | null;
          gerada_em: string;
          gerada_por: string | null;
          id: string;
          nome_arquivo: string;
          observacoes: string | null;
          sequencial: number;
          status: Database["public"]["Enums"]["cnab_remessa_status"];
          total_titulos: number;
          valor_total: number;
        };
        Insert: {
          banco: Database["public"]["Enums"]["cnab_banco"];
          condominio_id: string;
          conteudo?: string | null;
          enviada_em?: string | null;
          gerada_em?: string;
          gerada_por?: string | null;
          id?: string;
          nome_arquivo: string;
          observacoes?: string | null;
          sequencial: number;
          status?: Database["public"]["Enums"]["cnab_remessa_status"];
          total_titulos?: number;
          valor_total?: number;
        };
        Update: {
          banco?: Database["public"]["Enums"]["cnab_banco"];
          condominio_id?: string;
          conteudo?: string | null;
          enviada_em?: string | null;
          gerada_em?: string;
          gerada_por?: string | null;
          id?: string;
          nome_arquivo?: string;
          observacoes?: string | null;
          sequencial?: number;
          status?: Database["public"]["Enums"]["cnab_remessa_status"];
          total_titulos?: number;
          valor_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cnab_remessas_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      cnab_retorno_eventos: {
        Row: {
          cobranca_id: string | null;
          created_at: string;
          data_evento: string | null;
          id: string;
          motivo: string | null;
          nosso_numero: string | null;
          pagamento_id: string | null;
          retorno_id: string;
          tipo: Database["public"]["Enums"]["cnab_evento_tipo"];
          valor: number | null;
        };
        Insert: {
          cobranca_id?: string | null;
          created_at?: string;
          data_evento?: string | null;
          id?: string;
          motivo?: string | null;
          nosso_numero?: string | null;
          pagamento_id?: string | null;
          retorno_id: string;
          tipo: Database["public"]["Enums"]["cnab_evento_tipo"];
          valor?: number | null;
        };
        Update: {
          cobranca_id?: string | null;
          created_at?: string;
          data_evento?: string | null;
          id?: string;
          motivo?: string | null;
          nosso_numero?: string | null;
          pagamento_id?: string | null;
          retorno_id?: string;
          tipo?: Database["public"]["Enums"]["cnab_evento_tipo"];
          valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "cnab_retorno_eventos_cobranca_id_fkey";
            columns: ["cobranca_id"];
            isOneToOne: false;
            referencedRelation: "cobrancas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cnab_retorno_eventos_retorno_id_fkey";
            columns: ["retorno_id"];
            isOneToOne: false;
            referencedRelation: "cnab_retornos";
            referencedColumns: ["id"];
          },
        ];
      };
      cnab_retornos: {
        Row: {
          banco: Database["public"]["Enums"]["cnab_banco"];
          condominio_id: string;
          conteudo: string | null;
          id: string;
          importado_em: string;
          importado_por: string | null;
          nome_arquivo: string;
          total_eventos: number;
          valor_total_liquidado: number;
        };
        Insert: {
          banco: Database["public"]["Enums"]["cnab_banco"];
          condominio_id: string;
          conteudo?: string | null;
          id?: string;
          importado_em?: string;
          importado_por?: string | null;
          nome_arquivo: string;
          total_eventos?: number;
          valor_total_liquidado?: number;
        };
        Update: {
          banco?: Database["public"]["Enums"]["cnab_banco"];
          condominio_id?: string;
          conteudo?: string | null;
          id?: string;
          importado_em?: string;
          importado_por?: string | null;
          nome_arquivo?: string;
          total_eventos?: number;
          valor_total_liquidado?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cnab_retornos_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      cobrancas: {
        Row: {
          acordo_id: string | null;
          categoria_id: string | null;
          competencia: string;
          condominio_id: string;
          created_at: string;
          criado_por: string | null;
          desconto: number;
          descricao: string | null;
          id: string;
          juros: number;
          mp_payment_id: string | null;
          mp_qr_code: string | null;
          mp_qr_code_base64: string | null;
          mp_ticket_url: string | null;
          multa: number;
          pago_em: string | null;
          parcela_num: number | null;
          status: Database["public"]["Enums"]["cobranca_status"];
          unidade_id: string;
          updated_at: string;
          valor: number;
          valor_pago: number;
          vencimento: string;
        };
        Insert: {
          acordo_id?: string | null;
          categoria_id?: string | null;
          competencia: string;
          condominio_id: string;
          created_at?: string;
          criado_por?: string | null;
          desconto?: number;
          descricao?: string | null;
          id?: string;
          juros?: number;
          mp_payment_id?: string | null;
          mp_qr_code?: string | null;
          mp_qr_code_base64?: string | null;
          mp_ticket_url?: string | null;
          multa?: number;
          pago_em?: string | null;
          parcela_num?: number | null;
          status?: Database["public"]["Enums"]["cobranca_status"];
          unidade_id: string;
          updated_at?: string;
          valor: number;
          valor_pago?: number;
          vencimento: string;
        };
        Update: {
          acordo_id?: string | null;
          categoria_id?: string | null;
          competencia?: string;
          condominio_id?: string;
          created_at?: string;
          criado_por?: string | null;
          desconto?: number;
          descricao?: string | null;
          id?: string;
          juros?: number;
          mp_payment_id?: string | null;
          mp_qr_code?: string | null;
          mp_qr_code_base64?: string | null;
          mp_ticket_url?: string | null;
          multa?: number;
          pago_em?: string | null;
          parcela_num?: number | null;
          status?: Database["public"]["Enums"]["cobranca_status"];
          unidade_id?: string;
          updated_at?: string;
          valor?: number;
          valor_pago?: number;
          vencimento?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cobrancas_acordo_id_fkey";
            columns: ["acordo_id"];
            isOneToOne: false;
            referencedRelation: "acordos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cobrancas_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias_financeiras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cobrancas_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cobrancas_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      condominios: {
        Row: {
          assinatura_fim: string | null;
          assinatura_inicio: string | null;
          cep: string | null;
          cidade: string | null;
          cnpj: string | null;
          codigo_publico: string;
          created_at: string;
          criado_por: string;
          endereco: string | null;
          estado: string | null;
          id: string;
          logo_url: string | null;
          motivo_suspensao: string | null;
          nome: string;
          plano: Database["public"]["Enums"]["plano_tipo"];
          suspenso: boolean;
          total_unidades: number;
          updated_at: string;
          valor_mensal: number | null;
          whatsapp_numero: string | null;
        };
        Insert: {
          assinatura_fim?: string | null;
          assinatura_inicio?: string | null;
          cep?: string | null;
          cidade?: string | null;
          cnpj?: string | null;
          codigo_publico: string;
          created_at?: string;
          criado_por: string;
          endereco?: string | null;
          estado?: string | null;
          id?: string;
          logo_url?: string | null;
          motivo_suspensao?: string | null;
          nome: string;
          plano?: Database["public"]["Enums"]["plano_tipo"];
          suspenso?: boolean;
          total_unidades?: number;
          updated_at?: string;
          valor_mensal?: number | null;
          whatsapp_numero?: string | null;
        };
        Update: {
          assinatura_fim?: string | null;
          assinatura_inicio?: string | null;
          cep?: string | null;
          cidade?: string | null;
          cnpj?: string | null;
          codigo_publico?: string;
          created_at?: string;
          criado_por?: string;
          endereco?: string | null;
          estado?: string | null;
          id?: string;
          logo_url?: string | null;
          motivo_suspensao?: string | null;
          nome?: string;
          plano?: Database["public"]["Enums"]["plano_tipo"];
          suspenso?: boolean;
          total_unidades?: number;
          updated_at?: string;
          valor_mensal?: number | null;
          whatsapp_numero?: string | null;
        };
        Relationships: [];
      };
      config_pagamento: {
        Row: {
          ativo: boolean;
          banco_agencia: string | null;
          banco_cnpj: string | null;
          banco_conta: string | null;
          banco_nome: string | null;
          banco_tipo_conta: string | null;
          banco_titular: string | null;
          condominio_id: string;
          created_at: string;
          dias_envio_lembrete: number;
          instrucoes_boleto: string | null;
          juros_dia_percentual: number;
          multa_percentual: number;
          pix_chave: string | null;
          saldo_inicial: number;
          saldo_inicial_data: string | null;
          updated_at: string;
          wa_automacao_ativa: boolean;
          wa_dias_pos_vencimento: number[];
          wa_dias_pre_vencimento: number[];
          wa_template_lembrete: string;
          wa_template_vencida: string;
        };
        Insert: {
          ativo?: boolean;
          banco_agencia?: string | null;
          banco_cnpj?: string | null;
          banco_conta?: string | null;
          banco_nome?: string | null;
          banco_tipo_conta?: string | null;
          banco_titular?: string | null;
          condominio_id: string;
          created_at?: string;
          dias_envio_lembrete?: number;
          instrucoes_boleto?: string | null;
          juros_dia_percentual?: number;
          multa_percentual?: number;
          pix_chave?: string | null;
          saldo_inicial?: number;
          saldo_inicial_data?: string | null;
          updated_at?: string;
          wa_automacao_ativa?: boolean;
          wa_dias_pos_vencimento?: number[];
          wa_dias_pre_vencimento?: number[];
          wa_template_lembrete?: string;
          wa_template_vencida?: string;
        };
        Update: {
          ativo?: boolean;
          banco_agencia?: string | null;
          banco_cnpj?: string | null;
          banco_conta?: string | null;
          banco_nome?: string | null;
          banco_tipo_conta?: string | null;
          banco_titular?: string | null;
          condominio_id?: string;
          created_at?: string;
          dias_envio_lembrete?: number;
          instrucoes_boleto?: string | null;
          juros_dia_percentual?: number;
          multa_percentual?: number;
          pix_chave?: string | null;
          saldo_inicial?: number;
          saldo_inicial_data?: string | null;
          updated_at?: string;
          wa_automacao_ativa?: boolean;
          wa_dias_pos_vencimento?: number[];
          wa_dias_pre_vencimento?: number[];
          wa_template_lembrete?: string;
          wa_template_vencida?: string;
        };
        Relationships: [
          {
            foreignKeyName: "config_pagamento_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: true;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      convites: {
        Row: {
          aceito_em: string | null;
          aceito_por: string | null;
          condominio_id: string;
          created_at: string;
          email: string | null;
          enviado_por: string;
          expira_em: string;
          id: string;
          nome: string | null;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["convite_status"];
          telefone: string | null;
          token: string | null;
          token_hash: string | null;
          unidade_id: string | null;
        };
        Insert: {
          aceito_em?: string | null;
          aceito_por?: string | null;
          condominio_id: string;
          created_at?: string;
          email?: string | null;
          enviado_por: string;
          expira_em?: string;
          id?: string;
          nome?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["convite_status"];
          telefone?: string | null;
          token?: string | null;
          token_hash?: string | null;
          unidade_id?: string | null;
        };
        Update: {
          aceito_em?: string | null;
          aceito_por?: string | null;
          condominio_id?: string;
          created_at?: string;
          email?: string | null;
          enviado_por?: string;
          expira_em?: string;
          id?: string;
          nome?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["convite_status"];
          telefone?: string | null;
          token?: string | null;
          token_hash?: string | null;
          unidade_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "convites_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convites_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      despesas: {
        Row: {
          anexo_url: string | null;
          categoria_id: string | null;
          condominio_id: string;
          created_at: string;
          data: string;
          descricao: string;
          forma: Database["public"]["Enums"]["forma_pagamento"] | null;
          fornecedor: string | null;
          id: string;
          registrado_por: string | null;
          updated_at: string;
          valor: number;
        };
        Insert: {
          anexo_url?: string | null;
          categoria_id?: string | null;
          condominio_id: string;
          created_at?: string;
          data?: string;
          descricao: string;
          forma?: Database["public"]["Enums"]["forma_pagamento"] | null;
          fornecedor?: string | null;
          id?: string;
          registrado_por?: string | null;
          updated_at?: string;
          valor: number;
        };
        Update: {
          anexo_url?: string | null;
          categoria_id?: string | null;
          condominio_id?: string;
          created_at?: string;
          data?: string;
          descricao?: string;
          forma?: Database["public"]["Enums"]["forma_pagamento"] | null;
          fornecedor?: string | null;
          id?: string;
          registrado_por?: string | null;
          updated_at?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "despesas_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias_financeiras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      documentos: {
        Row: {
          aprovado: boolean;
          aprovado_em: string | null;
          aprovado_por: string | null;
          categoria: Database["public"]["Enums"]["documento_categoria"];
          condominio_id: string;
          created_at: string;
          descricao: string | null;
          disponivel_whatsapp: boolean;
          enviado_por: string;
          id: string;
          mime_type: string | null;
          storage_path: string;
          tamanho_bytes: number | null;
          titulo: string;
          updated_at: string;
          visivel_publico: boolean;
        };
        Insert: {
          aprovado?: boolean;
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          categoria?: Database["public"]["Enums"]["documento_categoria"];
          condominio_id: string;
          created_at?: string;
          descricao?: string | null;
          disponivel_whatsapp?: boolean;
          enviado_por: string;
          id?: string;
          mime_type?: string | null;
          storage_path: string;
          tamanho_bytes?: number | null;
          titulo: string;
          updated_at?: string;
          visivel_publico?: boolean;
        };
        Update: {
          aprovado?: boolean;
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          categoria?: Database["public"]["Enums"]["documento_categoria"];
          condominio_id?: string;
          created_at?: string;
          descricao?: string | null;
          disponivel_whatsapp?: boolean;
          enviado_por?: string;
          id?: string;
          mime_type?: string | null;
          storage_path?: string;
          tamanho_bytes?: number | null;
          titulo?: string;
          updated_at?: string;
          visivel_publico?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "documentos_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      email_send_log: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          message_id: string | null;
          metadata: Json | null;
          recipient_email: string;
          status: string;
          template_name: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          metadata?: Json | null;
          recipient_email: string;
          status: string;
          template_name: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          metadata?: Json | null;
          recipient_email?: string;
          status?: string;
          template_name?: string;
        };
        Relationships: [];
      };
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number;
          batch_size: number;
          id: number;
          retry_after_until: string | null;
          send_delay_ms: number;
          transactional_email_ttl_minutes: number;
          updated_at: string;
        };
        Insert: {
          auth_email_ttl_minutes?: number;
          batch_size?: number;
          id?: number;
          retry_after_until?: string | null;
          send_delay_ms?: number;
          transactional_email_ttl_minutes?: number;
          updated_at?: string;
        };
        Update: {
          auth_email_ttl_minutes?: number;
          batch_size?: number;
          id?: number;
          retry_after_until?: string | null;
          send_delay_ms?: number;
          transactional_email_ttl_minutes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_unsubscribe_tokens: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          token: string;
          used_at: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          token: string;
          used_at?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          token?: string;
          used_at?: string | null;
        };
        Relationships: [];
      };
      encomendas: {
        Row: {
          codigo_rastreio: string | null;
          condominio_id: string;
          created_at: string;
          descricao: string;
          foto_url: string | null;
          id: string;
          local_armazenamento: string | null;
          notificado_em: string | null;
          observacoes: string | null;
          recebido_em: string;
          recebido_por: string | null;
          remetente: string | null;
          retirado_em: string | null;
          retirado_por: string | null;
          retirado_por_nome: string | null;
          status: Database["public"]["Enums"]["encomenda_status"];
          transportadora: string | null;
          unidade_id: string;
          updated_at: string;
        };
        Insert: {
          codigo_rastreio?: string | null;
          condominio_id: string;
          created_at?: string;
          descricao: string;
          foto_url?: string | null;
          id?: string;
          local_armazenamento?: string | null;
          notificado_em?: string | null;
          observacoes?: string | null;
          recebido_em?: string;
          recebido_por?: string | null;
          remetente?: string | null;
          retirado_em?: string | null;
          retirado_por?: string | null;
          retirado_por_nome?: string | null;
          status?: Database["public"]["Enums"]["encomenda_status"];
          transportadora?: string | null;
          unidade_id: string;
          updated_at?: string;
        };
        Update: {
          codigo_rastreio?: string | null;
          condominio_id?: string;
          created_at?: string;
          descricao?: string;
          foto_url?: string | null;
          id?: string;
          local_armazenamento?: string | null;
          notificado_em?: string | null;
          observacoes?: string | null;
          recebido_em?: string;
          recebido_por?: string | null;
          remetente?: string | null;
          retirado_em?: string | null;
          retirado_por?: string | null;
          retirado_por_nome?: string | null;
          status?: Database["public"]["Enums"]["encomenda_status"];
          transportadora?: string | null;
          unidade_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "encomendas_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "encomendas_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      indices_economicos: {
        Row: {
          atualizado_em: string;
          competencia: string;
          indice: Database["public"]["Enums"]["indice_reajuste"];
          variacao: number;
        };
        Insert: {
          atualizado_em?: string;
          competencia: string;
          indice: Database["public"]["Enums"]["indice_reajuste"];
          variacao: number;
        };
        Update: {
          atualizado_em?: string;
          competencia?: string;
          indice?: Database["public"]["Enums"]["indice_reajuste"];
          variacao?: number;
        };
        Relationships: [];
      };
      infracoes: {
        Row: {
          assembleia_id: string | null;
          base_legal: Database["public"]["Enums"]["infracao_base"] | null;
          cancelada_em: string | null;
          cancelamento_motivo: string | null;
          cobranca_id: string | null;
          condominio_id: string;
          created_at: string;
          data_ocorrencia: string;
          deliberacao: string | null;
          descricao: string;
          id: string;
          local: string | null;
          numero: number;
          referencia_mensal: number | null;
          registrada_por: string | null;
          status: Database["public"]["Enums"]["infracao_status"];
          tipo: Database["public"]["Enums"]["infracao_tipo"];
          unidade_id: string;
          updated_at: string;
          valor: number | null;
        };
        Insert: {
          assembleia_id?: string | null;
          base_legal?: Database["public"]["Enums"]["infracao_base"] | null;
          cancelada_em?: string | null;
          cancelamento_motivo?: string | null;
          cobranca_id?: string | null;
          condominio_id: string;
          created_at?: string;
          data_ocorrencia: string;
          deliberacao?: string | null;
          descricao: string;
          id?: string;
          local?: string | null;
          numero: number;
          referencia_mensal?: number | null;
          registrada_por?: string | null;
          status?: Database["public"]["Enums"]["infracao_status"];
          tipo: Database["public"]["Enums"]["infracao_tipo"];
          unidade_id: string;
          updated_at?: string;
          valor?: number | null;
        };
        Update: {
          assembleia_id?: string | null;
          base_legal?: Database["public"]["Enums"]["infracao_base"] | null;
          cancelada_em?: string | null;
          cancelamento_motivo?: string | null;
          cobranca_id?: string | null;
          condominio_id?: string;
          created_at?: string;
          data_ocorrencia?: string;
          deliberacao?: string | null;
          descricao?: string;
          id?: string;
          local?: string | null;
          numero?: number;
          referencia_mensal?: number | null;
          registrada_por?: string | null;
          status?: Database["public"]["Enums"]["infracao_status"];
          tipo?: Database["public"]["Enums"]["infracao_tipo"];
          unidade_id?: string;
          updated_at?: string;
          valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "infracoes_assembleia_id_fkey";
            columns: ["assembleia_id"];
            isOneToOne: false;
            referencedRelation: "assembleias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infracoes_cobranca_id_fkey";
            columns: ["cobranca_id"];
            isOneToOne: false;
            referencedRelation: "cobrancas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infracoes_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infracoes_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          condominio: string;
          consent_lgpd: boolean;
          created_at: string;
          id: string;
          mensagem: string | null;
          nome: string;
          observacoes_internas: string | null;
          origem: string;
          quer_demo: boolean;
          status: string;
          telefone: string;
          updated_at: string;
          user_agent: string | null;
        };
        Insert: {
          condominio: string;
          consent_lgpd?: boolean;
          created_at?: string;
          id?: string;
          mensagem?: string | null;
          nome: string;
          observacoes_internas?: string | null;
          origem?: string;
          quer_demo?: boolean;
          status?: string;
          telefone: string;
          updated_at?: string;
          user_agent?: string | null;
        };
        Update: {
          condominio?: string;
          consent_lgpd?: boolean;
          created_at?: string;
          id?: string;
          mensagem?: string | null;
          nome?: string;
          observacoes_internas?: string | null;
          origem?: string;
          quer_demo?: boolean;
          status?: string;
          telefone?: string;
          updated_at?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      notificacoes_whatsapp: {
        Row: {
          condominio_id: string;
          contexto: string | null;
          contexto_id: string | null;
          created_at: string;
          destinatario_nome: string | null;
          destinatario_telefone: string;
          destinatario_user_id: string | null;
          enviado_em: string | null;
          erro: string | null;
          id: string;
          link_wa: string | null;
          mensagem: string;
          status: Database["public"]["Enums"]["wa_status"];
          unidade_id: string | null;
        };
        Insert: {
          condominio_id: string;
          contexto?: string | null;
          contexto_id?: string | null;
          created_at?: string;
          destinatario_nome?: string | null;
          destinatario_telefone: string;
          destinatario_user_id?: string | null;
          enviado_em?: string | null;
          erro?: string | null;
          id?: string;
          link_wa?: string | null;
          mensagem: string;
          status?: Database["public"]["Enums"]["wa_status"];
          unidade_id?: string | null;
        };
        Update: {
          condominio_id?: string;
          contexto?: string | null;
          contexto_id?: string | null;
          created_at?: string;
          destinatario_nome?: string | null;
          destinatario_telefone?: string;
          destinatario_user_id?: string | null;
          enviado_em?: string | null;
          erro?: string | null;
          id?: string;
          link_wa?: string | null;
          mensagem?: string;
          status?: Database["public"]["Enums"]["wa_status"];
          unidade_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notificacoes_whatsapp_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificacoes_whatsapp_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      ocorrencia_anexos: {
        Row: {
          condominio_id: string;
          created_at: string;
          enviado_por: string;
          id: string;
          nome: string | null;
          ocorrencia_id: string;
          url: string;
        };
        Insert: {
          condominio_id: string;
          created_at?: string;
          enviado_por: string;
          id?: string;
          nome?: string | null;
          ocorrencia_id: string;
          url: string;
        };
        Update: {
          condominio_id?: string;
          created_at?: string;
          enviado_por?: string;
          id?: string;
          nome?: string | null;
          ocorrencia_id?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ocorrencia_anexos_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ocorrencia_anexos_ocorrencia_id_fkey";
            columns: ["ocorrencia_id"];
            isOneToOne: false;
            referencedRelation: "ocorrencias";
            referencedColumns: ["id"];
          },
        ];
      };
      ocorrencia_comentarios: {
        Row: {
          autor_id: string;
          condominio_id: string;
          created_at: string;
          id: string;
          interno: boolean;
          mensagem: string;
          ocorrencia_id: string;
        };
        Insert: {
          autor_id: string;
          condominio_id: string;
          created_at?: string;
          id?: string;
          interno?: boolean;
          mensagem: string;
          ocorrencia_id: string;
        };
        Update: {
          autor_id?: string;
          condominio_id?: string;
          created_at?: string;
          id?: string;
          interno?: boolean;
          mensagem?: string;
          ocorrencia_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ocorrencia_comentarios_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ocorrencia_comentarios_ocorrencia_id_fkey";
            columns: ["ocorrencia_id"];
            isOneToOne: false;
            referencedRelation: "ocorrencias";
            referencedColumns: ["id"];
          },
        ];
      };
      ocorrencias: {
        Row: {
          aberta_por: string;
          atribuido_a: string | null;
          atribuido_em: string | null;
          atribuido_por: string | null;
          categoria: Database["public"]["Enums"]["ocorrencia_categoria"];
          comentario_satisfacao: string | null;
          condominio_id: string;
          created_at: string;
          descricao: string;
          fechado_em: string | null;
          foto_url: string | null;
          id: string;
          local: string | null;
          nota_satisfacao: number | null;
          prioridade: Database["public"]["Enums"]["ocorrencia_prioridade"];
          resolucao: string | null;
          resolvido_em: string | null;
          resolvido_por: string | null;
          status: Database["public"]["Enums"]["ocorrencia_status"];
          titulo: string;
          unidade_id: string | null;
          updated_at: string;
        };
        Insert: {
          aberta_por: string;
          atribuido_a?: string | null;
          atribuido_em?: string | null;
          atribuido_por?: string | null;
          categoria?: Database["public"]["Enums"]["ocorrencia_categoria"];
          comentario_satisfacao?: string | null;
          condominio_id: string;
          created_at?: string;
          descricao: string;
          fechado_em?: string | null;
          foto_url?: string | null;
          id?: string;
          local?: string | null;
          nota_satisfacao?: number | null;
          prioridade?: Database["public"]["Enums"]["ocorrencia_prioridade"];
          resolucao?: string | null;
          resolvido_em?: string | null;
          resolvido_por?: string | null;
          status?: Database["public"]["Enums"]["ocorrencia_status"];
          titulo: string;
          unidade_id?: string | null;
          updated_at?: string;
        };
        Update: {
          aberta_por?: string;
          atribuido_a?: string | null;
          atribuido_em?: string | null;
          atribuido_por?: string | null;
          categoria?: Database["public"]["Enums"]["ocorrencia_categoria"];
          comentario_satisfacao?: string | null;
          condominio_id?: string;
          created_at?: string;
          descricao?: string;
          fechado_em?: string | null;
          foto_url?: string | null;
          id?: string;
          local?: string | null;
          nota_satisfacao?: number | null;
          prioridade?: Database["public"]["Enums"]["ocorrencia_prioridade"];
          resolucao?: string | null;
          resolvido_em?: string | null;
          resolvido_por?: string | null;
          status?: Database["public"]["Enums"]["ocorrencia_status"];
          titulo?: string;
          unidade_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ocorrencias_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ocorrencias_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      orcamento_itens: {
        Row: {
          categoria_id: string;
          condominio_id: string;
          created_at: string;
          id: string;
          indice: Database["public"]["Enums"]["indice_reajuste"];
          observacao: string | null;
          orcamento_id: string;
          ordem: number;
          percentual: number;
          realizado_base: number;
          updated_at: string;
          valor_previsto: number;
        };
        Insert: {
          categoria_id: string;
          condominio_id: string;
          created_at?: string;
          id?: string;
          indice?: Database["public"]["Enums"]["indice_reajuste"];
          observacao?: string | null;
          orcamento_id: string;
          ordem?: number;
          percentual?: number;
          realizado_base?: number;
          updated_at?: string;
          valor_previsto?: number;
        };
        Update: {
          categoria_id?: string;
          condominio_id?: string;
          created_at?: string;
          id?: string;
          indice?: Database["public"]["Enums"]["indice_reajuste"];
          observacao?: string | null;
          orcamento_id?: string;
          ordem?: number;
          percentual?: number;
          realizado_base?: number;
          updated_at?: string;
          valor_previsto?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias_financeiras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamento_itens_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey";
            columns: ["orcamento_id"];
            isOneToOne: false;
            referencedRelation: "orcamentos";
            referencedColumns: ["id"];
          },
        ];
      };
      orcamentos: {
        Row: {
          ano: number;
          ano_base: number;
          aplicado_em: string | null;
          aplicado_por: string | null;
          aprovado_em: string | null;
          aprovado_por: string | null;
          assembleia_id: string | null;
          condominio_id: string;
          created_at: string;
          criado_por: string | null;
          fundo_reserva_percentual: number;
          id: string;
          inadimplencia_prevista: number;
          premissas: string | null;
          status: Database["public"]["Enums"]["orcamento_status"];
          updated_at: string;
        };
        Insert: {
          ano: number;
          ano_base: number;
          aplicado_em?: string | null;
          aplicado_por?: string | null;
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          assembleia_id?: string | null;
          condominio_id: string;
          created_at?: string;
          criado_por?: string | null;
          fundo_reserva_percentual?: number;
          id?: string;
          inadimplencia_prevista?: number;
          premissas?: string | null;
          status?: Database["public"]["Enums"]["orcamento_status"];
          updated_at?: string;
        };
        Update: {
          ano?: number;
          ano_base?: number;
          aplicado_em?: string | null;
          aplicado_por?: string | null;
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          assembleia_id?: string | null;
          condominio_id?: string;
          created_at?: string;
          criado_por?: string | null;
          fundo_reserva_percentual?: number;
          id?: string;
          inadimplencia_prevista?: number;
          premissas?: string | null;
          status?: Database["public"]["Enums"]["orcamento_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orcamentos_assembleia_id_fkey";
            columns: ["assembleia_id"];
            isOneToOne: false;
            referencedRelation: "assembleias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamentos_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      pagamentos: {
        Row: {
          cobranca_id: string | null;
          comprovante_url: string | null;
          condominio_id: string;
          created_at: string;
          forma: Database["public"]["Enums"]["forma_pagamento"];
          id: string;
          mp_payment_id: string | null;
          observacoes: string | null;
          pago_em: string;
          registrado_por: string | null;
          valor: number;
        };
        Insert: {
          cobranca_id?: string | null;
          comprovante_url?: string | null;
          condominio_id: string;
          created_at?: string;
          forma?: Database["public"]["Enums"]["forma_pagamento"];
          id?: string;
          mp_payment_id?: string | null;
          observacoes?: string | null;
          pago_em?: string;
          registrado_por?: string | null;
          valor: number;
        };
        Update: {
          cobranca_id?: string | null;
          comprovante_url?: string | null;
          condominio_id?: string;
          created_at?: string;
          forma?: Database["public"]["Enums"]["forma_pagamento"];
          id?: string;
          mp_payment_id?: string | null;
          observacoes?: string | null;
          pago_em?: string;
          registrado_por?: string | null;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pagamentos_cobranca_id_fkey";
            columns: ["cobranca_id"];
            isOneToOne: false;
            referencedRelation: "cobrancas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagamentos_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          id: string;
          nome_completo: string | null;
          telefone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          id: string;
          nome_completo?: string | null;
          telefone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          id?: string;
          nome_completo?: string | null;
          telefone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reservas: {
        Row: {
          aprovado_em: string | null;
          aprovado_por: string | null;
          area_id: string;
          cancelado_em: string | null;
          cancelado_por: string | null;
          cobranca_id: string | null;
          condominio_id: string;
          created_at: string;
          fim: string;
          id: string;
          inicio: string;
          motivo_recusa: string | null;
          num_convidados: number;
          observacoes: string | null;
          solicitante_id: string;
          status: Database["public"]["Enums"]["reserva_status"];
          taxa: number;
          unidade_id: string;
          updated_at: string;
        };
        Insert: {
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          area_id: string;
          cancelado_em?: string | null;
          cancelado_por?: string | null;
          cobranca_id?: string | null;
          condominio_id: string;
          created_at?: string;
          fim: string;
          id?: string;
          inicio: string;
          motivo_recusa?: string | null;
          num_convidados?: number;
          observacoes?: string | null;
          solicitante_id: string;
          status?: Database["public"]["Enums"]["reserva_status"];
          taxa?: number;
          unidade_id: string;
          updated_at?: string;
        };
        Update: {
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          area_id?: string;
          cancelado_em?: string | null;
          cancelado_por?: string | null;
          cobranca_id?: string | null;
          condominio_id?: string;
          created_at?: string;
          fim?: string;
          id?: string;
          inicio?: string;
          motivo_recusa?: string | null;
          num_convidados?: number;
          observacoes?: string | null;
          solicitante_id?: string;
          status?: Database["public"]["Enums"]["reserva_status"];
          taxa?: number;
          unidade_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservas_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas_comuns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservas_cobranca_id_fkey";
            columns: ["cobranca_id"];
            isOneToOne: false;
            referencedRelation: "cobrancas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservas_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservas_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      suppressed_emails: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          metadata: Json | null;
          reason: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          metadata?: Json | null;
          reason: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          metadata?: Json | null;
          reason?: string;
        };
        Relationships: [];
      };
      unidade_moradores: {
        Row: {
          created_at: string;
          id: string;
          principal: boolean;
          representante: boolean;
          unidade_id: string;
          user_id: string;
          vinculo: Database["public"]["Enums"]["vinculo_tipo"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          principal?: boolean;
          representante?: boolean;
          unidade_id: string;
          user_id: string;
          vinculo?: Database["public"]["Enums"]["vinculo_tipo"];
        };
        Update: {
          created_at?: string;
          id?: string;
          principal?: boolean;
          representante?: boolean;
          unidade_id?: string;
          user_id?: string;
          vinculo?: Database["public"]["Enums"]["vinculo_tipo"];
        };
        Relationships: [
          {
            foreignKeyName: "unidade_moradores_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      unidades: {
        Row: {
          bloco: string | null;
          condominio_id: string;
          created_at: string;
          fracao_ideal: number | null;
          id: string;
          numero: string;
          observacoes: string | null;
          taxa_mensal: number | null;
          updated_at: string;
        };
        Insert: {
          bloco?: string | null;
          condominio_id: string;
          created_at?: string;
          fracao_ideal?: number | null;
          id?: string;
          numero: string;
          observacoes?: string | null;
          taxa_mensal?: number | null;
          updated_at?: string;
        };
        Update: {
          bloco?: string | null;
          condominio_id?: string;
          created_at?: string;
          fracao_ideal?: number | null;
          id?: string;
          numero?: string;
          observacoes?: string | null;
          taxa_mensal?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unidades_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          condominio_id: string;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          condominio_id: string;
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          condominio_id?: string;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      visitantes: {
        Row: {
          autorizado_em: string | null;
          autorizado_por: string | null;
          condominio_id: string;
          created_at: string;
          documento: string | null;
          empresa: string | null;
          entrada_em: string | null;
          foto_url: string | null;
          id: string;
          motivo_recusa: string | null;
          nome: string;
          notificado_em: string | null;
          observacoes: string | null;
          placa_veiculo: string | null;
          registrado_por: string | null;
          saida_em: string | null;
          status: Database["public"]["Enums"]["visitante_status"];
          tipo: Database["public"]["Enums"]["visitante_tipo"];
          unidade_id: string;
          updated_at: string;
          valido_ate: string | null;
        };
        Insert: {
          autorizado_em?: string | null;
          autorizado_por?: string | null;
          condominio_id: string;
          created_at?: string;
          documento?: string | null;
          empresa?: string | null;
          entrada_em?: string | null;
          foto_url?: string | null;
          id?: string;
          motivo_recusa?: string | null;
          nome: string;
          notificado_em?: string | null;
          observacoes?: string | null;
          placa_veiculo?: string | null;
          registrado_por?: string | null;
          saida_em?: string | null;
          status?: Database["public"]["Enums"]["visitante_status"];
          tipo?: Database["public"]["Enums"]["visitante_tipo"];
          unidade_id: string;
          updated_at?: string;
          valido_ate?: string | null;
        };
        Update: {
          autorizado_em?: string | null;
          autorizado_por?: string | null;
          condominio_id?: string;
          created_at?: string;
          documento?: string | null;
          empresa?: string | null;
          entrada_em?: string | null;
          foto_url?: string | null;
          id?: string;
          motivo_recusa?: string | null;
          nome?: string;
          notificado_em?: string | null;
          observacoes?: string | null;
          placa_veiculo?: string | null;
          registrado_por?: string | null;
          saida_em?: string | null;
          status?: Database["public"]["Enums"]["visitante_status"];
          tipo?: Database["public"]["Enums"]["visitante_tipo"];
          unidade_id?: string;
          updated_at?: string;
          valido_ate?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "visitantes_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visitantes_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      wa_bot_estado: {
        Row: {
          conversa_id: string;
          dados: Json;
          expira_em: string;
          intent: Database["public"]["Enums"]["wa_intent"];
          passo: string | null;
          updated_at: string;
        };
        Insert: {
          conversa_id: string;
          dados?: Json;
          expira_em?: string;
          intent?: Database["public"]["Enums"]["wa_intent"];
          passo?: string | null;
          updated_at?: string;
        };
        Update: {
          conversa_id?: string;
          dados?: Json;
          expira_em?: string;
          intent?: Database["public"]["Enums"]["wa_intent"];
          passo?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wa_bot_estado_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: true;
            referencedRelation: "wa_conversas";
            referencedColumns: ["id"];
          },
        ];
      };
      wa_config: {
        Row: {
          access_token: string | null;
          app_secret: string | null;
          ativo: boolean;
          business_account_id: string | null;
          condominio_id: string;
          created_at: string;
          display_phone: string | null;
          phone_number_id: string | null;
          saudacao: string | null;
          template_comunicado: string | null;
          template_encomenda: string | null;
          template_reserva_status: string | null;
          template_segunda_via: string | null;
          template_visitante: string | null;
          updated_at: string;
          webhook_verify_token: string | null;
        };
        Insert: {
          access_token?: string | null;
          app_secret?: string | null;
          ativo?: boolean;
          business_account_id?: string | null;
          condominio_id: string;
          created_at?: string;
          display_phone?: string | null;
          phone_number_id?: string | null;
          saudacao?: string | null;
          template_comunicado?: string | null;
          template_encomenda?: string | null;
          template_reserva_status?: string | null;
          template_segunda_via?: string | null;
          template_visitante?: string | null;
          updated_at?: string;
          webhook_verify_token?: string | null;
        };
        Update: {
          access_token?: string | null;
          app_secret?: string | null;
          ativo?: boolean;
          business_account_id?: string | null;
          condominio_id?: string;
          created_at?: string;
          display_phone?: string | null;
          phone_number_id?: string | null;
          saudacao?: string | null;
          template_comunicado?: string | null;
          template_encomenda?: string | null;
          template_reserva_status?: string | null;
          template_segunda_via?: string | null;
          template_visitante?: string | null;
          updated_at?: string;
          webhook_verify_token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wa_config_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: true;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      wa_conversas: {
        Row: {
          condominio_id: string;
          created_at: string;
          id: string;
          janela_24h_expira: string | null;
          nome: string | null;
          telefone: string;
          ultimo_contato: string;
          unidade_id: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          condominio_id: string;
          created_at?: string;
          id?: string;
          janela_24h_expira?: string | null;
          nome?: string | null;
          telefone: string;
          ultimo_contato?: string;
          unidade_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          condominio_id?: string;
          created_at?: string;
          id?: string;
          janela_24h_expira?: string | null;
          nome?: string | null;
          telefone?: string;
          ultimo_contato?: string;
          unidade_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wa_conversas_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wa_conversas_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      wa_mensagens: {
        Row: {
          condominio_id: string;
          contexto: string | null;
          contexto_id: string | null;
          conversa_id: string;
          created_at: string;
          direcao: Database["public"]["Enums"]["wa_direcao"];
          entregue_em: string | null;
          enviado_em: string | null;
          erro: string | null;
          id: string;
          lido_em: string | null;
          payload: Json | null;
          status: Database["public"]["Enums"]["wa_msg_status"];
          texto: string | null;
          tipo: Database["public"]["Enums"]["wa_msg_tipo"];
          wa_message_id: string | null;
        };
        Insert: {
          condominio_id: string;
          contexto?: string | null;
          contexto_id?: string | null;
          conversa_id: string;
          created_at?: string;
          direcao: Database["public"]["Enums"]["wa_direcao"];
          entregue_em?: string | null;
          enviado_em?: string | null;
          erro?: string | null;
          id?: string;
          lido_em?: string | null;
          payload?: Json | null;
          status?: Database["public"]["Enums"]["wa_msg_status"];
          texto?: string | null;
          tipo?: Database["public"]["Enums"]["wa_msg_tipo"];
          wa_message_id?: string | null;
        };
        Update: {
          condominio_id?: string;
          contexto?: string | null;
          contexto_id?: string | null;
          conversa_id?: string;
          created_at?: string;
          direcao?: Database["public"]["Enums"]["wa_direcao"];
          entregue_em?: string | null;
          enviado_em?: string | null;
          erro?: string | null;
          id?: string;
          lido_em?: string | null;
          payload?: Json | null;
          status?: Database["public"]["Enums"]["wa_msg_status"];
          texto?: string | null;
          tipo?: Database["public"]["Enums"]["wa_msg_tipo"];
          wa_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wa_mensagens_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wa_mensagens_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "wa_conversas";
            referencedColumns: ["id"];
          },
        ];
      };
      wa_notif_jobs: {
        Row: {
          condominio_id: string;
          contexto: string;
          created_at: string;
          destinatario_nome: string | null;
          destinatario_telefone: string;
          destinatario_user_id: string | null;
          documento_id: string | null;
          enviado_em: string | null;
          id: string;
          max_tentativas: number;
          mensagem: string;
          proxima_tentativa: string;
          status: Database["public"]["Enums"]["wa_job_status"];
          tentativas: number;
          ultimo_erro: string | null;
          updated_at: string;
          wa_message_id: string | null;
        };
        Insert: {
          condominio_id: string;
          contexto?: string;
          created_at?: string;
          destinatario_nome?: string | null;
          destinatario_telefone: string;
          destinatario_user_id?: string | null;
          documento_id?: string | null;
          enviado_em?: string | null;
          id?: string;
          max_tentativas?: number;
          mensagem: string;
          proxima_tentativa?: string;
          status?: Database["public"]["Enums"]["wa_job_status"];
          tentativas?: number;
          ultimo_erro?: string | null;
          updated_at?: string;
          wa_message_id?: string | null;
        };
        Update: {
          condominio_id?: string;
          contexto?: string;
          created_at?: string;
          destinatario_nome?: string | null;
          destinatario_telefone?: string;
          destinatario_user_id?: string | null;
          documento_id?: string | null;
          enviado_em?: string | null;
          id?: string;
          max_tentativas?: number;
          mensagem?: string;
          proxima_tentativa?: string;
          status?: Database["public"]["Enums"]["wa_job_status"];
          tentativas?: number;
          ultimo_erro?: string | null;
          updated_at?: string;
          wa_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wa_notif_jobs_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      wa_preferencias: {
        Row: {
          condominio_id: string;
          created_at: string;
          id: string;
          receber_cobrancas: boolean;
          receber_comunicados: boolean;
          receber_encomendas: boolean;
          receber_visitantes: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          condominio_id: string;
          created_at?: string;
          id?: string;
          receber_cobrancas?: boolean;
          receber_comunicados?: boolean;
          receber_encomendas?: boolean;
          receber_visitantes?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          condominio_id?: string;
          created_at?: string;
          id?: string;
          receber_cobrancas?: boolean;
          receber_comunicados?: boolean;
          receber_encomendas?: boolean;
          receber_visitantes?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wa_preferencias_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      config_pagamento_safe: {
        Row: {
          ativo: boolean | null;
          banco_agencia: string | null;
          banco_cnpj: string | null;
          banco_conta_mascarada: string | null;
          banco_nome: string | null;
          banco_tipo_conta: string | null;
          banco_titular: string | null;
          condominio_id: string | null;
          dias_envio_lembrete: number | null;
          instrucoes_boleto: string | null;
          juros_dia_percentual: number | null;
          multa_percentual: number | null;
          pix_chave_mascarada: string | null;
          updated_at: string | null;
        };
        Insert: {
          ativo?: boolean | null;
          banco_agencia?: string | null;
          banco_cnpj?: string | null;
          banco_conta_mascarada?: never;
          banco_nome?: string | null;
          banco_tipo_conta?: string | null;
          banco_titular?: string | null;
          condominio_id?: string | null;
          dias_envio_lembrete?: number | null;
          instrucoes_boleto?: string | null;
          juros_dia_percentual?: number | null;
          multa_percentual?: number | null;
          pix_chave_mascarada?: never;
          updated_at?: string | null;
        };
        Update: {
          ativo?: boolean | null;
          banco_agencia?: string | null;
          banco_cnpj?: string | null;
          banco_conta_mascarada?: never;
          banco_nome?: string | null;
          banco_tipo_conta?: string | null;
          banco_titular?: string | null;
          condominio_id?: string | null;
          dias_envio_lembrete?: number | null;
          instrucoes_boleto?: string | null;
          juros_dia_percentual?: number | null;
          multa_percentual?: number | null;
          pix_chave_mascarada?: never;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "config_pagamento_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: true;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
        ];
      };
      convites_safe: {
        Row: {
          aceito_em: string | null;
          aceito_por: string | null;
          condominio_id: string | null;
          created_at: string | null;
          email: string | null;
          enviado_por: string | null;
          expira_em: string | null;
          id: string | null;
          nome: string | null;
          role: Database["public"]["Enums"]["app_role"] | null;
          status: Database["public"]["Enums"]["convite_status"] | null;
          telefone: string | null;
          unidade_id: string | null;
        };
        Insert: {
          aceito_em?: string | null;
          aceito_por?: string | null;
          condominio_id?: string | null;
          created_at?: string | null;
          email?: string | null;
          enviado_por?: string | null;
          expira_em?: string | null;
          id?: string | null;
          nome?: string | null;
          role?: Database["public"]["Enums"]["app_role"] | null;
          status?: Database["public"]["Enums"]["convite_status"] | null;
          telefone?: string | null;
          unidade_id?: string | null;
        };
        Update: {
          aceito_em?: string | null;
          aceito_por?: string | null;
          condominio_id?: string | null;
          created_at?: string | null;
          email?: string | null;
          enviado_por?: string | null;
          expira_em?: string | null;
          id?: string | null;
          nome?: string | null;
          role?: Database["public"]["Enums"]["app_role"] | null;
          status?: Database["public"]["Enums"]["convite_status"] | null;
          telefone?: string | null;
          unidade_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "convites_condominio_id_fkey";
            columns: ["condominio_id"];
            isOneToOne: false;
            referencedRelation: "condominios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convites_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      _acordo_calcular: {
        Args: {
          _cobranca_ids: string[];
          _condominio_id: string;
          _desconto: number;
          _entrada: number;
          _num_parcelas: number;
          _primeiro_vencimento: string;
          _unidade_id: string;
        };
        Returns: Json;
      };
      _aplicar_encargos: {
        Args: {
          _cobranca_id: string;
          _condominio_id: string;
          _referencia: string;
        };
        Returns: number;
      };
      _elegibilidade_assembleia: {
        Args: { _assembleia_id: string };
        Returns: {
          bloco: string;
          elegivel: boolean;
          fracao_ideal: number;
          motivo: string;
          numero: string;
          peso: number;
          unidade_id: string;
        }[];
      };
      _encargos_cobranca: {
        Args: { _cobranca_id: string; _referencia: string };
        Returns: {
          dias_atraso: number;
          juros: number;
          multa: number;
        }[];
      };
      _encargos_devidos: {
        Args: {
          _cobranca_id: string;
          _condominio_id: string;
          _referencia: string;
        };
        Returns: {
          cobranca_id: string;
          dias_atraso: number;
          juros: number;
          multa: number;
        }[];
      };
      _saldo_ate: {
        Args: { _ate: string; _condominio_id: string };
        Returns: number;
      };
      abrir_ocorrencia: {
        Args: {
          _categoria: Database["public"]["Enums"]["ocorrencia_categoria"];
          _condominio_id: string;
          _descricao: string;
          _foto_url: string;
          _local: string;
          _prioridade: Database["public"]["Enums"]["ocorrencia_prioridade"];
          _titulo: string;
          _unidade_id: string;
        };
        Returns: string;
      };
      abrir_votacao: { Args: { _pauta_id: string }; Returns: undefined };
      aceitar_convite: { Args: { _token: string }; Returns: string };
      acumulado_12m: {
        Args: {
          _ate?: string;
          _indice: Database["public"]["Enums"]["indice_reajuste"];
        };
        Returns: Json;
      };
      adicionar_pauta: {
        Args: {
          _assembleia_id: string;
          _descricao?: string;
          _maioria: Database["public"]["Enums"]["maioria_tipo"];
          _titulo: string;
        };
        Returns: string;
      };
      admin_metricas_globais: { Args: never; Returns: Json };
      aplicar_encargos_atraso: {
        Args: { _condominio_id: string; _referencia?: string };
        Returns: number;
      };
      aplicar_encargos_atraso_todos: { Args: never; Returns: number };
      aplicar_multa: {
        Args: {
          _assembleia_id?: string;
          _base_legal: Database["public"]["Enums"]["infracao_base"];
          _categoria_id?: string;
          _condominio_id: string;
          _data_ocorrencia: string;
          _deliberacao?: string;
          _descricao: string;
          _local?: string;
          _unidade_id: string;
          _valor: number;
          _vencimento: string;
        };
        Returns: string;
      };
      aplicar_orcamento: {
        Args: {
          _ate_mes?: number;
          _categoria_id: string;
          _dia_vencimento?: number;
          _orcamento_id: string;
        };
        Returns: Json;
      };
      aprovar_orcamento: {
        Args: { _assembleia_id: string; _orcamento_id: string };
        Returns: undefined;
      };
      aprovar_reserva: { Args: { _reserva_id: string }; Returns: undefined };
      apurar_pauta: { Args: { _pauta_id: string }; Returns: Json };
      atribuir_ocorrencia: {
        Args: { _atribuido_a: string; _ocorrencia_id: string };
        Returns: undefined;
      };
      atualizar_item_orcamento: {
        Args: {
          _indice: Database["public"]["Enums"]["indice_reajuste"];
          _item_id: string;
          _observacao?: string;
          _percentual: number;
          _valor_previsto?: number;
        };
        Returns: number;
      };
      atualizar_orcamento: {
        Args: {
          _fundo_reserva?: number;
          _inadimplencia?: number;
          _orcamento_id: string;
          _premissas?: string;
        };
        Returns: undefined;
      };
      atualizar_status_ocorrencia: {
        Args: {
          _novo_status: Database["public"]["Enums"]["ocorrencia_status"];
          _ocorrencia_id: string;
          _resolucao: string;
        };
        Returns: undefined;
      };
      autorizar_visitante: {
        Args: { _visitante_id: string };
        Returns: undefined;
      };
      avaliar_ocorrencia: {
        Args: { _comentario: string; _nota: number; _ocorrencia_id: string };
        Returns: undefined;
      };
      calcular_balancete: {
        Args: { _condominio_id: string; _fim: string; _inicio: string };
        Returns: Json;
      };
      calcular_encargos_cobranca: {
        Args: { _cobranca_id: string; _referencia?: string };
        Returns: {
          dias_atraso: number;
          juros: number;
          multa: number;
        }[];
      };
      cancelar_assembleia: {
        Args: { _assembleia_id: string; _motivo?: string };
        Returns: undefined;
      };
      cancelar_infracao: {
        Args: { _infracao_id: string; _motivo: string };
        Returns: undefined;
      };
      cancelar_reserva: { Args: { _reserva_id: string }; Returns: undefined };
      carta_cobranca: {
        Args: { _prazo_dias?: number; _unidade_id: string };
        Returns: Json;
      };
      claim_platform_admin: { Args: never; Returns: boolean };
      cnab_alocar_nosso_numero: {
        Args: { _condominio_id: string; _quantidade: number };
        Returns: {
          fim: number;
          inicio: number;
        }[];
      };
      cnab_baixar_cobranca: {
        Args: {
          _cobranca_id: string;
          _data_pagamento: string;
          _retorno_id: string;
          _valor: number;
        };
        Returns: string;
      };
      cnab_proximo_sequencial: {
        Args: { _condominio_id: string };
        Returns: number;
      };
      comentar_ocorrencia: {
        Args: { _interno: boolean; _mensagem: string; _ocorrencia_id: string };
        Returns: string;
      };
      concentracao_pagamentos: {
        Args: { _condominio_id: string; _fim: string; _inicio: string };
        Returns: Json;
      };
      conferir_certidao: {
        Args: { _codigo: string };
        Returns: Json;
      };
      contar_usuarios_empresa: {
        Args: { _condominio_id: string };
        Returns: number;
      };
      convocar_assembleia: {
        Args: { _assembleia_id: string };
        Returns: undefined;
      };
      criar_acordo: {
        Args: {
          _autorizacao?: string;
          _categoria_id?: string;
          _cobranca_ids: string[];
          _condominio_id: string;
          _desconto: number;
          _entrada: number;
          _num_parcelas: number;
          _observacoes?: string;
          _primeiro_vencimento: string;
          _unidade_id: string;
        };
        Returns: string;
      };
      criar_assembleia: {
        Args: {
          _condominio_id: string;
          _edital?: string;
          _exige_quitacao?: boolean;
          _fim: string;
          _inicio: string;
          _link?: string;
          _local?: string;
          _modo: Database["public"]["Enums"]["assembleia_modo"];
          _peso_por_fracao?: boolean;
          _quorum_instalacao?: number;
          _tipo: Database["public"]["Enums"]["assembleia_tipo"];
          _titulo: string;
        };
        Returns: string;
      };
      criar_condominio: {
        Args: {
          _cep: string;
          _cidade: string;
          _cnpj: string;
          _codigo_publico: string;
          _endereco: string;
          _estado: string;
          _nome: string;
          _whatsapp_numero: string;
        };
        Returns: string;
      };
      criar_orcamento: {
        Args: {
          _ano: number;
          _ano_base: number;
          _condominio_id: string;
          _fundo_reserva?: number;
          _inadimplencia?: number;
          _premissas?: string;
        };
        Returns: string;
      };
      definir_representante: {
        Args: { _unidade_id: string; _user_id: string };
        Returns: undefined;
      };
      delete_email: {
        Args: { message_id: number; queue_name: string };
        Returns: boolean;
      };
      disparar_lembretes_cobranca: { Args: never; Returns: undefined };
      divida_da_unidade: {
        Args: { _unidade_id: string };
        Returns: Json;
      };
      elegibilidade_assembleia: {
        Args: { _assembleia_id: string };
        Returns: {
          bloco: string;
          elegivel: boolean;
          fracao_ideal: number;
          motivo: string;
          numero: string;
          peso: number;
          pode_votar: boolean;
          representante_nome: string;
          unidade_id: string;
        }[];
      };
      emitir_nada_consta: {
        Args: { _unidade_id: string; _validade_dias?: number };
        Returns: string;
      };
      encerrar_assembleia: {
        Args: { _assembleia_id: string };
        Returns: undefined;
      };
      enqueue_documento_comunicado: {
        Args: { _documento_id: string };
        Returns: number;
      };
      enqueue_email: {
        Args: { payload: Json; queue_name: string };
        Returns: number;
      };
      fechar_balancete: {
        Args: {
          _condominio_id: string;
          _fim: string;
          _inicio: string;
          _observacoes?: string;
        };
        Returns: string;
      };
      fechar_votacao: { Args: { _pauta_id: string }; Returns: Json };
      fluxo_de_caixa: {
        Args: { _condominio_id: string; _fim: string; _inicio: string };
        Returns: Json;
      };
      gerar_cobrancas_lote: {
        Args: {
          _categoria_id: string;
          _competencia: string;
          _condominio_id: string;
          _descricao: string;
          _modo: string;
          _valor: number;
          _vencimento: string;
        };
        Returns: number;
      };
      has_role: {
        Args: {
          _condominio_id: string;
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      indices_para_orcamento: {
        Args: { _ate?: string };
        Returns: Json;
      };
      is_admin: {
        Args: { _condominio_id: string; _user_id: string };
        Returns: boolean;
      };
      is_contador: {
        Args: { _condominio_id: string; _user_id: string };
        Returns: boolean;
      };
      is_member_of: {
        Args: { _condominio_id: string; _user_id: string };
        Returns: boolean;
      };
      is_morador_da_unidade: {
        Args: { _unidade_id: string; _user_id: string };
        Returns: boolean;
      };
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean };
      is_sindico: {
        Args: { _condominio_id: string; _user_id: string };
        Returns: boolean;
      };
      join_condominio_by_code: {
        Args: { _codigo: string };
        Returns: {
          condominio_id: string;
          nome: string;
        }[];
      };
      limite_usuarios_plano: {
        Args: { _condominio_id: string };
        Returns: number;
      };
      marcar_encomenda_retirada: {
        Args: { _encomenda_id: string; _retirado_por_nome: string };
        Returns: undefined;
      };
      move_to_dlq: {
        Args: {
          dlq_name: string;
          message_id: number;
          payload: Json;
          source_queue: string;
        };
        Returns: number;
      };
      orcado_x_realizado: {
        Args: { _ate_mes?: number; _orcamento_id: string };
        Returns: Json;
      };
      pode_gerir_financeiro: {
        Args: { _condominio_id: string; _user_id: string };
        Returns: boolean;
      };
      processar_fila_email: { Args: never; Returns: undefined };
      processar_fila_whatsapp: { Args: never; Returns: undefined };
      proprietarios_da_unidade: {
        Args: { _unidade_id: string };
        Returns: {
          nome: string;
          representante: boolean;
          user_id: string;
        }[];
      };
      publicar_balancete: {
        Args: { _balancete_id: string };
        Returns: undefined;
      };
      quotas_do_orcamento: {
        Args: { _orcamento_id: string };
        Returns: {
          bloco: string;
          fracao_ideal: number;
          numero: string;
          quota_mensal: number;
          taxa_actual: number;
          unidade_id: string;
        }[];
      };
      ratear_por_fracao_ideal: {
        Args: { _condominio_id: string; _total: number };
        Returns: {
          unidade_id: string;
          valor: number;
        }[];
      };
      reabrir_balancete: {
        Args: { _balancete_id: string; _motivo?: string };
        Returns: undefined;
      };
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number };
        Returns: {
          message: Json;
          msg_id: number;
          read_ct: number;
        }[];
      };
      realizado_por_categoria: {
        Args: { _ano: number; _condominio_id: string };
        Returns: Json;
      };
      recusar_reserva: {
        Args: { _motivo: string; _reserva_id: string };
        Returns: undefined;
      };
      recusar_visitante: {
        Args: { _motivo: string; _visitante_id: string };
        Returns: undefined;
      };
      registrar_advertencia: {
        Args: {
          _condominio_id: string;
          _data_ocorrencia: string;
          _descricao: string;
          _local?: string;
          _unidade_id: string;
        };
        Returns: string;
      };
      registrar_encomenda: {
        Args: {
          _codigo_rastreio: string;
          _descricao: string;
          _foto_url: string;
          _local_armazenamento: string;
          _observacoes: string;
          _remetente: string;
          _transportadora: string;
          _unidade_id: string;
        };
        Returns: string;
      };
      registrar_entrada_visitante: {
        Args: { _visitante_id: string };
        Returns: undefined;
      };
      registrar_indices: {
        Args: { _dados: Json };
        Returns: number;
      };
      registrar_pagamento_manual: {
        Args: {
          _cobranca_id: string;
          _forma: Database["public"]["Enums"]["forma_pagamento"];
          _observacoes: string;
          _pago_em: string;
          _valor: number;
        };
        Returns: string;
      };
      registrar_saida_visitante: {
        Args: { _visitante_id: string };
        Returns: undefined;
      };
      registrar_visitante: {
        Args: {
          _documento: string;
          _empresa: string;
          _foto_url: string;
          _nome: string;
          _observacoes: string;
          _placa_veiculo: string;
          _pre_autorizar: boolean;
          _tipo: Database["public"]["Enums"]["visitante_tipo"];
          _unidade_id: string;
          _valido_ate: string;
        };
        Returns: string;
      };
      registrar_voto: {
        Args: {
          _opcao: Database["public"]["Enums"]["voto_opcao"];
          _pauta_id: string;
          _unidade_id: string;
        };
        Returns: undefined;
      };
      reincidencia_da_unidade: {
        Args: { _unidade_id: string };
        Returns: Json;
      };
      relatorio_inadimplencia: {
        Args: { _condominio_id: string };
        Returns: {
          bloco: string;
          cobrancas: number;
          dias_atraso_max: number;
          juros: number;
          multa: number;
          numero: string;
          principal: number;
          total: number;
          unidade_id: string;
          vencimento_mais_antigo: string;
        }[];
      };
      remover_pauta: { Args: { _pauta_id: string }; Returns: undefined };
      rescindir_acordo: {
        Args: { _acordo_id: string; _motivo?: string };
        Returns: string;
      };
      resumo_orcamento: {
        Args: { _orcamento_id: string };
        Returns: Json;
      };
      simular_acordo: {
        Args: {
          _cobranca_ids: string[];
          _condominio_id: string;
          _desconto: number;
          _entrada: number;
          _num_parcelas: number;
          _primeiro_vencimento: string;
          _unidade_id: string;
        };
        Returns: Json;
      };
      solicitar_reserva: {
        Args: {
          _area_id: string;
          _fim: string;
          _inicio: string;
          _num_convidados: number;
          _observacoes: string;
          _unidade_id: string;
        };
        Returns: string;
      };
      unidade_inadimplente: {
        Args: { _referencia?: string; _unidade_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      acordo_status: "ativo" | "quitado" | "rescindido" | "cancelado";
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
        | "consulta";
      assembleia_modo: "virtual" | "presencial" | "hibrida";
      assembleia_status: "rascunho" | "convocada" | "em_curso" | "encerrada" | "cancelada";
      assembleia_tipo: "ordinaria" | "extraordinaria";
      balancete_status: "rascunho" | "publicado";
      certidao_tipo: "nada_consta";
      cnab_banco: "sicoob" | "itau" | "bradesco" | "bb" | "caixa" | "santander" | "generico";
      cnab_evento_tipo: "liquidacao" | "baixa" | "rejeicao" | "protesto" | "outros";
      cnab_remessa_status: "gerada" | "enviada" | "processada" | "erro";
      cobranca_status: "pendente" | "paga" | "vencida" | "cancelada" | "parcial" | "em_acordo";
      convite_status: "pendente" | "aceito" | "expirado" | "cancelado";
      documento_categoria:
        | "convencao"
        | "regimento"
        | "ata"
        | "comunicado"
        | "informativo"
        | "contrato"
        | "financeiro"
        | "outros";
      encomenda_status: "aguardando" | "retirada" | "devolvida";
      forma_pagamento: "pix" | "boleto" | "dinheiro" | "transferencia" | "cartao" | "outro";
      indice_reajuste: "ipca" | "inpc" | "igpm" | "incc" | "cct" | "tarifa" | "manual" | "nenhum";
      infracao_base: "convencao" | "art_1336_p2" | "art_1337_caput" | "art_1337_unico";
      infracao_status: "vigente" | "cancelada";
      infracao_tipo: "advertencia" | "multa";
      maioria_tipo:
        | "maioria_presentes"
        | "maioria_condominos"
        | "dois_tercos_condominos"
        | "tres_quartos_condominos"
        | "unanimidade";
      ocorrencia_categoria:
        | "manutencao"
        | "barulho"
        | "seguranca"
        | "limpeza"
        | "area_comum"
        | "infraestrutura"
        | "outros";
      ocorrencia_prioridade: "baixa" | "media" | "alta" | "urgente";
      ocorrencia_status:
        "aberta" | "em_andamento" | "aguardando_morador" | "resolvida" | "fechada" | "cancelada";
      orcamento_status: "rascunho" | "aprovado";
      plano_tipo: "basico" | "profissional" | "admin" | "enterprise";
      reserva_status: "pendente" | "confirmada" | "recusada" | "cancelada" | "concluida";
      tipo_lancamento: "receita" | "despesa";
      vinculo_tipo: "proprietario" | "inquilino" | "familiar";
      visitante_status: "aguardando" | "autorizado" | "recusado" | "dentro" | "saiu" | "expirado";
      visitante_tipo: "visita" | "prestador" | "delivery" | "mudanca" | "outro";
      voto_opcao: "sim" | "nao" | "abstencao";
      wa_direcao: "entrada" | "saida";
      wa_intent:
        | "menu"
        | "segunda_via_boleto"
        | "status_reserva"
        | "abrir_ocorrencia"
        | "confirmar_visitante"
        | "desconhecido";
      wa_job_status: "pendente" | "enviando" | "enviado" | "falha" | "desistido";
      wa_msg_status: "pendente" | "enviada" | "entregue" | "lida" | "falha" | "recebida";
      wa_msg_tipo: "texto" | "template" | "interativo" | "midia" | "localizacao" | "sistema";
      wa_status: "pendente" | "enviado" | "falhou";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      acordo_status: ["ativo", "quitado", "rescindido", "cancelado"],
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
      assembleia_modo: ["virtual", "presencial", "hibrida"],
      assembleia_status: ["rascunho", "convocada", "em_curso", "encerrada", "cancelada"],
      assembleia_tipo: ["ordinaria", "extraordinaria"],
      balancete_status: ["rascunho", "publicado"],
      cnab_banco: ["sicoob", "itau", "bradesco", "bb", "caixa", "santander", "generico"],
      cnab_evento_tipo: ["liquidacao", "baixa", "rejeicao", "protesto", "outros"],
      cnab_remessa_status: ["gerada", "enviada", "processada", "erro"],
      cobranca_status: ["pendente", "paga", "vencida", "cancelada", "parcial", "em_acordo"],
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
      forma_pagamento: ["pix", "boleto", "dinheiro", "transferencia", "cartao", "outro"],
      maioria_tipo: [
        "maioria_presentes",
        "maioria_condominos",
        "dois_tercos_condominos",
        "tres_quartos_condominos",
        "unanimidade",
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
      reserva_status: ["pendente", "confirmada", "recusada", "cancelada", "concluida"],
      tipo_lancamento: ["receita", "despesa"],
      vinculo_tipo: ["proprietario", "inquilino", "familiar"],
      visitante_status: ["aguardando", "autorizado", "recusado", "dentro", "saiu", "expirado"],
      visitante_tipo: ["visita", "prestador", "delivery", "mudanca", "outro"],
      voto_opcao: ["sim", "nao", "abstencao"],
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
      wa_msg_status: ["pendente", "enviada", "entregue", "lida", "falha", "recebida"],
      wa_msg_tipo: ["texto", "template", "interativo", "midia", "localizacao", "sistema"],
      wa_status: ["pendente", "enviado", "falhou"],
    },
  },
} as const;
