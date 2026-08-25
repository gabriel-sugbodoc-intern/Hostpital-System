import React, { useState, useMemo } from "react";
import {
  Shield, Star, Users, Phone, Mail, Globe, Check, X, ChevronDown,
  AlertCircle, Download, Clock, CreditCard, FileText, ArrowRight,
  TrendingUp, Heart, Activity, Stethoscope, Building2, Calendar,
  Search, Filter, Sparkles, CheckCircle2, XCircle, MinusCircle,
  Tag, Percent, Award, BadgePercent, CheckCircle, RefreshCw, Zap
} from "lucide-react";

export type InsurancePlan = {
  id: string;
  code: string;
  name: string;
  provider: string;
  providerDescription: string;
  providerHotline: string;
  providerWebsite: string;
  providerEmail: string;
  providerRating: number;
  providerMembers: number;
  monthlyPremium: string;
  annualPremium: string;
  coverageLimit: string;
  coveragePercentage: number;
  validityMonths: number;
  tag?: string;
  category?: string;
  benefits: string[];
  eligibility: string[];
  waitingPeriod: string;
  exclusions: string[];
  includedServices: string[];
  maximumClaims: number;
  renewalPolicy: string;
  termsAndConditions: string;
  faqs: Array<{ question: string; answer: string }>;
  logoUrl?: string;
  cardImageUrl?: string;
  description: string;
  active: boolean;
};

export type InsurancePolicy = {
  id: string;
  planId: string;
  planName: string;
  provider: string;
  policyNumber: string;
  insuranceId: string;
  status: "active" | "expired" | "pending" | "cancelled" | "rejected";
  expirationDate: string;
  renewalDate: string;
  coverageLimit: string;
  remainingCoverage: string;
  paymentStatus: "paid" | "pending" | "overdue" | "failed" | "cancelled" | "refunded";
  premiumAmount: string;
  billingCycle?: "monthly" | "annual";
  billId?: string;
  purchasedAt: string;
};

type InsuranceSectionProps = {
  plans: InsurancePlan[];
  policies: InsurancePolicy[];
  loading: boolean;
  onPurchase: (plan: InsurancePlan) => void;
  onRenew: (policy: InsurancePolicy) => void;
  onDownload: (policy: InsurancePolicy) => void;
  onOpenBilling: () => void;
  onRetryPayment?: (policy: InsurancePolicy) => void;
  purchaseBusyPolicyId?: string;
  defaultTab?: "browse" | "my-insurance";
};

const money = (value: number | string) =>
  `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const policyStatusStyles: Record<InsurancePolicy["status"], { bg: string; text: string; border: string; label: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-700", border: "border-emerald-500/20", label: "Active Policy" },
  expired: { bg: "bg-red-500/10", text: "text-red-700", border: "border-red-500/20", label: "Expired" },
  pending: { bg: "bg-amber-500/10", text: "text-amber-700", border: "border-amber-500/20", label: "Pending Activation" },
  cancelled: { bg: "bg-gray-500/10", text: "text-gray-700", border: "border-gray-500/20", label: "Cancelled" },
  rejected: { bg: "bg-rose-500/10", text: "text-rose-700", border: "border-rose-500/20", label: "Declined" },
};

const paymentStatusStyles: Record<InsurancePolicy["paymentStatus"], { bg: string; text: string; border: string; label: string }> = {
  paid: { bg: "bg-emerald-500/10", text: "text-emerald-700", border: "border-emerald-500/20", label: "Payment: Paid (Stripe)" },
  pending: { bg: "bg-amber-500/10", text: "text-amber-700", border: "border-amber-500/20", label: "Payment: Pending" },
  overdue: { bg: "bg-orange-500/10", text: "text-orange-700", border: "border-orange-500/20", label: "Payment: Overdue" },
  failed: { bg: "bg-rose-500/10", text: "text-rose-700", border: "border-rose-500/20", label: "Payment: Failed" },
  cancelled: { bg: "bg-gray-500/10", text: "text-gray-700", border: "border-gray-500/20", label: "Payment: Cancelled" },
  refunded: { bg: "bg-sky-500/10", text: "text-sky-700", border: "border-sky-500/20", label: "Payment: Refunded" },
};

function PolicyStatusBadge({ status }: { status: InsurancePolicy["status"] }) {
  const conf = policyStatusStyles[status] ?? { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", label: status };
  const Icon = status === "active" ? CheckCircle2 : status === "pending" ? Clock : XCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${conf.bg} ${conf.text} ${conf.border}`}>
      <Icon className="h-3.5 w-3.5" />
      {conf.label}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: InsurancePolicy["paymentStatus"] }) {
  const conf = paymentStatusStyles[status] ?? { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", label: `Payment: ${status}` };
  const Icon = status === "paid" ? CheckCircle : status === "pending" ? Clock : status === "refunded" ? RefreshCw : XCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${conf.bg} ${conf.text} ${conf.border}`}>
      <CreditCard className="h-3.5 w-3.5" />
      {conf.label}
    </span>
  );
}

function PlanOfferCard({
  plan,
  onSelect,
  onSubscribe,
  onCompare,
  isComparing,
}: {
  plan: InsurancePlan;
  onSelect: () => void;
  onSubscribe: () => void;
  onCompare: () => void;
  isComparing: boolean;
}) {
  const monthlyNum = Number(plan.monthlyPremium);
  const annualNum = Number(plan.annualPremium);
  const annualSavingsPercent = monthlyNum > 0 && annualNum > 0
    ? Math.round((1 - (annualNum / (monthlyNum * 12))) * 100)
    : 15;

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary/40">
      {/* Plan Tag / Special Offer Badge */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
        {plan.tag && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/95 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-3 w-3" />
            {plan.tag}
          </span>
        )}
        {plan.coveragePercentage === 100 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur">
            <CheckCircle2 className="h-3 w-3" />
            100% Cashless
          </span>
        )}
      </div>

      {/* Compare Toggle Button */}
      <div className="absolute right-3 top-3 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCompare();
          }}
          className={`rounded-lg p-2 text-xs font-semibold backdrop-blur transition ${
            isComparing
              ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary"
              : "bg-card/85 text-muted-foreground border border-border hover:bg-card hover:text-foreground"
          }`}
          title={isComparing ? "Remove from comparison" : "Add to comparison"}
          aria-label="Toggle comparison"
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {/* Header Image & Logo */}
      <div>
        <div className="relative aspect-[16/8] overflow-hidden bg-gradient-to-br from-primary/[0.08] via-accent/60 to-primary/5">
          {plan.cardImageUrl ? (
            <img
              src={plan.cardImageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Shield className="h-14 w-14 text-primary/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-white">
            <div className="flex items-center gap-2">
              {plan.logoUrl ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-1 shadow-sm">
                  <img src={plan.logoUrl} alt={plan.provider} className="h-full w-full object-contain" />
                </div>
              ) : (
                <Building2 className="h-5 w-5 text-white/80" />
              )}
              <span className="text-xs font-semibold tracking-wide uppercase drop-shadow">
                {plan.provider}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-xs text-amber-300 backdrop-blur">
              <Star className="h-3 w-3 fill-current" />
              {Number(plan.providerRating ?? 4.8).toFixed(1)}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-4 p-5">
          <div>
            <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
              {plan.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {plan.description}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-border/80 bg-muted/40 p-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">Coverage Limit</p>
              <p className="mt-0.5 font-bold text-foreground">{money(plan.coverageLimit)}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-muted/40 p-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">Co-Pay / Rate</p>
              <p className="mt-0.5 font-bold text-emerald-600">{plan.coveragePercentage}% Covered</p>
            </div>
          </div>

          {/* Top Benefits Preview */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Offer Highlights & Benefits
            </p>
            <ul className="space-y-1">
              {plan.benefits.slice(0, 3).map((benefit, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 font-bold" />
                  <span className="line-clamp-1">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing Box */}
          <div className="rounded-xl border border-primary/20 bg-accent/40 p-3.5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Monthly Premium</span>
                <p className="text-lg font-bold text-primary">{money(plan.monthlyPremium)}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Annual Option</span>
                <p className="text-sm font-semibold text-foreground">{money(plan.annualPremium)}</p>
              </div>
            </div>
            {annualSavingsPercent > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                <BadgePercent className="h-3.5 w-3.5" />
                <span>Save ~{annualSavingsPercent}% with annual billing</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex gap-2 p-5 pt-0">
        <button
          onClick={onSelect}
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          Offer Details
        </button>
        <button
          onClick={onSubscribe}
          className="flex-[1.4] inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Subscribe / Purchase
        </button>
      </div>
    </article>
  );
}

function PlanDetailModal({
  plan,
  onClose,
  onPurchase,
}: {
  plan: InsurancePlan;
  onClose: () => void;
  onPurchase: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "benefits" | "terms">("overview");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div
        className="my-8 w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-10 rounded-t-2xl border-b border-border bg-card/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {plan.logoUrl ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-white p-1.5 shadow-sm">
                  <img src={plan.logoUrl} alt={plan.provider} className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Shield className="h-6 w-6" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">{plan.provider}</p>
                  {plan.tag && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {plan.tag}
                    </span>
                  )}
                </div>
                <h2 className="mt-1 text-xl font-bold">{plan.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
                    {Number(plan.providerRating ?? 4.8).toFixed(1)} rating
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    {Number(plan.providerMembers ?? 1250000).toLocaleString()} accredited members
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {plan.validityMonths} months validity
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="border-b border-border bg-muted/30 px-5">
          <div className="flex gap-2">
            {[
              { id: "overview", label: "Overview & Pricing" },
              { id: "benefits", label: "Covered Benefits & Services" },
              { id: "terms", label: "Eligibility & Terms" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`rounded-t-lg px-4 py-3 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-card text-primary border-b-2 border-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-primary/20 bg-accent/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Monthly Premium</p>
                  <p className="mt-1 text-2xl font-bold text-primary">{money(plan.monthlyPremium)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Billed monthly via Stripe</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Annual Premium (Discounted)</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{money(plan.annualPremium)}</p>
                  <p className="mt-1 text-xs text-emerald-600 font-medium">Save on annual single payment</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coverage Limit</p>
                  <p className="mt-1 text-2xl font-bold">{money(plan.coverageLimit)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Maximum allowable claims</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Co-Pay / Cashless Rate</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-600">{plan.coveragePercentage}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">Direct hospital cashless settlement</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">About {plan.provider}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.providerDescription}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
                  <a
                    href={`tel:${plan.providerHotline}`}
                    className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-primary hover:bg-muted transition"
                  >
                    <Phone className="h-4 w-4" />
                    <span className="truncate">{plan.providerHotline}</span>
                  </a>
                  <a
                    href={`mailto:${plan.providerEmail}`}
                    className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-primary hover:bg-muted transition"
                  >
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{plan.providerEmail}</span>
                  </a>
                  <a
                    href={plan.providerWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-primary hover:bg-muted transition"
                  >
                    <Globe className="h-4 w-4" />
                    <span className="truncate">Provider Portal</span>
                  </a>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-border p-3.5">
                  <p className="font-semibold text-foreground">Waiting Period</p>
                  <p className="mt-1 text-muted-foreground">{plan.waitingPeriod}</p>
                </div>
                <div className="rounded-xl border border-border p-3.5">
                  <p className="font-semibold text-foreground">Maximum Claims per Year</p>
                  <p className="mt-1 text-muted-foreground">{plan.maximumClaims} claims</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "benefits" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold">Covered Inpatient & Outpatient Benefits</h3>
                <ul className="mt-3 space-y-2.5">
                  {plan.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Included Clinical & Diagnostic Services</h3>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {plan.includedServices.map((service, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-xs font-medium">
                      <Activity className="h-4 w-4 shrink-0 text-primary" />
                      <span>{service}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">General Policy Exclusions</h3>
                <ul className="mt-3 space-y-2">
                  {plan.exclusions.map((exclusion, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                      <span>{exclusion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "terms" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold">Eligibility Requirements</h3>
                <ul className="mt-3 space-y-2">
                  {plan.eligibility.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Terms and Conditions</h3>
                <div className="mt-3 rounded-xl border border-border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
                  <p className="whitespace-pre-line">{plan.termsAndConditions}</p>
                </div>
              </div>

              {plan.faqs && plan.faqs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold">Frequently Asked Questions</h3>
                  <div className="mt-3 space-y-3">
                    {plan.faqs.map((faq, i) => (
                      <details key={i} className="group rounded-xl border border-border bg-card p-3.5">
                        <summary className="flex cursor-pointer items-start justify-between gap-4 text-xs font-semibold">
                          {faq.question}
                          <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180 text-muted-foreground" />
                        </summary>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{faq.answer}</p>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Sticky Footer */}
        <div className="sticky bottom-0 rounded-b-2xl border-t border-border bg-card/95 p-5 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Subscription starts at</p>
              <p className="text-2xl font-bold text-primary">{money(plan.monthlyPremium)}<span className="text-xs font-normal text-muted-foreground"> / month</span></p>
            </div>
            <button
              onClick={onPurchase}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              <CreditCard className="h-4 w-4" />
              Subscribe / Purchase Plan
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareModal({
  plans,
  onClose,
  onPurchase,
}: {
  plans: InsurancePlan[];
  onClose: () => void;
  onPurchase: (plan: InsurancePlan) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="my-8 w-full max-w-6xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-xl font-bold">Compare Insurance Plan Offers</h2>
            <p className="mt-1 text-sm text-muted-foreground">Side-by-side comparison of {plans.length} selected plans</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/80 backdrop-blur px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Offer Specification
                </th>
                {plans.map((plan) => (
                  <th key={plan.id} className="min-w-64 px-5 py-4">
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{plan.provider}</p>
                      <p className="text-sm font-bold text-foreground">{plan.name}</p>
                      <p className="text-lg font-bold text-primary">{money(plan.monthlyPremium)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              <tr className="hover:bg-muted/20">
                <td className="sticky left-0 bg-card px-5 py-3.5 font-medium text-muted-foreground">Annual Option</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-5 py-3.5 font-semibold">{money(plan.annualPremium)}</td>
                ))}
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="sticky left-0 bg-card px-5 py-3.5 font-medium text-muted-foreground">Coverage Limit</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-5 py-3.5 font-bold text-foreground">{money(plan.coverageLimit)}</td>
                ))}
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="sticky left-0 bg-card px-5 py-3.5 font-medium text-muted-foreground">Co-Pay / Rate</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-5 py-3.5 text-emerald-600 font-semibold">{plan.coveragePercentage}% Covered</td>
                ))}
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="sticky left-0 bg-card px-5 py-3.5 font-medium text-muted-foreground">Waiting Period</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-5 py-3.5 text-xs text-muted-foreground">{plan.waitingPeriod}</td>
                ))}
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="sticky left-0 bg-card px-5 py-3.5 font-medium text-muted-foreground">Max Claims / Year</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-5 py-3.5 font-medium">{plan.maximumClaims} claims</td>
                ))}
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="sticky left-0 bg-card px-5 py-3.5 font-medium text-muted-foreground">Validity Period</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-5 py-3.5">{plan.validityMonths} months</td>
                ))}
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="sticky left-0 bg-card px-5 py-4 font-medium text-muted-foreground">Instant Action</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-5 py-4">
                    <button
                      onClick={() => onPurchase(plan)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Subscribe via Stripe
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PolicyCard({
  policy,
  onRenew,
  onDownload,
  onRetryPayment,
  isBusy,
}: {
  policy: InsurancePolicy;
  onRenew: () => void;
  onDownload: () => void;
  onRetryPayment?: () => void;
  isBusy: boolean;
}) {
  const expiresIn = Math.ceil((new Date(policy.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isExpiringSoon = expiresIn <= 30 && expiresIn > 0;
  const coverageUsed = Number(policy.coverageLimit) > 0
    ? ((Number(policy.coverageLimit) - Number(policy.remainingCoverage)) / Number(policy.coverageLimit)) * 100
    : 0;

  const isPaymentPendingOrFailed = policy.paymentStatus === "pending" || policy.paymentStatus === "failed" || policy.paymentStatus === "cancelled";

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PolicyStatusBadge status={policy.status} />
              <PaymentStatusBadge status={policy.paymentStatus} />
            </div>
            <h3 className="mt-2.5 font-bold text-base text-foreground">{policy.planName}</h3>
            <p className="text-xs text-muted-foreground">{policy.provider}</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-6 w-6" />
          </div>
        </div>

        <div className="grid gap-3 text-xs sm:grid-cols-2 rounded-xl bg-muted/40 p-3.5 border border-border/60">
          <div>
            <p className="text-muted-foreground">Policy Number</p>
            <p className="mt-0.5 font-mono font-bold text-foreground">{policy.policyNumber}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Insurance ID</p>
            <p className="mt-0.5 font-mono font-bold text-foreground">{policy.insuranceId}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Premium Paid</p>
            <p className="mt-0.5 font-semibold text-primary">{money(policy.premiumAmount)} ({policy.billingCycle ?? "annual"})</p>
          </div>
          <div>
            <p className="text-muted-foreground">Valid Through</p>
            <p className="mt-0.5 font-medium text-foreground">
              {new Date(policy.expirationDate).toLocaleDateString("en-PH", { dateStyle: "medium" })}
            </p>
          </div>
        </div>

        {isExpiringSoon && policy.status === "active" && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 border border-amber-500/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>Your policy expires in {expiresIn} days. Renew your subscription now to avoid coverage interruption.</p>
          </div>
        )}

        {isPaymentPendingOrFailed && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 border border-amber-500/20">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="font-semibold">Stripe Payment Incomplete</p>
              <p className="mt-0.5 text-muted-foreground">Complete payment through Stripe to activate full cashless healthcare coverage.</p>
            </div>
            {onRetryPayment && (
              <button
                onClick={onRetryPayment}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Pay via Stripe
              </button>
            )}
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Coverage Remaining</span>
            <span className="font-bold text-foreground">
              {money(policy.remainingCoverage)} / {money(policy.coverageLimit)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.max(5, Math.min(100 - coverageUsed, 100))}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {policy.status === "active" && (
            <button
              onClick={onRenew}
              disabled={isBusy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} />
              {isBusy ? "Renewing..." : "Renew Policy"}
            </button>
          )}
          <button
            onClick={onDownload}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            Download Policy PDF
          </button>
        </div>
      </div>
    </article>
  );
}

export default function InsuranceSection({
  plans,
  policies,
  loading,
  onPurchase,
  onRenew,
  onDownload,
  onOpenBilling,
  onRetryPayment,
  purchaseBusyPolicyId,
  defaultTab = "browse",
}: InsuranceSectionProps) {
  const [activeTab, setActiveTab] = useState<"browse" | "my-insurance">(defaultTab);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan | null>(null);
  const [comparingPlans, setComparingPlans] = useState<InsurancePlan[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["all", ...Array.from(set)];
  }, [plans]);

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      if (!plan.active) return false;
      const matchesSearch = `${plan.name} ${plan.provider} ${plan.description} ${plan.tag ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesCat = categoryFilter === "all" || plan.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [plans, search, categoryFilter]);

  const toggleCompare = (plan: InsurancePlan) => {
    setComparingPlans((prev) =>
      prev.find((p) => p.id === plan.id)
        ? prev.filter((p) => p.id !== plan.id)
        : prev.length < 3
        ? [...prev, plan]
        : prev
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 rounded-3xl bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.12] via-card to-accent/60 p-6 md:p-8">
        <div className="relative z-10 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-primary backdrop-blur">
            <Shield className="h-3.5 w-3.5" />
            Insurance Plan Offers & Health Coverage
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Accredited Healthcare Plans & Instant Cashless Protection
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Explore and subscribe to accredited HMO, private health plans, and PhilHealth packages with seamless Stripe payment checkout, instant digital policy card issuance, and 100% cashless admission across hospitals in Cebu.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card/60 px-3 py-1 border border-border">
              <Check className="h-4 w-4 text-emerald-600" />
              100% Verified Hospital Network
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card/60 px-3 py-1 border border-border">
              <CreditCard className="h-4 w-4 text-primary" />
              Secure Stripe Checkout
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card/60 px-3 py-1 border border-border">
              <Zap className="h-4 w-4 text-amber-500" />
              Immediate Emergency Coverage
            </span>
          </div>
        </div>
        <Shield className="absolute -bottom-10 -right-6 h-56 w-56 rotate-12 text-primary/10 pointer-events-none" />
      </section>

      {/* Primary Navigation Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex rounded-xl bg-muted p-1">
          <button
            onClick={() => setActiveTab("browse")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "browse" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Insurance Plan Offers
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-bold">
              {plans.filter((p) => p.active).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("my-insurance")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "my-insurance" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="h-4 w-4" />
            My Policies & Subscriptions
            {policies.length > 0 && (
              <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 font-bold">
                {policies.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "browse" && comparingPlans.length > 0 && (
          <button
            onClick={() => setComparisonOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
          >
            <Filter className="h-4 w-4" />
            Compare {comparingPlans.length} selected offer{comparingPlans.length !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {activeTab === "browse" ? (
        <section className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition capitalize ${
                    categoryFilter === cat
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {cat === "all" ? "All Offers" : cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plan offers, HMO, benefits..."
                className="min-h-10 w-full rounded-xl border border-input bg-card pl-9 pr-4 text-xs outline-none ring-primary transition focus:ring-2"
              />
            </div>
          </div>

          {/* Plan Offers Grid */}
          {filteredPlans.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPlans.map((plan) => (
                <PlanOfferCard
                  key={plan.id}
                  plan={plan}
                  onSelect={() => setSelectedPlan(plan)}
                  onSubscribe={() => onPurchase(plan)}
                  onCompare={() => toggleCompare(plan)}
                  isComparing={comparingPlans.some((p) => p.id === plan.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Search className="mx-auto h-9 w-9 text-muted-foreground/50" />
              <h2 className="mt-3 font-semibold text-base">No insurance plan offers found</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Try adjusting your search keywords or reset category filters.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("all");
                }}
                className="mt-4 rounded-xl border border-border bg-muted/60 px-4 py-2 text-xs font-semibold hover:bg-muted"
              >
                Reset Filters
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-6">
          {policies.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {policies.map((policy) => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    onRenew={() => onRenew(policy)}
                    onDownload={() => onDownload(policy)}
                    onRetryPayment={
                      onRetryPayment
                        ? () => onRetryPayment(policy)
                        : undefined
                    }
                    isBusy={purchaseBusyPolicyId === policy.id}
                  />
                ))}
              </div>

              {policies.some((p) => p.billId) && (
                <div className="rounded-2xl border border-primary/20 bg-accent/30 p-5">
                  <div className="flex items-start gap-3">
                    <CreditCard className="mt-0.5 h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">Linked Healthcare Invoices</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Your insurance subscription invoices are reconciled in the Billing & Invoices center.
                      </p>
                    </div>
                    <button
                      onClick={onOpenBilling}
                      className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                    >
                      View Bills
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Shield className="mx-auto h-12 w-12 text-primary/50" />
              <h2 className="mt-3 text-base font-bold">No Active Insurance Subscriptions</h2>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                You currently do not have any active insurance policies linked to your account. Browse our available health offers to get covered.
              </p>
              <button
                onClick={() => setActiveTab("browse")}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4" />
                Browse Insurance Plan Offers
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
      )}

      {/* Plan Detail Modal */}
      {selectedPlan && (
        <PlanDetailModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onPurchase={() => {
            onPurchase(selectedPlan);
            setSelectedPlan(null);
          }}
        />
      )}

      {/* Side-by-side Comparison Modal */}
      {comparisonOpen && comparingPlans.length >= 2 && (
        <CompareModal
          plans={comparingPlans}
          onClose={() => setComparisonOpen(false)}
          onPurchase={(plan) => {
            onPurchase(plan);
            setComparisonOpen(false);
          }}
        />
      )}
    </div>
  );
}

