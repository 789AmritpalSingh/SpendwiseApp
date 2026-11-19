
export async function getAnalytics(apiRequest, month) {
  return apiRequest(
    `/api/analytics?month=${encodeURIComponent(month)}`
  );
}
