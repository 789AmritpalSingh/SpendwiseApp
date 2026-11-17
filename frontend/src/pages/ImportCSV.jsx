
import { useState } from "react";
import Papa from "papaparse";

import {
  Box,
  Typography,
  Button,
  Card,
  Alert,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TextField,
  MenuItem,
  Chip,
} from "@mui/material";

import { UploadFile } from "@mui/icons-material";

import { categorizeTransaction } from "../utils/categorize";
import { importTransactions } from "../services/transactionService";

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

const money = (amount) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);

function parseAmount(value) {
  const text = String(value ?? "").trim();

  // This MVP accepts positive values with up to two decimals.
  // Values such as $1,234.00 or (25.00) require bank mapping later.
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(`Invalid amount: ${text}`);
  }

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Amount must be positive: ${text}`);
  }

  return amount;
}

function normalizeRow(row, index) {
  const date = String(row.Date ?? "").trim();
  const description = String(row.Description ?? "").trim();
  const type = String(row.Type ?? "").trim().toLowerCase();
  const amount = parseAmount(row.Amount);

  const parsedDate = new Date(`${date}T12:00:00Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Row ${index}: Invalid date`);
  }

  if (!description || description.length > 200) {
    throw new Error(`Row ${index}: Invalid description`);
  }

  if (!["income", "expense"].includes(type)) {
    throw new Error(`Row ${index}: Type must be income or expense`);
  }

  return {
    date,
    description,
    amount,
    type,
    category: categorizeTransaction(description, type),
  };
}

export default function ImportCSV() {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setResult(null);
    setTransactions([]);
    setFileName(file.name);

    // Limit size for the first version.
    if (file.size > 2 * 1024 * 1024) {
      setError("File must be smaller than 2 MB.");
      event.target.value = "";
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        try {
          if (results.errors.length) {
            throw new Error(results.errors[0].message);
          }

          const required = ["Date", "Description", "Amount", "Type"];

          if (!required.every((column) =>
            results.meta.fields?.includes(column)
          )) {
            throw new Error(
              "CSV must have Date, Description, Amount and Type columns."
            );
          }

          if (results.data.length === 0) {
            throw new Error("CSV file is empty.");
          }

          if (results.data.length > 500) {
            throw new Error("Maximum 500 transactions per import.");
          }

          const normalized = results.data.map((row, index) =>
            normalizeRow(row, index + 2)
          );

          setTransactions(normalized);
        } catch (err) {
          setError(err.message);
        }
      },
      error: (err) => setError(err.message),
    });

    // Allows selecting the same file again after editing it.
    event.target.value = "";
  }

  function updateCategory(index, category) {
    setTransactions((previous) =>
      previous.map((transaction, i) =>
        i === index ? { ...transaction, category } : transaction
      )
    );
  }

  async function handleImport() {
    if (transactions.length === 0) return;

    setImporting(true);
    setError("");

    try {
      const response = await importTransactions(transactions);

      setResult(response);
      setTransactions([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700}>
        Import Transactions
      </Typography>

      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Upload a CSV and review your transactions before saving.
      </Typography>

      <Card sx={{ p: 4, mb: 3, textAlign: "center" }}>
        <UploadFile sx={{ fontSize: 52, color: "primary.main" }} />

        <Typography variant="h6" sx={{ my: 2 }}>
          Upload CSV File
        </Typography>

        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Required columns: Date, Description, Amount, Type
        </Typography>

        <Button variant="contained" component="label">
          Choose CSV
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
          />
        </Button>

        {fileName && (
          <Typography sx={{ mt: 2 }}>
            Selected: {fileName}
          </Typography>
        )}
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Import complete: {result.inserted} inserted,
          {" "}{result.skipped} skipped as duplicates.
        </Alert>
      )}

      {transactions.length > 0 && (
        <Card sx={{ p: 2 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">
              Preview ({transactions.length} transactions)
            </Typography>

            <Button
              variant="contained"
              disabled={importing}
              onClick={handleImport}
            >
              {importing ? "Importing..." : "Import All"}
            </Button>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {transactions.map((transaction, index) => (
                  <TableRow key={index}>
                    <TableCell>{transaction.date}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>
                      <Chip
                        label={transaction.type}
                        size="small"
                        color={
                          transaction.type === "income"
                            ? "success"
                            : "error"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={transaction.category}
                        onChange={(e) =>
                          updateCategory(index, e.target.value)
                        }
                        sx={{ minWidth: 150 }}
                      >
                        {categories.map((category) => (
                          <MenuItem key={category} value={category}>
                            {category}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell align="right">
                      {money(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
}
