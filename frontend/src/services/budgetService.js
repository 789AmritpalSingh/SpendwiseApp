
export async function getBudgets(apiRequest, month) {
  return apiRequest(`/api/budgets/${month}`);
}

export async function saveBudget(
  apiRequest,
  month,
  category,
  limit
) {
  return apiRequest(`/api/budgets/${month}`, {
    method: "PUT",
    body: JSON.stringify({
      category,
      limit_cents: Math.round(limit * 100),
    }),
  });
}

export async function deleteBudget(
  apiRequest,
  month,
  category
) {
  return apiRequest(
    `/api/budgets/${month}/${encodeURIComponent(category)}`,
    { method: "DELETE" }
  );
}
