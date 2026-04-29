let smartChartData = {
  patients: [],
  providers: [],
  appointments: [],
  observations: [],
  medications: {},
  medicationCatalog: [],
  interactions: [],
  staffUsers: [],
};
let usingDatabaseApi = false;

document.addEventListener("DOMContentLoaded", async () => {
  wireLogin();

  if (!document.getElementById("login-form")) {
    await loadTaskCData();
    if (!usingDatabaseApi) {
      loadStoredAppointments();
      loadStoredMedications();
      loadStoredObservations();
    }
  }

  const params = new URLSearchParams(window.location.search);
  const role = params.get("role") || "patient";
  const patientId = params.get("patientId") || smartChartData.patients[0]?.id;

  if (!patientId && !document.getElementById("login-form")) {
    showDataNotice("Task C data could not be loaded. Run the site with a local server from the project root.");
    return;
  }

  updateNavigation(role, patientId);
  fillPatientSelects(patientId);
  applyRoleVisibility(role);
  populateMedicationOptions(patientId);
  populateProviderRecipients();
  renderDashboardPatient(patientId);
  renderVitalsSummary(patientId);
  renderEncounterList(patientId);
  renderAppointments(role, patientId);
  renderObservations(role, patientId);
  renderMedicationList(patientId);
  renderProfile(role, patientId);
  wireAppointmentRequest();
  wireObservationForm(role);
  wireEncounterFinalizer(patientId);
  wirePrescriptionSafetyCheck(patientId);
  wirePatientContext(role, patientId);
  wireGenericForms();
});

function dataPath() {
  return window.location.pathname.includes("/pages/")
    ? "../data/compacted_data.json"
    : "data/compacted_data.json";
}

function apiPath(endpoint) {
  return window.location.pathname.includes("/pages/")
    ? `../api/${endpoint}`
    : `api/${endpoint}`;
}

async function loadTaskCData() {
  try {
    let response = await fetch(apiPath("bootstrap.php"));
    if (response.ok) {
      smartChartData = await response.json();
      if (!smartChartData.error) {
        usingDatabaseApi = smartChartData.source === "mysql";
        normalizeLoadedData();
        return;
      }
    }

    response = await fetch(dataPath());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    smartChartData = await response.json();
    usingDatabaseApi = false;
    normalizeLoadedData();
  } catch (error) {
    console.error(error);
    showDataNotice("Unable to load Task C data. Start the local PHP server or static server from the project root.");
  }
}

function normalizeLoadedData() {
  smartChartData.patients = (smartChartData.patients || []).map((patient) => ({
    ...patient,
    id: String(patient.id),
    name: cleanDisplayName(patient.name),
  }));
  smartChartData.providers = (smartChartData.providers || []).map((provider) => ({
    ...provider,
    id: String(provider.id),
    name: cleanDisplayName(provider.name),
  }));
  smartChartData.appointments = (smartChartData.encounters || []).map((appointment) => ({
    ...appointment,
    id: String(appointment.id),
    patientId: String(appointment.patientId),
    providerId: String(appointment.providerId),
    patient: cleanDisplayName(appointment.patient),
    provider: cleanDisplayName(appointment.provider),
  }));
  smartChartData.observations = (smartChartData.observations || []).map((observation) => ({
    ...observation,
    patientId: String(observation.patientId),
    encounter: String(observation.encounter),
  }));
  smartChartData.medications = smartChartData.medications || {};
  smartChartData.staffUsers = smartChartData.staffUsers || [];
}

function wireLogin() {
  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const role = document.getElementById("role").value;

    if (role === "patient") {
      window.location.href = "pages/patient.html?role=patient";
    } else if (role === "provider") {
      window.location.href = "pages/provider.html?role=provider";
    } else {
      window.location.href = "pages/provider.html?role=admin";
    }
  });
}

function updateNavigation(role, patientId) {
  const dashboardLink = document.getElementById("dashboard-link");
  const roleQuery = `role=${role}&patientId=${patientId}`;

  if (dashboardLink) {
    dashboardLink.href =
      role === "patient"
        ? `patient.html?${roleQuery}`
        : `provider.html?${roleQuery}`;
  }

  setHref("appointments-link", `appointments.html?${roleQuery}`);
  setHref("profile-link", `profile.html?${roleQuery}`);
  setHref("flowsheets-link", `flowsheets.html?${roleQuery}`);
}

function setHref(id, href) {
  const link = document.getElementById(id);
  if (link) link.href = href;
}

function applyRoleVisibility(role) {
  document.querySelectorAll(".patient-only").forEach((item) => {
    item.hidden = role !== "patient";
  });

  document.querySelectorAll(".provider-only").forEach((item) => {
    item.hidden = role === "patient";
  });

  document.querySelectorAll(".admin-only").forEach((item) => {
    item.hidden = role !== "admin";
  });

  document.querySelectorAll(".clinical-only").forEach((item) => {
    item.hidden = role === "admin";
  });
}

function fillPatientSelects(selectedPatientId) {
  document.querySelectorAll("[data-patient-select]").forEach((select) => {
    select.innerHTML = smartChartData.patients
      .map((patient) => `<option value="${patient.id}">${patient.name} (${patient.mrn})</option>`)
      .join("");
    select.value = selectedPatientId;
  });
}

function populateMedicationOptions(patientId) {
  const medication = document.getElementById("medication");
  const medicationOptions = document.getElementById("medication-options");
  if (!medication) return;

  const currentMeds = (smartChartData.medications[patientId] || []).map((med) => ({
    name: med.name,
    strength: med.dosage,
    category: "Current patient medication",
  }));
  const catalogMeds = smartChartData.medicationCatalog || [];
  const interactionMeds = interactionDrugOptions();
  const options = [...currentMeds, ...catalogMeds, ...interactionMeds];
  const seen = new Set();

  const optionMarkup = options
    .filter((med) => {
      const key = normalizeDrug(med.name);
      if (!med.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((med) => {
      const label = med.strength ? `${med.name} - ${med.strength}` : med.name;
      return `<option value="${escapeAttribute(med.name)}">${label}</option>`;
    })
    .join("");

  if (medicationOptions) {
    medicationOptions.innerHTML = optionMarkup;
  } else {
    medication.innerHTML = optionMarkup;
  }
}

function interactionDrugOptions() {
  const names = new Set();
  (smartChartData.interactions || []).forEach((interaction) => {
    if (interaction.drug1) names.add(interaction.drug1);
    if (interaction.drug2) names.add(interaction.drug2);
  });
  return [...names].map((name) => ({
    name,
    strength: "",
    category: "Drug interaction catalog",
  }));
}

function populateProviderRecipients() {
  const recipient = document.getElementById("recipient");
  if (!recipient) return;

  recipient.innerHTML = smartChartData.providers
    .slice(0, 80)
    .map((provider) => `<option value="${provider.id}">${provider.name} (${provider.specialty})</option>`)
    .join("");
}

function wirePatientContext(role, patientId) {
  const activePatient = document.getElementById("active-patient");
  const prescriptionPatient = document.getElementById("prescription-patient");
  const observationPatient = document.getElementById("observation-patient");
  const flowsheetPatient = document.getElementById("flowsheet-patient-filter");

  if (activePatient) {
    activePatient.value = patientId;
    activePatient.addEventListener("change", () => {
      window.location.href = `provider.html?role=${role}&patientId=${activePatient.value}`;
    });
  }

  if (observationPatient) {
    observationPatient.value = patientId;
    observationPatient.disabled = Boolean(activePatient);
  }

  if (flowsheetPatient && !flowsheetPatient.dataset.activeSynced) {
    flowsheetPatient.dataset.activeSynced = "true";
    flowsheetPatient.addEventListener("change", () => {
      if (observationPatient) observationPatient.value = flowsheetPatient.value;
    });
  }

  if (prescriptionPatient) {
    prescriptionPatient.value = patientId;
    prescriptionPatient.addEventListener("change", () => {
      populateMedicationOptions(prescriptionPatient.value);
      renderMedicationList(prescriptionPatient.value);
    });
  }
}

function renderDashboardPatient(patientId) {
  const patient = getPatient(patientId);
  if (!patient) return;

  const params = new URLSearchParams(window.location.search);
  const role = params.get("role") || "patient";
  setText("workspace-title", role === "admin" ? "Admin View" : "Provider View");
  setText(
    "active-context-note",
    role === "admin"
      ? "Access: Admin can review patient records and audit care activity. Clinical edits are disabled."
      : "Access: Provider can switch between assigned patients."
  );
  setText("dashboard-patient-name", patient.name);
  setText("dashboard-email", patient.email);
  setText("dashboard-phone", patient.phone);
  setText("dashboard-dob", patient.dob);
  setText("dashboard-mrn", patient.mrn);
  setText("dashboard-address", patient.address);
}

function renderVitalsSummary(patientId) {
  const currentList = document.getElementById("current-vitals-list");
  const averageList = document.getElementById("average-vitals-list");
  if (!currentList || !averageList) return;

  const patientObservations = smartChartData.observations
    .filter((observation) => observation.patientId === patientId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const encounters = groupObservationsByEncounter(patientObservations);
  const openEncounterRows = patientObservations.filter(
    (observation) => observation.encounter === currentEncounterId(patientId)
  );

  if (encounters.length === 0) {
    currentList.innerHTML = "<li>No observations entered for the open encounter yet.</li>";
    averageList.innerHTML = "<li>No Task C observations found for this patient.</li>";
    return;
  }

  currentList.innerHTML = openEncounterRows.length
    ? buildCurrentVitals({ rows: openEncounterRows })
    : "<li>No observations entered for the open encounter yet.</li>";
  averageList.innerHTML = buildAverageVitals(encounters.slice(0, 5));
}

function currentEncounterId(patientId) {
  if (usingDatabaseApi) {
    const recentEncounter = currentDatabaseEncounter(patientId);
    const finalizedEncounter = localStorage.getItem(finalizedEncounterKey(patientId));
    if (recentEncounter?.id && finalizedEncounter === recentEncounter.id) {
      return `Closed database encounter ${recentEncounter.id}`;
    }
    return recentEncounter?.id || "";
  }

  const key = `smartchart-current-encounter-${patientId}`;
  let encounterId = localStorage.getItem(key);

  if (!encounterId) {
    encounterId = `Local encounter ${new Date().toLocaleDateString()}`;
    localStorage.setItem(key, encounterId);
  }

  return encounterId;
}

function rotateCurrentEncounter(patientId) {
  if (usingDatabaseApi) {
    const recentEncounter = currentDatabaseEncounter(patientId);
    if (recentEncounter?.id) {
      localStorage.setItem(finalizedEncounterKey(patientId), recentEncounter.id);
    }
    return "No open database encounter";
  }

  const encounterId = `Local encounter ${new Date().toLocaleString()}`;
  localStorage.setItem(`smartchart-current-encounter-${patientId}`, encounterId);
  return encounterId;
}

function finalizedEncounterKey(patientId) {
  return `smartchart-finalized-db-encounter-${patientId}`;
}

function currentDatabaseEncounter(patientId) {
  return smartChartData.appointments.find(
    (appointment) => appointment.patientId === String(patientId)
  );
}

function shouldCreateDatabaseEncounter(patientId) {
  const recentEncounter = currentDatabaseEncounter(patientId);
  return Boolean(
    recentEncounter?.id &&
      localStorage.getItem(finalizedEncounterKey(patientId)) === recentEncounter.id
  );
}

function updateEncounterStatus(patientId) {
  const status = document.getElementById("encounter-status");
  if (!status || !patientId) return;

  const count = smartChartData.observations.filter(
    (observation) =>
      observation.patientId === patientId &&
      observation.encounter === currentEncounterId(patientId)
  ).length;
  status.textContent = `Current encounter open - ${count} observation${count === 1 ? "" : "s"}`;
}

function wireEncounterFinalizer(defaultPatientId) {
  const button = document.getElementById("finalize-encounter");
  if (!button) return;

  button.addEventListener("click", () => {
    const selectedPatient =
      document.getElementById("active-patient")?.value ||
      document.getElementById("flowsheet-patient-filter")?.value ||
      document.getElementById("observation-patient")?.value ||
      defaultPatientId;
    const finishedEncounter = currentEncounterId(selectedPatient);
    const nextEncounter = rotateCurrentEncounter(selectedPatient);
    updateEncounterStatus(selectedPatient);
    renderVitalsSummary(selectedPatient);
    alert(`${finishedEncounter} finalized. ${nextEncounter}.`);
  });

  updateEncounterStatus(defaultPatientId);
}

function groupObservationsByEncounter(observations) {
  const groups = new Map();

  observations.forEach((observation) => {
    if (!groups.has(observation.encounter)) {
      groups.set(observation.encounter, []);
    }
    groups.get(observation.encounter).push(observation);
  });

  return [...groups.entries()]
    .map(([encounter, rows]) => ({
      encounter,
      date: rows[0]?.date || "",
      rows,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function buildCurrentVitals(encounter) {
  const rows = encounter.rows.slice(0, 8);

  return rows
    .map(
      (row) =>
        `<li>${shortObservationName(row.code)}: ${row.value}${row.unit ? ` ${row.unit}` : ""}</li>`
    )
    .join("");
}

function buildAverageVitals(encounters) {
  const buckets = new Map();

  encounters.flatMap((encounter) => encounter.rows).forEach((row) => {
    const value = Number.parseFloat(row.value);
    if (Number.isNaN(value)) return;

    const key = `${shortObservationName(row.code)}|${row.unit || ""}`;
    if (!buckets.has(key)) {
      buckets.set(key, { label: shortObservationName(row.code), unit: row.unit || "", values: [] });
    }
    buckets.get(key).values.push(value);
  });

  const averages = [...buckets.values()]
    .slice(0, 8)
    .map((bucket) => {
      const total = bucket.values.reduce((sum, value) => sum + value, 0);
      const average = total / bucket.values.length;
      const rounded = Number.isInteger(average) ? average : average.toFixed(1);
      return `<li>${bucket.label}: ${rounded}${bucket.unit ? ` ${bucket.unit}` : ""}</li>`;
    });

  return averages.length ? averages.join("") : "<li>No numeric vitals available to average.</li>";
}

function shortObservationName(name) {
  const mappedName = observationLabel(name);
  return String(mappedName || "")
    .replace(/\\s*\\[[^\\]]*\\]/g, "")
    .replace(/ - Reported/g, "")
    .replace(/Body /g, "")
    .replace(/ numeric rating/g, "")
    .trim();
}

function observationLabel(code) {
  const labels = {
    "9279-1": "Respiratory rate",
    "2093-3": "Total cholesterol",
    "6299-2": "Urea nitrogen",
    "4548-4": "Hemoglobin A1c",
    "6768-6": "Alkaline phosphatase",
    "55284-4": "Blood pressure",
    "2160-0": "Creatinine",
    "2339-0": "Glucose",
    "718-7": "Hemoglobin",
    "1920-8": "Aspartate aminotransferase",
    "8302-2": "Height",
    "1742-6": "Alanine aminotransferase",
    "2951-2": "Sodium",
    "2085-9": "HDL cholesterol",
    "2823-3": "Potassium",
    "39156-5": "BMI",
    "29463-7": "Weight",
    "8867-4": "Heart rate",
    "8310-5": "Body temperature",
    "13457-7": "LDL cholesterol",
  };
  return labels[code] || code;
}

function renderAppointments(role, patientId) {
  const table = document.getElementById("appointments-table");
  if (!table) return;

  const patientFilter = document.getElementById("appointment-patient-filter");
  const providerFilter = document.getElementById("appointment-provider-filter");
  const visiblePatientId =
    role === "patient" ? patientId : patientFilter?.value || patientId;
  fillAppointmentProviderFilter(providerFilter);
  const visibleProviderId = providerFilter?.value || "all";
  const rows = smartChartData.appointments
    .filter((appointment) => {
      const patientMatches = appointment.patientId === visiblePatientId;
      const providerMatches =
        role === "patient" ||
        visibleProviderId === "all" ||
        appointment.providerId === visibleProviderId;
      return patientMatches && providerMatches;
    })
    .slice(0, 12);

  setText(
    "appointments-heading",
    role === "patient" ? "My Appointments" : "Patient Appointments"
  );

  table.innerHTML = rows.length
    ? rows
        .map((appointment) => {
          const patient = getPatient(appointment.patientId);
          return `<tr>
            <td>${formatDate(appointment.date)}</td>
            <td>${formatTime(appointment.time)}</td>
            <td>${patient.name}</td>
            <td>${cleanDisplayName(appointment.provider)}</td>
            <td>${appointmentTypeCell(appointment)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="5">No encounters found for this patient.</td></tr>`;

  if (patientFilter && !patientFilter.dataset.wired) {
    patientFilter.dataset.wired = "true";
    patientFilter.addEventListener("change", () => renderAppointments(role, patientId));
  }

  if (providerFilter && !providerFilter.dataset.wired) {
    providerFilter.dataset.wired = "true";
    providerFilter.addEventListener("change", () => renderAppointments(role, patientId));
  }
}

function fillAppointmentProviderFilter(providerFilter) {
  if (!providerFilter || providerFilter.dataset.loaded) return;

  providerFilter.innerHTML = [
    '<option value="all">All providers</option>',
    ...smartChartData.providers.map(
      (provider) =>
        `<option value="${provider.id}">${provider.name} (${provider.specialty})</option>`
    ),
  ].join("");
  providerFilter.dataset.loaded = "true";
}

function renderEncounterList(patientId) {
  const table = document.getElementById("encounter-list");
  if (!table) return;

  const rows = smartChartData.appointments
    .filter((appointment) => appointment.patientId === patientId)
    .slice(0, 6);

  table.innerHTML = rows.length
    ? rows
        .map(
          (encounter) => `<tr>
            <td>${formatDate(encounter.date)}</td>
            <td>${encounter.type}</td>
            <td>${cleanDisplayName(encounter.provider)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="3">No encounters found.</td></tr>`;
}

function renderObservations(role, patientId) {
  const table = document.getElementById("observations-table");
  if (!table) return;

  const patientFilter = document.getElementById("flowsheet-patient-filter");
  const visiblePatientId =
    role === "patient" ? patientId : patientFilter?.value || patientId;
  const observationPatient = document.getElementById("observation-patient");
  if (observationPatient && !document.getElementById("active-patient")) {
    observationPatient.value = visiblePatientId;
  }
  const rows = smartChartData.observations
    .filter((observation) => observation.patientId === visiblePatientId)
    .slice(0, 20);

  setText(
    "flowsheets-heading",
    role === "patient" ? "My Observation History" : "Patient Observation History"
  );

  table.innerHTML = rows.length
    ? rows
        .map(
          (observation) => `<tr class="${observation.local || observation.database ? "local-observation" : ""}">
            <td>${observation.encounter}</td>
            <td>${formatDate(observation.date)}</td>
            <td>${shortObservationName(observation.code)}${observation.local ? '<span class="row-badge">Saved locally</span>' : ""}${observation.database ? '<span class="row-badge">Saved to DB</span>' : ""}</td>
            <td>${observation.value}</td>
            <td>${observation.unit || ""}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5">No observations found for this patient.</td></tr>`;

  if (patientFilter && !patientFilter.dataset.wired) {
    patientFilter.dataset.wired = "true";
    patientFilter.addEventListener("change", () => {
      renderObservations(role, patientId);
      updateEncounterStatus(patientFilter.value);
    });
  }
}

function renderMedicationList(patientId) {
  const table = document.getElementById("medication-list");
  if (!table) return;

  const prescriptionPatient = document.getElementById("prescription-patient");
  const columnCount = table.closest("table")?.tHead?.rows[0]?.cells.length || 5;
  const isPatientDashboard = columnCount === 4;
  const visiblePatientId = prescriptionPatient?.value || patientId;
  const meds = smartChartData.medications[visiblePatientId] || [];

  table.innerHTML = meds.length
    ? meds
        .slice(0, 12)
        .map((med) =>
          isPatientDashboard
            ? `<tr>
            <td>${med.name}</td>
            <td>${med.frequency}</td>
            <td>${med.provider}</td>
            <td>${med.status}</td>
          </tr>`
            : `<tr>
            <td>${med.name}</td>
            <td>${displayDosage(med)}</td>
            <td>${med.frequency}</td>
            <td>${med.provider}</td>
            <td>${med.status}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="${isPatientDashboard ? 4 : 5}">No medications on file.</td></tr>`;
}

function renderProfile(role, patientId) {
  const name = document.getElementById("profile-name");
  if (!name) return;

  if (role === "patient") {
    const patient = getPatient(patientId);
    setText("profile-name", patient.name);
    setText("profile-role", "Patient");
    setText("profile-access", "Self-service, own record only");
    setText("profile-summary", "Personal details for the signed-in patient.");
    setText("profile-avatar", "▣");
    setInput("profile-member-id", patient.mrn);
    setInput("profile-email", patient.email);
    setInput("profile-phone", patient.phone);
  } else {
    const provider = smartChartData.providers[0] || {};
    const staffUser = smartChartData.staffUsers[0] || {};
    setText("profile-name", role === "admin" ? staffUser.username || "Administrative Staff User" : provider.name);
    setText("profile-role", role === "admin" ? staffUser.role || "Administrative User" : provider.specialty || "Provider");
    setText(
      "profile-access",
      role === "admin"
        ? `Tier ${staffUser.accessLevel || 3}, ${staffUser.department || "account management"}`
        : "Tier 2, assigned patient care"
    );
    setText("profile-summary", "Healthcare staff profile and account details.");
    setText("profile-avatar", role === "admin" ? "▤" : "◌");
    setInput("profile-member-id", role === "admin" ? `STAFF-${staffUser.id || "9001"}` : provider.license || provider.id);
    setInput("profile-email", role === "admin" ? `${staffUser.username || "admin"}@smartchart.local` : `${slug(provider.name)}@smartchart.local`);
    setInput("profile-phone", "(555) 700-1100");
  }
}

function wireAppointmentRequest() {
  const specialty = document.getElementById("appointment-specialty");
  const provider = document.getElementById("appointment-provider");
  const form = document.getElementById("appointment-request-form");
  const status = document.getElementById("appointment-request-status");
  if (!specialty || !provider || !form) return;

  const specialties = [...new Set(smartChartData.providers.map((item) => item.specialty).filter(Boolean))];
  specialty.innerHTML = specialties.map((item) => `<option value="${escapeAttribute(item)}">${item}</option>`).join("");

  const fillProviders = () => {
    provider.innerHTML = smartChartData.providers
      .filter((item) => item.specialty === specialty.value)
      .slice(0, 60)
      .map((item) => `<option value="${item.id}">${item.name}</option>`)
      .join("");
  };

  specialty.addEventListener("change", fillProviders);
  fillProviders();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get("patientId") || smartChartData.patients[0]?.id;
    const patient = getPatient(patientId);
    const selectedProvider = smartChartData.providers.find((item) => item.id === provider.value);
    const date = document.getElementById("appointment-date")?.value;
    const time = document.getElementById("appointment-time")?.value;
    const reason = document.getElementById("appointment-reason")?.value.trim();

    if (!selectedProvider || !patient || !date || !time) return;

    if (usingDatabaseApi) {
      try {
        const response = await fetch(apiPath("appointments.php"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            providerId: selectedProvider.id,
            date,
            time,
            reason,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to save appointment request.");

        smartChartData.appointments = [
          result.appointment,
          ...smartChartData.appointments.filter((item) => item.id !== result.appointment.id),
        ];
        renderAppointments("patient", patientId);
        status.textContent = `Appointment request saved to the database for ${patient.name} with ${selectedProvider.name}.`;
        form.reset();
        fillProviders();
        return;
      } catch (error) {
        status.textContent = error.message;
        return;
      }
    }

    const appointment = {
      id: `local-appointment-${Date.now()}`,
      patientId,
      providerId: selectedProvider.id,
      patient: patient.name,
      provider: selectedProvider.name,
      date,
      time,
      type: reason || "Requested visit",
      reason,
      status: "Requested",
      local: true,
    };

    smartChartData.appointments = [
      appointment,
      ...smartChartData.appointments.filter((item) => item.id !== appointment.id),
    ];
    saveStoredAppointments();
    renderAppointments("patient", patientId);
    status.textContent = `Appointment request saved for ${patient.name} with ${selectedProvider.name}.`;
  });
}

function wireObservationForm(role) {
  const params = new URLSearchParams(window.location.search);
  const currentRole = role || params.get("role") || "patient";
  const form = document.getElementById("observation-form");
  const status = document.getElementById("observation-status");
  const code = document.getElementById("observation-code");
  const value = document.getElementById("observation-value");
  const unit = document.getElementById("observation-unit");
  const patient = document.getElementById("observation-patient");
  const time = document.getElementById("observation-time");
  const preview = document.getElementById("saved-observation-preview");
  if (!form) return;

  if (currentRole === "patient") {
    const observationPanel = form.closest(".content-card, .form-card, .panel, section");
    if (observationPanel) observationPanel.hidden = true;
    form.querySelectorAll("input, select, button, textarea").forEach((field) => {
      field.disabled = true;
    });
    return;
  }

  const syncObservationHints = () => {
    const selected = code.options[code.selectedIndex];
    unit.value = selected.dataset.unit || "";
    value.placeholder = `Example: ${selected.dataset.example || "value"}`;
  };

  code.addEventListener("change", syncObservationHints);
  syncObservationHints();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const targetPatientId =
      document.getElementById("active-patient")?.value ||
      document.getElementById("flowsheet-patient-filter")?.value ||
      patient.value;
    patient.value = targetPatientId;
    const patientName = getPatient(targetPatientId).name;
    if (usingDatabaseApi) {
      try {
        const response = await fetch(apiPath("observations.php"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: targetPatientId,
            code: code.value,
            value: value.value,
            unit: unit.value,
            recordedAt: time.value,
            createEncounter: shouldCreateDatabaseEncounter(targetPatientId),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to save observation.");

        const savedObservation = {
          ...result.observation,
          patientId: String(result.observation.patientId),
          encounter: String(result.observation.encounter),
          database: true,
        };
        localStorage.removeItem(finalizedEncounterKey(targetPatientId));
        if (result.encounterCreated && result.encounter) {
          const provider = smartChartData.providers.find(
            (item) => item.id === String(result.encounter.providerId)
          );
          const patientRecord = getPatient(targetPatientId);
          smartChartData.appointments.unshift({
            ...result.encounter,
            id: String(result.encounter.id),
            patientId: String(result.encounter.patientId),
            providerId: String(result.encounter.providerId),
            provider: provider?.name || "Provider",
            patient: patientRecord.name,
          });
        }
        smartChartData.observations.unshift(savedObservation);
        const filter = document.getElementById("flowsheet-patient-filter");
        if (filter) filter.value = targetPatientId;
        renderObservations(currentRole, targetPatientId);
        renderVitalsSummary(targetPatientId);
        updateEncounterStatus(targetPatientId);
        status.textContent = `${code.value} saved to the MySQL database for ${patientName}.`;
        if (preview) {
          preview.classList.remove("hidden");
          preview.innerHTML = `<strong>Last saved to database:</strong> ${patientName} - ${code.value}: ${savedObservation.value} ${savedObservation.unit}`;
        }
        value.value = "";
        value.focus();
      } catch (error) {
        status.textContent = error.message;
      }
      return;
    }

    const encounterId = currentEncounterId(targetPatientId);
    const existingObservation = smartChartData.observations.find(
      (observation) =>
        observation.local &&
        observation.patientId === targetPatientId &&
        observation.encounter === encounterId &&
        observation.code === code.value
    );
    const newObservation = {
      id: `local-${Date.now()}`,
      patientId: targetPatientId,
      encounter: encounterId,
      date: (time.value || new Date().toISOString()).slice(0, 10),
      code: code.value,
      value: value.value,
      unit: unit.value,
      local: true,
    };

    if (existingObservation) {
      existingObservation.value = newObservation.value;
      existingObservation.unit = newObservation.unit;
      existingObservation.date = newObservation.date;
    } else {
      smartChartData.observations.unshift(newObservation);
    }
    saveStoredObservations();
    const filter = document.getElementById("flowsheet-patient-filter");
    if (filter) filter.value = targetPatientId;
    renderObservations(currentRole, targetPatientId);
    renderVitalsSummary(targetPatientId);
    updateEncounterStatus(targetPatientId);
    status.textContent = existingObservation
      ? `${code.value} updated for ${patientName} in the current encounter.`
      : `${code.value} saved locally for ${patientName}. It is highlighted at the top of the flowsheet table.`;
    if (preview) {
      preview.classList.remove("hidden");
      preview.innerHTML = `<strong>${existingObservation ? "Last updated" : "Last saved"}:</strong> ${patientName} - ${code.value}: ${newObservation.value} ${newObservation.unit}`;
    }
    value.value = "";
    value.focus();
  });
}

function wirePrescriptionSafetyCheck(defaultPatientId) {
  const submit = document.getElementById("prescription-submit");
  const warning = document.getElementById("interaction-warning");
  if (!submit || !warning) return;

  const form = document.getElementById("prescription-form");
  const prescriptionPatient = document.getElementById("prescription-patient");
  const medication = document.getElementById("medication");
  const dosage = document.getElementById("dosage");
  const frequency = document.getElementById("frequency");
  const status = document.getElementById("status");
  const startDate = document.getElementById("start-date");
  const prescriptionStatus = document.getElementById("prescription-status");
  const message = document.getElementById("interaction-message");
  const revise = document.getElementById("revise-prescription");
  const override = document.getElementById("override-prescription");

  const savePrescription = async (overrideWarning = false) => {
    const targetPatientId = prescriptionPatient?.value || defaultPatientId;
    const patient = getPatient(targetPatientId);
    const provider = smartChartData.providers[0] || { name: "Provider" };
    const newMedication = {
      name: medication.value,
      dosage: dosage.value || "Not specified",
      frequency: frequency.value || "Not specified",
      provider: provider.name,
      status: status.value,
      startDate: startDate.value || "Pending",
    };

    if (usingDatabaseApi) {
      try {
        const response = await fetch(apiPath("prescriptions.php"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: targetPatientId,
            providerId: provider.id,
            medication: medication.value,
            dosage: dosage.value,
            frequency: frequency.value,
            status: status.value,
            startDate: startDate.value,
            endDate: document.getElementById("end-date")?.value || "",
            overrideWarning,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to save prescription.");

        smartChartData.medications[targetPatientId] =
          smartChartData.medications[targetPatientId] || [];
        smartChartData.medications[targetPatientId].push(result.prescription);
        warning.classList.add("hidden");
        renderMedicationList(targetPatientId);
        prescriptionStatus.textContent = overrideWarning
          ? `Prescription saved to the database for ${patient.name} with provider override recorded.`
          : `Prescription saved to the database for ${patient.name}.`;
        form.reset();
        if (prescriptionPatient) prescriptionPatient.value = targetPatientId;
        populateMedicationOptions(targetPatientId);
      } catch (error) {
        prescriptionStatus.textContent = error.message;
      }
      return;
    }

    smartChartData.medications[targetPatientId] =
      smartChartData.medications[targetPatientId] || [];
    smartChartData.medications[targetPatientId].push(newMedication);
    saveStoredMedications();
    warning.classList.add("hidden");
    renderMedicationList(targetPatientId);
    prescriptionStatus.textContent = overrideWarning
      ? `Prescription added for ${patient.name} with provider override recorded.`
      : `Prescription added for ${patient.name}.`;
    form.reset();
    if (prescriptionPatient) prescriptionPatient.value = targetPatientId;
    populateMedicationOptions(targetPatientId);
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const targetPatientId = prescriptionPatient?.value || defaultPatientId;
    const interaction = findInteraction(targetPatientId, medication.value);

    if (interaction) {
      message.textContent = interaction;
      warning.classList.remove("hidden");
    } else {
      savePrescription(false);
    }
  });

  revise.addEventListener("click", () => {
    warning.classList.add("hidden");
    medication.focus();
  });

  override.addEventListener("click", () => {
    savePrescription(true);
  });
}

function findInteraction(patientId, newMedication) {
  const active = (smartChartData.medications[patientId] || [])
    .filter((med) => med.status === "Active")
    .map((med) => med.name);
  const normalizedNew = normalizeDrug(newMedication);

  for (const current of active) {
    const normalizedCurrent = normalizeDrug(current);
    const interaction = smartChartData.interactions.find((item) => {
      const drug1 = normalizeDrug(item.drug1);
      const drug2 = normalizeDrug(item.drug2);
      return (
        (normalizedCurrent.includes(drug1) && normalizedNew.includes(drug2)) ||
        (normalizedCurrent.includes(drug2) && normalizedNew.includes(drug1)) ||
        (drug1.includes(normalizedCurrent) && drug2.includes(normalizedNew)) ||
        (drug2.includes(normalizedCurrent) && drug1.includes(normalizedNew))
      );
    });
    if (interaction) return interaction.description;
  }

  return "";
}

function loadStoredMedications() {
  const stored = localStorage.getItem("smartchart-medications");
  if (!stored) return;

  try {
    const storedMeds = JSON.parse(stored);
    smartChartData.medications = { ...smartChartData.medications, ...storedMeds };
  } catch {
    localStorage.removeItem("smartchart-medications");
  }
}

function loadStoredAppointments() {
  const stored = localStorage.getItem("smartchart-appointments");
  if (!stored) return;

  try {
    const storedAppointments = JSON.parse(stored);
    smartChartData.appointments = [
      ...storedAppointments.map((appointment) => ({
        ...appointment,
        patient: cleanDisplayName(appointment.patient),
        provider: cleanDisplayName(appointment.provider),
      })),
      ...smartChartData.appointments,
    ];
  } catch {
    localStorage.removeItem("smartchart-appointments");
  }
}

function saveStoredAppointments() {
  const localAppointments = smartChartData.appointments.filter(
    (appointment) => appointment.local
  );
  localStorage.setItem("smartchart-appointments", JSON.stringify(localAppointments));
}

function saveStoredMedications() {
  localStorage.setItem(
    "smartchart-medications",
    JSON.stringify(smartChartData.medications)
  );
}

function loadStoredObservations() {
  const stored = localStorage.getItem("smartchart-observations");
  if (!stored) return;

  try {
    const storedObservations = JSON.parse(stored);
    smartChartData.observations = [...storedObservations, ...smartChartData.observations];
  } catch {
    localStorage.removeItem("smartchart-observations");
  }
}

function saveStoredObservations() {
  const localObservations = smartChartData.observations.filter(
    (observation) => observation.local
  );
  localStorage.setItem("smartchart-observations", JSON.stringify(localObservations));
}

function wireGenericForms() {
  document.querySelectorAll("form[data-message]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const message = form.dataset.message || "Form submitted.";
      alert(message);
    });
  });
}

function getPatient(patientId) {
  return smartChartData.patients.find((patient) => patient.id === patientId) || smartChartData.patients[0];
}

function cleanDisplayName(value) {
  return String(value || "")
    .split(/\s+/)
    .map((part) => part.replace(/\d+/g, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function appointmentTypeCell(appointment) {
  const type = appointment.reason || appointment.type || "Visit";
  return sentenceCase(String(type).replace(/^Requested:\s*/i, ""));
}

function displayDosage(medication) {
  if (!medication.dosage || medication.dosage === medication.name) return "";
  return medication.dosage;
}

function sentenceCase(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || "";
}

function setInput(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value || "";
}

function formatDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(value) {
  if (!value) return "";
  if (/^\d{2}:\d{2}$/.test(value)) {
    const [hour, minute] = value.split(":").map(Number);
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return value;
}

function normalizeDrug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function slug(value) {
  return normalizeDrug(value).replace(/\s+/g, ".") || "provider";
}

function escapeAttribute(value) {
  return String(value).replace(/"/g, "&quot;");
}

function showDataNotice(message) {
  const content = document.querySelector(".content") || document.querySelector(".login-card");
  if (!content) return;
  const notice = document.createElement("div");
  notice.className = "warning-box";
  notice.textContent = message;
  content.prepend(notice);
}
