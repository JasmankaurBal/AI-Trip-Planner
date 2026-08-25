import React from "react";
import { GoogleLogo } from "@phosphor-icons/react";

export default function GoogleButton({ label = "Continue with Google" }) {
  const onClick = () => {
    window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/auth/google/start`;
  };
  return (
    <button type="button" onClick={onClick} className="btn-secondary w-full" data-testid="google-signin-button">
      <GoogleLogo size={20} weight="bold" /> {label}
    </button>
  );
}
