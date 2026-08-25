import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  FileText,
  Stethoscope,
  MessageSquare,
  Pill,
  ShieldCheck,
  CreditCard,
  ListOrdered,
  HeartPulse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SugboDoc — Your Healthcare, Connected" },
      {
        name: "description",
        content:
          "SugboDoc connects patients with healthcare providers: appointments, medical records, consultations, pharmacy, insurance, and billing in one portal.",
      },
      { property: "og:title", content: "SugboDoc — Your Healthcare, Connected" },
      {
        property: "og:description",
        content:
          "Book appointments, access medical records, consult doctors, and manage healthcare in one place.",
      },
    ],
  }),
  component: Landing,
});

const services = [
  {
    icon: CalendarCheck,
    title: "Online Appointment Booking",
    body: "Book and manage healthcare appointments.",
  },
  {
    icon: FileText,
    title: "Patient Medical Records",
    body: "Access encounters, diagnoses, prescriptions, laboratory results, imaging, and other medical information.",
  },
  {
    icon: Stethoscope,
    title: "Doctor Consultation",
    body: "Connect and communicate with healthcare providers.",
  },
  {
    icon: MessageSquare,
    title: "SMS Messaging",
    body: "Patients, doctors, and administrators communicate through the platform.",
  },
  {
    icon: Pill,
    title: "Pharmacy / Medical Store",
    body: "Browse healthcare products, select a store branch, and place orders.",
  },
  {
    icon: ShieldCheck,
    title: "Insurance Management",
    body: "Browse insurance plans and submit insurance applications.",
  },
  {
    icon: CreditCard,
    title: "Billing & Payments",
    body: "View bills, payments, and transaction information.",
  },
  {
    icon: ListOrdered,
    title: "Queue & Appointment Tracking",
    body: "Monitor appointments and relevant queue information.",
  },
];

const steps = [
  { n: "1", title: "Create Your Account", body: "Register in a few steps and verify your details." },
  {
    n: "2",
    title: "Book or Access Healthcare Services",
    body: "Schedule appointments, consult doctors, or open your records.",
  },
  {
    n: "3",
    title: "Manage Your Healthcare in One Platform",
    body: "Track visits, prescriptions, bills, and insurance in one portal.",
  },
];

function Landing() {
  return (
    <div id="top" className="min-h-screen bg-background">
      <SiteNav />

      <main>
        {/* Hero */}
        <section
          className="border-b border-border"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        >
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <HeartPulse className="size-4 text-primary" /> SugboDoc Patient Portal
              </span>
              <h1 className="mt-5 text-4xl font-extrabold text-brand-deep sm:text-5xl">
                Your Healthcare, Connected.
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                SugboDoc connects patients with healthcare providers and makes healthcare services
                easier to access and manage — from appointments and medical records to pharmacy,
                insurance, and billing.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/register">Get Started</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">Login</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <div className="grid grid-cols-2 gap-4">
                {services.slice(0, 4).map((s) => (
                  <div key={s.title} className="rounded-xl bg-secondary/70 p-4">
                    <s.icon className="size-6 text-primary" />
                    <p className="mt-2 text-sm font-semibold leading-snug">{s.title}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                One secure portal for patients, doctors, and administrators.
              </p>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold">Services</h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to access and manage healthcare in one platform.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <Card key={s.title} className="h-full border-border/80 transition-shadow hover:shadow-[var(--shadow-soft)]">
                <CardHeader className="space-y-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <s.icon className="size-5" />
                  </span>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works / About */}
        <section id="about" className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold">How It Works</h2>
              <p className="mt-3 text-muted-foreground">
                Getting started with SugboDoc takes three simple steps.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="rounded-2xl border border-border bg-card p-6">
                  <span className="grid size-10 place-items-center rounded-full bg-primary font-display text-base font-bold text-primary-foreground">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)] sm:p-12">
            <h2 className="text-3xl font-bold text-brand-deep">
              Take control of your healthcare today.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Create your SugboDoc account and manage appointments, records, and more in one place.
            </p>
            <Button asChild size="lg" className="mt-7">
              <Link to="/register">Create Account</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
