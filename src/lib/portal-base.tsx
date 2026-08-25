import React, { createContext, useContext } from "react";

/**
 * Base path for the staff portal pages that are shared between the Admin and
 * Doctor experiences (patients, encounters, appointments, messaging).
 * Defaults to the admin portal so existing admin routes keep working.
 */
const PortalBaseContext = createContext<string>("/admin");

export function PortalBaseProvider({
  base,
  children,
}: {
  base: string;
  children: React.ReactNode;
}) {
  return <PortalBaseContext.Provider value={base}>{children}</PortalBaseContext.Provider>;
}

export function usePortalBase() {
  return useContext(PortalBaseContext);
}
