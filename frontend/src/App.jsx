import Transactions from "./pages/Transactions";
import ImportCSV from "./pages/ImportCSV";
import { useState } from "react";
import Budgets from "./pages/Budgets";
import ThemeSwitcher from "./components/ThemeSwitcher";

import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import {
  Dashboard as DashboardIcon,
  ReceiptLong,
  AccountBalanceWallet,
  UploadFile,
  Menu as MenuIcon,
} from "@mui/icons-material";

import Dashboard from "./pages/Dashboard";

const drawerWidth = 240;

const menuItems = [
  { name: "Dashboard", icon: <DashboardIcon /> },
  { name: "Transactions", icon: <ReceiptLong /> },
  { name: "Budgets", icon: <AccountBalanceWallet /> },
  { name: "Import CSV", icon: <UploadFile /> },
];

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const sidebar = (
    <Box>
      <Toolbar>
        <Typography variant="h5" fontWeight={800} color="primary">
          SpendWise
        </Typography>
      </Toolbar>

      <List>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.name}
            selected={page === item.name}
            onClick={() => {
              setPage(item.name);
              setMobileOpen(false);
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.name} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          width: isMobile ? "100%" : `calc(100% - ${drawerWidth}px)`,
          ml: isMobile ? 0 : `${drawerWidth}px`,
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
              aria-label="Open navigation"
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>
            {page}
          </Typography>

          <ThemeSwitcher />
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        sx={{
          width: isMobile ? 0 : drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        {sidebar}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, md: 4 },
          mt: 8,
        }}
      >
        {page === "Dashboard" && <Dashboard />}

        {page === "Transactions" && <Transactions />}

        {page === "Import CSV" && <ImportCSV />}

        {page === "Budgets" && <Budgets />}
      </Box>
    </Box>
  );
}
