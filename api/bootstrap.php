<?php
require __DIR__ . '/db.php';

function clean_name(string $value): string
{
    return trim(preg_replace('/\s+/', ' ', preg_replace('/\d+/', '', $value)));
}

function patient_record(array $row): array
{
    $id = (string) $row['patient_id'];
    $mrn = str_pad($id, 7, '0', STR_PAD_LEFT);
    $name = clean_name($row['first_name'] . ' ' . $row['last_name']);

    return [
        'id' => $id,
        'sourceId' => $id,
        'name' => $name,
        'dob' => $row['dob'],
        'gender' => $row['gender'],
        'email' => strtolower(str_replace(' ', '.', $name)) . '@smartchart.local',
        'phone' => '(555) 010-' . str_pad($id, 4, '0', STR_PAD_LEFT),
        'address' => 'Address on file',
        'mrn' => $mrn,
    ];
}

try {
    $db = smartchart_db();

    $patients = array_map(
        'patient_record',
        $db->query(
            "SELECT patient_id, first_name, last_name, dob, gender
             FROM Patients
             ORDER BY patient_id"
        )->fetchAll()
    );

    $providers = array_map(
        fn($row) => [
            'id' => (string) $row['provider_id'],
            'sourceId' => (string) $row['provider_id'],
            'name' => clean_name($row['first_name'] . ' ' . $row['last_name']),
            'specialty' => $row['specialty'] ?? 'General Practice',
            'license' => $row['license_no'],
        ],
        $db->query(
            "SELECT p.provider_id, p.first_name, p.last_name, p.license_no, ps.specialty
             FROM Providers p
             LEFT JOIN Provider_Specialties ps ON ps.provider_id = p.provider_id
             ORDER BY p.provider_id"
        )->fetchAll()
    );

    $encounters = array_map(
        fn($row) => [
            'id' => (string) $row['encounter_id'],
            'sourceId' => (string) $row['encounter_id'],
            'patientId' => (string) $row['patient_id'],
            'providerId' => (string) $row['provider_id'],
            'date' => $row['encounter_date'],
            'time' => '',
            'provider' => clean_name($row['provider_first_name'] . ' ' . $row['provider_last_name']),
            'type' => ucwords($row['visit_type']),
            'description' => ucwords($row['visit_type']),
            'patient' => clean_name($row['patient_first_name'] . ' ' . $row['patient_last_name']),
        ],
        $db->query(
            "SELECT e.encounter_id, e.patient_id, e.provider_id, e.encounter_date, e.visit_type,
                    p.first_name AS provider_first_name, p.last_name AS provider_last_name,
                    pt.first_name AS patient_first_name, pt.last_name AS patient_last_name
             FROM Encounters e
             JOIN Providers p ON p.provider_id = e.provider_id
             JOIN Patients pt ON pt.patient_id = e.patient_id
             ORDER BY e.encounter_date DESC, e.encounter_id DESC"
        )->fetchAll()
    );

    $observations = array_map(
        fn($row) => [
            'patientId' => (string) $row['patient_id'],
            'encounter' => (string) $row['encounter_id'],
            'date' => substr($row['recorded_at'], 0, 10),
            'code' => $row['observation_code'],
            'value' => $row['value'],
            'unit' => $row['unit'],
        ],
        $db->query(
            "SELECT e.patient_id, o.encounter_id, o.observation_id, o.observation_code,
                    o.value, o.unit, o.recorded_at
             FROM Observations o
             JOIN Encounters e ON e.encounter_id = o.encounter_id
             ORDER BY o.recorded_at DESC, o.observation_id DESC
             LIMIT 1000"
        )->fetchAll()
    );

    $medications = [];
    $prescriptionRows = $db->query(
        "SELECT e.patient_id,
                rx.prescription_id,
                m.drug_name,
                rx.dosage,
                rx.frequency,
                rx.start_date,
                rx.end_date,
                rx.status,
                p.first_name AS provider_first_name,
                p.last_name AS provider_last_name
         FROM Prescriptions rx
         JOIN Encounters e ON e.encounter_id = rx.encounter_id
         JOIN Medications m ON m.med_id = rx.med_id
         JOIN Providers p ON p.provider_id = e.provider_id
         ORDER BY rx.start_date DESC, rx.prescription_id DESC"
    )->fetchAll();
    foreach ($prescriptionRows as $row) {
        $patientId = (string) $row['patient_id'];
        $medications[$patientId] ??= [];
        $medications[$patientId][] = [
            'prescriptionId' => (string) $row['prescription_id'],
            'name' => $row['drug_name'],
            'dosage' => $row['dosage'],
            'frequency' => $row['frequency'],
            'provider' => clean_name($row['provider_first_name'] . ' ' . $row['provider_last_name']),
            'status' => ucfirst($row['status']),
            'startDate' => $row['start_date'],
            'endDate' => $row['end_date'],
        ];
    }

    $medicationCatalog = array_map(
        fn($row) => [
            'name' => $row['drug_name'],
            'category' => $row['drug_class'] ?? '',
            'strength' => '',
            'form' => '',
            'classification' => $row['drug_class'] ?? '',
        ],
        $db->query(
            "SELECT med_id, drug_name, drug_class
             FROM Medications
             ORDER BY med_id"
        )->fetchAll()
    );

    $interactions = array_map(
        fn($row) => [
            'drug1' => $row['drug1'],
            'drug2' => $row['drug2'],
            'description' => $row['description'],
        ],
        $db->query(
            "SELECT d1.drug_name AS drug1, d2.drug_name AS drug2, di.description
             FROM Drug_Interactions di
             JOIN Interaction_Drugs d1 ON d1.idrug_id = di.drug1_id
             JOIN Interaction_Drugs d2 ON d2.idrug_id = di.drug2_id
             LIMIT 1250"
        )->fetchAll()
    );

    $staffUsers = array_map(
        fn($row) => [
            'id' => (string) $row['staff_id'],
            'username' => $row['username'],
            'role' => $row['role'],
            'accessLevel' => (int) $row['access_level'],
            'department' => $row['department'],
        ],
        $db->query(
            "SELECT staff_id, username, role, access_level, department
             FROM StaffUsers
             ORDER BY staff_id"
        )->fetchAll()
    );

    send_json([
        'source' => 'mysql',
        'patients' => $patients,
        'providers' => $providers,
        'encounters' => $encounters,
        'observations' => $observations,
        'medications' => $medications,
        'medicationCatalog' => $medicationCatalog,
        'interactions' => $interactions,
        'staffUsers' => $staffUsers,
    ]);
} catch (Throwable $error) {
    send_json(['error' => $error->getMessage()], 500);
}

