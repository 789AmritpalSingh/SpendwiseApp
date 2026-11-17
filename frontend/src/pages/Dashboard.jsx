
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { transactions } from "../data/mockTransactions";

const COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
];

const money = (amount) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);

export default function Dashboard() {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = income - expenses;

  const savingsRate =
    income > 0 ? (balance / income) * 100 : 0;

  const categoryTotals = {};

  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      categoryTotals[t.category] =
        (categoryTotals[t.category] || 0) + t.amount;
    });

  const categoryData = Object.entries(categoryTotals)
    .map(([name, value]) => ({
      name,
      value,
    }));

  // Current sample dataset contains November transactions.
  const monthlyData = [
    {
      month: "Nov",
      Income: income,
      Expenses: expenses,
    },
  ];

  const cards = [
    {
      label: "Total Income",
      value: money(income),
      color: "#16a34a",
    },
    {
      label: "Total Expenses",
      value: money(expenses),
      color: "#dc2626",
    },
    {
      label: "Current Balance",
      value: money(balance),
      color: "#2563eb",
    },
    {
      label: "Savings Rate",
      value: `${savingsRate.toFixed(1)}%`,
      color: "#8b5cf6",
    },
  ];

  return (
    <Box>
      <Typography variant="h4" fontWeight={700}>
        Dashboard
      </Typography>

      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Your financial overview — November 2026
      </Typography>

      <Grid container spacing={3}>
        {cards.map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography color="text.secondary">
                  {card.label}
                </Typography>

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

        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Income vs Expenses
              </Typography>

              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => money(value)} />
                    <Legend />
                    <Bar
                      dataKey="Income"
                      fill="#16a34a"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="Expenses"
                      fill="#ef4444"
                      radius={[6, 6, 0, 0]}
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

              <Box sx={{ height: 300 }}>
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
                      {categoryData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => money(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Savings Overview
              </Typography>

              <Typography color="text.secondary" sx={{ mb: 1 }}>
                {money(balance)} remaining from {money(income)}
              </Typography>

              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, savingsRate))}
                sx={{ height: 10, borderRadius: 5 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Recent Transactions
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
                    {[...transactions].reverse().map((t) => (
                      <TableRow key={t.id} hover>
                        <TableCell>{t.date}</TableCell>
                        <TableCell>{t.description}</TableCell>
                        <TableCell>{t.category}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={t.type}
                            color={
                              t.type === "income"
                                ? "success"
                                : "error"
                            }
                          />
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color:
                              t.type === "income"
                                ? "success.main"
                                : "error.main",
                            fontWeight: 600,
                          }}
                        >
                          {t.type === "income" ? "+" : "-"}
                          {money(t.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
