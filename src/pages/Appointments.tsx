import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, X, ChevronRight, Bell } from 'lucide-react';
import { appointments, doctors } from '@/lib/mock-data';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

type ApptStatus = 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';

export default function Appointments() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [isLoading, setIsLoading] = useState(true);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedSuccess, setBookedSuccess] = useState(false);

  // Booking state
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [savedAppointments, setSavedAppointments] = useState<Array<any>>([]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    apiClient.getAppointments().then(({ data }) => {
      if (data?.appointments) setSavedAppointments(data.appointments);
    });
    return () => clearTimeout(timer);
  }, []);

  const persistedAppts = savedAppointments.map(a => ({
    id: a.id,
    date: a.appointmentDate,
    time: a.appointmentTime,
    doctor: { name: a.doctorName, specialty: a.specialty, avatar: a.doctorName.split(' ').map((p: string) => p[0]).join('').slice(0, 2) },
    clinic: a.clinic,
    status: a.status as ApptStatus,
    isPast: false,
  }));
  const filteredAppts = persistedAppts.filter(a => activeTab === 'upcoming' ? !a.isPast : a.isPast);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmed': return 'bg-success/10 text-success border-success/20';
      case 'Pending': return 'bg-warning/10 text-warning border-warning/20';
      case 'Completed': return 'bg-muted text-muted-foreground border-border';
      case 'Cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const resetBooking = () => {
    setBookingStep(1);
    setSelectedSpecialty('');
    setSelectedDoctor('');
    setSelectedDoctorId('');
    setSelectedDate('');
    setSelectedTime('');
    setBookedSuccess(false);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    const result = await apiClient.cancelAppointment(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.data?.appointment) {
      setSavedAppointments(prev => prev.map(appointment =>
        appointment.id === id ? result.data!.appointment : appointment
      ));
    }
    toast.success('Appointment cancelled successfully. A confirmation notification was sent.');
  };

  const submitBooking = async () => {
    setIsSubmitting(true);
    try {
      const appointmentResult = await apiClient.createAppointment({
        doctorId: selectedDoctorId,
        doctorName: selectedDoctor,
        specialty: selectedSpecialty,
        clinic: 'Chong Hua Hospital',
        appointmentDate: `${selectedDate}, 2026`,
        appointmentTime: selectedTime,
      });
      if (appointmentResult.error) {
        toast.error(appointmentResult.error);
        return;
      }
      if (appointmentResult.data?.appointment) {
        setSavedAppointments(prev => [appointmentResult.data!.appointment, ...prev]);
      }
      setBookedSuccess(true);
      const emailResult = appointmentResult.data?.email;
      if (emailResult?.sent === false) {
        toast.error(`Booking request submitted, but notification could not be sent: ${emailResult.reason ?? 'Notification delivery failed.'}`);
      } else {
        toast.success('Appointment booked (Pending). Your doctor will confirm your appointment shortly.', { duration: 4000 });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Appointment notification failed. Your booking may still be saved.');
      setBookedSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const specialties = Array.from(new Set(doctors.map(d => d.specialty)));
  const availableDoctors = doctors.filter(d => d.specialty === selectedSpecialty);

  // Generate available dates (next 14 days, excluding Sundays)
  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  })
    .filter(d => d.getDay() !== 0)
    .slice(0, 6)
    .map(d => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">Manage your clinic visits and consultations.</p>
        </div>
        <button
          onClick={() => { resetBooking(); setIsBookingModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors min-h-[44px]"
        >
          <CalendarIcon className="w-4 h-4" />
          Book New Appointment
        </button>
      </div>

      <div className="flex border-b border-border">
        {(['upcoming', 'past'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filteredAppts.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">No appointments found</h3>
          <p className="text-muted-foreground">You don't have any {activeTab} appointments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAppts.map(appt => (
            <div key={appt.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="hidden sm:flex flex-col items-center justify-center w-16 h-16 bg-accent rounded-lg border border-accent-foreground/10 shrink-0">
                    <span className="text-xs font-semibold text-primary uppercase">{appt.date.split(' ')[0]}</span>
                    <span className="text-xl font-bold text-foreground">{appt.date.split(' ')[1].replace(',', '')}</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(appt.status)}`}>
                        {appt.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{appt.doctor.name}</h3>
                    <p className="text-sm text-primary font-medium">{appt.doctor.specialty}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5"><CalendarIcon className="w-4 h-4" /> {appt.date}</div>
                      <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {appt.time}</div>
                      <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {appt.clinic}</div>
                    </div>
                  </div>
                </div>
                <div className="flex sm:flex-col gap-2 border-t md:border-t-0 pt-4 md:pt-0 mt-2 md:mt-0">
                  {!appt.isPast && (
                    <>
                      <button className="flex-1 md:flex-none px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/90 transition-colors min-h-[44px]">
                        Reschedule
                      </button>
                      <button onClick={() => handleCancel(appt.id)} className="flex-1 md:flex-none px-4 py-2 border border-destructive/30 text-destructive text-sm font-medium rounded-lg hover:bg-destructive/10 transition-colors min-h-[44px]">
                        Cancel
                      </button>
                    </>
                  )}
                  {appt.isPast && (
                    <button className="w-full px-4 py-2 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors min-h-[44px]">
                      View Notes
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Modal */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-semibold text-foreground">
                {bookedSuccess ? 'Appointment Confirmed' : 'Book Appointment'}
              </h2>
              <button onClick={() => setIsBookingModalOpen(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Success state */}
              {bookedSuccess ? (
                <div className="text-center space-y-4 py-4 animate-in fade-in">
                  <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Appointment Booked!</h3>
                  <div className="bg-muted rounded-xl p-4 text-left space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Doctor</span><span className="font-medium">{selectedDoctor}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Specialty</span><span className="font-medium">{selectedSpecialty}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Date & Time</span><span className="font-medium">{selectedDate}, 2026 · {selectedTime}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="font-medium">Chong Hua Hospital</span></div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/50 rounded-lg p-3">
                    <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Your booking confirmation has been sent to the SugboDoc appointments email.</span>
                  </div>
                  <button
                    onClick={() => setIsBookingModalOpen(false)}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Progress Steps */}
                  <div className="flex items-center justify-between mb-8 relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10 rounded-full" />
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all" style={{ width: `${((bookingStep - 1) / 3) * 100}%` }} />
                    {[1, 2, 3, 4].map(step => (
                      <div key={step} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                        step < bookingStep ? 'bg-primary border-primary text-primary-foreground' :
                        step === bookingStep ? 'bg-background border-primary text-primary' :
                        'bg-background border-muted text-muted-foreground'
                      }`}>
                        {step < bookingStep ? <CheckCircle2 className="w-4 h-4" /> : step}
                      </div>
                    ))}
                  </div>

                  {/* Step 1: Specialty */}
                  {bookingStep === 1 && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                      <h3 className="font-medium text-foreground mb-4">Select Specialty</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {specialties.map(spec => (
                          <button
                            key={spec}
                            onClick={() => { setSelectedSpecialty(spec); setBookingStep(2); }}
                            className="w-full text-left p-4 rounded-xl border border-border hover:border-primary hover:bg-accent/30 transition-colors flex justify-between items-center"
                          >
                            <span className="font-medium">{spec}</span>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Doctor */}
                  {bookingStep === 2 && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                      <button onClick={() => setBookingStep(1)} className="text-sm text-primary mb-2">← Back to specialties</button>
                      <h3 className="font-medium text-foreground mb-4">Select Doctor ({selectedSpecialty})</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {availableDoctors.map(doc => (
                          <button
                            key={doc.id}
                           onClick={() => { setSelectedDoctor(doc.name); setSelectedDoctorId(doc.id); setBookingStep(3); }}
                            className="w-full text-left p-4 rounded-xl border border-border hover:border-primary hover:bg-accent/30 transition-colors flex items-center gap-4"
                          >
                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">{doc.avatar}</div>
                            <div className="flex-1">
                              <div className="font-medium text-foreground">{doc.name}</div>
                              <div className="text-sm text-muted-foreground">{doc.specialty}</div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Date & Time */}
                  {bookingStep === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      <button onClick={() => setBookingStep(2)} className="text-sm text-primary">← Back to doctors</button>
                      <div>
                        <h3 className="font-medium text-foreground mb-3">Select Date</h3>
                        <div className="grid grid-cols-3 gap-2">
                          {availableDates.map(d => (
                            <button
                              key={d}
                              onClick={() => setSelectedDate(d)}
                              className={`p-3 rounded-lg border text-sm font-medium text-center transition-colors ${
                                selectedDate === d ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50 text-foreground'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                      {selectedDate && (
                        <div className="animate-in fade-in">
                          <h3 className="font-medium text-foreground mb-3">Select Time</h3>
                          <div className="grid grid-cols-3 gap-2">
                            {['09:00 AM', '10:30 AM', '01:00 PM', '02:30 PM', '04:00 PM'].map(t => (
                              <button
                                key={t}
                                onClick={() => setSelectedTime(t)}
                                className={`p-3 rounded-lg border text-sm font-medium text-center transition-colors ${
                                  selectedTime === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50 text-foreground'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        disabled={!selectedDate || !selectedTime}
                        onClick={() => setBookingStep(4)}
                        className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50 mt-6 min-h-[44px]"
                      >
                        Continue
                      </button>
                    </div>
                  )}

                  {/* Step 4: Confirm */}
                  {bookingStep === 4 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      <div className="text-center">
                        <h3 className="font-semibold text-foreground text-xl">Confirm Your Appointment</h3>
                        <p className="text-sm text-muted-foreground mt-1">Please review the details before confirming.</p>
                      </div>
                      <div className="bg-muted/50 border border-border p-4 rounded-xl space-y-3">
                        <div className="flex justify-between items-start border-b border-border/50 pb-3">
                          <span className="text-muted-foreground text-sm">Doctor</span>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{selectedDoctor}</p>
                            <p className="text-sm text-muted-foreground">{selectedSpecialty}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center border-b border-border/50 pb-3">
                          <span className="text-muted-foreground text-sm">Date & Time</span>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{selectedDate}, 2026</p>
                            <p className="text-sm text-muted-foreground">{selectedTime}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-sm">Location</span>
                          <span className="font-semibold text-foreground">Chong Hua Hospital</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/50 rounded-lg p-3">
                        <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>You will receive an email confirmation after booking.</span>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setBookingStep(3)} className="flex-1 py-3 border border-border rounded-lg font-medium hover:bg-muted min-h-[44px]">
                          Back
                        </button>
                        <button
                          onClick={submitBooking}
                          disabled={isSubmitting}
                          className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-70 min-h-[44px] flex items-center justify-center"
                        >
                          {isSubmitting ? (
                            <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Confirming…</span>
                          ) : 'Confirm Appointment'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
