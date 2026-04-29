<?php
require __DIR__ . '/db.php';

try {
    $db = smartchart_db();
    $stmt = $db->query(
        "SELECT patient_id AS id,
                first_name,
                last_name,
                dob,
                gender
         FROM Patients
         ORDER BY patient_id
         LIMIT 100"
    );
    send_json(['patients' => $stmt->fetchAll()]);
} catch (Throwable $error) {
    send_json(['error' => $error->getMessage()], 500);
}

