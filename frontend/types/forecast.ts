export interface DailyForecastPoint {
  date: string;
  predicted_amount: number;
  lower_bound: number;
  upper_bound: number;
  is_historical?: boolean;
}

export interface CategoryForecast {
  category: string;
  historical_daily_avg: number;
  projected_next_month: number;
  trend_direction: "UPWARD" | "DOWNWARD" | "STABLE" | "INCREASING" | "DECREASING";
}

export interface SpendingForecastResponse {
  success: boolean;
  has_sufficient_data: boolean;
  model_name?: string;
  data_points_count: number;
  historical_daily_average: number;
  projected_daily_average: number;
  projected_horizon_total: number;
  projected_30_day_total: number;
  trend_slope: number;
  trend_direction: "UPWARD" | "DOWNWARD" | "STABLE";
  forecast_points: DailyForecastPoint[];
  category_forecasts: CategoryForecast[];
  forecast_explanation: string;
  error?: {
    code: string;
    message: string;
  };
}
