
import { useCallback } from "react";
import { useAuth } from "@clerk/react";

const API_BASE =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000";


function getErrorMessage(status, data) {
    if (status === 401) {
        return "Your session has expired or is invalid. Please sign in again.";
    }

    if (status === 403) {
        return "You do not have permission to perform this action.";
    }

    // FastAPI/Pydantic field validation errors.
    if (status === 422 && Array.isArray(data?.detail)) {
        const errors = data.detail
            .slice(0, 3)
            .map((error) => {
                const location = Array.isArray(error.loc)
                    ? error.loc.filter(
                        (part) => part !== "body"
                    )
                    : [];

                const field = location.length
                    ? location.join(".")
                    : "Input";

                const message = String(
                    error.msg || "Invalid value"
                ).replace(
                    /^Value error,\s*/i,
                    ""
                );

                return `${field}: ${message}`;
            });

        if (errors.length > 0) {
            return errors.join("; ");
        }
    }

    // Don't expose server-side error details.
    if (status >= 500) {
        if (status === 503) {
            return (
                "Service temporarily unavailable. " +
                "Please try again shortly."
            );
        }

        return (
            "Something went wrong on the server. " +
            "Please try again."
        );
    }

    // FastAPI usually sends a string in "detail".
    if (typeof data?.detail === "string") {
        return data.detail;
    }

    if (status === 404) {
        return "The requested record was not found.";
    }

    if (status === 409) {
        return "This record conflicts with an existing record.";
    }

    if (status === 422) {
        return "Some information is invalid. Please check your input.";
    }

    if (status === 429) {
        return "Too many requests. Please try again later.";
    }

    return `Request failed (${status}).`;
}


export function useApi() {
    const { getToken } = useAuth();

    const apiRequest = useCallback(
        async (path, options = {}) => {
            // Obtain the current Clerk session token.
            const token = await getToken();

            if (!token) {
                throw new Error(
                    "Please sign in again."
                );
            }

            const headers = new Headers(
                options.headers
            );

            headers.set(
                "Authorization",
                `Bearer ${token}`
            );

            headers.set(
                "Accept",
                "application/json"
            );

            // Set JSON content type only when appropriate.
            if (
                options.body != null &&
                !(options.body instanceof FormData) &&
                !headers.has("Content-Type")
            ) {
                headers.set(
                    "Content-Type",
                    "application/json"
                );
            }

            let response;

            try {
                response = await fetch(
                    `${API_BASE}${path}`,
                    {
                        ...options,
                        headers,
                    }
                );
            } catch (error) {
                if (error?.name === "AbortError") {
                    throw error;
                }

                throw new Error(
                    "Unable to connect to SpendWise API. " +
                    "Check that the backend server is running.",
                    { cause: error }
                );
            }

            // A 204 response has no JSON body.
            if (response.status === 204) {
                return null;
            }

            const contentType =
                response.headers.get("content-type") ||
                "";

            let data = null;

            if (
                contentType.includes("application/json")
            ) {
                try {
                    data = await response.json();
                } catch {
                    if (response.ok) {
                        throw new Error(
                            "The server returned an invalid response."
                        );
                    }
                }
            }

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(
                        response.status,
                        data
                    )
                );
            }

            if (data === null) {
                throw new Error(
                    "The server returned an unexpected response."
                );
            }

            return data;
        },
        [getToken]
    );

    return apiRequest;
}
