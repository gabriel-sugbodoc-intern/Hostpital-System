import React, { useState } from "react";
import { loadStripe, type StripeError } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2, Lock } from "lucide-react";

type Props = {
  clientSecret: string;
  publishableKey: string;
  /** e.g. "Pay ₱1,250.00" */
  payLabel: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
};

const stripePromiseCache = new Map<string, ReturnType<typeof loadStripe>>();
function getStripePromise(publishableKey: string) {
  let p = stripePromiseCache.get(publishableKey);
  if (!p) {
    p = loadStripe(publishableKey);
    stripePromiseCache.set(publishableKey, p);
  }
  return p;
}

function describeError(err: StripeError): string {
  return err.message || "Your payment could not be processed. Please try again.";
}

function CardForm({
  payLabel,
  onSuccess,
  onError,
}: Omit<Props, "clientSecret" | "publishableKey">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    // Validate + tokenize fields client-side before confirming.
    const submitResult = await elements.submit();
    if (submitResult.error) {
      setSubmitting(false);
      onError(submitResult.error.message || "Please check your card details.");
      return;
    }

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });

      if (error) {
        onError(describeError(error));
        return;
      }
      if (
        paymentIntent &&
        (paymentIntent.status === "succeeded" ||
          paymentIntent.status === "processing" ||
          paymentIntent.status === "requires_capture")
      ) {
        onSuccess(paymentIntent.id);
        return;
      }
      onError("The payment did not complete. No charge was made — please try again.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unexpected error contacting Stripe.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-input bg-background p-3">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-60 min-h-[46px]"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Processing…
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" /> {payLabel}
          </>
        )}
      </button>
      <p className="text-[11px] text-muted-foreground text-center">
        Secured by Stripe · test mode: use 4242 4242 4242 4242
      </p>
    </form>
  );
}

export default function StripeCardSection({ clientSecret, publishableKey, ...rest }: Props) {
  return (
    <Elements
      stripe={getStripePromise(publishableKey)}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#2563EB",
            borderRadius: "8px",
            fontFamily: "'Segoe UI', Roboto, sans-serif",
          },
        },
      }}
    >
      <CardForm payLabel={rest.payLabel} onSuccess={rest.onSuccess} onError={rest.onError} />
    </Elements>
  );
}
