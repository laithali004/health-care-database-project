<?php
require __DIR__ . '/db.php';

try {
    $db = smartchart_db();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = request_json();
        $patientId = (int) ($data['patientId'] ?? 0);
        $providerId = (int) ($data['providerId'] ?? 0);
        $date = trim((string) ($data['date'] ?? ''));
        $time = trim((string) ($data['time'] ?? ''));
        $reason = trim((string) ($data['reason'] ?? ''));

        if ($patientId <= 0 || $providerId <= 0 || $date === '') {
            send_json(['error' => 'patientId, providerId, and date are required.'], 400);
            exit;
        }

        $patientCheck = $db->prepare("SELECT patient_id FROM Patients WHERE patient_id = ?");
        $patientCheck->execute([$patientId]);
        $providerCheck = $db->prepare("SELECT provider_id FROM Providers WHERE provider_id = ?");
        $providerCheck->execute([$providerId]);
        if (!$patientCheck->fetchColumn() || !$providerCheck->fetchColumn()) {
            send_json(['error' => 'Selected patient or provider was not found.'], 404);
            exit;
        }

        $encounterId = (int) $db->query(
            "SELECT COALESCE(MAX(encounter_id), 0) + 1 FROM Encounters"
        )->fetchColumn();
        $visitType = substr($reason !== '' ? $reason : 'Requested visit', 0, 30);

        $insert = $db->prepare(
            "INSERT INTO Encounters
                (encounter_id, patient_id, provider_id, encounter_date, visit_type)
             VALUES (?, ?, ?, ?, ?)"
        );
        $insert->execute([$encounterId, $patientId, $providerId, $date, $visitType]);

        $providerStmt = $db->prepare(
            "SELECT first_name, last_name FROM Providers WHERE provider_id = ?"
        );
        $providerStmt->execute([$providerId]);
        $providerRow = $providerStmt->fetch();

        $patientStmt = $db->prepare(
            "SELECT first_name, last_name FROM Patients WHERE patient_id = ?"
        );
        $patientStmt->execute([$patientId]);
        $patientRow = $patientStmt->fetch();

        send_json([
            'appointment' => [
                'id' => (string) $encounterId,
                'sourceId' => (string) $encounterId,
                'patientId' => (string) $patientId,
                'providerId' => (string) $providerId,
                'patient' => trim(($patientRow['first_name'] ?? '') . ' ' . ($patientRow['last_name'] ?? '')),
                'provider' => trim(($providerRow['first_name'] ?? '') . ' ' . ($providerRow['last_name'] ?? '')),
                'date' => $date,
                'time' => $time,
                'type' => $visitType,
                'reason' => $reason,
                'status' => 'Requested',
                'database' => true,
            ],
        ], 201);
        exit;
    }

    $patientId = $_GET['patient_id'] ?? null;
    $sql =
        "SELECT e.encounter_id AS id,
                e.patient_id,
                e.provider_id,
                e.encounter_date,
                e.visit_type,
                p.first_name AS provider_first_name,
                p.last_name AS provider_last_name
         FROM Encounters e
         JOIN Providers p ON p.provider_id = e.provider_id";
    $params = [];

    if ($patientId !== null) {
        $sql .= " WHERE e.patient_id = ?";
        $params[] = $patientId;
    }

    $sql .= " ORDER BY e.encounter_date DESC LIMIT 50";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    send_json(['appointments' => $stmt->fetchAll()]);
} catch (Throwable $error) {
    send_json(['error' => $error->getMessage()], 500);
}
