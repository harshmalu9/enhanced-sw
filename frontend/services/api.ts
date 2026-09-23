import { Platform } from "react-native";
import { ReceiptFile, SplitResponse } from "../types/bill";
import { ExpenseCategorizeParams, ExpenseCategorizeResponse } from "../types/expense";
import { ExpenseInput, PeriodInput, SpendingInsightsResponse } from "../types/spending";

// Configurable API base URL: EXPO_PUBLIC_API_URL (defaults to http://192.168.1.100:3001 or localhost)
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001");

export interface ProcessBillParams {
  receipt: ReceiptFile;
  people: string[];
  instruction: string;
}

export class ApiError extends Error {
  code: string;
  statusCode?: number;

  constructor(code: string, message: string, statusCode?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function processBill({
  receipt,
  people,
  instruction,
}: ProcessBillParams): Promise<SplitResponse> {
  const url = `${API_BASE_URL}/api/bill/process`;

  const formData = new FormData();

  // Handle file across Web and Native platforms
  if (Platform.OS === "web") {
    if (receipt.file) {
      formData.append("file", receipt.file, receipt.name);
    } else {
      const res = await fetch(receipt.uri);
      const blob = await res.blob();
      formData.append("file", blob, receipt.name);
    }
  } else {
    // React Native mobile format for multipart file upload
    // Clean up filename and mime type
    const filename = receipt.name || "receipt.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : "jpg";
    const type = receipt.type || (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");

    formData.append("file", {
      uri: receipt.uri,
      name: filename,
      type: type,
    } as unknown as Blob);
  }

  formData.append("people", JSON.stringify(people));
  formData.append("instruction", instruction);

  return new Promise<SplitResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 120000; // 2 minutes for OCR + LLM

    xhr.onload = () => {
      let data: any;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        return reject(
          new ApiError(
            "INVALID_RESPONSE",
            "Received an invalid non-JSON response from server.",
            xhr.status
          )
        );
      }

      if (xhr.status < 200 || xhr.status >= 300 || !data.success) {
        const errorCode = data?.error?.code || `HTTP_${xhr.status}`;
        const errorMessage = data?.error?.message || "Failed to process receipt split.";

        let friendlyMessage = errorMessage;
        if (errorCode === "AI_SERVICE_UNAVAILABLE") {
          friendlyMessage = "AI service is currently unavailable. Please try again.";
        } else if (
          errorCode === "INVALID_IMAGE" ||
          errorCode === "MISSING_FILE" ||
          errorCode === "OCR_PROCESSING_FAILED"
        ) {
          friendlyMessage = "Could not read this receipt. Please try another image.";
        } else if (
          errorCode === "AMBIGUOUS_ASSIGNMENT" ||
          errorCode === "UNASSIGNED_ITEMS" ||
          errorCode === "INVALID_ASSIGNMENT"
        ) {
          friendlyMessage = `We couldn't determine who had some items. Please clarify the instruction.\n(${errorMessage})`;
        }

        return reject(new ApiError(errorCode, friendlyMessage, xhr.status));
      }

      resolve(data as SplitResponse);
    };

    xhr.onerror = (err) => {
      console.error("XHR network error when calling processBill:", err);
      reject(
        new ApiError(
          "NETWORK_ERROR",
          `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running and phone is on the same Wi-Fi.`
        )
      );
    };

    xhr.ontimeout = () => {
      reject(
        new ApiError(
          "TIMEOUT",
          "Processing took too long and timed out. Please try again."
        )
      );
    };

    try {
      xhr.send(formData);
    } catch (sendErr: unknown) {
      console.error("Error sending XHR formData:", sendErr);
      reject(
        new ApiError(
          "NETWORK_ERROR",
          `Failed to send request to backend: ${String(sendErr)}`
        )
      );
    }
  });
}

export async function categorizeExpense({
  description,
  amount,
  merchant,
}: import("../types/expense").ExpenseCategorizeParams): Promise<import("../types/expense").ExpenseCategorizeResponse> {
  const url = `${API_BASE_URL}/api/expenses/categorize`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description,
        amount: amount !== undefined && !isNaN(amount) ? amount : undefined,
        merchant: merchant?.trim() || undefined,
      }),
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received an invalid non-JSON response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to categorize expense.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return data as import("../types/expense").ExpenseCategorizeResponse;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function createExpense(
  params: import("../types/expense").CreateExpenseParams
): Promise<import("../types/expense").CreateExpenseResponse> {

  const url = `${API_BASE_URL}/api/expenses`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received an invalid non-JSON response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to create expense.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function getExpenses(): Promise<import("../types/expense").ListExpensesResponse> {
  const url = `${API_BASE_URL}/api/expenses`;

  try {
    const res = await fetch(url, {
      method: "GET",
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received an invalid non-JSON response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to retrieve expenses.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function deleteExpense(
  id: string
): Promise<import("../types/expense").DeleteExpenseResponse> {
  const url = `${API_BASE_URL}/api/expenses/${id}`;

  try {
    const res = await fetch(url, {
      method: "DELETE",
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received an invalid non-JSON response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to delete expense.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function getSpendingInsights(params?: {
  expenses?: ExpenseInput[];
  period?: PeriodInput;
}): Promise<SpendingInsightsResponse> {
  const url = `${API_BASE_URL}/api/spending/insights`;

  try {
    let res: globalThis.Response;
    if (params?.expenses && params.expenses.length > 0) {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expenses: params.expenses,
          period: params.period,
        }),
      });
    } else {
      res = await fetch(url, {
        method: "GET",
      });
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received an invalid non-JSON response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to generate spending insights.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return data as SpendingInsightsResponse;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function getBudgetStatus(
  month?: string
): Promise<import("../types/budget").BudgetStatus | null> {
  const url = month
    ? `${API_BASE_URL}/api/budgets/${month}`
    : `${API_BASE_URL}/api/budgets/current`;

  try {
    const res = await fetch(url, { method: "GET" });
    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received invalid response from server.",
        res.status
      );
    }

    if (res.status === 404) {
      return null;
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to retrieve budget status.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return data.data;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function setBudget(
  payload: import("../types/budget").UpsertBudgetPayload
): Promise<import("../types/budget").BudgetStatus> {
  const url = `${API_BASE_URL}/api/budgets`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received invalid response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to save budget.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return data.data.status;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function deleteBudget(month: string): Promise<boolean> {
  const url = `${API_BASE_URL}/api/budgets/${month}`;

  try {
    const res = await fetch(url, { method: "DELETE" });
    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received invalid response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to delete budget.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return true;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function detectAnomalies(
  sensitivity = 2.0
): Promise<import("../types/anomaly").AnomalyDetectionResponse> {
  const url = `${API_BASE_URL}/api/spending/anomalies`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensitivity_factor: sensitivity }),
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received invalid response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to detect anomalies.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return data as import("../types/anomaly").AnomalyDetectionResponse;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function getSpendingForecast(
  horizonDays = 14
): Promise<import("../types/forecast").SpendingForecastResponse> {
  const url = `${API_BASE_URL}/api/spending/forecast?horizon=${horizonDays}`;

  try {
    const res = await fetch(url, { method: "GET" });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received invalid response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to generate spending forecast.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return data as import("../types/forecast").SpendingForecastResponse;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function simplifyDebts(
  payload: import("../types/settlement").GroupSettlementRequest
): Promise<import("../types/settlement").GroupSettlementResponse> {
  const url = `${API_BASE_URL}/api/settlement/simplify`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received invalid response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to calculate debt settlement.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return data as import("../types/settlement").GroupSettlementResponse;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export async function seedDemoData(): Promise<{
  expensesCount: number;
  budgetsCount: number;
  message: string;
}> {
  const url = `${API_BASE_URL}/api/dev/seed`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ApiError(
        "INVALID_RESPONSE",
        "Received invalid response from server.",
        res.status
      );
    }

    if (!res.ok || !data.success) {
      const errorCode = data?.error?.code || `HTTP_${res.status}`;
      const errorMessage = data?.error?.message || "Failed to load demo data.";
      throw new ApiError(errorCode, errorMessage, res.status);
    }

    return {
      expensesCount: data.data.expensesCount,
      budgetsCount: data.data.budgetsCount,
      message: data.message,
    };
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not connect to backend at ${API_BASE_URL}. Ensure the backend is running.`
    );
  }
}

export { API_BASE_URL };

