import { sqlDb } from "@/lib/db/sql-db";

export function parseApptIdFromText(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\[APPT:([a-zA-Z0-9_-]+)\]/);
  return match ? match[1] : null;
}

export async function ensureEncounterForAppointment(appt: any): Promise<any> {
  if (!appt?.id || !appt?.patient_id) return null;

  // 1. Check if encounter exists for this appointment_id directly
  const { data: existingByAppt } = await sqlDb
    .from("encounters")
    .select("*, profiles(name)")
    .eq("appointment_id", appt.id)
    .maybeSingle();

  if (existingByAppt) {
    return existingByAppt;
  }

  // 2. Check if existing encounter has [APPT:id] in summary or encounter_notes
  const { data: existingList } = await sqlDb
    .from("encounters")
    .select("*, profiles(name)")
    .eq("patient_id", appt.patient_id);

  const matchedByNote = (existingList ?? []).find((e: any) => 
    e.appointment_id === appt.id ||
    e.encounter_notes?.includes(`[APPT:${appt.id}]`) ||
    e.summary?.includes(`[APPT:${appt.id}]`)
  );

  if (matchedByNote) {
    if (!matchedByNote.appointment_id) {
      await sqlDb.from("encounters").update({ appointment_id: appt.id } as any).eq("id", matchedByNote.id);
    }
    return { ...matchedByNote, appointment_id: appt.id };
  }

  // 3. Look for an unlinked encounter for this patient on the same date or doctor
  const unlinked = (existingList ?? []).find((e: any) => 
    !e.appointment_id && 
    !parseApptIdFromText(e.encounter_notes) && 
    !parseApptIdFromText(e.summary) &&
    (e.encounter_date?.slice(0, 10) === appt.appointment_date || e.doctor_name === appt.doctor_name)
  );

  if (unlinked) {
    await sqlDb.from("encounters").update({ 
      appointment_id: appt.id,
      doctor_id: appt.doctor_id || unlinked.doctor_id,
      doctor_name: appt.doctor_name || unlinked.doctor_name,
      department: appt.department || unlinked.department,
    } as any).eq("id", unlinked.id);
    return { ...unlinked, appointment_id: appt.id };
  }

  // 4. Create new encounter corresponding to this appointment
  const doctorName = appt.doctor_name || appt.doctorName || "Assigned Doctor";
  const doctorId = appt.doctor_id || appt.doctorId || null;
  const dept = appt.department || appt.specialty || "General Medicine";
  const encDate = appt.appointment_date ? `${appt.appointment_date}${appt.appointment_time ? ' ' + appt.appointment_time : ' 09:00'}` : new Date().toISOString();
  const encType = dept ? `${dept} Consultation` : "Outpatient Visit";
  const encStatus = appt.status === "Completed" ? "Completed" : appt.status === "Cancelled" ? "Cancelled" : appt.status === "Pending" ? "Pending Appointment" : "In Progress";
  const noteTag = `[APPT:${appt.id}] Linked Appointment ID: ${appt.id}`;

  const insertData: any = {
    patient_id: appt.patient_id,
    appointment_id: appt.id,
    doctor_id: doctorId,
    doctor_name: doctorName,
    department: dept,
    encounter_date: encDate,
    encounter_type: encType,
    status: encStatus,
    chief_complaint: appt.notes || `${dept} Appointment`,
    summary: `Encounter for Appointment #${appt.id.slice(0, 8)} [APPT:${appt.id}]`,
    encounter_notes: noteTag,
  };

  const { data: created, error } = await sqlDb
    .from("encounters")
    .insert(insertData)
    .select("*, profiles(name)")
    .maybeSingle();

  if (error) {
    // Fallback if appointment_id column fails
    delete insertData.appointment_id;
    delete insertData.encounter_type;
    const { data: fallbackCreated } = await sqlDb.from("encounters").insert(insertData).select("*, profiles(name)").maybeSingle();
    return fallbackCreated;
  }

  return created;
}

export async function syncPatientEncountersAndAppointments(patientId: string) {
  try {
    const { data: appts } = await sqlDb
      .from("appointments")
      .select("*")
      .eq("patient_id", patientId)
      .order("appointment_date", { ascending: false });

    const { data: encounters } = await sqlDb
      .from("encounters")
      .select("*")
      .eq("patient_id", patientId)
      .order("encounter_date", { ascending: false });

    const appointmentList = appts ?? [];
    const encounterList = encounters ?? [];

    // Ensure every appointment has an encounter
    for (const appt of appointmentList) {
      await ensureEncounterForAppointment(appt);
    }

    const { data: updatedEncounters } = await sqlDb
      .from("encounters")
      .select("*")
      .eq("patient_id", patientId);

    const currentEncounters = updatedEncounters ?? [];

    // Check for any orphaned encounters and backfill an appointment
    for (const enc of currentEncounters) {
      const apptId = enc.appointment_id || parseApptIdFromText(enc.encounter_notes) || parseApptIdFromText(enc.summary);
      const hasAppt = apptId && appointmentList.some(a => a.id === apptId);

      if (!hasAppt) {
        const apptDate = enc.encounter_date ? enc.encounter_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const { data: newAppt } = await sqlDb
          .from("appointments")
          .insert({
            patient_id: patientId,
            doctor_id: enc.doctor_id || null,
            doctor_name: enc.doctor_name || "Doctor",
            department: enc.department || "General Medicine",
            clinic: enc.department || "Outpatient Clinic",
            appointment_date: apptDate,
            appointment_time: "09:00",
            status: enc.status === "Completed" ? "Completed" : "Confirmed",
            notes: enc.chief_complaint || "Clinical Encounter Visit",
          })
          .select("*")
          .single();

        if (newAppt) {
          appointmentList.push(newAppt);
          await sqlDb
            .from("encounters")
            .update({
              appointment_id: newAppt.id,
              encounter_notes: (enc.encounter_notes ?? "") + ` [APPT:${newAppt.id}]`,
            } as any)
            .eq("id", enc.id);
        }
      }
    }
  } catch (err) {
    console.error("Error syncing patient encounters and appointments:", err);
  }
}
