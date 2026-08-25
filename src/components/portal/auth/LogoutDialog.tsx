import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "@/lib/router-compat";
import { logoutCurrentSession, clearAuthState } from "@/lib/api-client";

export default function LogoutDialog({
  className,
  accountLabel = "administrator",
}: {
  className?: string;
  accountLabel?: string;
}) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoggingOut) setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isLoggingOut]);

  const handleConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await logoutCurrentSession();
    } catch {
      // ignore network errors during logout
    }
    clearAuthState("logout");
    toast.success("Successfully logged out.");
    setOpen(false);
    setIsLoggingOut(false);
    setLocation("/", { replace: true });
  };

  const modalContent = open ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoggingOut) setOpen(false);
      }}
    >
      <section
        className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl animate-in fade-in-0 zoom-in-95"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
      >
        <h2 id="logout-dialog-title" className="text-lg font-semibold text-foreground">
          Confirm Logout
        </h2>
        <p id="logout-dialog-description" className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to log out of your {accountLabel} account?
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="min-h-10 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            onClick={() => setOpen(false)}
            disabled={isLoggingOut}
          >
            Cancel
          </button>
          <button
            type="button"
            className="min-h-10 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
            onClick={() => void handleConfirm()}
            disabled={isLoggingOut}
            data-testid="button-confirm-logout"
          >
            {isLoggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        data-testid="button-logout"
      >
        <LogOut className="w-4 h-4 shrink-0" />
        <span>Log out</span>
      </button>
      {typeof document !== "undefined" && modalContent ? createPortal(modalContent, document.body) : null}
    </>
  );
}