export type DemoConversationMessage = {
  id: string;
  sender: 'doctor' | 'patient' | 'system';
  text: string;
  time: string;
  status?: 'Sent' | 'Delivered' | 'Read';
  read?: boolean;
};

export type DemoConversation = {
  id: string;
  contact: {
    name: string;
    specialty: string;
    avatar: string;
  };
  messages: DemoConversationMessage[];
  unread: number;
};

/**
 * Generic, non-patient-specific examples used to demonstrate the portal UI.
 * These are intentionally separate from authenticated account data.
 */
export const demoConversations: DemoConversation[] = [
  {
    id: 'demo-maria-santos',
    contact: { name: 'Dr. Maria Santos', specialty: 'Cardiology', avatar: 'MS' },
    unread: 1,
    messages: [
      { id: 'demo-ms-1', sender: 'doctor', text: 'Hello! How have your blood pressure readings been this week?', time: 'Yesterday · 9:14 AM', read: true },
      { id: 'demo-ms-2', sender: 'patient', text: 'They have been within the range you recommended. I will bring the log to my next visit.', time: 'Yesterday · 10:02 AM', status: 'Read', read: true },
      { id: 'demo-ms-3', sender: 'doctor', text: 'That sounds good. Please continue monitoring once in the morning and once at night.', time: 'Yesterday · 10:18 AM', read: false },
      { id: 'demo-ms-4', sender: 'patient', text: 'Thank you, Doctor. I will continue the twice-daily log.', time: 'Yesterday · 10:26 AM', status: 'Delivered', read: true },
    ],
  },
  {
    id: 'demo-john-cruz',
    contact: { name: 'Dr. John Cruz', specialty: 'General Physician', avatar: 'JC' },
    unread: 0,
    messages: [
      { id: 'demo-jc-1', sender: 'patient', text: 'I uploaded the lab document from my recent check-up.', time: 'Mon · 2:20 PM', status: 'Read', read: true },
      { id: 'demo-jc-2', sender: 'doctor', text: 'Received. I will review the results and follow up if anything needs attention.', time: 'Mon · 2:42 PM', read: true },
      { id: 'demo-jc-3', sender: 'patient', text: 'I appreciate it. Please let me know if I should schedule another visit.', time: 'Mon · 2:48 PM', status: 'Read', read: true },
    ],
  },
  {
    id: 'demo-angela-reyes',
    contact: { name: 'Dr. Angela Reyes', specialty: 'Pediatrics', avatar: 'AR' },
    unread: 2,
    messages: [
      { id: 'demo-ar-1', sender: 'doctor', text: 'The appointment is confirmed. Please bring the child health record.', time: 'Jun 18 · 4:05 PM', read: false },
      { id: 'demo-ar-2', sender: 'doctor', text: 'If the fever returns, please contact the clinic before the visit.', time: 'Jun 18 · 4:06 PM', read: false },
      { id: 'demo-ar-3', sender: 'patient', text: 'Understood. We will bring the record and arrive 15 minutes early.', time: 'Jun 18 · 4:19 PM', status: 'Sent', read: true },
    ],
  },
  {
    id: 'demo-anne-dela-cruz',
    contact: { name: 'Nurse Anne Dela Cruz', specialty: 'Care Coordination', avatar: 'AD' },
    unread: 0,
    messages: [
      { id: 'demo-ad-1', sender: 'patient', text: 'Could you confirm where I should check in for my appointment?', time: 'Jun 16 · 8:31 AM', status: 'Read', read: true },
      { id: 'demo-ad-2', sender: 'doctor', text: 'Please check in at the main reception desk on the ground floor.', time: 'Jun 16 · 8:47 AM', read: true },
      { id: 'demo-ad-3', sender: 'patient', text: 'Got it. Thank you for helping me prepare for the visit.', time: 'Jun 16 · 8:54 AM', status: 'Delivered', read: true },
    ],
  },
  {
    id: 'demo-billing-office',
    contact: { name: 'Billing Office', specialty: 'Patient Accounts', avatar: 'BO' },
    unread: 1,
    messages: [
      { id: 'demo-bo-1', sender: 'doctor', text: 'Your latest statement is available in Billing. Please contact us if you need a payment arrangement.', time: 'Jun 12 · 11:30 AM', read: false },
      { id: 'demo-bo-2', sender: 'patient', text: 'Thank you. I would like to review the available payment options.', time: 'Jun 12 · 11:46 AM', status: 'Read', read: true },
      { id: 'demo-bo-3', sender: 'doctor', text: 'A billing coordinator can help you through the secure Billing module.', time: 'Jun 12 · 12:03 PM', read: true },
    ],
  },
  {
    id: 'demo-reception-desk',
    contact: { name: 'Reception Desk', specialty: 'Appointments & Scheduling', avatar: 'RD' },
    unread: 0,
    messages: [
      { id: 'demo-rd-1', sender: 'patient', text: 'I would like to confirm the clinic location for my upcoming visit.', time: 'Jun 10 · 1:10 PM', status: 'Read', read: true },
      { id: 'demo-rd-2', sender: 'doctor', text: 'Your visit will be at the Chong Hua Hospital outpatient clinic.', time: 'Jun 10 · 1:22 PM', read: true },
      { id: 'demo-rd-3', sender: 'patient', text: 'Perfect, I have saved the location. See you then.', time: 'Jun 10 · 1:28 PM', status: 'Delivered', read: true },
    ],
  },
];

export const demoMedicalCertificates = [
  { id: 'demo-cert-1', title: 'Medical Certificate', purpose: 'Fit-to-work assessment', issuedBy: 'Dr. John Cruz', date: 'June 12, 2026', status: 'Demo document' },
  { id: 'demo-cert-2', title: 'Certificate of Consultation', purpose: 'Outpatient visit confirmation', issuedBy: 'Dr. Maria Santos', date: 'May 28, 2026', status: 'Demo document' },
];

export const demoRecordDocuments = [
  { id: 'demo-doc-1', name: 'Laboratory Results — CBC.pdf', type: 'PDF', date: 'June 12, 2026', description: 'Placeholder laboratory attachment' },
  { id: 'demo-doc-2', name: 'Prescription Instructions.jpg', type: 'Image', date: 'May 28, 2026', description: 'Placeholder prescription attachment' },
  { id: 'demo-doc-3', name: 'Consultation Summary.pdf', type: 'PDF', date: 'May 10, 2026', description: 'Placeholder consultation document' },
];

export const demoAppointmentHistory = [
  { id: 'demo-appt-1', date: 'July 30, 2026', time: '9:00 AM', doctor: 'Dr. Maria Santos', specialty: 'Cardiology', clinic: 'Chong Hua Hospital', status: 'Confirmed' },
  { id: 'demo-appt-2', date: 'June 15, 2026', time: '11:00 AM', doctor: 'Dr. John Cruz', specialty: 'General Medicine', clinic: 'SugboDoc Regional Hospital', status: 'Completed' },
  { id: 'demo-appt-3', date: 'May 10, 2026', time: '10:30 AM', doctor: 'Dr. Angela Reyes', specialty: 'Pediatrics', clinic: 'Perpetual Succour Hospital', status: 'Completed' },
];

export const demoMedicalRecords = {
  encounters: [
    { id: 'demo-encounter-1', date: 'June 12, 2026', doctor: 'Dr. John Cruz', specialty: 'General Medicine', clinic: 'SugboDoc Regional Hospital', complaint: 'Annual health check-up', summary: 'Routine consultation completed. Follow-up recommended in six months.', demo: true },
    { id: 'demo-encounter-2', date: 'May 28, 2026', doctor: 'Dr. Maria Santos', specialty: 'Cardiology', clinic: 'Chong Hua Hospital', complaint: 'Blood pressure review', summary: 'Vital signs reviewed and lifestyle guidance provided.', demo: true },
  ],
  vitals: [
    { date: 'June 12', systolic: 122, diastolic: 80, hr: 74, temp: 36.6, weight: 68, demo: true },
    { date: 'May 28', systolic: 128, diastolic: 82, hr: 78, temp: 36.7, weight: 68.5, demo: true },
    { date: 'April 15', systolic: 124, diastolic: 79, hr: 72, temp: 36.5, weight: 69, demo: true },
  ],
  prescriptions: [
    { id: 'demo-rx-1', med: 'Vitamin D3 1000 IU', instruction: 'Once daily with food', status: 'Active', demo: true },
    { id: 'demo-rx-2', med: 'Paracetamol 500mg', instruction: 'As needed for fever or pain', status: 'Completed', demo: true },
  ],
  labs: [
    { id: 'demo-lab-1', test: 'CBC - WBC', value: '7.8', range: '4.5–11.0', status: 'Normal', date: 'June 12, 2026', demo: true },
    { id: 'demo-lab-2', test: 'Blood Glucose', value: '96 mg/dL', range: '70–100 mg/dL', status: 'Normal', date: 'June 12, 2026', demo: true },
  ],
  diagnoses: [
    { code: 'Z00.00', desc: 'General adult medical examination', date: 'June 12, 2026', status: 'Resolved', demo: true },
    { code: 'R03.0', desc: 'Elevated blood-pressure reading', date: 'May 28, 2026', status: 'Active', demo: true },
  ],
};

export type DemoImagingRecord = {
  id: string;
  examinationName: string;
  examinationDate: string;
  orderingPhysician: string;
  performingDepartment: string;
  status: 'Completed' | 'Pending' | 'Scheduled';
  findingsSummary: string;
  impression: string;
  recommendation: string;
  reportGeneratedDate: string;
  images: { label: string; src: string }[];
  demo: true;
};

function radiologyPlaceholder(label: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
    <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#111827"/><stop offset="1" stop-color="#374151"/></linearGradient></defs>
    <rect width="640" height="400" fill="url(#g)"/>
    <circle cx="320" cy="205" r="124" fill="#0f172a" stroke="${accent}" stroke-opacity=".55" stroke-width="3"/>
    <path d="M226 154c28 18 48 35 62 73 11 29 25 29 32-3 8-35 22-52 48-70M240 272c28-20 51-22 80-1 28-21 53-19 80 1M320 99v202M212 205h216" fill="none" stroke="#d1d5db" stroke-opacity=".62" stroke-width="8" stroke-linecap="round"/>
    <rect x="20" y="20" width="600" height="360" fill="none" stroke="${accent}" stroke-opacity=".45" stroke-width="2"/>
    <text x="28" y="48" fill="#f9fafb" font-family="Arial,sans-serif" font-size="16" font-weight="700">${label}</text>
    <text x="28" y="72" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="12">SAMPLE IMAGE · DEMO ONLY</text>
    <text x="28" y="370" fill="#cbd5e1" font-family="monospace" font-size="11">NOT FOR CLINICAL DIAGNOSIS</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const imagingDefinitions: Array<[string, string, 'Completed' | 'Pending' | 'Scheduled', string, string, string]> = [
  ['Chest X-Ray', 'July 12, 2026', 'Completed', 'Clear lung fields with no focal consolidation or pleural effusion.', 'No acute cardiopulmonary abnormality.', 'Continue routine clinical follow-up.'],
  ['Skull X-Ray', 'July 9, 2026', 'Completed', 'No displaced fracture or acute osseous abnormality identified.', 'Unremarkable skull radiographs.', 'Correlate clinically if symptoms persist.'],
  ['Abdominal X-Ray', 'July 7, 2026', 'Completed', 'Non-obstructive bowel gas pattern with moderate stool burden.', 'No radiographic evidence of bowel obstruction.', 'Hydration and clinical correlation recommended.'],
  ['CT Scan — Head', 'July 2, 2026', 'Completed', 'No acute hemorrhage, mass effect, or midline shift.', 'No acute intracranial finding on this non-contrast study.', 'Follow the ordering physician’s care plan.'],
  ['MRI — Lumbar Spine', 'June 28, 2026', 'Pending', 'Sequences acquired; formal radiologist interpretation is in progress.', 'Report pending radiologist sign-off.', 'Review the finalized report with the ordering physician.'],
  ['Ultrasound — Abdomen', 'June 21, 2026', 'Completed', 'Liver, gallbladder, pancreas, spleen, and kidneys are visualized without acute abnormality.', 'Unremarkable abdominal ultrasound.', 'Routine follow-up as clinically indicated.'],
  ['2D Echo', 'June 17, 2026', 'Completed', 'Left ventricular systolic function is preserved on this sample report.', 'Sample echocardiogram report with preserved function.', 'Discuss complete measurements with Cardiology.'],
  ['ECG / EKG', 'June 14, 2026', 'Completed', 'Regular rhythm demonstrated in this sample tracing.', 'Sample ECG marked for physician review.', 'Clinical correlation required.'],
  ['Mammogram', 'June 8, 2026', 'Scheduled', 'Screening appointment has been scheduled; images are not yet available.', 'Scheduled — no impression yet.', 'Attend the scheduled imaging appointment.'],
  ['Bone Density Scan', 'May 30, 2026', 'Completed', 'Bone mineral density measurements captured for review.', 'Sample DEXA report available for clinician interpretation.', 'Review risk factors with your physician.'],
  ['Fluoroscopy — Upper GI', 'May 24, 2026', 'Completed', 'Contrast passage is demonstrated without a fixed obstructive pattern.', 'No acute fluoroscopic abnormality in this sample.', 'Continue care plan from the ordering service.'],
  ['PET Scan', 'May 18, 2026', 'Pending', 'Placeholder study entry; PET imaging interpretation is not yet available.', 'Placeholder — report pending.', 'Contact the imaging department for availability.'],
  ['Doppler Ultrasound — Leg', 'May 11, 2026', 'Completed', 'Flow is demonstrated in the sampled vessels in this demo report.', 'No demo evidence of acute occlusion.', 'Confirm final vascular interpretation with the ordering physician.'],
];

export const demoImagingRecords: DemoImagingRecord[] = imagingDefinitions.map(([examinationName, examinationDate, status, findingsSummary, impression, recommendation], index) => ({
  id: `demo-imaging-${index + 1}`,
  examinationName,
  examinationDate,
  orderingPhysician: index % 2 === 0 ? 'Dr. Maria Santos' : 'Dr. John Cruz',
  performingDepartment: index % 3 === 0 ? 'Radiology Department' : index % 3 === 1 ? 'Diagnostic Imaging Center' : 'Cardiopulmonary Diagnostics',
  status,
  findingsSummary,
  impression,
  recommendation,
  reportGeneratedDate: status === 'Scheduled' ? 'Not yet generated' : `July ${13 - Math.min(index, 9)}, 2026`,
  images: [{ label: `${examinationName} · Demo preview`, src: radiologyPlaceholder(examinationName, index % 2 === 0 ? '#818cf8' : '#38bdf8') }],
  demo: true,
}));