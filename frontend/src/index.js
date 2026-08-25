import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              style: { background: "#1A1C19", color: "#F9F7F3", borderRadius: "12px", fontSize: "14px" },
              success: { iconTheme: { primary: "#2F9E68", secondary: "#fff" } },
              error: { iconTheme: { primary: "#D6553F", secondary: "#fff" } },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
