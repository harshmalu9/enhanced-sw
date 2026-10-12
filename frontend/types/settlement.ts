export interface ParticipantPayment {
  person: string;
  amount_paid: number;
  custom_share?: number;
}

export interface ParticipantBalance {
  person: string;
  amount_paid: number;
  fair_share: number;
  net_balance: number;
}

export interface SettlementTransfer {
  id?: string;
  from_person: string;
  to_person: string;
  amount: number;
  instruction: string;
  status?: "pending" | "settled";
}

export interface GroupSettlementRequest {
  title?: string;
  payments: ParticipantPayment[];
}

export interface GroupSettlementResponse {
  success: boolean;
  title: string;
  total_group_spent: number;
  fair_share_per_person?: number;
  balances: ParticipantBalance[];
  transfers: SettlementTransfer[];
  total_transfers_count: number;
  settled_count?: number;
  pending_count?: number;
  remaining_unsettled_transfers?: SettlementTransfer[];
  remaining_unsettled_amount?: number;
  is_settled: boolean;
  error?: {
    code: string;
    message: string;
  };
}
