/**
 * Small compatibility layer so the merged Patient Portal pages (originally
 * written against `wouter`) can run on TanStack Router without rewrites.
 */
import { useCallback } from "react";
import {
  useNavigate,
  useParams as useRouterParams,
  useRouterState,
  Link,
} from "@tanstack/react-router";

export { Link };

export function useLocation(): [string, (to: string, opts?: { replace?: boolean }) => void] {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const setLocation = useCallback(
    (to: string, opts?: { replace?: boolean }) => {
      void navigate({ to, replace: opts?.replace } as never);
    },
    [navigate],
  );

  return [pathname, setLocation];
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return (useRouterParams as (opts: { strict: false }) => unknown)({ strict: false }) as T;
}
