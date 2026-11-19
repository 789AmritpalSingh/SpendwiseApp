
import { useCallback } from "react";
import { useAuth } from "@clerk/react";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

export function useApi() {
  const { getToken } = useAuth();

  const apiRequest = useCallback(
    async (path, options = {}) => {
      // Get the current Clerk session token
      const token = await getToken();

      if (!token) {
        throw new Error("Please sign in again.");
      }

      // Send authenticated request to FastAPI
      const response = await fetch(
        `${API_BASE}${path}`,
        {
          ...options,
          headers: {
            ...(options.body
              ? { "Content-Type": "application/json" }
              : {}),
            ...options.headers,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Handle API errors
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Your session has expired or is invalid."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "You do not have permission to perform this action."
          );
        }

        throw new Error(
          `Request failed (${response.status})`
        );
      }

      // Handle successful requests without a response body
      if (response.status === 204) {
        return null;
      }

      return response.json();
    },
    [getToken]
  );

  return apiRequest;
}
