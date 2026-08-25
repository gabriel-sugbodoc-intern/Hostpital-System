import { Link } from "@tanstack/react-router";
import { Stethoscope, Mail, Phone, MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-border bg-secondary/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Stethoscope className="size-5" />
            </span>
            <span className="font-display text-lg font-extrabold text-brand-deep">SugboDoc</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            A patient portal that connects patients with healthcare providers and makes healthcare
            services easier to access and manage.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Quick Links</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li>
              <Link to="/" hash="services" className="hover:text-foreground">
                Services
              </Link>
            </li>
            <li>
              <Link to="/" hash="about" className="hover:text-foreground">
                About
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-foreground">
                Login
              </Link>
            </li>
            <li>
              <Link to="/register" className="hover:text-foreground">
                Register
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Services</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Appointment Booking</li>
            <li>Medical Records</li>
            <li>Doctor Consultation</li>
            <li>Pharmacy Orders</li>
            <li>Insurance & Billing</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Contact</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" /> Cebu City, Philippines
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 size-4 shrink-0" /> +63 32 000 0000
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 size-4 shrink-0" /> support@sugbodoc.ph
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} SugboDoc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
