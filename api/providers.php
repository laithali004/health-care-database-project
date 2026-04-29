<?php
require __DIR__ . '/db.php';

try {
    $db = smartchart_db();
    $stmt = $db->query(
        "SELECT p.provider_id AS id,
                p.first_name,
                p.last_name,
                p.license_no,
                ps.specialty
         FROM Providers p
         LEFT JOIN Provider_Specialties ps ON ps.provider_id = p.provider_id
         ORDER BY p.provider_id"
    );
    send_json(['providers' => $stmt->fetchAll()]);
} catch (Throwable $error) {
    send_json(['error' => $error->getMessage()], 500);
}

