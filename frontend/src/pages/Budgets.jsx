import MonthYearSelector, {
  formatMonthYear,
} from "../components/MonthYearSelector";
import { useEffect, useState } from "react";

import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  TextField,
  MenuItem,
  LinearProgress,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import { Add, Delete, Edit } from "@mui/icons-material";

import {
  getBudgets,
  saveBudget,
  deleteBudget,
} from "../services/budgetService";

const categories = [
  "Groceries",
  "Food & Dining",
  "Entertainment",
  "Transportation",
  "Housing",
  "Utilities",
  "Other",
];

const money = (cents) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);

export default function Budgets() {
  const [month, setMonth] = useState(
    new Date().toLocaleDateString("en-CA").slice(0, 7),
  );

  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState("Groceries");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setSuccess("");
      setBudgets([]);

      try {
        const data = await getBudgets(month);
        if (active) setBudgets(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [month]);

  async function refresh() {
    const data = await getBudgets(month);
    setBudgets(data);
  }

  const availableCategories = categories.filter(
    (name) => !budgets.some((budget) => budget.category === name),
  );

  function openAdd() {
    if (availableCategories.length === 0) return;

    setEditing(false);
    setCategory(availableCategories[0]);
    setLimit("");
    setDialogOpen(true);
  }

  function openEdit(budget) {
    setEditing(true);
    setCategory(budget.category);
    setLimit(String(budget.limit_cents / 100));
    setDialogOpen(true);
  }

  async function handleSave(event) {
    event.preventDefault();

    const amount = Number(limit);

    if (
      !/^\d+(\.\d{1,2})?$/.test(limit) ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("Enter a valid positive budget amount (max 2 decimals).");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await saveBudget(month, category, amount);
      await refresh();
      setDialogOpen(false);
      setSuccess("Budget saved successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(budget) {
    if (
      !window.confirm(
        `Delete the ${budget.category} budget for ${formatMonthYear(month)}?`,
      )
    )
      return;

    try {
      setError("");
      await deleteBudget(month, budget.category);
      await refresh();
      setSuccess("Budget deleted successfully.");
    } catch (err) {
      setError(err.message);
    }
  }

  const totalLimit = budgets.reduce(
    (sum, budget) => sum + budget.limit_cents,
    0,
  );

  const totalSpent = budgets.reduce(
    (sum, budget) => sum + budget.spent_cents,
    0,
  );

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
            Monthly Budgets
          </Typography>
          <Typography color="text.secondary">
            Set your limits and track your spending
          </Typography>
        </Box>

        <Stack direction="row" spacing={2}>
          <MonthYearSelector value={month} onChange={setMonth} />

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openAdd}
            disabled={availableCategories.length === 0 || loading}
          >
            Add Budget
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary">Total Budgeted</Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {money(totalLimit)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary">
                    Spending in Budgeted Categories
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {money(totalSpent)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {budgets.length === 0 && (
            <Alert severity="info">
              No budgets for this month. Click Add Budget to get started.
            </Alert>
          )}

          <Grid container spacing={3}>
            {budgets.map((budget) => {
              const color =
                budget.status === "exceeded"
                  ? "error"
                  : budget.status === "warning"
                    ? "warning"
                    : "success";

              const label =
                budget.status === "exceeded"
                  ? "Limit reached"
                  : budget.status === "warning"
                    ? "Approaching limit"
                    : "On track";

              return (
                <Grid key={budget.id} size={{ xs: 12, md: 6 }}>
                  <Card sx={{ height: "100%" }}>
                    <CardContent>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Typography variant="h6">{budget.category}</Typography>

                        <Stack direction="row">
                          <IconButton
                            aria-label="Edit budget"
                            onClick={() => openEdit(budget)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>

                          <IconButton
                            aria-label="Delete budget"
                            color="error"
                            onClick={() => handleDelete(budget)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>

                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        {money(budget.spent_cents)} spent of{" "}
                        {money(budget.limit_cents)}
                      </Typography>

                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, budget.percentage)}
                        color={color}
                        sx={{
                          height: 12,
                          borderRadius: 6,
                          mt: 2,
                          mb: 1,
                        }}
                      />

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mt: 2 }}
                      >
                        <Chip size="small" label={label} color={color} />

                        <Typography fontWeight={700}>
                          {budget.percentage}%
                        </Typography>
                      </Stack>

                      <Typography
                        color="text.secondary"
                        variant="body2"
                        sx={{ mt: 2 }}
                      >
                        {budget.remaining_cents >= 0
                          ? `${money(budget.remaining_cents)} remaining`
                          : `${money(-budget.remaining_cents)} over budget`}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={handleSave}>
          <DialogTitle>
            {editing ? "Edit Budget" : "Add Monthly Budget"}
          </DialogTitle>

          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="Month"
                value={formatMonthYear(month)}
                slotProps={{ input: { readOnly: true } }}
                fullWidth
              />
              <TextField
                select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={editing}
                fullWidth
              >
                {(editing ? [category] : availableCategories).map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Budget Limit (CAD)"
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                inputProps={{
                  min: "0.01",
                  step: "0.01",
                }}
                required
                fullWidth
              />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 3 }}>
            <Button disabled={saving} onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>

            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving..." : "Save Budget"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
