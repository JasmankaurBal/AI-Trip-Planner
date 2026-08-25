import React from "react";
import { LoadingState } from "./ui/states";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  return <LoadingState label="Signing you in..." />;
}
