import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, CalendarX2, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { safeFormatDate, safeParseDate } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StatusBadge from "@/components/portal/admin/StatusBadge";

type Appointment = {
  id: string;
  patientName?: string;
  date?: string;
  time?: string;
  department?: string;
  status?: string;
  clinic?: string;
  notes?: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Mirrors the dashboard's StatusBadge palette groups. */
const ACTIVE_STATUSES = new Set(["confirmed", "checked in", "waiting", "in progress"]);
const PENDING_STATUSES = new Set(["pending", "scheduled"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "rejected", "no show", "no-show"]);

type Tone = "active" | "pending" | "completed" | "cancelled";

function apptTone(status?: string): Tone {
  const s = String(status || "pending")
    .trim()
    .toLowerCase();
  if (CANCELLED_STATUSES.has(s)) return "cancelled";
  if (ACTIVE_STATUSES.has(s)) return "active";
  if (PENDING_STATUSES.has(s)) return "pending";
  if (s === "completed") return "completed";
  return "pending";
}

/** Event-chip palette keyed by tone (light + dark variants). */
const TONE_CHIP: Record<Tone, string> = {
  active:
    "border-l-2 border-l-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-l-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/70",
  pending:
    "border-l-2 border-l-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-l-amber-500 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70",
  completed:
    "border-l-2 border-l-slate-400 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-l-slate-500 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800",
  cancelled:
    "border-l-2 border-l-red-400 bg-red-50 text-red-700 hover:bg-red-100 dark:border-l-red-600 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70",
};

const TONE_DOT: Record<Tone, string> = {
  active: "bg-emerald-500",
  pending: "bg-amber-500",
  completed: "bg-slate-400",
  cancelled: "bg-red-400",
};

/** Day-pill palette (compact/mobile mode), by overall schedule health. */
const ACTIVE_DAY_PILL = "bg-emerald-600 text-white";
const PENDING_DAY_PILL = "bg-amber-400 text-amber-950";

function dayPillTone(appts: Appointment[]): string {
  const statuses = appts.map((a) =>
    String(a.status || "pending")
      .trim()
      .toLowerCase(),
  );
  if (statuses.length > 0 && statuses.every((s) => ACTIVE_STATUSES.has(s))) {
    return ACTIVE_DAY_PILL;
  }
  if (statuses.length > 0 && statuses.every((s) => PENDING_STATUSES.has(s))) {
    return PENDING_DAY_PILL;
  }
  return "bg-primary text-primary-foreground";
}

/** Local YYYY-MM-DD key (avoids toISOString's UTC shift). */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Six-week matrix (Sunday-first) covering the visible month. */
function buildMonthCells(viewMonth: Date): Date[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const start = startOfDay(first);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function apptSorter(a: Appointment, b: Appointment): number {
  const da = safeParseDate(`${a.date ?? ""} ${a.time ?? ""}`);
  const db = safeParseDate(`${b.date ?? ""} ${b.time ?? ""}`);
  if (da && db) return da.getTime() - db.getTime();
  return String(a.time ?? "").localeCompare(String(b.time ?? ""));
}

function initialsOf(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function firstName(name?: string): string {
  return (name ?? "").trim().split(/\s+/)[0] || "Patient";
}

export default function DoctorAppointmentCalendar() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfDay(new Date()));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    apiClient
      .getAdminAppointments()
      .then(({ data, error }) => {
        if (disposed) return;
        if (error) {
          setLoadError(error);
          return;
        }
        const rows = ((data?.appointments ?? []) as Appointment[]).filter((a) => !!a.date);
        setAppointments(rows);
      })
      .finally(() => {
        if (!disposed) setIsLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    setExpandedId(null);
  }, [selectedDate]);

  // Group doctor-scoped appointments by their ISO date key.
  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      const key = String(appt.date);
      const list = map.get(key);
      if (list) list.push(appt);
      else map.set(key, [appt]);
    }
    return map;
  }, [appointments]);

  const monthCells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const todayKey = toDateKey(new Date());

  const upcomingCount = useMemo(
    () => appointments.filter((a) => (a.date ?? "") >= todayKey).length,
    [appointments, todayKey],
  );
  const todayCount = byDate.get(todayKey)?.length ?? 0;

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return [...(byDate.get(toDateKey(selectedDate)) ?? [])].sort(apptSorter);
  }, [byDate, selectedDate]);

  const totalCount = appointments.length;
  const monthLabel = viewMonth.toLocaleString("en-PH", { month: "long", year: "numeric" });

  function goToday() {
    const now = new Date();
    setViewMonth(startOfDay(now));
    setSelectedDate(now);
  }

  function shiftMonth(delta: number) {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
  }

  if (isLoading) {
    // Content-shaped skeleton reserves the calendar footprint (no CLS).
    return (
      <section
        className="rounded-xl border border-border bg-card p-4"
        aria-busy="true"
        aria-label="Loading schedule"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-muted/70 animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-44 rounded-lg bg-muted animate-pulse" />
        </div>
        <div>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="h-3 rounded bg-muted/70 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }).map((_, i) => (
              <div
                key={i}
                style={{ minHeight: "64px" }}
                className="rounded-md bg-muted/50 animate-pulse sm:min-h-[88px]"
              />
            ))}
          </div>
        </div>
        <span className="sr-only">Loading schedule…</span>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <p className="py-10 text-center text-sm text-muted-foreground">
          Could not load your schedule ({loadError}).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      {/* ── Card header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <CalendarDays className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">My Schedule</h3>
            <p className="text-xs text-muted-foreground">
              {upcomingCount} upcoming
              {todayCount > 0 ? ` · ${todayCount} today` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goToday}
            className="h-8 px-3 text-xs font-medium"
          >
            Today
          </Button>
          <div className="ml-1 flex items-center rounded-lg border border-input overflow-hidden">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-[8.5rem] px-2 text-center text-sm font-bold text-foreground tabular-nums">
              {monthLabel}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Weekday headers ─────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            aria-hidden="true"
            className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs"
          >
            <span className="sm:hidden">{w.slice(0, 1)}</span>
            <span className="hidden sm:inline">{w}</span>
          </div>
        ))}
      </div>

      {/* ── Month grid ──────────────────────────────────────────────── */}
      <div role="grid" aria-label={`${monthLabel} appointments`}>
        <div className="grid grid-cols-7 gap-1">
          {monthCells.map((date) => {
            const key = toDateKey(date);
            const dayAppts = [...(byDate.get(key) ?? [])].sort(apptSorter);
            const count = dayAppts.length;
            const inMonth = date.getMonth() === viewMonth.getMonth();
            const isToday = key === todayKey;
            const isSelected = !!selectedDate && toDateKey(selectedDate) === key;
            const visibleChips = dayAppts.slice(0, 2);
            const moreCount = Math.max(0, count - 2);

            return (
              <div
                key={key}
                role="gridcell"
                aria-selected={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${safeFormatDate(date.toISOString(), undefined, "en-PH")}${
                  count > 0 ? ` — ${count} appointment${count === 1 ? "" : "s"}` : ""
                }`}
                onClick={() => selectDate(date)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectDate(date);
                  }
                }}
                tabIndex={0}
                className={cn(
                  "group relative flex cursor-pointer flex-col gap-1 rounded-lg border p-1.5 outline-none text-left transition-colors min-h-[64px] sm:min-h-[96px]",
                  "focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                  inMonth ? "bg-card" : "bg-muted/20",
                  !inMonth && "opacity-55",
                  count > 0 && !isSelected && "hover:border-primary/40 hover:bg-accent/40",
                  isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
                  isToday && !isSelected && "ring-1 ring-primary/60",
                )}
              >
                {/* Day number (+ compact count pill on mobile) */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold tabular-nums",
                      isToday && !isSelected
                        ? "bg-primary text-primary-foreground"
                        : isSelected
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground",
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {count > 0 && (
                    <b
                      aria-hidden="true"
                      className={cn(
                        "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none sm:hidden",
                        dayPillTone(dayAppts),
                      )}
                    >
                      {count > 9 ? "9+" : count}
                    </b>
                  )}
                </div>

                {/* Desktop event chips */}
                {count > 0 && (
                  <div className="hidden sm:flex flex-col gap-1 overflow-hidden">
                    {visibleChips.map((appt) => {
                      const tone = apptTone(appt.status);
                      return (
                        <button
                          key={appt.id}
                          type="button"
                          title={`${appt.time || ""} ${firstName(appt.patientName)} · ${
                            appt.department || ""
                          } · ${String(appt.status || "Pending")}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectDate(date);
                          }}
                          className={cn(
                            "flex w-full items-center gap-1 truncate rounded-r-md py-0.5 pl-1.5 pr-1 text-left text-[11px] leading-tight transition-colors motion-reduce:transition-none",
                            TONE_CHIP[tone],
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
                          />
                          <span className="shrink-0 font-mono font-semibold whitespace-nowrap">
                            {appt.time || "--"}
                          </span>
                          <span className="truncate">{firstName(appt.patientName)}</span>
                        </button>
                      );
                    })}
                    {moreCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectDate(date);
                        }}
                        className="px-1.5 text-left text-[10px] font-semibold text-muted-foreground transition-colors hover:text-primary motion-reduce:transition-none"
                      >
                        +{moreCount} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status legend ───────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </span>
        {(
          [
            ["Confirmed", "bg-emerald-500"],
            ["Pending", "bg-amber-500"],
            ["Completed", "bg-slate-400"],
            ["Cancelled", "bg-red-400"],
          ] as const
        ).map(([label, dot]) => (
          <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span aria-hidden="true" className={cn("inline-block h-2 w-2 rounded-full", dot)} />
            {label}
          </span>
        ))}
        <span className="ml-auto hidden text-[11px] text-muted-foreground/80 sm:inline">
          Click a date for details
        </span>
      </div>

      {/* ── Day detail dialog ───────────────────────────────────────── */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(undefined)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {selectedDate ? safeFormatDate(selectedDate.toISOString(), undefined, "en-PH") : ""}
            </DialogTitle>
            <DialogDescription>
              {selectedDayAppointments.length === 0
                ? "Nothing booked — enjoy the quiet day."
                : `${selectedDayAppointments.length} appointment${
                    selectedDayAppointments.length === 1 ? "" : "s"
                  } scheduled.`}
            </DialogDescription>
          </DialogHeader>

          {selectedDayAppointments.length === 0 ? (
            <div className="py-6 text-center">
              <CalendarX2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">
                No appointments scheduled for this day.
              </p>
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-2 -mx-1 overflow-y-auto px-1">
              {selectedDayAppointments.map((appt, i) => {
                const expanded = expandedId === appt.id;
                const hasDetails = Boolean(appt.clinic || appt.notes);
                return (
                  <div
                    key={appt.id}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    className="animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards duration-300 rounded-xl border border-border bg-background/60 p-3 motion-reduce:animate-none"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                      >
                        {initialsOf(appt.patientName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {appt.patientName || "Patient"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="whitespace-nowrap font-mono font-semibold text-foreground">
                            {appt.time || "—"}
                          </span>
                          {" · "}
                          {appt.department || "General Medicine"}
                        </p>
                      </div>
                      <StatusBadge status={String(appt.status || "Pending")} />
                      {hasDetails && (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={`Details for ${appt.patientName || "patient"}`}
                          onClick={() => setExpandedId(expanded ? null : appt.id)}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none"
                        >
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 transition-transform duration-200 motion-reduce:transition-none",
                              expanded && "rotate-180",
                            )}
                          />
                        </button>
                      )}
                    </div>

                    {expanded && hasDetails && (
                      <dl className="mt-2.5 space-y-1.5 border-t border-border pt-2.5 text-xs animate-in fade-in slide-in-from-top-1 fill-mode-backwards duration-200 motion-reduce:animate-none">
                        {appt.clinic && (
                          <div className="flex gap-2">
                            <dt className="w-14 shrink-0 font-medium text-muted-foreground">
                              Clinic
                            </dt>
                            <dd className="text-foreground">{appt.clinic}</dd>
                          </div>
                        )}
                        {appt.notes && (
                          <div className="flex gap-2">
                            <dt className="w-14 shrink-0 font-medium text-muted-foreground">
                              Notes
                            </dt>
                            <dd className="whitespace-pre-wrap text-foreground">{appt.notes}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-1 flex justify-end border-t border-border pt-3">
            <Link
              to="/doctor/appointments"
              onClick={() => setSelectedDate(undefined)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Open full appointments →
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
