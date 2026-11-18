import MonthYearSelector, {
  formatMonthYear,
} from "../components/MonthYearSelector";
import { formatTransactionDate } from "../utils/date";

import { useEffect, useState } from "react";

import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { getAnalytics } from "../services/analyticsService";
import { getTransactions } from "../services/transactionService";
import { getBudgets } from "../services/budgetService";

const COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
];

const money = (cents) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);

export default function Dashboard() {
  const [month, setMonth] = useState(
    new Date().toLocaleDateString("en-CA").slice(0, 7),
  );

  const [analytics, setAnalytics] = useState({
    income_cents: 0,
    expenses_cents: 0,
    balance_cents: 0,
    savings_rate: 0,
    monthly_trend: [],
    category_breakdown: [],
  });
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setAnalytics({
        income_cents: 0,
        expenses_cents: 0,
        balance_cents: 0,
        savings_rate: 0,
        monthly_trend: [],
        category_breakdown: [],
      });

      setTransactions([]);
      setBudgets([]);
      setError("");

      try {
        const [analyticsData, transactionData, budgetData] = await Promise.all([
          getAnalytics(month),
          getTransactions(),
          getBudgets(month),
        ]);

        if (active) {
          setAnalytics(analyticsData);
          setTransactions(transactionData);
          setBudgets(budgetData);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [month]);

  const summaryCards = [
    {
      label: "Monthly Income",
      value: money(analytics.income_cents),
      color: "success.main",
    },
    {
      label: "Monthly Expenses",
      value: money(analytics.expenses_cents),
      color: "error.main",
    },
    {
      label: "Monthly Balance",
      value: money(analytics.balance_cents),
      color: "primary.main",
    },
    {
      label: "Savings Rate",
      value: `${analytics.savings_rate}%`,
      color: "secondary.main",
    },
  ];

  const trendData = analytics.monthly_trend.map((item) => ({
    month: new Date(`${item.month}-01T12:00:00`).toLocaleDateString("en-CA", {
      month: "short",
      year: "numeric",
    }),
    Income: item.income_cents / 100,
    Expenses: item.expenses_cents / 100,
  }));

  const categoryData = analytics.category_breakdown.map((item) => ({
    name: item.category,
    value: item.amount_cents / 100,
  }));

  const recentTransactions = transactions
    .filter((t) => t.date.startsWith(month))
    .slice(0, 5);

  const budgetWarnings = budgets.filter(
    (budget) => budget.status !== "on_track",
  );

  return (
    <Box>
      {loading && <CircularProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Unable to load data for this month: {error}
        </Alert>
      )}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Financial Dashboard
          </Typography>

          <Typography color="text.secondary">
            Track your income, expenses and savings
          </Typography>
        </Box>

        <MonthYearSelector value={month} onChange={setMonth} />
      </Stack>

      {!loading && !error && (
        <Grid container spacing={3}>
          {summaryCards.map((card) => (
            <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <Typography color="text.secondary">{card.label}</Typography>

                  <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{ color: card.color, mt: 1 }}
                  >
                    {card.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {budgetWarnings.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="warning">
                {budgetWarnings.length} budget category(s) have reached at least
                80% of their monthly limit:{" "}
                {budgetWarnings.map((b) => b.category).join(", ")}.
              </Alert>
            </Grid>
          )}

          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Income vs Expenses — Last 6 Months
                </Typography>

                <Box sx={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) =>
                          new Intl.NumberFormat("en-CA", {
                            style: "currency",
                            currency: "CAD",
                          }).format(value)
                        }
                      />
                      <Legend />
                      <Bar
                        dataKey="Income"
                        fill="#16a34a"
                        radius={[5, 5, 0, 0]}
                      />
                      <Bar
                        dataKey="Expenses"
                        fill="#ef4444"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Spending by Category
                </Typography>

                {categoryData.length === 0 ? (
                  <Box
                    sx={{
                      height: 320,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography color="text.secondary">
                      No expenses for this month
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="45%"
                          outerRadius={85}
                        >
                          {categoryData.map((entry, i) => (
                            <Cell
                              key={entry.name}
                              fill={COLORS[i % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) =>
                            new Intl.NumberFormat("en-CA", {
                              style: "currency",
                              currency: "CAD",
                            }).format(value)
                          }
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Recent Transactions — {formatMonthYear(month)}
                </Typography>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {recentTransactions.map((t) => (
                        <TableRow key={t.id} hover>
                          <TableCell>{formatTransactionDate(t.date)}</TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell>{t.category}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={t.type}
                              color={t.type === "income" ? "success" : "error"}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {t.type === "income" ? "+" : "-"}
                            {new Intl.NumberFormat("en-CA", {
                              style: "currency",
                              currency: "CAD",
                            }).format(t.amount)}
                          </TableCell>
                        </TableRow>
                      ))}

                      {recentTransactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            No transactions for this month
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
