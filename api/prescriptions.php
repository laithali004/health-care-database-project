<?php
require __DIR__ . '/db.php';

try {
    $db = smartchart_db();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        send_json(['error' => 'Prescription insert will be wired next.'], 501);
        exit;
    }

    $patientId = $_GET['patient_id'] ?? null;
    $sql =
        "SELECT rx.prescription_id,
                rx.patient_id,
                rx.provider_id,
                rx.med_id,
                m.drug_name,
                rx.dosage,
                rx.frequency,
                rx.start_date,
                rx.end_date,
                rx.status
         FROM Prescriptions rx
         JOIN Medications m ON m.med_id = rx.med_id";
    $params = [];

    if ($patientId !== null) {
        $sql .= " WHERE rx.patient_id = ?";
        $params[] = $patientId;
    }

    $sql .= " ORDER BY rx.start_date DESC LIMIT 100";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    send_json(['prescriptions' => $stmt->fetchAll()]);
} catch (Throwable $error) {
    send_json(['error' => $error->getMessage()], 500);
}

