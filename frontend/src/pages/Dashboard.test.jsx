/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import Dashboard from "./Dashboard";

// --------------------------------------------------
// MOCK SERVICES AND API HOOK
// --------------------------------------------------

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  getAnalytics: vi.fn(),
  getTransactions: vi.fn(),
  getBudgets: vi.fn(),
}));

vi.mock("../hooks/useApi", () => ({
  useApi: () => mocks.apiRequest,
}));

vi.mock("../services/analyticsService", () => ({
  getAnalytics: mocks.getAnalytics,
}));

vi.mock("../services/transactionService", () => ({
  getTransactions: mocks.getTransactions,
}));

vi.mock("../services/budgetService", () => ({
  getBudgets: mocks.getBudgets,
}));

// --------------------------------------------------
// MOCK CHILD COMPONENTS
// --------------------------------------------------

vi.mock("../components/DashboardSkeleton", () => ({
  default: () => <div data-testid="dashboard-skeleton">Loading dashboard</div>,
}));

vi.mock("../components/MonthYearSelector", () => ({
  default: function MockMonthYearSelector({ value, onChange }) {
    return (
      <div>
        <span data-testid="selected-month">{value}</span>

        <button type="button" onClick={() => onChange("2025-02")}>
          Select February 2025
        </button>
      </div>
    );
  },
}));

// Recharts needs browser measurements.
// Chart drawing itself is not tested here.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  PieChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Pie: ({ children }) => <div>{children}</div>,
  Cell: () => null,
}));

// --------------------------------------------------
// TEST DATA
// --------------------------------------------------

// Match the dashboard's default month at test time.
const currentMonth = new Date().toLocaleDateString("en-CA").slice(0, 7);

const otherMonth = "2025-02";

const sampleAnalytics = {
  month: currentMonth,
  income_cents: 300000,
  expenses_cents: 75000,
  balance_cents: 225000,
  savings_rate: 75,
  monthly_trend: [
    {
      month: currentMonth,
      income_cents: 300000,
      expenses_cents: 75000,
    },
  ],
  category_breakdown: [
    {
      category: "Groceries",
      amount_cents: 50000,
    },
    {
      category: "Transportation",
      amount_cents: 25000,
    },
  ],
};

const sampleTransactions = [
  {
    id: "transaction-1",
    date: `${currentMonth}-18`,
    description: "Walmart",
    category: "Groceries",
    type: "expense",
    amount: 100,
  },
  {
    id: "transaction-2",
    date: `${currentMonth}-17`,
    description: "Monthly Salary",
    category: "Salary",
    type: "income",
    amount: 3000,
  },
  {
    id: "transaction-3",
    date: "2024-01-15",
    description: "Old Transaction",
    category: "Other",
    type: "expense",
    amount: 20,
  },
];

const sampleBudgets = [
  {
    id: "budget-1",
    month: currentMonth,
    category: "Groceries",
    limit_cents: 50000,
    spent_cents: 45000,
    remaining_cents: 5000,
    percentage: 90,
    status: "warning",
  },
];

// --------------------------------------------------
// TEST SETUP
// --------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getAnalytics.mockResolvedValue(sampleAnalytics);

  mocks.getTransactions.mockResolvedValue(sampleTransactions);

  mocks.getBudgets.mockResolvedValue(sampleBudgets);
});

afterEach(() => {
  cleanup();
});

async function renderLoadedDashboard() {
  render(<Dashboard />);

  await screen.findByText("Walmart");
}

// --------------------------------------------------
// LOADING
// --------------------------------------------------

describe("Dashboard loading", () => {
  it("shows the loading skeleton", () => {
    mocks.getAnalytics.mockReturnValue(new Promise(() => {}));

    render(<Dashboard />);

    expect(screen.getByTestId("dashboard-skeleton")).toBeTruthy();
  });
});

// --------------------------------------------------
// FINANCIAL SUMMARY
// --------------------------------------------------

describe("Dashboard summaries", () => {
  it("displays financial totals correctly", async () => {
    await renderLoadedDashboard();

    expect(screen.getByText("Monthly Income")).toBeTruthy();

    expect(screen.getByText("Monthly Expenses")).toBeTruthy();

    expect(screen.getByText("Monthly Balance")).toBeTruthy();

    expect(screen.getByText("Savings Rate")).toBeTruthy();

    expect(screen.getAllByText(/\$3,000\.00/).length).toBeGreaterThan(0);

    expect(screen.getByText("$750.00")).toBeTruthy();

    expect(screen.getByText("$2,250.00")).toBeTruthy();

    expect(screen.getByText("75%")).toBeTruthy();

    expect(mocks.getAnalytics).toHaveBeenCalledWith(
      mocks.apiRequest,
      currentMonth,
    );
  });
});

// --------------------------------------------------
// RECENT TRANSACTIONS
// --------------------------------------------------

describe("Dashboard recent transactions", () => {
  it("displays transactions for the selected month", async () => {
    await renderLoadedDashboard();

    expect(screen.getByText("Walmart")).toBeTruthy();

    expect(screen.getByText("Monthly Salary")).toBeTruthy();
  });

  it("excludes transactions from other months", async () => {
    await renderLoadedDashboard();

    expect(screen.queryByText("Old Transaction")).toBeNull();
  });
});

// --------------------------------------------------
// BUDGET WARNINGS
// --------------------------------------------------

describe("Dashboard budget warnings", () => {
  it("displays a warning for budgets over 80%", async () => {
    await renderLoadedDashboard();

    expect(
      screen.getByText(/1 budget category\(s\) have reached/),
    ).toBeTruthy();

    expect(screen.getByText(/Groceries\./)).toBeTruthy();
  });
});

// --------------------------------------------------
// EMPTY FINANCIAL DATA
// --------------------------------------------------

describe("Dashboard empty state", () => {
  it("handles empty financial data", async () => {
    mocks.getAnalytics.mockResolvedValue({
      month: currentMonth,
      income_cents: 0,
      expenses_cents: 0,
      balance_cents: 0,
      savings_rate: 0,
      monthly_trend: [],
      category_breakdown: [],
    });

    mocks.getTransactions.mockResolvedValue([]);
    mocks.getBudgets.mockResolvedValue([]);

    render(<Dashboard />);

    expect(await screen.findByText("No expenses for this month")).toBeTruthy();

    expect(screen.getByText("No transactions for this month")).toBeTruthy();
  });
});

// --------------------------------------------------
// ERRORS AND RETRY
// --------------------------------------------------

describe("Dashboard errors", () => {
  it("displays an API error and retries successfully", async () => {
    mocks.getAnalytics
      .mockRejectedValueOnce(new Error("API connection failed"))
      .mockResolvedValue(sampleAnalytics);

    render(<Dashboard />);

    expect(
      await screen.findByText(
        /Unable to load financial data: API connection failed/,
      ),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Retry/i,
      }),
    );

    await screen.findByText("Walmart");

    await waitFor(() => {
      expect(mocks.getAnalytics).toHaveBeenCalledTimes(2);
    });
  });
});

// --------------------------------------------------
// MONTH SELECTION
// --------------------------------------------------

describe("Dashboard month selection", () => {
  it("fetches data when the selected month changes", async () => {
    await renderLoadedDashboard();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Select February 2025",
      }),
    );

    await waitFor(() => {
      expect(mocks.getAnalytics).toHaveBeenCalledWith(
        mocks.apiRequest,
        otherMonth,
      );
    });

    expect(mocks.getBudgets).toHaveBeenCalledWith(mocks.apiRequest, otherMonth);

    expect(screen.getByTestId("selected-month").textContent).toBe(otherMonth);
  });
});
