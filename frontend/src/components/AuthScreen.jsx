
import { useState } from "react";
import { SignIn, SignUp } from "@clerk/react";

import {
  Box,
  Paper,
  Typography,
  Button,
} from "@mui/material";

export default function AuthScreen() {
  const [screen, setScreen] = useState("signIn");

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper
        sx={{
          p: 3,
          width: "100%",
          maxWidth: 480,
          textAlign: "center",
        }}
      >
        <Typography
          variant="h4"
          fontWeight={800}
          color="primary"
          sx={{ mb: 3 }}
        >
          SpendWise
        </Typography>

        {screen === "signIn" ? (
          <>
            <SignIn routing="virtual" />

            <Button
              sx={{ mt: 2 }}
              onClick={() => setScreen("signUp")}
            >
              Create an account
            </Button>
          </>
        ) : (
          <>
            <SignUp routing="virtual" />

            <Button
              sx={{ mt: 2 }}
              onClick={() => setScreen("signIn")}
            >
              Already have an account? Sign in
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
