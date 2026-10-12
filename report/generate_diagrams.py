import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches

DIAGRAMS_DIR = "/home/malulu/proj/enhanced-sw/report/diagrams"
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['font.size'] = 10
plt.rcParams['figure.dpi'] = 300

def create_architecture_overview():
    fig, ax = plt.subplots(figsize=(12, 7.5))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 96, "Enhanced Splitwise: End-to-End System Architecture", 
            ha='center', va='center', fontsize=14, fontweight='bold', color='#1E293B')

    # Layer 1: Presentation Layer
    rect_client = patches.FancyBboxPatch((5, 72), 90, 18, boxstyle="round,pad=1.5", 
                                        ec="#3B82F6", fc="#EFF6FF", lw=2)
    ax.add_patch(rect_client)
    ax.text(8, 86, "Presentation Tier (Cross-Platform Mobile & Web Client)", fontsize=11, fontweight='bold', color="#1D4ED8")
    
    apps = [
        ("Dashboard &\nInsights UI", 10, 75, 16, 8),
        ("Receipt Capture\n& OCR Review", 28, 75, 16, 8),
        ("Bill Splitting &\nSettlement", 46, 75, 16, 8),
        ("Budget &\nAnalytics", 64, 75, 16, 8),
        ("State Management\n(Context/Hooks)", 82, 75, 11, 8),
    ]
    for title, x, y, w, h in apps:
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.5", ec="#93C5FD", fc="#FFFFFF", lw=1.2)
        ax.add_patch(box)
        ax.text(x + w/2, y + h/2, title, ha='center', va='center', fontsize=8.5, color='#1E293B', fontweight='bold')

    ax.annotate("", xy=(50, 62), xytext=(50, 72),
                arrowprops=dict(arrowstyle="->", lw=2, color="#475569"))
    ax.text(52, 67, "REST / JSON (Port 3001)", fontsize=9, color="#475569", fontweight='bold')

    # Layer 2: Application Tier
    rect_be = patches.FancyBboxPatch((5, 42), 90, 20, boxstyle="round,pad=1.5", 
                                     ec="#10B981", fc="#ECFDF5", lw=2)
    ax.add_patch(rect_be)
    ax.text(8, 58, "Application Tier (Node.js & TypeScript Express API Gateway)", fontsize=11, fontweight='bold', color="#047857")

    be_modules = [
        ("API Router &\nMiddleware", 8, 45, 16, 9),
        ("Expense & Group\nControllers", 26, 45, 16, 9),
        ("Split & Settlement\nOrchestrator", 44, 45, 18, 9),
        ("AI Service Client\n(HTTP Proxy)", 64, 45, 16, 9),
        ("Data Persistence\nLayer (Postgres/Map)", 82, 45, 11, 9),
    ]
    for title, x, y, w, h in be_modules:
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.5", ec="#6EE7B7", fc="#FFFFFF", lw=1.2)
        ax.add_patch(box)
        ax.text(x + w/2, y + h/2, title, ha='center', va='center', fontsize=8.5, color='#1E293B', fontweight='bold')

    ax.annotate("", xy=(25, 28), xytext=(25, 42),
                arrowprops=dict(arrowstyle="->", lw=2, color="#475569"))
    ax.text(12, 35, "SQL / Pool (5432)", fontsize=9, color="#475569", fontweight='bold')

    ax.annotate("", xy=(72, 28), xytext=(72, 42),
                arrowprops=dict(arrowstyle="->", lw=2, color="#475569"))
    ax.text(74, 35, "REST / JSON (8000)", fontsize=9, color="#475569", fontweight='bold')

    # Layer 3 Left: Data Tier
    rect_db = patches.FancyBboxPatch((5, 5), 40, 23, boxstyle="round,pad=1.5", 
                                     ec="#6366F1", fc="#EEF2FF", lw=2)
    ax.add_patch(rect_db)
    ax.text(8, 24, "Data Tier (PostgreSQL / Relational)", fontsize=10.5, fontweight='bold', color="#4338CA")
    
    db_tables = [
        ("Expenses Table", 8, 14, 16, 6),
        ("Groups & Members", 26, 14, 17, 6),
        ("Settlement Ledgers", 8, 7, 16, 6),
        ("Budgets & Meta", 26, 7, 17, 6),
    ]
    for title, x, y, w, h in db_tables:
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.4", ec="#A5B4FC", fc="#FFFFFF", lw=1)
        ax.add_patch(box)
        ax.text(x + w/2, y + h/2, title, ha='center', va='center', fontsize=8, color='#1E293B')

    # Layer 3 Right: AI Tier
    rect_ai = patches.FancyBboxPatch((50, 5), 45, 23, boxstyle="round,pad=1.5", 
                                     ec="#8B5CF6", fc="#F5F3FF", lw=2)
    ax.add_patch(rect_ai)
    ax.text(53, 24, "AI & Analytics Tier (Python / FastAPI)", fontsize=10.5, fontweight='bold', color="#6D28D9")

    ai_services = [
        ("PaddleOCR Engine", 52, 15, 12, 6),
        ("LLM Router\n(Gemini/Mistral/Groq)", 66, 15, 14, 6),
        ("Meta Prophet\nForecast Engine", 82, 15, 11.5, 6),
        ("Leave-One-Out\nAnomaly Detector", 52, 7, 13.5, 6),
        ("Greedy Min-Cash\nSettlement Engine", 67.5, 7, 13.5, 6),
        ("Deterministic\nDecimal Math", 83, 7, 10.5, 6),
    ]
    for title, x, y, w, h in ai_services:
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.4", ec="#C4B5FD", fc="#FFFFFF", lw=1)
        ax.add_patch(box)
        ax.text(x + w/2, y + h/2, title, ha='center', va='center', fontsize=7.5, color='#1E293B')

    plt.tight_layout()
    plt.savefig(os.path.join(DIAGRAMS_DIR, "architecture_overview.png"), bbox_inches='tight')
    plt.close()
    print("Generated architecture_overview.png")

def create_bill_splitting_pipeline():
    fig, ax = plt.subplots(figsize=(12, 6.5))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 95, "Receipt OCR and Hybrid Deterministic Splitting Pipeline", 
            ha='center', va='center', fontsize=13, fontweight='bold', color='#1E293B')

    stages = [
        ("1. Receipt Image Capture", "Camera / Upload\nBase64 Payload", 5, 55, 16, 25, "#3B82F6", "#EFF6FF"),
        ("2. Spatial OCR Processing", "PaddleOCR Engine\nBBox & Text Extraction\nReading Order Sort", 24, 55, 17, 25, "#8B5CF6", "#F5F3FF"),
        ("3. LLM Entity Extraction", "LangChain LLM Router\nPydantic JSON Schema\nItems, Tax, Discounts", 44, 55, 17, 25, "#EC4899", "#FDF2F8"),
        ("4. Deterministic Reconciliation", "Python Decimal Module\nTax Pro-rating (Tax_i = P_i * T/Sub)\nPenny Rounding Adjustment", 64, 55, 17, 25, "#10B981", "#ECFDF5"),
        ("5. Participant Assignment", "Per-Item Assignments\nShared Items (Equal Split)\nIndividual Totals Quantized", 84, 55, 15, 25, "#F59E0B", "#FFFBEB"),
    ]

    for title, desc, x, y, w, h, ec, fc in stages:
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=1", ec=ec, fc=fc, lw=2)
        ax.add_patch(box)
        ax.text(x + w/2, y + h - 5, title, ha='center', va='center', fontsize=8.5, fontweight='bold', color=ec)
        ax.text(x + w/2, y + h/2 - 3, desc, ha='center', va='center', fontsize=8, color='#334155')

    for x in [21, 41, 61, 81]:
        ax.annotate("", xy=(x + 3, 67.5), xytext=(x, 67.5),
                    arrowprops=dict(arrowstyle="->", lw=2, color="#64748B"))

    rect_rule = patches.FancyBboxPatch((15, 10), 70, 32, boxstyle="round,pad=1.5", 
                                      ec="#059669", fc="#F0FDF4", lw=1.5)
    ax.add_patch(rect_rule)
    ax.text(50, 36, "Strict Boundary: AI Perception vs. Deterministic Arithmetic", 
            ha='center', va='center', fontsize=10.5, fontweight='bold', color='#065F46')
    
    rule_text = (
        "• AI / LLM Scope: Optical token detection, text layout parsing, and semantic item naming.\n"
        "• Zero LLM Math: LLM is strictly prohibited from performing item addition or tax division.\n"
        "• Mathematical Guarantee: Sum of all assigned individual shares matches receipt total exactly:\n"
        r"  $\sum_{j=1}^{M} S_j = \mathrm{Total\ Receipt\ Amount} \quad (\Delta = 0.00\ \mathrm{discrepancy})$"
    )
    ax.text(50, 22, rule_text, ha='center', va='center', fontsize=9, color='#1E293B')

    plt.tight_layout()
    plt.savefig(os.path.join(DIAGRAMS_DIR, "bill_splitting_pipeline.png"), bbox_inches='tight')
    plt.close()
    print("Generated bill_splitting_pipeline.png")

def create_anomaly_detection_pipeline():
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 94, "Leave-One-Out (LOO) Statistical Anomaly Detection Pipeline", 
            ha='center', va='center', fontsize=13, fontweight='bold', color='#1E293B')

    steps = [
        ("1. Transaction Ingestion", "Target Expense $x_t$\nAmount $A_t$, Category $C_t$\nHistorical Window $H(C_t)$", 4, 48, 20, 32, "#3B82F6", "#EFF6FF"),
        ("2. Baseline Estimation", "Leave-Out Target $x_t$:\n" + r"$\mu = \frac{1}{N}\sum_{i=1}^N A_i$" + "\n" + r"$\sigma = \sqrt{\frac{\sum (A_i - \mu)^2}{N-1}}$", 27, 48, 20, 32, "#6366F1", "#EEF2FF"),
        ("3. Dynamic Thresholding", r"Sensitivity $k \in [1.5, 3.0]$" + "\n" + r"$T_{upper} = \mu + k \cdot \sigma$" + "\nAbsolute Floor: Rs. 250", 50, 48, 20, 32, "#8B5CF6", "#F5F3FF"),
        ("4. Anomaly Decision", r"If $A_t > T_{upper}$:" + "\nFlag Anomaly\n" + r"Severity Score $\in [0, 1]$" + "\nNatural Language Alert", 73, 48, 23, 32, "#EF4444", "#FEF2F2"),
    ]

    for title, desc, x, y, w, h, ec, fc in steps:
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=1", ec=ec, fc=fc, lw=2)
        ax.add_patch(box)
        ax.text(x + w/2, y + h - 5, title, ha='center', va='center', fontsize=9, fontweight='bold', color=ec)
        ax.text(x + w/2, y + h/2 - 4, desc, ha='center', va='center', fontsize=8.5, color='#334155')

    for x in [24, 47, 70]:
        ax.annotate("", xy=(x + 3, 64), xytext=(x, 64),
                    arrowprops=dict(arrowstyle="->", lw=2, color="#64748B"))

    rect_box = patches.FancyBboxPatch((8, 10), 84, 26, boxstyle="round,pad=1.2", 
                                      ec="#0D9488", fc="#F0FDFA", lw=1.5)
    ax.add_patch(rect_box)
    ax.text(50, 30, "Why Leave-One-Out (LOO) Formulation Prevents False Negatives", 
            ha='center', va='center', fontsize=10, fontweight='bold', color='#0F766E')
    exp = (
        r"Standard batch statistics include the outlier $x_t$ when computing mean $\mu$ and std $\sigma$," + "\n"
        r"which artificially inflates both metrics and causes large outliers to mask themselves." + "\n"
        r"By computing $\mu_{-t}$ and $\sigma_{-t}$ strictly over historical transactions excluding $x_t$, the baseline remains uncorrupted."
    )
    ax.text(50, 18, exp, ha='center', va='center', fontsize=8.5, color='#1E293B')

    plt.tight_layout()
    plt.savefig(os.path.join(DIAGRAMS_DIR, "anomaly_detection_pipeline.png"), bbox_inches='tight')
    plt.close()
    print("Generated anomaly_detection_pipeline.png")

def create_debt_simplification_flow():
    fig, ax = plt.subplots(figsize=(12, 6.5))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 95, "Greedy Debt Simplification Algorithm", 
            ha='center', va='center', fontsize=13, fontweight='bold', color='#1E293B')

    boxes = [
        ("1. Input Pairwise Debts", r"Directed multigraph $G=(V, E)$" + "\n" + r"Edges: $(u, v, w)$ where $u$ owes $v$", 4, 52, 21, 30, "#3B82F6", "#EFF6FF"),
        ("2. Net Balance Vector", r"$\mathrm{Net}(u) = \sum \mathrm{Recv} - \sum \mathrm{Paid}$" + "\n" + r"$\sum_{u \in V} \mathrm{Net}(u) = 0.00$", 28, 52, 20, 30, "#6366F1", "#EEF2FF"),
        ("3. Priority Queues", r"Debtors Max-Heap ($\mathrm{Net} < 0$)" + "\n" + r"Creditors Max-Heap ($\mathrm{Net} > 0$)" + "\n" + r"$O(V \log V)$ construction", 51, 52, 20, 30, "#8B5CF6", "#F5F3FF"),
        ("4. Greedy Matching", r"$\mathrm{amount} = \min(|D_{max}|, C_{max})$" + "\n" + r"Record Transfer $(D_{max} \to C_{max})$" + "\nUpdate & re-insert remainder", 74, 52, 22, 30, "#10B981", "#ECFDF5"),
    ]

    for title, desc, x, y, w, h, ec, fc in boxes:
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=1", ec=ec, fc=fc, lw=2)
        ax.add_patch(box)
        ax.text(x + w/2, y + h - 5, title, ha='center', va='center', fontsize=9, fontweight='bold', color=ec)
        ax.text(x + w/2, y + h/2 - 4, desc, ha='center', va='center', fontsize=8.5, color='#334155')

    for x in [25, 48, 71]:
        ax.annotate("", xy=(x + 3, 67), xytext=(x, 67),
                    arrowprops=dict(arrowstyle="->", lw=2, color="#64748B"))

    rect_prop = patches.FancyBboxPatch((10, 10), 80, 30, boxstyle="round,pad=1.2", 
                                       ec="#D97706", fc="#FFFBEB", lw=1.5)
    ax.add_patch(rect_prop)
    ax.text(50, 34, "Mathematical Guarantees and Complexity Bounds", 
            ha='center', va='center', fontsize=10.5, fontweight='bold', color='#92400E')
    prop_text = (
        r"• Maximum Number of Transactions: At most $N - 1$ total cash transfers for $N$ participants (vs. up to $N(N-1)/2$)." + "\n"
        r"• Conservation of Value: Total capital transferred equals the exact net surplus $\frac{1}{2}\sum |\mathrm{Net}(u)|$." + "\n"
        r"• Decimal Precision: All operations utilize fixed-point Python `Decimal` arithmetic with penny quantizing."
    )
    ax.text(50, 20, prop_text, ha='center', va='center', fontsize=9, color='#1E293B')

    plt.tight_layout()
    plt.savefig(os.path.join(DIAGRAMS_DIR, "debt_simplification_flow.png"), bbox_inches='tight')
    plt.close()
    print("Generated debt_simplification_flow.png")

def create_forecasting_pipeline():
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 94, "Meta Prophet Spending Forecasting Pipeline", 
            ha='center', va='center', fontsize=13, fontweight='bold', color='#1E293B')

    steps = [
        ("1. Historical Extraction", r"Filter transactions $\geq D_{start}$" + "\n" + r"Group by calendar date $t$" + "\n" + r"Calculate daily spend $\sum A_t$", 4, 48, 20, 32, "#3B82F6", "#EFF6FF"),
        ("2. Continuous Resampling", "Reindex continuous date range\nFill missing zero-spend days\nFormat DataFrame ['ds', 'y']", 27, 48, 21, 32, "#6366F1", "#EEF2FF"),
        ("3. Prophet GAM Model", r"Linear Growth Trend $g(t)$" + "\n" + r"Weekly Seasonality $s(t)$" + "\nInterval Width: 0.80 (80% CI)", 51, 48, 21, 32, "#8B5CF6", "#F5F3FF"),
        ("4. Projection & Bounds", r"Future Horizon $H = 30$ days" + "\n" + r"Forecast $\hat{y}_t$, Lower $\hat{y}_{min}$, Upper $\hat{y}_{max}$" + "\nExpected Total Monthly Outlay", 75, 48, 21, 32, "#10B981", "#ECFDF5"),
    ]

    for title, desc, x, y, w, h, ec, fc in steps:
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=1", ec=ec, fc=fc, lw=2)
        ax.add_patch(box)
        ax.text(x + w/2, y + h - 5, title, ha='center', va='center', fontsize=9, fontweight='bold', color=ec)
        ax.text(x + w/2, y + h/2 - 4, desc, ha='center', va='center', fontsize=8.5, color='#334155')

    for x in [24, 48, 72]:
        ax.annotate("", xy=(x + 3, 64), xytext=(x, 64),
                    arrowprops=dict(arrowstyle="->", lw=2, color="#64748B"))

    rect_fb = patches.FancyBboxPatch((8, 10), 84, 26, boxstyle="round,pad=1.2", 
                                     ec="#4B5563", fc="#F3F4F6", lw=1.5)
    ax.add_patch(rect_fb)
    ax.text(50, 30, "Adaptive Modeling and Cold-Start Graceful Degradation", 
            ha='center', va='center', fontsize=10, fontweight='bold', color='#1F2937')
    fb_text = (
        r"• Data Sufficiency: Prophet requires $\geq 5$ distinct active spending days. Weekly seasonality activates when $N \geq 7$." + "\n"
        r"• Cold-Start Fallback: If $N < 5$, system automatically computes moving average baseline $\mu_{\mathrm{daily}} \cdot H$." + "\n"
        r"• Category Forecasting: Generates top-3 category forecasts alongside aggregate spending trend."
    )
    ax.text(50, 18, fb_text, ha='center', va='center', fontsize=8.5, color='#111827')

    plt.tight_layout()
    plt.savefig(os.path.join(DIAGRAMS_DIR, "forecasting_pipeline.png"), bbox_inches='tight')
    plt.close()
    print("Generated forecasting_pipeline.png")

def create_categorization_and_insights_pipeline():
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 94, "Expense Categorization and Natural Language Spending Insights Architecture", 
            ha='center', va='center', fontsize=13, fontweight='bold', color='#1E293B')

    ax.text(10, 80, "A. Automatic Categorization Pipeline", fontsize=10, fontweight='bold', color='#1D4ED8')
    cat_steps = [
        ("Raw Expense Input", "Title, Amount, Note", 10, 52, 17, 22, "#3B82F6", "#EFF6FF"),
        ("Few-Shot Prompt", "Canonical Taxonomy\nRules & Context", 31, 52, 17, 22, "#6366F1", "#EEF2FF"),
        ("LLM Router", "Gemini -> Mistral -> Groq\nStructured Output Parser", 52, 52, 19, 22, "#8B5CF6", "#F5F3FF"),
        ("Persisted Record", "Category + Confidence\nCanonical Tagging", 75, 52, 17, 22, "#10B981", "#ECFDF5"),
    ]
    for title, desc, x, y, w, h, ec, fc in cat_steps:
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.8", ec=ec, fc=fc, lw=1.5)
        ax.add_patch(box)
        ax.text(x + w/2, y + h - 4, title, ha='center', va='center', fontsize=8, fontweight='bold', color=ec)
        ax.text(x + w/2, y + h/2 - 3, desc, ha='center', va='center', fontsize=7.5, color='#334155')

    for x in [27, 48, 71]:
        ax.annotate("", xy=(x + 4, 63), xytext=(x, 63),
                    arrowprops=dict(arrowstyle="->", lw=1.5, color="#64748B"))

    ax.text(10, 38, "B. Deterministic-to-NLG Spending Insights Pipeline", fontsize=10, fontweight='bold', color='#047857')
    ins_steps = [
        ("Historical Aggregations", "Month-over-Month Delta\nTop Categories & Variance", 10, 10, 17, 22, "#059669", "#ECFDF5"),
        ("Statistical Metrics", "Burn Rate, Peak Spend Day\nBudget Adherence Ratio", 31, 10, 17, 22, "#0D9488", "#F0FDFA"),
        ("LLM Commentary", "Prompt with Hard Numbers\nZero Math Calculation", 52, 10, 19, 22, "#D97706", "#FFFBEB"),
        ("Actionable Insights", "Structured Recommendations\nRisk Alerts & Trends", 75, 10, 17, 22, "#7C3AED", "#F5F3FF"),
    ]
    for title, desc, x, y, w, h, ec, fc in ins_steps:
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.8", ec=ec, fc=fc, lw=1.5)
        ax.add_patch(box)
        ax.text(x + w/2, y + h - 4, title, ha='center', va='center', fontsize=8, fontweight='bold', color=ec)
        ax.text(x + w/2, y + h/2 - 3, desc, ha='center', va='center', fontsize=7.5, color='#334155')

    for x in [27, 48, 71]:
        ax.annotate("", xy=(x + 4, 21), xytext=(x, 21),
                    arrowprops=dict(arrowstyle="->", lw=1.5, color="#64748B"))

    plt.tight_layout()
    plt.savefig(os.path.join(DIAGRAMS_DIR, "categorization_insights_flow.png"), bbox_inches='tight')
    plt.close()
    print("Generated categorization_insights_flow.png")

if __name__ == "__main__":
    create_architecture_overview()
    create_bill_splitting_pipeline()
    create_anomaly_detection_pipeline()
    create_debt_simplification_flow()
    create_forecasting_pipeline()
    create_categorization_and_insights_pipeline()
    print("All architectural diagrams generated successfully.")
