
import {
  useCallback,
  useState,
} from "react";

import { Snackbar, Alert } from "@mui/material";
import { ToastContext } from "./toastStore";

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback(
    (message, severity = "success") => {
      setToast({
        id: Date.now(),
        message,
        severity,
      });
    },
    []
  );

  const closeToast = () => setToast(null);

  return (
    <ToastContext.Provider value={showToast}>
      {children}

      <Snackbar
        key={toast?.id}
        open={Boolean(toast)}
        autoHideDuration={3500}
        onClose={closeToast}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
      >
        <Alert
          severity={toast?.severity || "success"}
          variant="filled"
          onClose={closeToast}
          sx={{ width: "100%" }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
