<?php
require __DIR__ . '/db.php';

try {
    $db = smartchart_db();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        send_json(['error' => 'Appointment request insert will be wired next.'], 501);
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

