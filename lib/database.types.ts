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
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_import_runs: {
        Row: {
          case_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          file_name: string
          file_sha256: string
          id: string
          model: string
          organization_id: string
          prompt_sha256: string
          proposal_id: string
          proposal_version_id: string
          provider: string
          response_id: string | null
          service_count: number
          started_at: string
          status: string
          warnings: Json
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          file_name: string
          file_sha256: string
          id?: string
          model: string
          organization_id: string
          prompt_sha256: string
          proposal_id: string
          proposal_version_id: string
          provider?: string
          response_id?: string | null
          service_count?: number
          started_at?: string
          status?: string
          warnings?: Json
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          file_name?: string
          file_sha256?: string
          id?: string
          model?: string
          organization_id?: string
          prompt_sha256?: string
          proposal_id?: string
          proposal_version_id?: string
          provider?: string
          response_id?: string | null
          service_count?: number
          started_at?: string
          status?: string
          warnings?: Json
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          case_id: string
          created_at: string
          error: string | null
          executed_at: string
          id: string
          occurrence_key: string
          organization_id: string
          result: Json
          rule_id: string
          status: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          error?: string | null
          executed_at?: string
          id?: string
          occurrence_key: string
          organization_id: string
          result?: Json
          rule_id: string
          status: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          error?: string | null
          executed_at?: string
          id?: string
          occurrence_key?: string
          organization_id?: string
          result?: Json
          rule_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          name: string
          organization_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name: string
          organization_id: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name?: string
          organization_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_documents: {
        Row: {
          amount: number | null
          case_id: string
          client_id: string | null
          created_at: string
          currency: string
          document_number: string | null
          document_type: string
          external_document_id: string | null
          holded_document_id: string | null
          id: string
          idempotency_key: string | null
          issued_at: string | null
          last_synced_at: string | null
          notes: string | null
          organization_id: string
          status: string
          sync_message: string | null
          sync_status: Database["public"]["Enums"]["sync_status"]
          tax_amount: number
          trigger: string
          trigger_name: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          case_id: string
          client_id?: string | null
          created_at?: string
          currency?: string
          document_number?: string | null
          document_type: string
          external_document_id?: string | null
          holded_document_id?: string | null
          id?: string
          idempotency_key?: string | null
          issued_at?: string | null
          last_synced_at?: string | null
          notes?: string | null
          organization_id: string
          status?: string
          sync_message?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"]
          tax_amount?: number
          trigger: string
          trigger_name?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          case_id?: string
          client_id?: string | null
          created_at?: string
          currency?: string
          document_number?: string | null
          document_type?: string
          external_document_id?: string | null
          holded_document_id?: string | null
          id?: string
          idempotency_key?: string | null
          issued_at?: string | null
          last_synced_at?: string | null
          notes?: string | null
          organization_id?: string
          status?: string
          sync_message?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"]
          tax_amount?: number
          trigger?: string
          trigger_name?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          client_id: string | null
          created_at: string
          ends_at: string | null
          event_timestamp: string
          event_type: string
          external_booking_id: string
          external_id: string | null
          id: string
          lead_id: string | null
          organization_id: string
          payload: Json
          possible_duplicate_client_id: string | null
          source: string
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          ends_at?: string | null
          event_timestamp?: string
          event_type: string
          external_booking_id: string
          external_id?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          payload?: Json
          possible_duplicate_client_id?: string | null
          source?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          ends_at?: string | null
          event_timestamp?: string
          event_type?: string
          external_booking_id?: string
          external_id?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          payload?: Json
          possible_duplicate_client_id?: string | null
          source?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_possible_duplicate_client_id_fkey"
            columns: ["possible_duplicate_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean
          cost_budget: number
          cost_real: number | null
          cost_real_approved_at: string | null
          cost_real_approved_by: string | null
          cost_real_source: string | null
          created_at: string
          creates_expected_purchase: boolean
          description_internal: string | null
          description_public: string
          destination_segment: string | null
          end_date: string | null
          expected_purchase_id: string | null
          formula_version_id: string | null
          id: string
          included: boolean
          manual_real_cost_reason: string | null
          margin_applied: number
          margin_rule_id: string | null
          margin_snapshot: Json
          organization_id: string
          origin_margin: string
          proposal_version_id: string
          requirement_level: string
          sale_price: number
          service_type_code: string | null
          service_type_id: string | null
          sort_order: number
          stable_line_id: string
          start_date: string | null
          source_reference: string | null
          supplier_id: string | null
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean
          cost_budget?: number
          cost_real?: number | null
          cost_real_approved_at?: string | null
          cost_real_approved_by?: string | null
          cost_real_source?: string | null
          created_at?: string
          creates_expected_purchase?: boolean
          description_internal?: string | null
          description_public: string
          destination_segment?: string | null
          end_date?: string | null
          expected_purchase_id?: string | null
          formula_version_id?: string | null
          id?: string
          included?: boolean
          manual_real_cost_reason?: string | null
          margin_applied?: number
          margin_rule_id?: string | null
          margin_snapshot?: Json
          organization_id: string
          origin_margin?: string
          proposal_version_id: string
          requirement_level?: string
          sale_price?: number
          service_type_code?: string | null
          service_type_id?: string | null
          sort_order?: number
          stable_line_id?: string
          start_date?: string | null
          source_reference?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean
          cost_budget?: number
          cost_real?: number | null
          cost_real_approved_at?: string | null
          cost_real_approved_by?: string | null
          cost_real_source?: string | null
          created_at?: string
          creates_expected_purchase?: boolean
          description_internal?: string | null
          description_public?: string
          destination_segment?: string | null
          end_date?: string | null
          expected_purchase_id?: string | null
          formula_version_id?: string | null
          id?: string
          included?: boolean
          manual_real_cost_reason?: string | null
          margin_applied?: number
          margin_rule_id?: string | null
          margin_snapshot?: Json
          organization_id?: string
          origin_margin?: string
          proposal_version_id?: string
          requirement_level?: string
          sale_price?: number
          service_type_code?: string | null
          service_type_id?: string | null
          sort_order?: number
          stable_line_id?: string
          start_date?: string | null
          source_reference?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_expected_purchase_fk"
            columns: ["expected_purchase_id"]
            isOneToOne: false
            referencedRelation: "expected_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_margin_rule_id_fkey"
            columns: ["margin_rule_id"]
            isOneToOne: false
            referencedRelation: "margin_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_proposal_version_id_fkey"
            columns: ["proposal_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      case_sequences: {
        Row: {
          last_value: number
          organization_id: string
          updated_at: string
          year: number
        }
        Insert: {
          last_value?: number
          organization_id: string
          updated_at?: string
          year: number
        }
        Update: {
          last_value?: number
          organization_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_stage_events: {
        Row: {
          case_id: string
          changed_by: string | null
          entered_at: string
          from_status: string | null
          id: string
          metadata: Json
          organization_id: string
          source: string
          to_status: string
        }
        Insert: {
          case_id: string
          changed_by?: string | null
          entered_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          source?: string
          to_status: string
        }
        Update: {
          case_id?: string
          changed_by?: string | null
          entered_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          source?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_stage_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          accepted_value: number | null
          billing_status: string
          blocker: string | null
          case_code: string
          client_id: string
          close_blockers: Json
          closed_at: string | null
          closure_check_at: string | null
          created_at: string
          currency: string
          destination: string | null
          final_notes: string | null
          fiscal_resolution_at: string | null
          fiscal_resolution_notes: string | null
          fiscal_resolution_status: string
          holded_project_id: string | null
          id: string
          last_activity_at: string
          last_event_at: string
          lead_id: string | null
          next_action: string | null
          next_action_at: string | null
          operational_closed_at: string | null
          organization_id: string
          priority: string
          purchase_status: string
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["case_status"]
          title: string
          trip_end: string | null
          trip_start: string | null
          updated_at: string
        }
        Insert: {
          accepted_value?: number | null
          billing_status?: string
          blocker?: string | null
          case_code: string
          client_id: string
          close_blockers?: Json
          closed_at?: string | null
          closure_check_at?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          final_notes?: string | null
          fiscal_resolution_at?: string | null
          fiscal_resolution_notes?: string | null
          fiscal_resolution_status?: string
          holded_project_id?: string | null
          id?: string
          last_activity_at?: string
          last_event_at?: string
          lead_id?: string | null
          next_action?: string | null
          next_action_at?: string | null
          operational_closed_at?: string | null
          organization_id: string
          priority?: string
          purchase_status?: string
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          title: string
          trip_end?: string | null
          trip_start?: string | null
          updated_at?: string
        }
        Update: {
          accepted_value?: number | null
          billing_status?: string
          blocker?: string | null
          case_code?: string
          client_id?: string
          close_blockers?: Json
          closed_at?: string | null
          closure_check_at?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          final_notes?: string | null
          fiscal_resolution_at?: string | null
          fiscal_resolution_notes?: string | null
          fiscal_resolution_status?: string
          holded_project_id?: string | null
          id?: string
          last_activity_at?: string
          last_event_at?: string
          lead_id?: string | null
          next_action?: string | null
          next_action_at?: string | null
          operational_closed_at?: string | null
          organization_id?: string
          priority?: string
          purchase_status?: string
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          title?: string
          trip_end?: string | null
          trip_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_address: Json
          billing_email: string | null
          billing_name: string | null
          client_type: string
          company_name: string | null
          country: string | null
          created_at: string
          display_name: string
          email: string | null
          email_normalized: string | null
          first_name: string | null
          fiscal_data_approved_at: string | null
          fiscal_data_approved_by: string | null
          holded_contact_id: string | null
          holded_last_synced_at: string | null
          holded_sync_error: string | null
          holded_sync_status: string
          id: string
          language: string | null
          last_contact_at: string | null
          last_name: string | null
          lifetime_value: number
          next_opportunity_at: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          phone_normalized: string | null
          preferred_contact_channel: string
          profile_updated_at: string | null
          relationship_status: string
          responsible_user_id: string | null
          risk_level: string
          segment: string
          source: string | null
          tags: string[]
          tax_country: string | null
          tax_id: string | null
          travel_preferences: Json
          updated_at: string
        }
        Insert: {
          billing_address?: Json
          billing_email?: string | null
          billing_name?: string | null
          client_type?: string
          company_name?: string | null
          country?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          email_normalized?: string | null
          first_name?: string | null
          fiscal_data_approved_at?: string | null
          fiscal_data_approved_by?: string | null
          holded_contact_id?: string | null
          holded_last_synced_at?: string | null
          holded_sync_error?: string | null
          holded_sync_status?: string
          id?: string
          language?: string | null
          last_contact_at?: string | null
          last_name?: string | null
          lifetime_value?: number
          next_opportunity_at?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          phone_normalized?: string | null
          preferred_contact_channel?: string
          profile_updated_at?: string | null
          relationship_status?: string
          responsible_user_id?: string | null
          risk_level?: string
          segment?: string
          source?: string | null
          tags?: string[]
          tax_country?: string | null
          tax_id?: string | null
          travel_preferences?: Json
          updated_at?: string
        }
        Update: {
          billing_address?: Json
          billing_email?: string | null
          billing_name?: string | null
          client_type?: string
          company_name?: string | null
          country?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          email_normalized?: string | null
          first_name?: string | null
          fiscal_data_approved_at?: string | null
          fiscal_data_approved_by?: string | null
          holded_contact_id?: string | null
          holded_last_synced_at?: string | null
          holded_sync_error?: string | null
          holded_sync_status?: string
          id?: string
          language?: string | null
          last_contact_at?: string | null
          last_name?: string | null
          lifetime_value?: number
          next_opportunity_at?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          phone_normalized?: string | null
          preferred_contact_channel?: string
          profile_updated_at?: string | null
          relationship_status?: string
          responsible_user_id?: string | null
          risk_level?: string
          segment?: string
          source?: string | null
          tags?: string[]
          tax_country?: string | null
          tax_id?: string | null
          travel_preferences?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      communication_followups: {
        Row: {
          answered_at: string | null
          body: string
          cancelled_at: string | null
          case_id: string | null
          channel: string
          client_id: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          due_at: string
          failed_at: string | null
          id: string
          idempotency_key: string
          kind: string
          metadata: Json
          next_followup_at: string | null
          organization_id: string
          proposal_id: string | null
          provider: string | null
          provider_error: string | null
          provider_message_id: string | null
          provider_status: string | null
          purchase_id: string | null
          read_at: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          sent_at: string | null
          sequence_step: number
          status: string
          subject: string | null
          supplier_id: string | null
          task_id: string | null
          template_id: string | null
          thread_key: string
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          body: string
          cancelled_at?: string | null
          case_id?: string | null
          channel: string
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          due_at: string
          failed_at?: string | null
          id?: string
          idempotency_key: string
          kind: string
          metadata?: Json
          next_followup_at?: string | null
          organization_id: string
          proposal_id?: string | null
          provider?: string | null
          provider_error?: string | null
          provider_message_id?: string | null
          provider_status?: string | null
          purchase_id?: string | null
          read_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          sequence_step?: number
          status?: string
          subject?: string | null
          supplier_id?: string | null
          task_id?: string | null
          template_id?: string | null
          thread_key: string
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          body?: string
          cancelled_at?: string | null
          case_id?: string | null
          channel?: string
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          due_at?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          metadata?: Json
          next_followup_at?: string | null
          organization_id?: string
          proposal_id?: string | null
          provider?: string | null
          provider_error?: string | null
          provider_message_id?: string | null
          provider_status?: string | null
          purchase_id?: string | null
          read_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          sequence_step?: number
          status?: string
          subject?: string | null
          supplier_id?: string | null
          task_id?: string | null
          template_id?: string | null
          thread_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_followups_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_followups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_followups_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_followups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_followups_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_followups_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "expected_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_followups_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_followups_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_followups_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          active: boolean
          audience: string
          body_template: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          key: string
          name: string
          organization_id: string
          subject_template: string | null
          system_template: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience: string
          body_template: string
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          key: string
          name: string
          organization_id: string
          subject_template?: string | null
          system_template?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          body_template?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string
          name?: string
          organization_id?: string
          subject_template?: string | null
          system_template?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_versions: {
        Row: {
          case_id: string
          content_snapshot: Json
          contract_id: string
          created_at: string
          created_by: string | null
          document_id: string | null
          id: string
          legal_document_id: string | null
          legal_version: string
          locked_at: string | null
          organization_id: string
          proposal_version_id: string
          status: string
          version_number: number
        }
        Insert: {
          case_id: string
          content_snapshot?: Json
          contract_id: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          legal_document_id?: string | null
          legal_version: string
          locked_at?: string | null
          organization_id: string
          proposal_version_id: string
          status?: string
          version_number: number
        }
        Update: {
          case_id?: string
          content_snapshot?: Json
          contract_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          legal_document_id?: string | null
          legal_version?: string
          locked_at?: string | null
          organization_id?: string
          proposal_version_id?: string
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_versions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_legal_document_id_fkey"
            columns: ["legal_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_proposal_version_id_fkey"
            columns: ["proposal_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          case_id: string
          created_at: string
          current_version_id: string | null
          external_url: string | null
          id: string
          legal_document_id: string | null
          legal_version: string | null
          notes: string | null
          organization_id: string
          proposal_version_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_client_at: string | null
          signature_ip_hash: string | null
          signature_user_agent: string | null
          signed_at: string | null
          signed_by_email: string | null
          signed_by_name: string | null
          signing_token_expires_at: string | null
          signing_token_hash: string | null
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          case_id: string
          created_at?: string
          current_version_id?: string | null
          external_url?: string | null
          id?: string
          legal_document_id?: string | null
          legal_version?: string | null
          notes?: string | null
          organization_id: string
          proposal_version_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_client_at?: string | null
          signature_ip_hash?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signed_by_email?: string | null
          signed_by_name?: string | null
          signing_token_expires_at?: string | null
          signing_token_hash?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          case_id?: string
          created_at?: string
          current_version_id?: string | null
          external_url?: string | null
          id?: string
          legal_document_id?: string | null
          legal_version?: string | null
          notes?: string | null
          organization_id?: string
          proposal_version_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_client_at?: string | null
          signature_ip_hash?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signed_by_email?: string | null
          signed_by_name?: string | null
          signing_token_expires_at?: string | null
          signing_token_hash?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "contract_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_legal_document_id_fkey"
            columns: ["legal_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_version_id_fkey"
            columns: ["proposal_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          entity_type: string
          field_type: string
          id: string
          key: string
          label: string
          options: Json
          organization_id: string
          required: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          entity_type: string
          field_type: string
          id?: string
          key: string
          label: string
          options?: Json
          organization_id: string
          required?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          entity_type?: string
          field_type?: string
          id?: string
          key?: string
          label?: string
          options?: Json
          organization_id?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          created_at: string
          created_by: string | null
          definition_id: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          updated_at: string
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition_id: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_log: {
        Row: {
          action: string
          actor_id: string | null
          case_id: string | null
          created_at: string
          document_id: string | null
          expires_at: string | null
          id: string
          organization_id: string
          purpose: string
          storage_path: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          case_id?: string | null
          created_at?: string
          document_id?: string | null
          expires_at?: string | null
          id?: string
          organization_id: string
          purpose: string
          storage_path?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          case_id?: string | null
          created_at?: string
          document_id?: string | null
          expires_at?: string | null
          id?: string
          organization_id?: string
          purpose?: string
          storage_path?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          access_purpose: string | null
          bucket: string | null
          case_id: string | null
          checksum: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_type: string
          file_name: string | null
          id: string
          mime_type: string | null
          ocr_status: string
          organization_id: string
          owner_id: string | null
          owner_type: string
          purge_after: string | null
          purged_at: string | null
          required: boolean
          retention_until: string | null
          scan_status: string
          sensitivity: string
          size_bytes: number | null
          status: string
          storage_bucket: string
          storage_path: string
          temporary: boolean
          title: string | null
          type: string | null
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          access_purpose?: string | null
          bucket?: string | null
          case_id?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_type?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          ocr_status?: string
          organization_id: string
          owner_id?: string | null
          owner_type: string
          purge_after?: string | null
          purged_at?: string | null
          required?: boolean
          retention_until?: string | null
          scan_status?: string
          sensitivity?: string
          size_bytes?: number | null
          status?: string
          storage_bucket?: string
          storage_path: string
          temporary?: boolean
          title?: string | null
          type?: string | null
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          access_purpose?: string | null
          bucket?: string | null
          case_id?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_type?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          ocr_status?: string
          organization_id?: string
          owner_id?: string | null
          owner_type?: string
          purge_after?: string | null
          purged_at?: string | null
          required?: boolean
          retention_until?: string | null
          scan_status?: string
          sensitivity?: string
          size_bytes?: number | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          temporary?: boolean
          title?: string | null
          type?: string | null
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expected_purchases: {
        Row: {
          active: boolean
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          approved_cost: number | null
          budget_line_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          case_id: string | null
          created_at: string
          currency: string
          due_date: string | null
          expected_amount: number | null
          holded_purchase_id: string | null
          id: string
          invoice_base: number | null
          invoice_date: string | null
          invoice_number: string | null
          invoice_tax: number | null
          invoice_total: number | null
          last_synced_at: string | null
          match_checks: Json
          match_score: number | null
          matched_at: string | null
          matched_by: string | null
          not_required_at: string | null
          not_required_by: string | null
          not_required_reason: string | null
          organization_id: string
          proposal_version_id: string | null
          provider_hash: string | null
          requested_at: string | null
          requested_by: string | null
          required: boolean
          review_notes: string | null
          service: string | null
          status: Database["public"]["Enums"]["expected_purchase_status"]
          supplier_id: string | null
          supplier_name: string | null
          sync_error: string | null
          sync_status: string
          updated_at: string
          uploaded_at: string | null
        }
        Insert: {
          active?: boolean
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_cost?: number | null
          budget_line_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          case_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          expected_amount?: number | null
          holded_purchase_id?: string | null
          id?: string
          invoice_base?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_tax?: number | null
          invoice_total?: number | null
          last_synced_at?: string | null
          match_checks?: Json
          match_score?: number | null
          matched_at?: string | null
          matched_by?: string | null
          not_required_at?: string | null
          not_required_by?: string | null
          not_required_reason?: string | null
          organization_id: string
          proposal_version_id?: string | null
          provider_hash?: string | null
          requested_at?: string | null
          requested_by?: string | null
          required?: boolean
          review_notes?: string | null
          service?: string | null
          status?: Database["public"]["Enums"]["expected_purchase_status"]
          supplier_id?: string | null
          supplier_name?: string | null
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Update: {
          active?: boolean
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_cost?: number | null
          budget_line_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          case_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          expected_amount?: number | null
          holded_purchase_id?: string | null
          id?: string
          invoice_base?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_tax?: number | null
          invoice_total?: number | null
          last_synced_at?: string | null
          match_checks?: Json
          match_score?: number | null
          matched_at?: string | null
          matched_by?: string | null
          not_required_at?: string | null
          not_required_by?: string | null
          not_required_reason?: string | null
          organization_id?: string
          proposal_version_id?: string | null
          provider_hash?: string | null
          requested_at?: string | null
          requested_by?: string | null
          required?: boolean
          review_notes?: string | null
          service?: string | null
          status?: Database["public"]["Enums"]["expected_purchase_status"]
          supplier_id?: string | null
          supplier_name?: string | null
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expected_purchases_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expected_purchases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expected_purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expected_purchases_proposal_version_id_fkey"
            columns: ["proposal_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expected_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          amount: number
          case_id: string
          client_id: string | null
          created_at: string
          currency: string
          document_kind: string
          document_number: string | null
          external_id: string | null
          id: string
          issued_at: string | null
          notes: string | null
          organization_id: string
          status: string
          tax_amount: number
          updated_at: string
        }
        Insert: {
          amount?: number
          case_id: string
          client_id?: string | null
          created_at?: string
          currency?: string
          document_kind?: string
          document_number?: string | null
          external_id?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          organization_id: string
          status?: string
          tax_amount?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          case_id?: string
          client_id?: string | null
          created_at?: string
          currency?: string
          document_kind?: string
          document_number?: string | null
          external_id?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          organization_id?: string
          status?: string
          tax_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_versions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          definition: Json
          formula: string
          id: string
          organization_id: string
          rounding_scale: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          definition?: Json
          formula?: string
          id?: string
          organization_id: string
          rounding_scale?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          definition?: Json
          formula?: string
          id?: string
          organization_id?: string
          rounding_scale?: number
        }
        Relationships: [
          {
            foreignKeyName: "formula_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      holded_sync: {
        Row: {
          attempts: number
          created_at: string
          entity_type: string
          holded_entity_id: string | null
          holded_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          last_synced_at: string | null
          local_id: string | null
          metadata: Json
          organization_id: string
          payload_hash: string | null
          sync_status: string
          trigger: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          entity_type: string
          holded_entity_id?: string | null
          holded_type: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          last_synced_at?: string | null
          local_id?: string | null
          metadata?: Json
          organization_id: string
          payload_hash?: string | null
          sync_status?: string
          trigger: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          entity_type?: string
          holded_entity_id?: string | null
          holded_type?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          last_synced_at?: string | null
          local_id?: string | null
          metadata?: Json
          organization_id?: string
          payload_hash?: string | null
          sync_status?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holded_sync_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_outbox: {
        Row: {
          attempts: number
          business_rule: string | null
          channel: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          last_error: string | null
          last_synced_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_action: string | null
          next_attempt_at: string | null
          organization_id: string
          payload: Json
          processed_at: string | null
          provider: string
          related_case_id: string | null
          risk: string
          status: string
          sync_status: Database["public"]["Enums"]["sync_status"]
        }
        Insert: {
          attempts?: number
          business_rule?: string | null
          channel?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type: string
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_action?: string | null
          next_attempt_at?: string | null
          organization_id: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          related_case_id?: string | null
          risk?: string
          status?: string
          sync_status?: Database["public"]["Enums"]["sync_status"]
        }
        Update: {
          attempts?: number
          business_rule?: string | null
          channel?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_action?: string | null
          next_attempt_at?: string | null
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          related_case_id?: string | null
          risk?: string
          status?: string
          sync_status?: Database["public"]["Enums"]["sync_status"]
        }
        Relationships: [
          {
            foreignKeyName: "integration_outbox_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_runs: {
        Row: {
          attempts: number
          created_at: string
          duration_ms: number | null
          finished_at: string | null
          id: string
          integration: string
          kind: string
          last_error: string | null
          metadata: Json
          organization_id: string | null
          started_at: string
          status: string
          summary: string | null
          trigger_source: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          integration: string
          kind?: string
          last_error?: string | null
          metadata?: Json
          organization_id?: string | null
          started_at?: string
          status?: string
          summary?: string | null
          trigger_source?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          integration?: string
          kind?: string
          last_error?: string | null
          metadata?: Json
          organization_id?: string | null
          started_at?: string
          status?: string
          summary?: string | null
          trigger_source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          activated_at: string | null
          archived_at: string | null
          checksum: string | null
          created_at: string
          document_type: string
          file_name: string
          id: string
          is_active: boolean
          is_test: boolean
          mime_type: string
          organization_id: string
          size_bytes: number
          status: string
          storage_bucket: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
          version_label: string
        }
        Insert: {
          activated_at?: string | null
          archived_at?: string | null
          checksum?: string | null
          created_at?: string
          document_type: string
          file_name: string
          id?: string
          is_active?: boolean
          is_test?: boolean
          mime_type?: string
          organization_id: string
          size_bytes: number
          status?: string
          storage_bucket?: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          version_label: string
        }
        Update: {
          activated_at?: string | null
          archived_at?: string | null
          checksum?: string | null
          created_at?: string
          document_type?: string
          file_name?: string
          id?: string
          is_active?: boolean
          is_test?: boolean
          mime_type?: string
          organization_id?: string
          size_bytes?: number
          status?: string
          storage_bucket?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived_at: string | null
          booking_id: string | null
          booking_invite_sent_at: string | null
          budget_hint: number | null
          call_booked_at: string | null
          campaign: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          destination: string | null
          email: string | null
          email_normalized: string | null
          form_received_at: string | null
          form_reminder_sent_at: string | null
          form_submission_id: string | null
          id: string
          organization_id: string
          outcome: string
          payload_hash: string | null
          payload_redacted: Json
          phone: string | null
          phone_normalized: string | null
          possible_duplicate_client_id: string | null
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          source_submission_id: string | null
          status: string
          travel_end: string | null
          travel_start: string | null
          travelers: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          booking_id?: string | null
          booking_invite_sent_at?: string | null
          budget_hint?: number | null
          call_booked_at?: string | null
          campaign?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          destination?: string | null
          email?: string | null
          email_normalized?: string | null
          form_received_at?: string | null
          form_reminder_sent_at?: string | null
          form_submission_id?: string | null
          id?: string
          organization_id: string
          outcome?: string
          payload_hash?: string | null
          payload_redacted?: Json
          phone?: string | null
          phone_normalized?: string | null
          possible_duplicate_client_id?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_submission_id?: string | null
          status?: string
          travel_end?: string | null
          travel_start?: string | null
          travelers?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          booking_id?: string | null
          booking_invite_sent_at?: string | null
          budget_hint?: number | null
          call_booked_at?: string | null
          campaign?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          destination?: string | null
          email?: string | null
          email_normalized?: string | null
          form_received_at?: string | null
          form_reminder_sent_at?: string | null
          form_submission_id?: string | null
          id?: string
          organization_id?: string
          outcome?: string
          payload_hash?: string | null
          payload_redacted?: Json
          phone?: string | null
          phone_normalized?: string | null
          possible_duplicate_client_id?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_submission_id?: string | null
          status?: string
          travel_end?: string | null
          travel_start?: string | null
          travelers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_possible_duplicate_client_id_fkey"
            columns: ["possible_duplicate_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      margin_rules: {
        Row: {
          active: boolean
          created_at: string
          destination: string | null
          formula: string
          id: string
          minimum_margin: number
          name: string
          organization_id: string
          priority: number
          service_type_code: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          destination?: string | null
          formula?: string
          id?: string
          minimum_margin?: number
          name?: string
          organization_id: string
          priority?: number
          service_type_code?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          destination?: string | null
          formula?: string
          id?: string
          minimum_margin?: number
          name?: string
          organization_id?: string
          priority?: number
          service_type_code?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "margin_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_rules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_receipts: {
        Row: {
          created_at: string
          dismissed_at: string | null
          id: string
          notification_key: string
          organization_id: string
          read_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          notification_key: string
          organization_id: string
          read_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          notification_key?: string
          organization_id?: string
          read_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_fields: {
        Row: {
          confidence: number
          corrected_value: string | null
          created_at: string
          extracted_value: string | null
          field_name: string
          id: string
          ocr_run_id: string
          organization_id: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          confidence?: number
          corrected_value?: string | null
          created_at?: string
          extracted_value?: string | null
          field_name: string
          id?: string
          ocr_run_id: string
          organization_id: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          confidence?: number
          corrected_value?: string | null
          created_at?: string
          extracted_value?: string | null
          field_name?: string
          id?: string
          ocr_run_id?: string
          organization_id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_fields_ocr_run_id_fkey"
            columns: ["ocr_run_id"]
            isOneToOne: false
            referencedRelation: "ocr_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_runs: {
        Row: {
          case_id: string | null
          completed_at: string | null
          confidence_overall: number | null
          created_at: string
          created_by: string | null
          document_id: string
          error: string | null
          id: string
          organization_id: string
          provider: string
          raw_payload_redacted: Json
          reviewed_at: string | null
          reviewed_by: string | null
          started_at: string | null
          status: string
          traveler_id: string | null
        }
        Insert: {
          case_id?: string | null
          completed_at?: string | null
          confidence_overall?: number | null
          created_at?: string
          created_by?: string | null
          document_id: string
          error?: string | null
          id?: string
          organization_id: string
          provider?: string
          raw_payload_redacted?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          traveler_id?: string | null
        }
        Update: {
          case_id?: string | null
          completed_at?: string | null
          confidence_overall?: number | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          error?: string | null
          id?: string
          organization_id?: string
          provider?: string
          raw_payload_redacted?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          traveler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_runs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_runs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_runs_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "travelers"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_secrets: {
        Row: {
          auth_tag: string | null
          ciphertext: string | null
          created_at: string
          iv: string | null
          last_test_message: string | null
          last_test_status: string | null
          last_tested_at: string | null
          organization_id: string
          secret_key: string
          updated_at: string
          updated_by: string | null
          vault_secret_id: string | null
        }
        Insert: {
          auth_tag?: string | null
          ciphertext?: string | null
          created_at?: string
          iv?: string | null
          last_test_message?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          organization_id: string
          secret_key: string
          updated_at?: string
          updated_by?: string | null
          vault_secret_id?: string | null
        }
        Update: {
          auth_tag?: string | null
          ciphertext?: string | null
          created_at?: string
          iv?: string | null
          last_test_message?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          organization_id?: string
          secret_key?: string
          updated_at?: string
          updated_by?: string | null
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_secrets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand_background_color: string
          brand_primary_color: string
          close_margin_days: number
          created_at: string
          fiscal_mode: string
          fiscal_mode_validated_at: string | null
          fiscal_mode_validated_by: string | null
          id: string
          name: string
          privacy_retention_days: number
          slug: string
          supplier_invoice_retention_days: number
          updated_at: string
        }
        Insert: {
          brand_background_color?: string
          brand_primary_color?: string
          close_margin_days?: number
          created_at?: string
          fiscal_mode?: string
          fiscal_mode_validated_at?: string | null
          fiscal_mode_validated_by?: string | null
          id?: string
          name: string
          privacy_retention_days?: number
          slug: string
          supplier_invoice_retention_days?: number
          updated_at?: string
        }
        Update: {
          brand_background_color?: string
          brand_primary_color?: string
          close_margin_days?: number
          created_at?: string
          fiscal_mode?: string
          fiscal_mode_validated_at?: string | null
          fiscal_mode_validated_by?: string | null
          id?: string
          name?: string
          privacy_retention_days?: number
          slug?: string
          supplier_invoice_retention_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          case_id: string
          created_at: string
          event_id: string
          event_type: string
          id: string
          occurred_at: string
          organization_id: string
          payload_redacted: Json
          payment_link_id: string | null
          provider: string
        }
        Insert: {
          case_id: string
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          occurred_at?: string
          organization_id: string
          payload_redacted?: Json
          payment_link_id?: string | null
          provider: string
        }
        Update: {
          case_id?: string
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          occurred_at?: string
          organization_id?: string
          payload_redacted?: Json
          payment_link_id?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          case_id: string
          clicked_at: string | null
          confirmed_at: string | null
          contract_version_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          expires_at: string | null
          external_url: string
          id: string
          organization_id: string
          proposal_version_id: string | null
          provider: string
          sent_at: string | null
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          amount: number
          case_id: string
          clicked_at?: string | null
          confirmed_at?: string | null
          contract_version_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at?: string | null
          external_url: string
          id?: string
          organization_id: string
          proposal_version_id?: string | null
          provider?: string
          sent_at?: string | null
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          amount?: number
          case_id?: string
          clicked_at?: string | null
          confirmed_at?: string | null
          contract_version_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at?: string | null
          external_url?: string
          id?: string
          organization_id?: string
          proposal_version_id?: string | null
          provider?: string
          sent_at?: string | null
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_contract_version_id_fkey"
            columns: ["contract_version_id"]
            isOneToOne: false
            referencedRelation: "contract_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_proposal_version_id_fkey"
            columns: ["proposal_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          case_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          method: string
          organization_id: string
          payload: Json
          payment_link_id: string | null
          payment_reference: string
          provider: string
          received_at: string | null
          reference: string | null
          source: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          case_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          method?: string
          organization_id: string
          payload?: Json
          payment_link_id?: string | null
          payment_reference: string
          provider?: string
          received_at?: string | null
          reference?: string | null
          source?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          case_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          method?: string
          organization_id?: string
          payload?: Json
          payment_link_id?: string | null
          payment_reference?: string
          provider?: string
          received_at?: string | null
          reference?: string | null
          source?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_acceptances: {
        Row: {
          accepted_at: string
          acceptor_email: string | null
          acceptor_name: string
          case_id: string
          id: string
          ip_hash: string | null
          organization_id: string
          proposal_id: string
          proposal_version_id: string
          terms_accepted: boolean
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          acceptor_email?: string | null
          acceptor_name: string
          case_id: string
          id?: string
          ip_hash?: string | null
          organization_id: string
          proposal_id: string
          proposal_version_id: string
          terms_accepted?: boolean
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          acceptor_email?: string | null
          acceptor_name?: string
          case_id?: string
          id?: string
          ip_hash?: string | null
          organization_id?: string
          proposal_id?: string
          proposal_version_id?: string
          terms_accepted?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_acceptances_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_acceptances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_acceptances_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_acceptances_proposal_version_id_fkey"
            columns: ["proposal_version_id"]
            isOneToOne: true
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_versions: {
        Row: {
          accepted_at: string | null
          budgeted_profit: number
          cost_deviation: number
          created_at: string
          expires_at: string | null
          financial_summary_json: Json
          formula_version_id: string | null
          id: string
          locked: boolean
          locked_at: string | null
          margin_rules_snapshot_json: Json
          margin_snapshot: Json
          narrative: Json
          organization_id: string
          proposal_id: string
          real_margin_pct: number
          real_profit: number
          snapshot: Json
          status: Database["public"]["Enums"]["proposal_version_status"]
          terms_snapshot: string | null
          title: string
          total_cost: number
          total_cost_budget: number
          total_cost_real: number
          total_sale: number
          updated_at: string
          version_number: number
        }
        Insert: {
          accepted_at?: string | null
          budgeted_profit?: number
          cost_deviation?: number
          created_at?: string
          expires_at?: string | null
          financial_summary_json?: Json
          formula_version_id?: string | null
          id?: string
          locked?: boolean
          locked_at?: string | null
          margin_rules_snapshot_json?: Json
          margin_snapshot?: Json
          narrative?: Json
          organization_id: string
          proposal_id: string
          real_margin_pct?: number
          real_profit?: number
          snapshot?: Json
          status?: Database["public"]["Enums"]["proposal_version_status"]
          terms_snapshot?: string | null
          title?: string
          total_cost?: number
          total_cost_budget?: number
          total_cost_real?: number
          total_sale?: number
          updated_at?: string
          version_number: number
        }
        Update: {
          accepted_at?: string | null
          budgeted_profit?: number
          cost_deviation?: number
          created_at?: string
          expires_at?: string | null
          financial_summary_json?: Json
          formula_version_id?: string | null
          id?: string
          locked?: boolean
          locked_at?: string | null
          margin_rules_snapshot_json?: Json
          margin_snapshot?: Json
          narrative?: Json
          organization_id?: string
          proposal_id?: string
          real_margin_pct?: number
          real_profit?: number
          snapshot?: Json
          status?: Database["public"]["Enums"]["proposal_version_status"]
          terms_snapshot?: string | null
          title?: string
          total_cost?: number
          total_cost_budget?: number
          total_cost_real?: number
          total_sale?: number
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          case_id: string
          created_at: string
          current_version_id: string | null
          holded_estimate_id: string | null
          id: string
          organization_id: string
          public_token_expires_at: string | null
          public_token_hash: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          current_version_id?: string | null
          holded_estimate_id?: string | null
          id?: string
          organization_id: string
          public_token_expires_at?: string | null
          public_token_hash?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          current_version_id?: string | null
          holded_estimate_id?: string | null
          id?: string
          organization_id?: string
          public_token_expires_at?: string | null
          public_token_hash?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_match_candidates: {
        Row: {
          checks: Json
          created_at: string
          expected_purchase_id: string
          holded_purchase_id: string
          id: string
          organization_id: string
          payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          status: string
          updated_at: string
        }
        Insert: {
          checks?: Json
          created_at?: string
          expected_purchase_id: string
          holded_purchase_id: string
          id?: string
          organization_id: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          status?: string
          updated_at?: string
        }
        Update: {
          checks?: Json
          created_at?: string
          expected_purchase_id?: string
          holded_purchase_id?: string
          id?: string
          organization_id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_match_candidates_expected_purchase_id_fkey"
            columns: ["expected_purchase_id"]
            isOneToOne: false
            referencedRelation: "expected_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_match_candidates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      routsify_settings: {
        Row: {
          affected_modules: string[]
          created_at: string
          default_value: Json | null
          description: string | null
          editable: boolean
          id: string
          key: string
          label: string | null
          module: string
          organization_id: string
          requires_recalculation: boolean
          scope: string | null
          updated_at: string
          updated_by: string | null
          value: Json
          value_type: string | null
        }
        Insert: {
          affected_modules?: string[]
          created_at?: string
          default_value?: Json | null
          description?: string | null
          editable?: boolean
          id?: string
          key: string
          label?: string | null
          module: string
          organization_id: string
          requires_recalculation?: boolean
          scope?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_type?: string | null
        }
        Update: {
          affected_modules?: string[]
          created_at?: string
          default_value?: Json | null
          description?: string | null
          editable?: boolean
          id?: string
          key?: string
          label?: string | null
          module?: string
          organization_id?: string
          requires_recalculation?: boolean
          scope?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_type?: string | null
        }
        Relationships: []
      }
      routsify_settings_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          event_name: string | null
          id: string
          key: string | null
          module: string
          new_value: Json | null
          old_value: Json | null
          organization_id: string
          requires_recalculation: boolean
          setting_key: string | null
        }
        Insert: {
          action?: string
          actor_id?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          key?: string | null
          module: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id: string
          requires_recalculation?: boolean
          setting_key?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          key?: string | null
          module?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string
          requires_recalculation?: boolean
          setting_key?: string | null
        }
        Relationships: []
      }
      saved_views: {
        Row: {
          columns: Json
          created_at: string
          filters: Json
          id: string
          is_default: boolean
          module: string
          name: string
          organization_id: string
          sort: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          module: string
          name: string
          organization_id: string
          sort?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          columns?: Json
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          module?: string
          name?: string
          organization_id?: string
          sort?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_evidence: {
        Row: {
          case_id: string
          contract_id: string
          contract_version_id: string
          evidence: Json
          id: string
          ip_hash: string | null
          organization_id: string
          proposal_version_id: string
          signed_at: string
          signer_email: string | null
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          case_id: string
          contract_id: string
          contract_version_id: string
          evidence?: Json
          id?: string
          ip_hash?: string | null
          organization_id: string
          proposal_version_id: string
          signed_at?: string
          signer_email?: string | null
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          case_id?: string
          contract_id?: string
          contract_version_id?: string
          evidence?: Json
          id?: string
          ip_hash?: string | null
          organization_id?: string
          proposal_version_id?: string
          signed_at?: string
          signer_email?: string | null
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_evidence_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_evidence_contract_version_id_fkey"
            columns: ["contract_version_id"]
            isOneToOne: true
            referencedRelation: "contract_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_evidence_proposal_version_id_fkey"
            columns: ["proposal_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_incidents: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          occurred_at: string
          organization_id: string
          resolved_at: string | null
          severity: string
          status: string
          supplier_id: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          occurred_at?: string
          organization_id: string
          resolved_at?: string | null
          severity?: string
          status?: string
          supplier_id: string
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          occurred_at?: string
          organization_id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          supplier_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_incidents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_incidents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          base_amount: number | null
          checksum: string | null
          created_at: string
          currency: string
          expected_purchase_id: string | null
          file_name: string | null
          holded_purchase_id: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          mime_type: string | null
          organization_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          status: string
          storage_path: string | null
          supplier_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"]
          tax_amount: number | null
          total: number | null
          total_amount: number | null
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number | null
          checksum?: string | null
          created_at?: string
          currency?: string
          expected_purchase_id?: string | null
          file_name?: string | null
          holded_purchase_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          mime_type?: string | null
          organization_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          supplier_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"]
          tax_amount?: number | null
          total?: number | null
          total_amount?: number | null
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number | null
          checksum?: string | null
          created_at?: string
          currency?: string
          expected_purchase_id?: string | null
          file_name?: string | null
          holded_purchase_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          mime_type?: string | null
          organization_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          supplier_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"]
          tax_amount?: number | null
          total?: number | null
          total_amount?: number | null
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_expected_purchase_id_fkey"
            columns: ["expected_purchase_id"]
            isOneToOne: false
            referencedRelation: "expected_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_services: {
        Row: {
          active: boolean
          base_cost: number | null
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          destination: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          supplier_id: string
          tax_rate: number | null
          unit: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          base_cost?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          destination?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          supplier_id: string
          tax_rate?: number | null
          unit?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          base_cost?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          destination?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          supplier_id?: string
          tax_rate?: number | null
          unit?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_services_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          average_rating: number | null
          billing_address: Json
          cancellation_policy: string | null
          category: string | null
          country: string | null
          created_at: string
          default_currency: string
          email: string | null
          emergency_contact: Json
          fiscal_name: string
          holded_contact_id: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          payment_terms_days: number
          phone: string | null
          preferred: boolean
          profile_updated_at: string | null
          reliability_score: number
          risk_level: string
          service_regions: string[]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          average_rating?: number | null
          billing_address?: Json
          cancellation_policy?: string | null
          category?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string
          email?: string | null
          emergency_contact?: Json
          fiscal_name: string
          holded_contact_id?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          payment_terms_days?: number
          phone?: string | null
          preferred?: boolean
          profile_updated_at?: string | null
          reliability_score?: number
          risk_level?: string
          service_regions?: string[]
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          average_rating?: number | null
          billing_address?: Json
          cancellation_policy?: string | null
          category?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string
          email?: string | null
          emergency_contact?: Json
          fiscal_name?: string
          holded_contact_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          payment_terms_days?: number
          phone?: string | null
          preferred?: boolean
          profile_updated_at?: string | null
          reliability_score?: number
          risk_level?: string
          service_regions?: string[]
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          blocker: string | null
          case_id: string | null
          client_id: string | null
          created_at: string
          due_at: string | null
          id: string
          idempotency_key: string | null
          organization_id: string
          payload: Json
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          blocker?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          idempotency_key?: string | null
          organization_id: string
          payload?: Json
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          blocker?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          idempotency_key?: string | null
          organization_id?: string
          payload?: Json
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          organization_id: string
          payload: Json
          title: string
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
          title: string
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          title?: string
        }
        Relationships: []
      }
      travelers: {
        Row: {
          birth_date: string | null
          case_id: string
          created_at: string
          document_country: string | null
          document_expires_at: string | null
          document_number: string | null
          document_type: string | null
          first_name: string
          id: string
          issuing_country: string | null
          last_name: string
          mrz: string | null
          nationality: string | null
          ocr_confidence: number | null
          ocr_status: string
          organization_id: string
          review_status: Database["public"]["Enums"]["traveler_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          traveler_type: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          case_id: string
          created_at?: string
          document_country?: string | null
          document_expires_at?: string | null
          document_number?: string | null
          document_type?: string | null
          first_name: string
          id?: string
          issuing_country?: string | null
          last_name: string
          mrz?: string | null
          nationality?: string | null
          ocr_confidence?: number | null
          ocr_status?: string
          organization_id: string
          review_status?: Database["public"]["Enums"]["traveler_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          traveler_type?: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          case_id?: string
          created_at?: string
          document_country?: string | null
          document_expires_at?: string | null
          document_number?: string | null
          document_type?: string | null
          first_name?: string
          id?: string
          issuing_country?: string | null
          last_name?: string
          mrz?: string | null
          nationality?: string | null
          ocr_confidence?: number | null
          ocr_status?: string
          organization_id?: string
          review_status?: Database["public"]["Enums"]["traveler_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          traveler_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travelers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travelers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          channel: string
          event_id: string
          event_type: string
          id: string
          idempotency_key: string | null
          last_error: string | null
          organization_id: string
          payload: Json
          payload_hash: string | null
          processed_at: string | null
          received_at: string
          status: string
          updated_at: string
        }
        Insert: {
          channel: string
          event_id: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          organization_id: string
          payload?: Json
          payload_hash?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          event_id?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          organization_id?: string
          payload?: Json
          payload_hash?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_proposal_version: {
        Args: { target_version: string }
        Returns: Json
      }
      delete_unaccepted_proposal: {
        Args: { actor?: string; target_org: string; target_proposal: string }
        Returns: Json
      }
      approve_expected_purchase: {
        Args: {
          actor: string
          approved_amount: number
          review_note?: string
          target_holded_purchase_id: string
          target_org: string
          target_purchase: string
        }
        Returns: Json
      }
      claim_integration_outbox: {
        Args: { batch_size?: number; worker_name: string }
        Returns: {
          attempts: number
          business_rule: string | null
          channel: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          last_error: string | null
          last_synced_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_action: string | null
          next_attempt_at: string | null
          organization_id: string
          payload: Json
          processed_at: string | null
          provider: string
          related_case_id: string | null
          risk: string
          status: string
          sync_status: Database["public"]["Enums"]["sync_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "integration_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_integration_outbox_for_org: {
        Args: { batch_size?: number; target_org?: string; worker_name: string }
        Returns: {
          attempts: number
          business_rule: string | null
          channel: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          last_error: string | null
          last_synced_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_action: string | null
          next_attempt_at: string | null
          organization_id: string
          payload: Json
          processed_at: string | null
          provider: string
          related_case_id: string | null
          risk: string
          status: string
          sync_status: Database["public"]["Enums"]["sync_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "integration_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_operational_case: {
        Args: { actor: string; target_case: string }
        Returns: Json
      }
      confirm_external_payment: {
        Args: {
          amount_value: number
          confirmed_timestamp: string
          currency_value: string
          payment_payload: Json
          payment_reference_value: string
          provider_value: string
          target_case: string
          target_org: string
          transaction_value: string
        }
        Returns: Json
      }
      confirm_supplier_invoice_upload: {
        Args: {
          document_title: string
          invoice_base_value: number
          invoice_currency_value: string
          invoice_date_value: string
          invoice_number_value: string
          invoice_tax_value: number
          invoice_total_value: number
          object_checksum: string
          object_mime_type: string
          object_path: string
          object_size_bytes: number
          original_file_name: string
          retention_days: number
          storage_bucket: string
          target_case: string
          target_org: string
          target_purchase: string
        }
        Returns: Json
      }
      create_contract_version: {
        Args: {
          actor: string
          contract_status_value: string
          contract_title: string
          external_url_value: string
          legal_version_value: string
          notes_value: string
          target_case: string
          target_org: string
        }
        Returns: Json
      }
      create_contract_version_with_legal_document: {
        Args: {
          actor: string
          contract_status_value: string
          contract_title: string
          legal_document_id_value: string
          notes_value: string
          target_case: string
          target_org: string
        }
        Returns: Json
      }
      create_contract_version_for_proposal: {
        Args: {
          actor: string
          contract_status_value: string
          contract_title: string
          legal_document_id_value: string
          notes_value: string
          proposal_version_id_value: string
          target_case: string
          target_org: string
        }
        Returns: Json
      }
      create_proposal_revision: {
        Args: {
          actor?: string
          source_version: string
          target_org: string
          target_proposal: string
        }
        Returns: Json
      }
      create_or_get_case_proposal: {
        Args: { target_actor?: string; target_case: string; target_org: string }
        Returns: {
          created: boolean
          proposal_id: string
          proposal_version_id: string
        }[]
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_org_id: { Args: never; Returns: string }
      delete_organization_secret: {
        Args: { actor?: string; target_key: string; target_org: string }
        Returns: Json
      }
      enqueue_integration_event: {
        Args: {
          action?: string
          channel_name: string
          event_name: string
          event_payload: Json
          event_risk?: string
          idem_key: string
          rule?: string
          target_org: string
        }
        Returns: string
      }
      ensure_profile_for_current_user: {
        Args: never
        Returns: {
          created_at: string
          full_name: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_organization_secret: {
        Args: { target_key: string; target_org: string }
        Returns: string
      }
      mark_expired_sensitive_documents: {
        Args: { actor?: string; target_org: string }
        Returns: Json
      }
      next_case_code: {
        Args: { target_org: string; target_year?: number }
        Returns: string
      }
      operational_close_preflight: {
        Args: { target_case: string }
        Returns: Json
      }
      organization_secret_statuses: {
        Args: { target_org: string }
        Returns: {
          configured: boolean
          last_test_message: string
          last_test_status: string
          last_tested_at: string
          secret_key: string
          updated_at: string
        }[]
      }
      recalculate_proposal_version_economics: {
        Args: { target_version: string }
        Returns: Json
      }
      record_contract_signature: {
        Args: {
          actor: string
          evidence_value: Json
          ip_hash_value: string
          review_confirmed: boolean
          signer_email_value: string
          signer_name_value: string
          target_contract: string
          target_org: string
          user_agent_value: string
        }
        Returns: Json
      }
      register_legal_document: {
        Args: {
          activate_value: boolean
          actor: string
          checksum_value: string
          document_type_value: string
          file_name_value: string
          is_test_value: boolean
          size_bytes_value: number
          storage_path_value: string
          target_org: string
          title_value: string
          version_label_value: string
        }
        Returns: Json
      }
      record_organization_secret_test: {
        Args: {
          actor?: string
          target_key: string
          target_org: string
          test_message?: string
          test_status: string
        }
        Returns: undefined
      }
      routsify_has_active_booking: {
        Args: { target_client: string; target_org: string }
        Returns: boolean
      }
      routsify_setting_boolean: {
        Args: { fallback: boolean; target_key: string; target_org: string }
        Returns: boolean
      }
      set_legal_document_state: {
        Args: {
          action_value: string
          actor: string
          target_document: string
          target_org: string
        }
        Returns: Json
      }
      set_organization_secret: {
        Args: {
          actor?: string
          secret_value: string
          target_key: string
          target_org: string
        }
        Returns: Json
      }
      sign_contract_version: {
        Args: {
          evidence_value: Json
          ip_hash_value: string
          signer_email_value: string
          signer_name_value: string
          target_contract_version: string
          target_org: string
          user_agent_value: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "direction"
        | "sales"
        | "operations"
        | "billing"
        | "viewer"
      case_status:
        | "new_lead"
        | "call_booked"
        | "call_done"
        | "budget_draft"
        | "proposal_sent"
        | "proposal_accepted"
        | "documentation_approved"
        | "contract_ready"
        | "contract_signed"
        | "payment_confirmed"
        | "suppliers_pending"
        | "ready_to_close"
        | "closed"
      expected_purchase_status:
        | "expected"
        | "requested"
        | "uploaded"
        | "holded_candidate"
        | "matched"
        | "review_needed"
        | "approved"
        | "not_required"
        | "cancelled"
        | "pending"
        | "received"
        | "review"
      proposal_version_status:
        | "draft"
        | "sent"
        | "accepted"
        | "internal_review"
        | "lost"
        | "expired"
      sync_status:
        | "pending"
        | "processing"
        | "synced"
        | "sync_error"
        | "cancelled"
      traveler_review_status: "pending" | "reviewed" | "approved" | "rejected"
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
        "direction",
        "sales",
        "operations",
        "billing",
        "viewer",
      ],
      case_status: [
        "new_lead",
        "call_booked",
        "call_done",
        "budget_draft",
        "proposal_sent",
        "proposal_accepted",
        "documentation_approved",
        "contract_ready",
        "contract_signed",
        "payment_confirmed",
        "suppliers_pending",
        "ready_to_close",
        "closed",
      ],
      expected_purchase_status: [
        "expected",
        "requested",
        "uploaded",
        "holded_candidate",
        "matched",
        "review_needed",
        "approved",
        "not_required",
        "cancelled",
        "pending",
        "received",
        "review",
      ],
      proposal_version_status: [
        "draft",
        "sent",
        "accepted",
        "internal_review",
        "lost",
        "expired",
      ],
      sync_status: [
        "pending",
        "processing",
        "synced",
        "sync_error",
        "cancelled",
      ],
      traveler_review_status: ["pending", "reviewed", "approved", "rejected"],
    },
  },
} as const
