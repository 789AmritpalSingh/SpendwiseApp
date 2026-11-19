
export async function getTransactions(apiRequest) {
  const data = await apiRequest("/api/transactions");

  return data.map((transaction) => ({
    ...transaction,
    amount: transaction.amount_cents / 100,
  }));
}

export async function addTransaction(apiRequest, transaction) {
  const { amount, ...details } = transaction;

  return apiRequest("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      ...details,
      amount_cents: Math.round(amount * 100),
    }),
  });
}

export async function updateTransaction(
  apiRequest,
  id,
  transaction
) {
  const { amount, ...details } = transaction;

  return apiRequest(`/api/transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      ...details,
      amount_cents: Math.round(amount * 100),
    }),
  });
}

export async function deleteTransaction(apiRequest, id) {
  return apiRequest(`/api/transactions/${id}`, {
    method: "DELETE",
  });
}

export async function importTransactions(
  apiRequest,
  transactions
) {
  const payload = transactions.map(
    ({ amount, ...details }) => ({
      ...details,
      amount_cents: Math.round(amount * 100),
    })
  );

  return apiRequest("/api/transactions/bulk", {
    method: "POST",
    body: JSON.stringify({
      transactions: payload,
    }),
  });
}
