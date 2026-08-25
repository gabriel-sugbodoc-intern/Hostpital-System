import React, { useEffect, useState } from "react";
import { useLocation } from "@/lib/router-compat";
import { toast } from "sonner";
import {
  Shield, CreditCard, CheckCircle2, AlertCircle, Sparkles,
  Lock, ArrowRight, X, Calendar, BadgePercent
} from "lucide-react";
import InsuranceSection, { type InsurancePlan, type InsurancePolicy } from "@/components/portal/insurance/InsuranceSection";
import { apiClient } from "@/lib/api-client";
import { exportInsurancePolicy } from "@/lib/pdf-export";
import { applyPaymentFulfillment } from "@/lib/billing-fulfillment";

export default function Insurance() {
  const [, setLocation] = useLocation();
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [busyPolicyId, setBusyPolicyId] = useState<string>();
  const [activeTab, setActiveTab] = useState<"browse" | "my-insurance">("browse");

  const loadInsurance = async () => {
    const [plansResult, policiesResult] = await Promise.all([
      apiClient.getInsurancePlans(),
      apiClient.getInsurancePolicies(),
    ]);
    if (plansResult.data) setPlans(plansResult.data.plans as InsurancePlan[]);
    else toast.error(plansResult.error ?? "Could not load insurance plans.");
    if (policiesResult.data) setPolicies(policiesResult.data.policies as InsurancePolicy[]);
    else toast.error(policiesResult.error ?? "Could not load your insurance policies.");
  };

  useEffect(() => {
    loadInsurance().finally(() => setLoading(false));
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("checkout_session_id");
    const statusParam = params.get("status");
    if (!sessionId) return;

    apiClient.getCheckoutSession(sessionId).then(async ({ data, error }) => {
      if (error || !data) {
        toast.error(error ?? "Could not verify the Stripe checkout session.");
      } else if (data.paymentStatus !== "paid" || !data.paymentIntentId) {
        // Pending/failed/cancelled: policy stays "Pending Payment" — never
        // activated, and the bill is left unpaid for retry.
        if (statusParam === "cancelled") {
          toast.info("Checkout cancelled — no payment was charged. Your policy remains pending.");
        } else {
          toast.warning(
            `Insurance payment not completed (status: ${String(data.paymentStatus)}). Your policy remains pending payment.`,
          );
        }
      } else {
        try {
          const result = await applyPaymentFulfillment({
            paymentIntentId: String(data.paymentIntentId),
            amountTotal: Number(data.amountTotal ?? 0),
            patientId: data.metadata?.patient_id || undefined,
            billId: data.metadata?.bill_id || undefined,
            invoiceNo: data.metadata?.invoice_no || undefined,
            orderId: data.metadata?.order_id || undefined,
            orderNo: data.metadata?.order_no || undefined,
            policyId: data.metadata?.policy_id || undefined,
            description: data.metadata?.description || undefined,
          });
          if (result.alreadyProcessed) {
            toast.info("This insurance payment was already recorded.");
          } else {
            toast.success("Insurance subscription payment confirmed via Stripe! Your policy is now active.", {
              description: `Stripe reference: ${result.paymentIntentId}`,
            });
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Payment confirmed but activation failed. Contact support.");
        }
        setActiveTab("my-insurance");
        void loadInsurance();
      }
      window.history.replaceState({}, "", window.location.pathname);
    });
  }, []);

  const purchase = async () => {
    if (!selectedPlan) return;
    if (!termsAccepted) {
      toast.error("Please accept the plan terms and conditions to proceed.");
      return;
    }
    setPurchaseBusy(true);
    const purchaseResult = await apiClient.purchaseInsurance(selectedPlan.id, true, billingCycle);
    if (purchaseResult.error || !purchaseResult.data) {
      toast.error(purchaseResult.error ?? "Could not initiate insurance subscription.");
      setPurchaseBusy(false);
      return;
    }
    const { checkout } = purchaseResult.data;
    const returnPath = window.location.pathname;
    const checkoutResult = await apiClient.createCheckoutSession(checkout.amount, checkout.description, {
      invoiceId: checkout.invoiceId,
      invoiceNo: checkout.invoiceNo,
      policyId: checkout.policyId,
      patientId: checkout.patientId,
      patientEmail: checkout.patientEmail,
      successUrl: `${window.location.origin}${returnPath}`,
      cancelUrl: `${window.location.origin}${returnPath}`,
    });
    if (checkoutResult.error || !checkoutResult.data?.url) {
      toast.error(checkoutResult.error ?? "Unable to start secure Stripe checkout session.");
      setPurchaseBusy(false);
      return;
    }
    window.location.assign(checkoutResult.data.url);
  };

  const retryPolicyPayment = async (policy: InsurancePolicy) => {
    setBusyPolicyId(policy.id);
    const plan = plans.find((p) => p.id === policy.planId);
    const amount = Number(policy.premiumAmount) || (plan ? (policy.billingCycle === "monthly" ? Number(plan.monthlyPremium) : Number(plan.annualPremium)) : 1500);
    const returnPath = window.location.pathname;

    const checkoutResult = await apiClient.createCheckoutSession(
      amount,
      `Insurance Policy Activation: ${policy.planName} (${policy.policyNumber})`,
      {
        policyId: policy.id,
        invoiceId: policy.billId,
        successUrl: `${window.location.origin}${returnPath}`,
        cancelUrl: `${window.location.origin}${returnPath}`,
      }
    );
    setBusyPolicyId(undefined);

    if (checkoutResult.error || !checkoutResult.data?.url) {
      toast.error(checkoutResult.error ?? "Unable to launch Stripe checkout for this policy.");
      return;
    }
    window.location.assign(checkoutResult.data.url);
  };

  const downloadPolicy = async (policy: InsurancePolicy) => {
    const result = await apiClient.getInsurancePolicyPdf(policy.id);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Could not generate the policy PDF.");
      return;
    }
    await exportInsurancePolicy(policy);
    toast.success("Policy certificate PDF generated and downloaded.");
  };

  const renewPolicy = async (policy: InsurancePolicy) => {
    setBusyPolicyId(policy.id);
    const result = await apiClient.renewInsurance(policy.id);
    setBusyPolicyId(undefined);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.data?.message ?? "Renewal request submitted successfully.");
      void loadInsurance();
    }
  };

  const monthlyPrice = selectedPlan ? Number(selectedPlan.monthlyPremium) : 0;
  const annualPrice = selectedPlan ? Number(selectedPlan.annualPremium) : 0;
  const savingsPct = monthlyPrice > 0 && annualPrice > 0
    ? Math.round((1 - (annualPrice / (monthlyPrice * 12))) * 100)
    : 15;

  return (
    <>
      <InsuranceSection
        plans={plans}
        policies={policies}
        loading={loading}
        defaultTab={activeTab}
        onPurchase={(plan) => {
          setSelectedPlan(plan);
          setTermsAccepted(false);
          setBillingCycle("annual");
        }}
        onRenew={renewPolicy}
        onDownload={downloadPolicy}
        onRetryPayment={retryPolicyPayment}
        onOpenBilling={() => setLocation("/billing")}
        purchaseBusyPolicyId={busyPolicyId}
      />

      {/* Subscribe & Stripe Checkout Modal */}
      {selectedPlan && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-title"
        >
          <div
            className="my-8 w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <CreditCard className="h-3.5 w-3.5" />
                  Stripe Payment Integration
                </div>
                <h2 id="purchase-title" className="mt-1.5 text-xl font-bold text-foreground">
                  Subscribe to {selectedPlan.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Underwritten by {selectedPlan.provider}
                </p>
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close purchase dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Billing Cycle Selection */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Select Subscription Billing Cycle</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    billingCycle === "monthly"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border bg-card hover:bg-muted/40"
                  }`}
                >
                  <p className="text-xs text-muted-foreground font-medium">Monthly Plan</p>
                  <p className="mt-1 text-xl font-bold text-primary">
                    ₱{Number(selectedPlan.monthlyPremium).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Billed once per month</p>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingCycle("annual")}
                  className={`relative rounded-2xl border p-4 text-left transition ${
                    billingCycle === "annual"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border bg-card hover:bg-muted/40"
                  }`}
                >
                  {savingsPct > 0 && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      <BadgePercent className="h-3 w-3" />
                      Save ~{savingsPct}%
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground font-medium">Annual Plan (Recommended)</p>
                  <p className="mt-1 text-xl font-bold text-primary">
                    ₱{Number(selectedPlan.annualPremium).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-600 font-medium">Single payment / 12 mos</p>
                </button>
              </div>
            </div>

            {/* Coverage Summary Box */}
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coverage Limit</span>
                <span className="font-bold text-foreground">₱{Number(selectedPlan.coverageLimit).toLocaleString("en-PH")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Co-Pay / Cashless Rate</span>
                <span className="font-bold text-emerald-600">{selectedPlan.coveragePercentage}% Full Settlement</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hospital Network Validity</span>
                <span className="font-bold text-foreground">{selectedPlan.validityMonths} months</span>
              </div>
              <div className="flex justify-between border-t border-border/80 pt-2 font-semibold">
                <span className="text-foreground">Total Checkout Amount</span>
                <span className="text-sm font-bold text-primary">
                  ₱{Number(billingCycle === "monthly" ? selectedPlan.monthlyPremium : selectedPlan.annualPremium).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Terms and Acceptance */}
            <label className="flex items-start gap-3 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <span className="text-muted-foreground leading-5">
                I understand and agree to the {selectedPlan.provider} Policy Guidelines, Underwriting Terms, and automatic subscription renewals.
              </span>
            </label>

            {/* Stripe Notice */}
            <div className="flex items-start gap-2.5 rounded-xl bg-accent/40 p-3 text-[11px] leading-5 text-muted-foreground border border-primary/10">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Payments are securely processed through <strong className="text-foreground">Stripe Checkout</strong>. Your official digital health card and active policy will be instantly generated upon payment confirmation.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-xs font-semibold hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purchaseBusy || !termsAccepted}
                onClick={purchase}
                className="flex-[1.5] inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                {purchaseBusy ? "Connecting to Stripe..." : "Continue to Stripe Checkout"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
