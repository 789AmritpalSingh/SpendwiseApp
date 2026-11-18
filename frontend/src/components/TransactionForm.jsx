import { useState } from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Alert,
} from "@mui/material";

import { categorizeTransaction } from "../utils/categorize";

const emptyTransaction = {
  date: new Date().toLocaleDateString("en-CA"),
  description: "",
  amount: "",
  category: "Other",
  type: "expense",
};

const categories = [
  "Groceries",
  "Food & Dining",
  "Entertainment",
  "Transportation",
  "Housing",
  "Utilities",
  "Salary",
  "Other Income",
  "Other",
];

export default function TransactionForm({
  open,
  onClose,
  onSave,
  transaction,
}) {
  const [form, setForm] = useState(() =>
    transaction
      ? {
          date: transaction.date,
          description: transaction.description,
          amount: String(transaction.amount),
          category: transaction.category,
          type: transaction.type,
        }
      : {
          ...emptyTransaction,
          date: new Date().toLocaleDateString("en-CA"),
        },
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleDescription = (description) => {
    setForm((previous) => ({
      ...previous,
      description,
      category: categorizeTransaction(description, previous.type),
    }));
  };

  const handleType = (type) => {
    setForm((previous) => ({
      ...previous,
      type,
      category: categorizeTransaction(previous.description, type),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const amount = Number(form.amount);

    if (
      !form.description.trim() ||
      !form.date ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(String(form.amount))
    ) {
      setError(
        "Enter a valid description, date and positive amount (max 2 decimals).",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        ...form,
        description: form.description.trim(),
        amount,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {transaction ? "Edit Transaction" : "Add Transaction"}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              select
              label="Transaction Type"
              value={form.type}
              onChange={(e) => handleType(e.target.value)}
              fullWidth
            >
              <MenuItem value="expense">Expense</MenuItem>
              <MenuItem value="income">Income</MenuItem>
            </TextField>

            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => handleDescription(e.target.value)}
              required
              fullWidth
              inputProps={{ maxLength: 200 }}
            />

            <TextField
              label="Amount (CAD)"
              type="number"
              value={form.amount}
              onChange={(e) => updateField("amount", e.target.value)}
              inputProps={{ min: "0.01", step: "0.01" }}
              required
              fullWidth
            />

            <TextField
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
            />

            <TextField
              select
              label="Category"
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
              fullWidth
            >
              {categories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? "Saving..." : "Save Transaction"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
