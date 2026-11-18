
const API_BASE = "http://127.0.0.1:8000/api/analytics";

export async function getAnalytics(month) {
  const response = await fetch(
    `${API_BASE}?month=${encodeURIComponent(month)}`
  );

  if (!response.ok) {
    throw new Error("Failed to load analytics");
  }

  return response.json();
}
