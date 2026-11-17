
const API_URL = "http://127.0.0.1:8000/api/transactions";

export async function getTransactions() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error("Unable to load transactions");
  }

  const data = await response.json();

  return data.map((transaction) => ({
    ...transaction,
    amount: transaction.amount_cents / 100,
  }));
}

export async function addTransaction(transaction) {
  const { amount, ...details } = transaction;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...details,
      amount_cents: Math.round(amount * 100),
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to add transaction");
  }

  return response.json();
}

export async function updateTransaction(id, transaction) {
  const { amount, ...details } = transaction;

  const response = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...details,
      amount_cents: Math.round(amount * 100),
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to update transaction");
  }

  return response.json();
}

export async function deleteTransaction(id) {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Unable to delete transaction");
  }

  return response.json();
}
