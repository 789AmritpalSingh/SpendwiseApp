import { useState } from "react";
import Papa from "papaparse";
import { useToast } from "../hooks/useToast";
import { useApi } from "../hooks/useApi";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { UploadFile } from "@mui/icons-material";
import { categorizeTransaction } from "../utils/categorize";
import { importTransactions } from "../services/transactionService";

const categories = [
  "Groceries", "Food & Dining", "Entertainment", "Transportation",
  "Housing", "Utilities", "Salary", "Other Income", "Other",
];

const aliases = {
  date: ["date", "transaction date", "posting date", "posted date", "trans date", "value date"],
  description: ["description", "transaction description", "details", "transaction details", "merchant", "payee", "memo", "narrative"],
  amount: ["amount", "transaction amount", "total", "value"],
  debit: ["debit", "withdrawal", "withdrawals", "money out", "paid out", "debits"],
  credit: ["credit", "deposit", "deposits", "money in", "paid in", "credits"],
  type: ["type", "transaction type", "type of transaction", "debit credit", "dr cr"],
};

function normalizedHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function guessColumn(headers, field) {
  return headers.find((header) => aliases[field].includes(normalizedHeader(header))) ?? "";
}

function parseMoney(raw) {
  let value = String(raw ?? "").trim();
  if (!value) return null;

  // Examples: -1,234.50, $1,234.50, (1,234.50), 123.45 CR
  const isParenthesized = /^\(.*\)$/.test(value);
  if (isParenthesized) value = value.slice(1, -1);
  const suffix = value.match(/\s+(CR|DR)$/i)?.[1]?.toUpperCase();
  value = value.replace(/\s+(CR|DR)$/i, "");
  value = value.replace(/[$£€\s,]/g, "");
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(`Unsupported amount: ${String(raw)}`);
  }
  let number = Number(value);
  if (isParenthesized || suffix === "DR") number = -Math.abs(number);
  if (suffix === "CR") number = Math.abs(number);
  if (!Number.isFinite(number)) throw new Error("Invalid amount");
  return number;
}

function formatDate(raw, dateOrder) {
  const text = String(raw ?? "").trim();
  let year, month, day;
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    [, year, month, day] = match;
  } else {
    match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!match) throw new Error(`Unsupported date: ${text || "(blank)"}`);
    year = match[3];
    [month, day] = dateOrder === "MDY" ? [match[1], match[2]] : [match[2], match[1]];
  }

  const y = Number(year), m = Number(month), d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== m || date.getUTCDate() !== d) {
    throw new Error(`Invalid date: ${text}`);
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function determineType(typeText, signedAmount, positiveMeans) {
  const type = String(typeText ?? "").trim().toLowerCase();
  if (["income", "credit", "cr", "deposit", "money in", "in"].includes(type)) return "income";
  if (["expense", "debit", "dr", "withdrawal", "purchase", "money out", "out"].includes(type)) return "expense";
  if (signedAmount < 0) return "expense";
  return positiveMeans;
}

function normalizeTransaction(row, mapping, amountMode, dateOrder, positiveMeans) {
  const date = formatDate(row[mapping.date], dateOrder);
  const description = String(row[mapping.description] ?? "").trim();
  if (!description || description.length > 200) throw new Error("Description must be 1–200 characters");

  let amount;
  let type;
  if (amountMode === "separate") {
    const debit = mapping.debit ? parseMoney(row[mapping.debit]) : null;
    const credit = mapping.credit ? parseMoney(row[mapping.credit]) : null;
    const hasDebit = debit !== null && debit !== 0;
    const hasCredit = credit !== null && credit !== 0;
    if (hasDebit === hasCredit) throw new Error("Exactly one of Debit or Credit must contain an amount");
    type = hasDebit ? "expense" : "income";
    amount = Math.abs(hasDebit ? debit : credit);
  } else {
    const signedAmount = parseMoney(row[mapping.amount]);
    if (signedAmount === null || signedAmount === 0) throw new Error("Amount is missing or zero");
    type = determineType(mapping.type ? row[mapping.type] : "", signedAmount, positiveMeans);
    amount = Math.abs(signedAmount);
  }

  // FastAPI validates a strictly positive integer number of cents (max $10,000,000).
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 1_000_000_000) {
    throw new Error("Amount is outside the supported range");
  }

  return {
    date,
    description,
    amount: cents / 100,
    type,
    category: categorizeTransaction(description, type),
  };
}

// Each active role must use a different bank CSV column.
// Disable columns already assigned elsewhere instead of waiting for an error.
function ColumnPicker({ label, value, onChange, headers, usedBy = {}, optional = false }) {
  return (
    <TextField
      select
      label={label}
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      fullWidth
    >
      {optional && <MenuItem value="">Not used</MenuItem>}
      {headers.map((header) => (
        <MenuItem key={header} value={header} disabled={Boolean(usedBy[header]) && header !== value}>
          {header}{usedBy[header] && header !== value ? ` (used for ${usedBy[header]})` : ""}
        </MenuItem>
      ))}
    </TextField>
  );
}

const mappingLabels = {
  date: "Date", description: "Description", amount: "Amount",
  type: "Type", debit: "Debit", credit: "Credit",
};

function activeMappingFields(amountMode) {
  return amountMode === "single"
    ? ["date", "description", "amount", "type"]
    : ["date", "description", "debit", "credit"];
}

const money = (value) => new Intl.NumberFormat("en-CA", {
  style: "currency", currency: "CAD",
}).format(value);

export default function ImportCSV() {
  const apiRequest = useApi();
  const showToast = useToast();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({ date: "", description: "", amount: "", debit: "", credit: "", type: "" });
  const [amountMode, setAmountMode] = useState("single");
  const [dateOrder, setDateOrder] = useState("MDY");
  const [positiveMeans, setPositiveMeans] = useState("expense");
  const [categoryEdits, setCategoryEdits] = useState({});
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);

  function resetPreview() {
    setRows([]);
    setHeaders([]);
    setCategoryEdits({});
    setError("");
    setResult(null);
  }

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (importing) return;
    resetPreview();
    setFileName(file.name);

    if (file.size > 2 * 1024 * 1024) {
      setError("File must be smaller than 2 MB.");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: (results) => {
        if (results.errors.length) {
          setError(`CSV parsing error: ${results.errors[0].message}`);
          return;
        }
        const parsedHeaders = results.meta.fields ?? [];
        if (!parsedHeaders.length || !results.data.length) {
          setError("CSV is empty or has no headers.");
          return;
        }
        if (results.data.length > 500) {
          setError("Maximum 500 transactions per CSV. Split larger exports into smaller files.");
          return;
        }
        const detected = {
          date: guessColumn(parsedHeaders, "date"),
          description: guessColumn(parsedHeaders, "description"),
          amount: guessColumn(parsedHeaders, "amount"),
          debit: guessColumn(parsedHeaders, "debit"),
          credit: guessColumn(parsedHeaders, "credit"),
          type: guessColumn(parsedHeaders, "type"),
        };
        setMapping(detected);
        setAmountMode(detected.debit && detected.credit ? "separate" : "single");
        setDateOrder("MDY");
        setPositiveMeans("expense");
        setHeaders(parsedHeaders);
        setRows(results.data);
      },
      error: (parseError) => setError(parseError.message),
    });
  }

  const activeFields = activeMappingFields(amountMode);
  const usedColumns = {};
  for (const field of activeFields) {
    if (mapping[field] && !usedColumns[mapping[field]]) {
      usedColumns[mapping[field]] = mappingLabels[field];
    }
  }

  const preview = (() => {
    if (!rows.length) return { transactions: [], errors: [] };

    // Validate mapping before interpreting any financial data.
    const fields = activeMappingFields(amountMode);
    const assigned = new Map();
    for (const field of fields) {
      const column = mapping[field];
      if (!column) continue;
      if (assigned.has(column)) {
        return {
          transactions: [],
          errors: [`Column "${column}" cannot be used for both ${mappingLabels[assigned.get(column)]} and ${mappingLabels[field]}. Choose different columns.`],
        };
      }
      assigned.set(column, field);
    }

    if (!mapping.date || !mapping.description) {
      return { transactions: [], errors: ["Select a Date column and a Description column to continue."] };
    }

    if (amountMode === "single" && !mapping.amount) {
      return { transactions: [], errors: ["Select the Amount column. If your file has separate Debit and Credit columns, change Amount layout."] };
    }

    if (amountMode === "separate" && (!mapping.debit || !mapping.credit)) {
      const looksLikeSingleAmount = headers.some((header) => aliases.amount.includes(normalizedHeader(header)));
      return {
        transactions: [],
        errors: [looksLikeSingleAmount
          ? 'This CSV appears to have one Amount column, not separate Debit and Credit columns. Select "One Amount column" under Amount layout.'
          : 'Separate Debit / Credit layout requires two distinct columns. Select both Debit and Credit, or switch to "One Amount column".'],
      };
    }

    const transactions = [];
    const errors = [];
    rows.forEach((row, index) => {
      try {
        const transaction = normalizeTransaction(row, mapping, amountMode, dateOrder, positiveMeans);
        transactions.push({
          ...transaction,
          category: categoryEdits[index] ?? transaction.category,
        });
      } catch (parseError) {
        errors.push(`CSV row ${index + 2}: ${parseError.message}`);
      }
    });
    return { transactions, errors };
  })();

  // Fail closed: never silently import only a subset of a statement.
  const readyToImport = rows.length > 0 && preview.errors.length === 0 &&
    preview.transactions.length === rows.length && !importing;

  async function handleImport() {
    if (!readyToImport) return;
    setImporting(true);
    setError("");
    try {
      // Retain one CSV per batch for the existing duplicate-import protection.
      const response = await importTransactions(apiRequest, preview.transactions);
      setResult(response);
      showToast(`${response.inserted} transactions imported, ${response.skipped} skipped.`);
      setRows([]);
      setCategoryEdits({});
    } catch (importError) {
      setError(importError.message);
      showToast("CSV import failed.", "error");
    } finally {
      setImporting(false);
    }
  }

  const updateMapping = (field, value) => {
    setMapping((previous) => {
      // A safety check as well as the disabled options in ColumnPicker.
      const conflicts = activeMappingFields(amountMode).some(
        (other) => other !== field && value && previous[other] === value,
      );
      return conflicts ? previous : { ...previous, [field]: value };
    });
    setCategoryEdits({});
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700}>Import Transactions</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Upload one bank CSV, match its columns, review transactions, then import.
      </Typography>

      <Card sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2} alignItems="flex-start">
          <UploadFile color="primary" sx={{ fontSize: 42 }} />
          <Typography variant="h6">Upload a bank CSV</Typography>
          <Button variant="contained" component="label" disabled={importing}>
            Choose CSV
            <input hidden type="file" accept=".csv,text/csv" onChange={handleFile} />
          </Button>
          {fileName && <Typography>Selected: {fileName}</Typography>}
          <Typography color="text.secondary" variant="body2">
            One CSV at a time • up to 500 transactions • max 2 MB • no PDF statements
          </Typography>
        </Stack>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Import complete: {result.inserted} inserted, {result.skipped} skipped as duplicates.
        </Alert>
      )}

      {rows.length > 0 && (
        <>
          <Card sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Match bank CSV columns</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
              <ColumnPicker label="Date column" value={mapping.date} headers={headers} usedBy={usedColumns} onChange={(v) => updateMapping("date", v)} optional />
              <ColumnPicker label="Description column" value={mapping.description} headers={headers} usedBy={usedColumns} onChange={(v) => updateMapping("description", v)} optional />
              <TextField select label="Amount layout" size="small" fullWidth value={amountMode}
                onChange={(e) => { setAmountMode(e.target.value); setCategoryEdits({}); }}>
                <MenuItem value="single">One Amount column</MenuItem>
                <MenuItem value="separate">Separate Debit / Credit columns</MenuItem>
              </TextField>
              <TextField select label="Date format (only for non-YYYY-MM-DD dates)" size="small" fullWidth value={dateOrder}
                onChange={(e) => { setDateOrder(e.target.value); setCategoryEdits({}); }}>
                <MenuItem value="MDY">Month / Day / Year</MenuItem>
                <MenuItem value="DMY">Day / Month / Year</MenuItem>
              </TextField>
              {amountMode === "single" ? (
                <>
                  <ColumnPicker label="Amount column" value={mapping.amount} headers={headers} usedBy={usedColumns} onChange={(v) => updateMapping("amount", v)} optional />
                  <ColumnPicker label="Type column (optional)" value={mapping.type} headers={headers} usedBy={usedColumns} onChange={(v) => updateMapping("type", v)} optional />
                  <TextField select label="Positive amounts without a recognized type mean" size="small" fullWidth
                    value={positiveMeans} onChange={(e) => { setPositiveMeans(e.target.value); setCategoryEdits({}); }}>
                    <MenuItem value="expense">Expense (card purchases)</MenuItem>
                    <MenuItem value="income">Income (deposits)</MenuItem>
                  </TextField>
                </>
              ) : (
                <>
                  <ColumnPicker label="Debit column" value={mapping.debit} headers={headers} usedBy={usedColumns} onChange={(v) => updateMapping("debit", v)} optional />
                  <ColumnPicker label="Credit column" value={mapping.credit} headers={headers} usedBy={usedColumns} onChange={(v) => updateMapping("credit", v)} optional />
                </>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {amountMode === "single"
                ? "One Amount column is used for signed amounts (negative debit, positive credit) or a separate transaction type column."
                : "Use this layout only when the CSV has two separate columns: one for Debit and one for Credit."}
              {" "}Dates already formatted YYYY-MM-DD are detected automatically.
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              Confirm that debit and credit directions are correct before importing. Refunds,
              transfers and credit-card payments may require review.
            </Alert>
          </Card>

          {preview.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Import blocked: {preview.errors.length} problem(s). Fix the mapping or file first.
              <Box component="ul" sx={{ mb: 0, pl: 3 }}>
                {preview.errors.slice(0, 5).map((message, i) => <li key={i}>{message}</li>)}
              </Box>
              {preview.errors.length > 5 && <Typography variant="body2">More errors not shown.</Typography>}
            </Alert>
          )}

          <Card sx={{ p: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
              sx={{ mb: 2, justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}>
              <Typography variant="h6">Preview ({preview.transactions.length} of {rows.length} rows)</Typography>
              <Button variant="contained" disabled={!readyToImport} onClick={handleImport}>
                {importing ? "Importing..." : "Import All"}
              </Button>
            </Stack>
            <TableContainer sx={{ maxHeight: 480 }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow>
                  <TableCell>Date</TableCell><TableCell>Description</TableCell><TableCell>Type</TableCell>
                  <TableCell>Category</TableCell><TableCell align="right">Amount</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {preview.transactions.map((transaction, index) => (
                    <TableRow key={index}>
                      <TableCell>{transaction.date}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell><Chip size="small" label={transaction.type}
                        color={transaction.type === "income" ? "success" : "error"} /></TableCell>
                      <TableCell>
                        <TextField select size="small" value={transaction.category}
                          onChange={(event) => setCategoryEdits((old) => ({ ...old, [index]: event.target.value }))}
                          sx={{ minWidth: 145 }}>
                          {categories.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell align="right">{money(transaction.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {preview.transactions.length === 0 && <TableRow><TableCell colSpan={5} align="center">No valid rows to preview</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </Box>
  );
}
