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
  from_person: string;
  to_person: string;
  amount: number;
  instruction: string;
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
  is_settled: boolean;
  error?: {
    code: string;
    message: string;
  };
}
