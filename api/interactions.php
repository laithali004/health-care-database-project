<?php
require __DIR__ . '/db.php';

try {
    $db = smartchart_db();
    $stmt = $db->query(
        "SELECT d1.drug_name AS drug1,
                d2.drug_name AS drug2,
                di.description
         FROM Drug_Interactions di
         JOIN Interaction_Drugs d1 ON d1.idrug_id = di.drug1_id
         JOIN Interaction_Drugs d2 ON d2.idrug_id = di.drug2_id
         LIMIT 500"
    );
    send_json(['interactions' => $stmt->fetchAll()]);
} catch (Throwable $error) {
    send_json(['error' => $error->getMessage()], 500);
}

