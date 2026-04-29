<?php
require __DIR__ . '/db.php';

try {
    $db = smartchart_db();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = request_json();
        $patientId = (int) ($data['patientId'] ?? 0);
        $providerId = (int) ($data['providerId'] ?? 0);
        $medicationName = trim((string) ($data['medication'] ?? ''));
        $dosage = trim((string) ($data['dosage'] ?? ''));
        $frequency = trim((string) ($data['frequency'] ?? ''));
        $status = strtolower(trim((string) ($data['status'] ?? 'active')));
        $startDate = trim((string) ($data['startDate'] ?? ''));
        $endDate = trim((string) ($data['endDate'] ?? ''));

        if ($patientId <= 0 || $medicationName === '') {
            send_json(['error' => 'patientId and medication are required.'], 400);
            exit;
        }

        if ($dosage === '') {
            $dosage = 'Not specified';
        }
        if ($frequency === '') {
            $frequency = 'Not specified';
        }
        if ($startDate === '') {
            $startDate = date('Y-m-d');
        }
        if ($endDate === '') {
            $endDate = null;
        }
        if (!in_array($status, ['active', 'pending', 'stopped'], true)) {
            $status = 'active';
        }

        $medStmt = $db->prepare(
            "SELECT med_id, drug_name
             FROM Medications
             WHERE drug_name = ?
             ORDER BY med_id
             LIMIT 1"
        );
        $medStmt->execute([$medicationName]);
        $medication = $medStmt->fetch();
        if (!$medication) {
            send_json(['error' => 'Selected medication was not found in the database catalog.'], 404);
            exit;
        }

        $encounterStmt = $db->prepare(
            "SELECT encounter_id, provider_id
             FROM Encounters
             WHERE patient_id = ?
             ORDER BY encounter_date DESC, encounter_id DESC
             LIMIT 1"
        );
        $encounterStmt->execute([$patientId]);
        $encounter = $encounterStmt->fetch();
        if (!$encounter) {
            send_json(['error' => 'No encounter exists for this patient.'], 400);
            exit;
        }

        if ($providerId <= 0) {
            $providerId = (int) $encounter['provider_id'];
        }

        $providerCheck = $db->prepare("SELECT provider_id FROM Providers WHERE provider_id = ?");
        $providerCheck->execute([$providerId]);
        if (!$providerCheck->fetchColumn()) {
            send_json(['error' => 'Selected provider was not found.'], 404);
            exit;
        }

        $prescriptionId = (int) $db->query(
            "SELECT COALESCE(MAX(prescription_id), 0) + 1 FROM Prescriptions"
        )->fetchColumn();

        $insert = $db->prepare(
            "INSERT INTO Prescriptions
                (prescription_id, med_id, encounter_id, dosage, frequency, start_date, end_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $insert->execute([
            $prescriptionId,
            (int) $medication['med_id'],
            (int) $encounter['encounter_id'],
            $dosage,
            $frequency,
            $startDate,
            $endDate,
            $status,
        ]);

        $providerStmt = $db->prepare(
            "SELECT first_name, last_name FROM Providers WHERE provider_id = ?"
        );
        $providerStmt->execute([$providerId]);
        $provider = $providerStmt->fetch();

        send_json([
            'prescription' => [
                'prescriptionId' => (string) $prescriptionId,
                'name' => $medication['drug_name'],
                'dosage' => $dosage,
                'frequency' => $frequency,
                'provider' => trim(($provider['first_name'] ?? '') . ' ' . ($provider['last_name'] ?? '')),
                'status' => ucfirst($status),
                'startDate' => $startDate,
                'endDate' => $endDate,
                'database' => true,
            ],
        ], 201);
        exit;
    }

    $patientId = $_GET['patient_id'] ?? null;
    $sql =
        "SELECT rx.prescription_id,
                e.patient_id,
                e.provider_id,
                rx.med_id,
                m.drug_name,
                rx.dosage,
                rx.frequency,
                rx.start_date,
                rx.end_date,
                rx.status
         FROM Prescriptions rx
         JOIN Encounters e ON e.encounter_id = rx.encounter_id
         JOIN Medications m ON m.med_id = rx.med_id";
    $params = [];

    if ($patientId !== null) {
        $sql .= " WHERE e.patient_id = ?";
        $params[] = $patientId;
    }

    $sql .= " ORDER BY rx.start_date DESC LIMIT 100";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    send_json(['prescriptions' => $stmt->fetchAll()]);
} catch (Throwable $error) {
    send_json(['error' => $error->getMessage()], 500);
}
