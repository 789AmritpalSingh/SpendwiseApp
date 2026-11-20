
/* @vitest-environment jsdom */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import Transactions from "./Transactions";


// --------------------------------------------------
// MOCK API, TOAST AND TRANSACTION SERVICES
// --------------------------------------------------

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  showToast: vi.fn(),
  getTransactions: vi.fn(),
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));

vi.mock("../hooks/useApi", () => ({
  useApi: () => mocks.apiRequest,
}));

vi.mock("../hooks/useToast", () => ({
  useToast: () => mocks.showToast,
}));

vi.mock("../services/transactionService", () => ({
  getTransactions: mocks.getTransactions,
  addTransaction: mocks.addTransaction,
  updateTransaction: mocks.updateTransaction,
  deleteTransaction: mocks.deleteTransaction,
}));


// --------------------------------------------------
// MOCK FORM
// The real TransactionForm has its own tests.
// Here we test only page-to-form communication.
// --------------------------------------------------

vi.mock("../components/TransactionForm", () => ({
  default: function MockTransactionForm({
    transaction,
    onSave,
    onClose,
  }) {
    async function submit() {
      await onSave({
        date: "2026-11-18",
        description: transaction
          ? "Updated Walmart"
          : "New Purchase",
        category: "Groceries",
        type: "expense",
        amount: 30,
      });

      onClose();
    }

    return (
      <div role="dialog" aria-label="Transaction form">
        <h2>
          {transaction
            ? "Edit Transaction Form"
            : "Add Transaction Form"}
        </h2>

        <button onClick={submit}>
          Submit Mock Form
        </button>

        <button onClick={onClose}>
          Cancel Mock Form
        </button>
      </div>
    );
  },
}));


// --------------------------------------------------
// SAMPLE TRANSACTIONS
// --------------------------------------------------

const sampleTransactions = [
  {
    id: "transaction-1",
    date: "2026-11-18",
    description: "Walmart",
    category: "Groceries",
    type: "expense",
    amount: 100,
  },
  {
    id: "transaction-2",
    date: "2026-11-17",
    description: "Monthly Salary",
    category: "Salary",
    type: "income",
    amount: 3000,
  },
  {
    id: "transaction-3",
    date: "2026-11-16",
    description: "Netflix",
    category: "Entertainment",
    type: "expense",
    amount: 18,
  },
];


// --------------------------------------------------
// TEST SETUP
// --------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  mocks.getTransactions.mockResolvedValue(
    sampleTransactions
  );

  mocks.addTransaction.mockResolvedValue({});
  mocks.updateTransaction.mockResolvedValue({});
  mocks.deleteTransaction.mockResolvedValue({});

  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  );
});


afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});


async function renderLoadedPage() {
  render(<Transactions />);

  await screen.findByText("Walmart");
}


// --------------------------------------------------
// LOADING
// --------------------------------------------------

describe("Transactions loading", () => {
  it("shows a loading indicator initially", () => {
    // Keep the API request pending.
    mocks.getTransactions.mockReturnValue(
      new Promise(() => {})
    );

    render(<Transactions />);

    expect(
      screen.getByRole("progressbar")
    ).toBeTruthy();
  });
});


// --------------------------------------------------
// DISPLAY TRANSACTIONS
// --------------------------------------------------

describe("Transactions display", () => {
  it("loads and displays transactions", async () => {
    await renderLoadedPage();

    expect(
      screen.getByText("Walmart")
    ).toBeTruthy();

    expect(
      screen.getByText("Monthly Salary")
    ).toBeTruthy();

    expect(
      screen.getByText("Netflix")
    ).toBeTruthy();

    expect(
      mocks.getTransactions
    ).toHaveBeenCalledWith(mocks.apiRequest);
  });


  it("shows empty state when no transactions exist", async () => {
    mocks.getTransactions.mockResolvedValue([]);

    render(<Transactions />);

    expect(
      await screen.findByText(
        "No transactions found"
      )
    ).toBeTruthy();
  });


  it("filters transactions by search text", async () => {
    await renderLoadedPage();

    fireEvent.change(
      screen.getByRole("textbox", {
        name: /Search transactions/i,
      }),
      {
        target: {
          value: "Netflix",
        },
      }
    );

    expect(
      screen.getByText("Netflix")
    ).toBeTruthy();

    expect(
      screen.queryByText("Walmart")
    ).toBeNull();

    expect(
      screen.queryByText("Monthly Salary")
    ).toBeNull();
  });
});


// --------------------------------------------------
// ADD TRANSACTION
// --------------------------------------------------

describe("Add transaction", () => {
  it("adds a transaction and refreshes the list", async () => {
    await renderLoadedPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add Transaction",
      })
    );

    expect(
      screen.getByText("Add Transaction Form")
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Submit Mock Form",
      })
    );

    await waitFor(() => {
      expect(
        mocks.addTransaction
      ).toHaveBeenCalledWith(
        mocks.apiRequest,
        expect.objectContaining({
          description: "New Purchase",
          amount: 30,
        })
      );
    });

    await waitFor(() => {
      expect(
        mocks.getTransactions
      ).toHaveBeenCalledTimes(2);
    });

    expect(
      mocks.showToast
    ).toHaveBeenCalledWith(
      "Transaction added successfully."
    );
  });
});


// --------------------------------------------------
// EDIT TRANSACTION
// --------------------------------------------------

describe("Edit transaction", () => {
  it("updates an existing transaction", async () => {
    await renderLoadedPage();

    const walmartRow = screen
      .getByText("Walmart")
      .closest("tr");

    fireEvent.click(
      within(walmartRow).getByRole("button", {
        name: "Edit transaction",
      })
    );

    expect(
      screen.getByText("Edit Transaction Form")
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Submit Mock Form",
      })
    );

    await waitFor(() => {
      expect(
        mocks.updateTransaction
      ).toHaveBeenCalledWith(
        mocks.apiRequest,
        "transaction-1",
        expect.objectContaining({
          description: "Updated Walmart",
          amount: 30,
        })
      );
    });

    expect(
      mocks.showToast
    ).toHaveBeenCalledWith(
      "Transaction updated successfully."
    );
  });
});


// --------------------------------------------------
// DELETE TRANSACTION
// --------------------------------------------------

describe("Delete transaction", () => {
  it("deletes a transaction after confirmation", async () => {
    await renderLoadedPage();

    const walmartRow = screen
      .getByText("Walmart")
      .closest("tr");

    fireEvent.click(
      within(walmartRow).getByRole("button", {
        name: "Delete transaction",
      })
    );

    await waitFor(() => {
      expect(
        mocks.deleteTransaction
      ).toHaveBeenCalledWith(
        mocks.apiRequest,
        "transaction-1"
      );
    });

    await waitFor(() => {
      expect(
        mocks.getTransactions
      ).toHaveBeenCalledTimes(2);
    });

    expect(
      mocks.showToast
    ).toHaveBeenCalledWith(
      "Transaction deleted successfully."
    );
  });


  it("does not delete when confirmation is cancelled", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false)
    );

    await renderLoadedPage();

    const walmartRow = screen
      .getByText("Walmart")
      .closest("tr");

    fireEvent.click(
      within(walmartRow).getByRole("button", {
        name: "Delete transaction",
      })
    );

    expect(
      mocks.deleteTransaction
    ).not.toHaveBeenCalled();
  });
});


// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

describe("Transactions errors", () => {
  it("displays API errors", async () => {
    mocks.getTransactions.mockRejectedValue(
      new Error("Unable to load transactions")
    );

    render(<Transactions />);

    expect(
      await screen.findByText(
        "Unable to load transactions"
      )
    ).toBeTruthy();
  });
});
