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
} from "@testing-library/react";

import TransactionForm from "./TransactionForm";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function renderForm(overrides = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  render(
    <TransactionForm open onSave={onSave} onClose={onClose} {...overrides} />,
  );

  return { onSave, onClose };
}

function fillTransaction({ description = "Walmart", amount = "25.50" } = {}) {
  fireEvent.change(
    screen.getByRole("textbox", {
      name: /Description/i,
    }),
    {
      target: { value: description },
    },
  );

  fireEvent.change(screen.getByRole("spinbutton", {
  name: /Amount \(CAD\)/i,
}), {
    target: { value: amount },
  });
}

function submitForm() {
  const button = screen.getByRole("button", { name: "Save Transaction" });

  fireEvent.submit(button.closest("form"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// --------------------------------------------------
// RENDERING
// --------------------------------------------------

describe("TransactionForm rendering", () => {
  it("renders the add transaction form", () => {
    renderForm();

    expect(screen.getByText("Add Transaction")).toBeTruthy();

    expect(
      screen.getByRole("textbox", {
        name: /Description/i,
      }),
    ).toBeTruthy();

    expect(screen.getByRole("spinbutton", {
  name: /Amount \(CAD\)/i,
})).toBeTruthy();

    expect(
      screen.getByRole("button", {
        name: "Save Transaction",
      }),
    ).toBeTruthy();
  });

  it("renders existing transaction values for editing", () => {
    renderForm({
      transaction: {
        date: "2026-11-18",
        description: "Costco",
        amount: 75.5,
        category: "Groceries",
        type: "expense",
      },
    });

    expect(screen.getByText("Edit Transaction")).toBeTruthy();

    expect(
      screen.getByRole("textbox", {
        name: /Description/i,
      }).value,
    ).toBe("Costco");

    expect(screen.getByRole("spinbutton", {
  name: /Amount \(CAD\)/i,
}).value).toBe("75.5");
  });
});

// --------------------------------------------------
// VALID SUBMISSION
// --------------------------------------------------

describe("TransactionForm submission", () => {
  it("submits a valid transaction", async () => {
    const { onSave, onClose } = renderForm();

    fillTransaction({
      description: "Walmart",
      amount: "25.50",
    });

    submitForm();

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Walmart",
        amount: 25.5,
        type: "expense",
      }),
    );

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("trims description whitespace before saving", async () => {
    const { onSave } = renderForm();

    fillTransaction({
      description: "  Costco  ",
      amount: "50",
    });

    submitForm();

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Costco",
          amount: 50,
        }),
      );
    });
  });
});

// --------------------------------------------------
// INVALID INPUT
// --------------------------------------------------

describe("TransactionForm validation", () => {
  it("rejects an empty description", async () => {
    const { onSave } = renderForm();

    fillTransaction({
      description: "   ",
      amount: "25",
    });

    submitForm();

    expect(await screen.findByText(/Enter a valid description/)).toBeTruthy();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("rejects amounts with more than two decimals", async () => {
    const { onSave } = renderForm();

    fillTransaction({
      description: "Coffee",
      amount: "12.345",
    });

    submitForm();

    expect(await screen.findByText(/Enter a valid description/)).toBeTruthy();

    expect(onSave).not.toHaveBeenCalled();
  });
});

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

describe("TransactionForm error handling", () => {
  it("displays an error if saving fails", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new Error("Unable to save transaction"));

    const onClose = vi.fn();

    renderForm({
      onSave,
      onClose,
    });

    fillTransaction();

    submitForm();

    expect(await screen.findByText("Unable to save transaction")).toBeTruthy();

    expect(onClose).not.toHaveBeenCalled();
  });
});

// --------------------------------------------------
// CANCEL
// --------------------------------------------------

describe("TransactionForm cancel", () => {
  it("closes without saving when Cancel is clicked", () => {
    const { onSave, onClose } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
