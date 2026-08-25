import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const HOSPITAL_NAME = "SugboDoc Regional Hospital";
const HOSPITAL_ADDRESS = "Osmeña Blvd, Cebu City, Philippines 6000";
const HOSPITAL_TEL = "Tel: (032) 255-8000  |  Email: records@sugbodoc.ph";
const PRIMARY = [74, 79, 196] as [number, number, number]; // #4A4FC4

function drawHeader(doc: jsPDF, title: string) {
  const pageW = doc.internal.pageSize.getWidth();

  // Top color bar
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 28, "F");

  // Hospital name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(HOSPITAL_NAME, 14, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(HOSPITAL_ADDRESS, 14, 19);
  doc.text(HOSPITAL_TEL, 14, 24);

  // Report title in top-right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, pageW - 14, 17, { align: "right" });

  // Generation date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Generated: ${new Date().toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" })}`,
    pageW - 14,
    23,
    { align: "right" }
  );

  // Reset text colour for body
  doc.setTextColor(30, 30, 30);
}

function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.text(text.toUpperCase(), 14, y);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.4);
  doc.line(14, y + 2, doc.internal.pageSize.getWidth() - 14, y + 2);
  doc.setTextColor(30, 30, 30);
  return y + 8;
}

/** Export a comprehensive patient health report as PDF. */
export async function exportPatientReport(data: {
  patient: {
    name: string;
    age: number;
    gender: string;
    bloodType: string;
    dob: string;
    allergies: string[];
    emergencyContact: { name: string; relation: string; phone: string };
  };
  appointments: { date: string; time: string; doctor: { name: string; specialty: string }; clinic: string; status: string }[];
  encounters: { date: string; doctor: string; specialty: string; complaint: string; summary: string }[];
  labResults: { test: string; value: string; range: string; status: string; date: string }[];
  prescriptions: { med: string; instruction: string; status: string }[];
  bills: {
    outstanding: { desc: string; date: string; amount: number }[];
    history: { desc: string; date: string; amount: number }[];
  };
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 36;

  drawHeader(doc, "PATIENT HEALTH REPORT");

  // ── Patient Information ──────────────────────────────────────────────────
  y = drawSectionTitle(doc, "Patient Information", y);

  const patientInfo = [
    ["Full Name", data.patient.name, "Date of Birth", data.patient.dob],
    ["Age", `${data.patient.age} years`, "Gender", data.patient.gender],
    ["Blood Type", data.patient.bloodType, "Allergies", data.patient.allergies.join(", ") || "None"],
    [
      "Emergency Contact",
      `${data.patient.emergencyContact.name} (${data.patient.emergencyContact.relation})`,
      "Contact No.",
      data.patient.emergencyContact.phone,
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: patientInfo,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40, textColor: [80, 80, 80] },
      1: { cellWidth: 55 },
      2: { fontStyle: "bold", cellWidth: 40, textColor: [80, 80, 80] },
      3: { cellWidth: 55 },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Upcoming Appointments ────────────────────────────────────────────────
  y = drawSectionTitle(doc, "Appointments", y);
  autoTable(doc, {
    startY: y,
    head: [["Date", "Time", "Doctor", "Specialty", "Clinic", "Status"]],
    body: data.appointments.map((a) => [
      a.date,
      a.time,
      a.doctor.name,
      a.doctor.specialty,
      a.clinic,
      a.status,
    ]),
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Recent Encounters ────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "Medical Encounters", y);
  autoTable(doc, {
    startY: y,
    head: [["Date", "Doctor", "Specialty", "Chief Complaint", "Summary"]],
    body: data.encounters.map((e) => [e.date, e.doctor, e.specialty, e.complaint, e.summary]),
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 4: { cellWidth: 60 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Lab Results ──────────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "Laboratory Results", y);
  autoTable(doc, {
    startY: y,
    head: [["Test", "Value", "Reference Range", "Status", "Date"]],
    body: data.labResults.map((l) => [l.test, l.value, l.range, l.status, l.date]),
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
    didDrawCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.column.index === 3) {
        const val = hookData.cell.raw as string;
        if (val === "Abnormal") {
          doc.setTextColor(220, 50, 50);
          doc.text(val, hookData.cell.x + 2, hookData.cell.y + 4);
          doc.setTextColor(30, 30, 30);
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Prescriptions ────────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "Active Prescriptions", y);
  autoTable(doc, {
    startY: y,
    head: [["Medication", "Instructions", "Status"]],
    body: data.prescriptions.map((p) => [p.med, p.instruction, p.status]),
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Billing Summary ──────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "Billing Summary", y);

  const totalOutstanding = data.bills.outstanding.reduce((s, b) => s + b.amount, 0);
  const totalPaid = data.bills.history.reduce((s, b) => s + b.amount, 0);

  autoTable(doc, {
    startY: y,
    head: [["Description", "Date", "Amount (₱)", "Status"]],
    body: [
      ...data.bills.outstanding.map((b) => [b.desc, b.date, `₱${b.amount.toLocaleString()}`, "OUTSTANDING"]),
      ...data.bills.history.map((b) => [b.desc, b.date, `₱${b.amount.toLocaleString()}`, "PAID"]),
    ],
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Totals row
  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ["Total Outstanding", `₱${totalOutstanding.toLocaleString()}`],
      ["Total Paid", `₱${totalPaid.toLocaleString()}`],
    ],
    theme: "plain",
    styles: { fontSize: 9, fontStyle: "bold", cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
    margin: { left: pageW - 80, right: 14 },
  });

  // ── Footer ───────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${HOSPITAL_NAME}  •  CONFIDENTIAL PATIENT RECORD  •  Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  doc.save(`SugboDoc_HealthReport_${data.patient.name.replace(/\s+/g, "_")}_${Date.now()}.pdf`);
}

/** Export a single itemized invoice as PDF. */
export async function exportInvoice(invoice: {
  invoiceNo: string;
  patient: { name: string };
  date: string;
  items: { desc: string; qty: number; unitPrice: number; total: number }[];
  status: string;
  paymentMethod?: string;
  paidOn?: string;
  deliveryFee?: number;
  tax?: number;
  discount?: number;
  total?: number;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  drawHeader(doc, "OFFICIAL INVOICE");

  let y = 36;

  // Invoice meta
  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ["Invoice No.", invoice.invoiceNo, "Date", invoice.date],
      ["Patient", invoice.patient.name, "Status", invoice.status],
      ...(invoice.paymentMethod ? [["Payment Method", invoice.paymentMethod, "Paid On", invoice.paidOn ?? "-"]] : []),
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40, textColor: [80, 80, 80] },
      1: { cellWidth: 70 },
      2: { fontStyle: "bold", cellWidth: 30, textColor: [80, 80, 80] },
      3: { cellWidth: 50 },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  y = drawSectionTitle(doc, "Itemized Charges", y);

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: invoice.items.map((item) => [
      item.desc,
      item.qty,
      `₱${item.unitPrice.toLocaleString()}`,
      `₱${item.total.toLocaleString()}`,
    ]),
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  const itemTotal = invoice.items.reduce((s, i) => s + i.total, 0);
  const deliveryFee = invoice.deliveryFee ?? 0;
  const tax = invoice.tax ?? 0;
  const discount = invoice.discount ?? 0;
  const total = invoice.total ?? itemTotal + deliveryFee + tax - discount;

  // Total box
  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ["Subtotal", `₱${itemTotal.toLocaleString()}`],
      ...(deliveryFee > 0 ? [["Delivery fee", `₱${deliveryFee.toLocaleString()}`]] : []),
      ...(tax > 0 ? [["Taxes", `₱${tax.toLocaleString()}`]] : []),
      ...(discount > 0 ? [["Discount", `-₱${discount.toLocaleString()}`]] : []),
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
    margin: { left: pageW - 80, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFillColor(245, 247, 255);
  doc.roundedRect(pageW - 80, y, 66, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text("TOTAL DUE:", pageW - 78, y + 9);
  doc.text(`₱${total.toLocaleString()}`, pageW - 16, y + 9, { align: "right" });
  doc.setTextColor(30, 30, 30);

  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("This is an official hospital invoice. Please retain for your records.", 14, y);
  doc.text("For billing inquiries call (032) 255-8000 or email billing@sugbodoc.ph", 14, y + 5);

  // Footer
  doc.setFontSize(7);
  doc.text(
    `${HOSPITAL_NAME}  •  OFFICIAL INVOICE  •  ${invoice.invoiceNo}`,
    pageW / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: "center" }
  );

  doc.save(`Invoice_${invoice.invoiceNo}_${Date.now()}.pdf`);
}

/** Export a patient-owned insurance policy. This is a client-generated demo PDF placeholder. */
export async function exportInsurancePolicy(policy: {
  policyNumber: string;
  insuranceId: string;
  planName: string;
  provider: string;
  status: string;
  paymentStatus: string;
  premiumAmount: string | number;
  coverageLimit: string | number;
  remainingCoverage: string | number;
  expirationDate: string;
  renewalDate: string;
  purchasedAt: string;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, "INSURANCE POLICY");
  let y = 38;
  y = drawSectionTitle(doc, "Policy Details", y);
  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ["Policy Number", policy.policyNumber, "Insurance ID", policy.insuranceId],
      ["Plan", policy.planName, "Provider", policy.provider],
      ["Policy Status", policy.status, "Payment Status", policy.paymentStatus],
      ["Premium", `₱${Number(policy.premiumAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, "Purchased", new Date(policy.purchasedAt).toLocaleDateString("en-PH")],
      ["Coverage Limit", `₱${Number(policy.coverageLimit).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, "Remaining", `₱${Number(policy.remainingCoverage).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
      ["Expiration Date", new Date(policy.expirationDate).toLocaleDateString("en-PH"), "Renewal Date", new Date(policy.renewalDate).toLocaleDateString("en-PH")],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 35, textColor: [80, 80, 80] },
      1: { cellWidth: 60 },
      2: { fontStyle: "bold", cellWidth: 35, textColor: [80, 80, 80] },
      3: { cellWidth: 60 },
    },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 12;
  y = drawSectionTitle(doc, "Important Notice", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const notice = doc.splitTextToSize(
    "This policy document is a patient portal PDF placeholder for the SugboDoc insurance demonstration. Coverage is subject to the selected plan's terms, eligibility, waiting periods, exclusions, provider authorization, and available limits.",
    180,
  );
  doc.text(notice, 14, y);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(7);
  doc.text(`${HOSPITAL_NAME}  •  INSURANCE POLICY  •  ${policy.policyNumber}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
  doc.save(`SugboDoc_Insurance_${policy.policyNumber}_${Date.now()}.pdf`);
}
