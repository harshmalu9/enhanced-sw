export interface BillItem {
  name: string;
  quantity?: number;
  unit_price?: number | null;
  total_price?: number | null;
}

export interface ItemAssignment {
  item_name: string;
  people: string[];
  quantity_shares?: Record<string, number> | null;
}

export interface PersonItemShare {
  item_name: string;
  item_total_price: number;
  share_fraction: number;
  share_amount: number;
}

export interface PersonShare {
  person: string;
  items: PersonItemShare[];
  subtotal: number;
  tax: number;
  discount: number;
  tip: number;
  total: number;
}

export interface BillSplitSummary {
  merchant?: string | null;
  total: number;
  currency: string;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  tip?: number | null;
}

export interface BillSplitResult {
  bill: BillSplitSummary;
  assignments: ItemAssignment[];
  shares: PersonShare[];
  reconciled_total: number;
}

export interface BillValidationResult {
  is_consistent: boolean;
  difference?: number | null;
  expected_total?: number | null;
  items_total?: number | null;
  message?: string | null;
}

export interface SplitResponse {
  success: boolean;
  data: BillSplitResult;
  validation?: BillValidationResult | null;
  error?: {
    code: string;
    message: string;
  };
}

export interface ReceiptFile {
  uri: string;
  name: string;
  type: string;
  file?: File | Blob; // For web platform
}
