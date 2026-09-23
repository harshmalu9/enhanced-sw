export interface CategoryAnomalyStats {
  category: string;
  transaction_count: number;
  mean_amount: number;
  std_dev: number;
  threshold_amount: number;
}

export interface AnomalyItem {
  expense_id?: string;
  description: string;
  amount: number;
  category: string;
  expense_date?: string;
  severity: "HIGH" | "MEDIUM" | "MILD";
  reason: string;
  baseline_mean: number;
  threshold: number;
  deviation_factor: number;
}

export interface AnomalyDetectionResponse {
  success: boolean;
  total_expenses_analyzed: number;
  anomalies_detected_count: number;
  anomalies: AnomalyItem[];
  category_baselines: CategoryAnomalyStats[];
  summary_message: string;
  has_sufficient_history: boolean;
  error?: {
    code: string;
    message: string;
  };
}
