
const API_BASE = "http://127.0.0.1:8000/api/budgets";

export async function getBudgets(month) {
  const response = await fetch(`${API_BASE}/${month}`);

  if (!response.ok) {
    throw new Error("Failed to fetch budgets");
  }

  return response.json();
}

export async function saveBudget(month, category, limit) {
  const response = await fetch(`${API_BASE}/${month}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      category,
      limit_cents: Math.round(limit * 100),
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save budget");
  }

  return response.json();
}

export async function deleteBudget(month, category) {
  const response = await fetch(
    `${API_BASE}/${month}/${encodeURIComponent(category)}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error("Failed to delete budget");
  }
}
