export const patient = {
  name: 'Juan dela Cruz',
  initials: 'JD',
  age: 34,
  gender: 'M',
  bloodType: 'O+',
  dob: 'Jan 15, 1992',
  allergies: ['Penicillin', 'Sulfa drugs'],
  emergencyContact: {
    name: 'Maria dela Cruz',
    relation: 'Spouse',
    phone: '09171234567'
  }
};

export const hospitals = [
  "Cebu Doctors' University Hospital",
  "Perpetual Succour Hospital",
  "Chong Hua Hospital",
  "Vicente Sotto Memorial Medical Center"
];

export const doctors = [
  { id: 'd1', name: 'Dr. Maria Santos', specialty: 'Internal Medicine', avatar: 'MS' },
  { id: 'd2', name: 'Dr. Jose Reyes', specialty: 'Cardiology', avatar: 'JR' },
  { id: 'd3', name: 'Dr. Ana Villanueva', specialty: 'OB-GYN', avatar: 'AV' },
  { id: 'd4', name: 'Dr. Ramon Dela Cruz', specialty: 'Pediatrics', avatar: 'RC' },
  { id: 'd5', name: 'Dr. Christine Lim', specialty: 'Dermatology', avatar: 'CL' }
];

export const appointments = [
  { id: 'a1', date: 'July 30, 2026', time: '9:00 AM', doctor: doctors[0], clinic: 'Chong Hua Hospital', status: 'Confirmed', isPast: false },
  { id: 'a2', date: 'Aug 5, 2026', time: '2:00 PM', doctor: doctors[1], clinic: "Cebu Doctors'", status: 'Pending', isPast: false },
  { id: 'a3', date: 'Aug 12, 2026', time: '10:00 AM', doctor: doctors[2], clinic: 'Perpetual Succour', status: 'Confirmed', isPast: false },
  { id: 'a4', date: 'June 15, 2026', time: '11:00 AM', doctor: doctors[0], clinic: 'Chong Hua Hospital', status: 'Completed', isPast: true },
  { id: 'a5', date: 'May 28, 2026', time: '3:00 PM', doctor: doctors[3], clinic: 'Vicente Sotto', status: 'Completed', isPast: true }
];

export const encounters = [
  { id: 'e1', date: 'July 15, 2026', doctor: 'Dr. Santos', specialty: 'Internal Medicine', clinic: 'Chong Hua Hospital', complaint: 'Persistent cough', summary: 'Upper respiratory tract infection, prescribed amoxicillin' },
  { id: 'e2', date: 'June 28, 2026', doctor: 'Dr. Reyes', specialty: 'Cardiology', clinic: "Cebu Doctors' University Hospital", complaint: 'Chest palpitations', summary: 'Benign PVCs, stress-induced, ECG normal' },
  { id: 'e3', date: 'May 10, 2026', doctor: 'Dr. Villanueva', specialty: 'OB-GYN', clinic: 'Perpetual Succour Hospital', complaint: 'Annual check-up', summary: 'All vitals normal, labs requested' }
];

export const vitals = [
  { date: 'July 15', systolic: 128, diastolic: 84, hr: 78, temp: 36.8, weight: 72 },
  { date: 'June 28', systolic: 132, diastolic: 86, hr: 82, temp: 36.6, weight: 73 },
  { date: 'May 10', systolic: 125, diastolic: 80, hr: 76, temp: 36.5, weight: 72 },
  { date: 'Apr 5', systolic: 130, diastolic: 85, hr: 80, temp: 36.7, weight: 73 },
  { date: 'Mar 12', systolic: 122, diastolic: 78, hr: 74, temp: 36.4, weight: 71 },
  { date: 'Feb 8', systolic: 135, diastolic: 88, hr: 85, temp: 36.9, weight: 74 }
];

export const prescriptions = [
  { id: 'p1', med: 'Amlodipine 5mg', instruction: 'Once daily', status: 'Active' },
  { id: 'p2', med: 'Amoxicillin 500mg', instruction: 'Thrice daily x 7 days', status: 'Completed' },
  { id: 'p3', med: 'Metoprolol 25mg', instruction: 'Twice daily', status: 'Refill Needed' }
];

export const labResults = [
  { id: 'l1', test: 'CBC - WBC', value: '8.2', range: '4.5-11.0', status: 'Normal', date: 'July 15, 2026' },
  { id: 'l2', test: 'Blood Glucose', value: '105 mg/dL', range: '70-100 mg/dL', status: 'Abnormal', date: 'July 15, 2026' },
  { id: 'l3', test: 'Cholesterol Total', value: '195 mg/dL', range: '<200 mg/dL', status: 'Normal', date: 'July 15, 2026' },
  { id: 'l4', test: 'Creatinine', value: '0.9 mg/dL', range: '0.7-1.3 mg/dL', status: 'Normal', date: 'July 15, 2026' }
];

export type ImagingReport = {
  id: string;
  date: string;
  type: string;
  region: string;
  orderedBy: string;
  facility: string;
  impression: string;
  findings: string;
  status: 'Normal' | 'Abnormal' | 'Borderline';
  reportImage: string;   // the printed report document
  scanImage: string;     // the actual radiograph / scan
};

export const imagingReports: ImagingReport[] = [
  {
    id: 'img1',
    date: 'June 28, 2026',
    type: 'Chest X-Ray (PA View)',
    region: 'Chest / Thorax',
    orderedBy: 'Dr. Jose Reyes',
    facility: "Cebu Doctors' University Hospital",
    impression: 'No acute cardiopulmonary process. Heart size within normal limits.',
    findings: 'Lungs are clear with no consolidation, infiltrates, or pleural effusion noted. Hemidiaphragms are intact and normally positioned. Cardiac silhouette is not enlarged. Bony thorax is intact. No pneumothorax.',
    status: 'Normal',
    reportImage: new URL('@/assets/imaging/ct-report.jpg', import.meta.url).href,
    scanImage: new URL('@/assets/imaging/chest-xray.jpg', import.meta.url).href,
  },
  {
    id: 'img2',
    date: 'June 28, 2026',
    type: 'Echocardiogram (2D)',
    region: 'Heart',
    orderedBy: 'Dr. Jose Reyes',
    facility: "Cebu Doctors' University Hospital",
    impression: 'Preserved left ventricular systolic function. No significant valvular disease. PVCs noted, consistent with clinical history.',
    findings: 'LV size and wall thickness normal. LVEF estimated at 62%. No regional wall motion abnormalities. Mild trivial mitral regurgitation. Right ventricle normal size and function. No pericardial effusion. Aortic root normal.',
    status: 'Borderline',
    reportImage: new URL('@/assets/imaging/ct-report.jpg', import.meta.url).href,
    scanImage: new URL('@/assets/imaging/echocardiogram.jpg', import.meta.url).href,
  },
];

export type SoapNote = {
  id: string;
  date: string;
  doctor: string;
  text: string;
  fromDocument?: boolean;
  documentName?: string;
};

export const soapNotes: SoapNote[] = [
  {
    id: 's1',
    date: 'July 15, 2026',
    doctor: 'Dr. Santos',
    text: 'S: Patient c/o productive cough x 5 days / O: Lungs clear, temp 36.8°C, RR 18, HR 78 / A: Acute upper respiratory tract infection (URTI) / P: Amoxicillin 500mg TID x 7 days, increase fluid intake, rest'
  }
];

const SOAP_STORAGE_KEY = 'sugbodoc_generated_soap';

export function getGeneratedSoapNotes(): SoapNote[] {
  try {
    const stored = localStorage.getItem(SOAP_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveGeneratedSoapNote(note: SoapNote): void {
  try {
    const existing = getGeneratedSoapNotes();
    localStorage.setItem(SOAP_STORAGE_KEY, JSON.stringify([note, ...existing]));
  } catch {
    // ignore
  }
}

export function generateSoapFromDocument(fileName: string, doctorName: string): SoapNote {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Generate a contextual SOAP note based on the file name hint
  const lowerFile = fileName.toLowerCase();
  let soapText = '';

  if (lowerFile.includes('lab') || lowerFile.includes('result') || lowerFile.includes('blood') || lowerFile.includes('cbc')) {
    soapText = `S: Patient submitted laboratory results for review. Reports mild fatigue over the past week. / O: Document reviewed — CBC within normal limits except slightly elevated blood glucose at 105 mg/dL. Weight stable at 72 kg. / A: Borderline hyperglycemia, likely diet-related. Fatigue may be secondary. / P: Dietary modification advised — reduce refined carbohydrate intake. Follow-up in 4 weeks for repeat FBS. Patient instructed to log daily glucose readings.`;
  } else if (lowerFile.includes('xray') || lowerFile.includes('x-ray') || lowerFile.includes('chest') || lowerFile.includes('scan') || lowerFile.includes('mri') || lowerFile.includes('ct')) {
    soapText = `S: Patient submitted imaging document for physician review. Reports occasional shortness of breath on exertion. / O: Imaging report reviewed — lungs clear, no consolidation or effusion noted. Heart size normal. No active pulmonary disease. / A: Normal chest imaging. Dyspnea on exertion may be related to deconditioning. / P: Gradual aerobic exercise program recommended. Reassess in 6 weeks. Echocardiogram deferred pending clinical correlation.`;
  } else if (lowerFile.includes('prescription') || lowerFile.includes('rx') || lowerFile.includes('medicine') || lowerFile.includes('drug')) {
    soapText = `S: Patient submitted prescription document for medication reconciliation. Currently taking Amlodipine 5mg OD and Metoprolol 25mg BID. Reports compliance but occasional dizziness in the morning. / O: Prescription reviewed. BP 128/84 at last reading. HR 78 bpm. No edema. / A: Controlled hypertension on current regimen. Morning dizziness likely orthostatic, secondary to Amlodipine. / P: Advise patient to sit upright before standing. Continue current medications. Monitor BP diary. Follow-up in 1 month.`;
  } else {
    soapText = `S: Patient submitted health document for review. Reports general wellness with no acute complaints at time of submission. / O: Submitted document reviewed and filed. Vital signs at last visit: BP 128/84, HR 78 bpm, Temp 36.8°C, Weight 72 kg. / A: Stable health status based on submitted documentation. No acute findings requiring urgent intervention. / P: Continue current management plan. Maintain lifestyle modifications. Follow-up as scheduled on July 30, 2026.`;
  }

  return {
    id: `sg_${Date.now()}`,
    date: `${dateStr} at ${timeStr}`,
    doctor: doctorName,
    text: soapText,
    fromDocument: true,
    documentName: fileName,
  };
}

export const diagnoses = [
  { code: 'J06.9', desc: 'Acute upper respiratory infection', date: 'July 15', status: 'Resolved' },
  { code: 'I49.3', desc: 'Ventricular premature depolarization', date: 'June 28', status: 'Active' },
  { code: 'E11.9', desc: 'Type 2 DM, uncontrolled', date: 'May 10', status: 'Active' }
];

export const inbox = [
  { id: 'm1', doctor: doctors[0], preview: 'Your lab results look...', time: '2h ago', unread: 2 },
  { id: 'm2', doctor: doctors[1], preview: 'Please monitor your BP...', time: 'Yesterday', unread: 1 },
  { id: 'm3', doctor: doctors[2], preview: 'See you at your next...', time: '3 days ago', unread: 0 }
];

export const thread = [
  { id: 't1', sender: 'doctor', text: "Good morning, Juan. I've reviewed your latest lab results. Your blood glucose is slightly elevated at 105 mg/dL.", time: '10:02 AM' },
  { id: 't2', sender: 'doctor', text: "I'd recommend cutting back on refined sugars and doing 30 minutes of walking daily. Can you come in for a follow-up next week?", time: '10:03 AM' },
  { id: 't3', sender: 'patient', text: "Good morning, Doc! Thank you for checking. I'll definitely try to eat better. Is Tuesday morning available?", time: '10:15 AM' },
  { id: 't4', sender: 'doctor', text: "Yes, Tuesday at 9 AM works. I'll have my assistant send you a confirmation.", time: '10:18 AM' },
  { id: 't5', sender: 'patient', text: "Perfect, thank you Doc!", time: '10:20 AM' }
];

export const bills = {
  outstanding: [
    { id: 'b1', desc: 'Consultation Fee', date: 'July 15, 2026', amount: 1500 },
    { id: 'b2', desc: 'Laboratory Package', date: 'July 15, 2026', amount: 2500 },
    { id: 'b3', desc: 'Cardiology Consult', date: 'June 28, 2026', amount: 500 }
  ],
  history: [
    { id: 'h1', desc: 'OB-GYN Consultation', date: 'May 10, 2026', amount: 1200 },
    { id: 'h2', desc: 'CBC Package', date: 'May 10, 2026', amount: 800 }
  ]
};

// ── QUEUE ────────────────────────────────────────────────────────────────────

export type QueueEntry = {
  id: string;
  appointmentId: string;
  queueNumber: number;
  clinic: string;
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  avgServiceMinutes: number; // avg minutes per patient ahead
};

export const queueEntry: QueueEntry = {
  id: 'q1',
  appointmentId: 'a1',
  queueNumber: 47,
  clinic: 'Chong Hua Hospital',
  doctor: 'Dr. Maria Santos',
  specialty: 'Internal Medicine',
  date: 'July 30, 2026',
  time: '9:00 AM',
  avgServiceMinutes: 5,
};

const QUEUE_SERVING_KEY  = 'sugbodoc_queue_serving';
const QUEUE_CHECKIN_KEY  = 'sugbodoc_queue_checkin';
const QUEUE_NOTIFIED_KEY = 'sugbodoc_queue_notified';

export function getQueueCurrentlyServing(): number {
  try {
    const stored = localStorage.getItem(QUEUE_SERVING_KEY);
    if (stored !== null) return parseInt(stored, 10);
    // First load: patient has 5 people ahead
    const initial = queueEntry.queueNumber - 5;
    localStorage.setItem(QUEUE_SERVING_KEY, String(initial));
    return initial;
  } catch {
    return queueEntry.queueNumber - 5;
  }
}

export function advanceQueueServing(): number {
  const current = getQueueCurrentlyServing();
  // Stop advancing once we've passed the patient's turn
  const next = Math.min(current + 1, queueEntry.queueNumber + 1);
  try { localStorage.setItem(QUEUE_SERVING_KEY, String(next)); } catch { /* */ }
  return next;
}

export function getQueueCheckedIn(): boolean {
  try { return localStorage.getItem(QUEUE_CHECKIN_KEY) === 'true'; } catch { return false; }
}

export function setQueueCheckedIn(value: boolean): void {
  try { localStorage.setItem(QUEUE_CHECKIN_KEY, String(value)); } catch { /* */ }
}

export function getQueueNotified(): boolean {
  try { return localStorage.getItem(QUEUE_NOTIFIED_KEY) === 'true'; } catch { return false; }
}

export function setQueueNotified(value: boolean): void {
  try { localStorage.setItem(QUEUE_NOTIFIED_KEY, String(value)); } catch { /* */ }
}

export function resetQueueDemo(): void {
  try {
    localStorage.removeItem(QUEUE_SERVING_KEY);
    localStorage.removeItem(QUEUE_CHECKIN_KEY);
    localStorage.removeItem(QUEUE_NOTIFIED_KEY);
  } catch { /* */ }
}

// ─────────────────────────────────────────────────────────────────────────────

export const activityFeed = [
  { id: 'ac1', title: 'Lab result uploaded', time: '2 hours ago', type: 'lab' },
  { id: 'ac2', title: 'Dr. Santos sent a message', time: 'Yesterday', type: 'message' },
  { id: 'ac3', title: 'Bill payment received', time: 'July 24', type: 'payment' },
  { id: 'ac4', title: 'Prescription renewed', time: 'July 22', type: 'prescription' },
  { id: 'ac5', title: 'Appointment confirmed', time: 'July 20', type: 'appointment' }
];
