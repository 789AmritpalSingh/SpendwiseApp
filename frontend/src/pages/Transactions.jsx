import { formatTransactionDate } from "../utils/date";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../hooks/useToast";
import {
  Box,
  Typography,
  Button,
  Card,
  TextField,
  MenuItem,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";

import { Add, Edit, Delete } from "@mui/icons-material";
import { useApi } from "../hooks/useApi";
import TransactionForm from "../components/TransactionForm";

import {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from "../services/transactionService";

const money = (amount) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);

export default function Transactions() {
  const apiRequest = useApi();
  const showToast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTransactions() {
    try {
      setError("");
      const data = await getTransactions(apiRequest);
      setTransactions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function fetchInitialTransactions() {
      try {
        const data = await getTransactions(apiRequest);

        if (active) {
          setTransactions(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchInitialTransactions();

    return () => {
      active = false;
    };
  }, [apiRequest]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesSearch =
        transaction.description.toLowerCase().includes(search.toLowerCase()) ||
        transaction.category.toLowerCase().includes(search.toLowerCase());

      const matchesType = filter === "all" || transaction.type === filter;

      return matchesSearch && matchesType;
    });
  }, [transactions, search, filter]);

  const handleSave = async (transaction) => {
    const isEditing = Boolean(editing);

    if (isEditing) {
      await updateTransaction(apiRequest, editing.id, transaction);
    } else {
      await addTransaction(apiRequest, transaction);
    }

    // Saving succeeded. Refresh the table.
    showToast(
      isEditing
        ? "Transaction updated successfully."
        : "Transaction added successfully.",
    );

    // Avoid claiming saving failed if only refresh fails.
    try {
      await loadTransactions();
    } catch {
      // loadTransactions already handles fetch errors.
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this transaction?")) {
      return;
    }

    try {
      await deleteTransaction(apiRequest, id);

      showToast("Transaction deleted successfully.");

      await loadTransactions();
    } catch (err) {
      setError(err.message);
      showToast("Unable to delete transaction.", "error");
    }
  };

  const openAddForm = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEditForm = (transaction) => {
    setEditing(transaction);
    setOpen(true);
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Transactions
          </Typography>
          <Typography color="text.secondary">
            Manage your income and expenses
          </Typography>
        </Box>

        <Button variant="contained" startIcon={<Add />} onClick={openAddForm}>
          Add Transaction
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Search transactions"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1 }}
          />

          <TextField
            select
            label="Type"
            size="small"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expenses</MenuItem>
          </TextField>
        </Stack>
      </Card>

      {loading ? (
        <CircularProgress />
      ) : (
        <Card>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id} hover>
                    <TableCell>
                      {formatTransactionDate(transaction.date)}
                    </TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>{transaction.category}</TableCell>
                    <TableCell>
                      <Chip
                        label={transaction.type}
                        color={
                          transaction.type === "income" ? "success" : "error"
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {transaction.type === "income" ? "+" : "-"}
                      {money(transaction.amount)}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label="Edit transaction"
                        onClick={() => openEditForm(transaction)}
                      >
                        <Edit fontSize="small" />
                      </IconButton>

                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete transaction"
                        onClick={() => handleDelete(transaction.id)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {open && (
        <TransactionForm
          key={editing?.id ?? "new"}
          open={open}
          transaction={editing}
          onClose={() => setOpen(false)}
          onSave={handleSave}
        />
      )}
    </Box>
  );
}
