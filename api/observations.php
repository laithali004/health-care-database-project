<?php
require __DIR__ . '/db.php';

try {
    $db = smartchart_db();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = request_json();
        $patientId = (int) ($data['patientId'] ?? 0);
        $code = trim((string) ($data['code'] ?? ''));
        $value = trim((string) ($data['value'] ?? ''));
        $unit = trim((string) ($data['unit'] ?? ''));
        $recordedAt = trim((string) ($data['recordedAt'] ?? ''));
        $createEncounter = !empty($data['createEncounter']);

        if ($patientId <= 0 || $code === '' || $value === '') {
            send_json(['error' => 'patientId, code, and value are required.'], 400);
            exit;
        }

        if ($recordedAt === '') {
            $recordedAt = date('Y-m-d H:i:s');
        } else {
            $recordedAt = str_replace('T', ' ', $recordedAt);
            if (strlen($recordedAt) === 16) {
                $recordedAt .= ':00';
            }
        }

        $encounterStmt = $db->prepare(
            "SELECT encounter_id, provider_id
             FROM Encounters
             WHERE patient_id = ?
             ORDER BY encounter_date DESC, encounter_id DESC
             LIMIT 1"
        );
        $encounterStmt->execute([$patientId]);
        $latestEncounter = $encounterStmt->fetch();

        if (!$latestEncounter) {
            send_json(['error' => 'No encounter exists for this patient.'], 400);
            exit;
        }

        $encounterId = (int) $latestEncounter['encounter_id'];
        $encounterCreated = false;

        if ($createEncounter) {
            $nextEncounterId = (int) $db->query(
                "SELECT COALESCE(MAX(encounter_id), 0) + 1 FROM Encounters"
            )->fetchColumn();
            $providerId = (int) ($latestEncounter['provider_id'] ?: 1);
            $encounterDate = substr($recordedAt, 0, 10);
            $visitType = 'ambulatory';

            $insertEncounter = $db->prepare(
                "INSERT INTO Encounters
                    (encounter_id, patient_id, provider_id, encounter_date, visit_type)
                 VALUES (?, ?, ?, ?, ?)"
            );
            $insertEncounter->execute([
                $nextEncounterId,
                $patientId,
                $providerId,
                $encounterDate,
                $visitType,
            ]);

            $encounterId = $nextEncounterId;
            $encounterCreated = true;
        }

        $nextStmt = $db->prepare(
            "SELECT COALESCE(MAX(observation_id), 0) + 1
             FROM Observations
             WHERE encounter_id = ?"
        );
        $nextStmt->execute([$encounterId]);
        $observationId = (int) $nextStmt->fetchColumn();

        $insert = $db->prepare(
            "INSERT INTO Observations
                (encounter_id, observation_id, observation_code, value, unit, recorded_at)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $insert->execute([$encounterId, $observationId, $code, $value, $unit, $recordedAt]);

        send_json([
            'observation' => [
                'patientId' => (string) $patientId,
                'encounter' => (string) $encounterId,
                'date' => substr($recordedAt, 0, 10),
                'code' => $code,
                'value' => $value,
                'unit' => $unit,
                'database' => true,
            ],
            'encounterCreated' => $encounterCreated,
            'encounter' => [
                'id' => (string) $encounterId,
                'sourceId' => (string) $encounterId,
                'patientId' => (string) $patientId,
                'providerId' => (string) ($providerId ?? $latestEncounter['provider_id']),
                'date' => substr($recordedAt, 0, 10),
                'time' => '',
                'provider' => '',
                'type' => 'Ambulatory',
                'description' => 'Ambulatory',
                'patient' => '',
            ],
        ], 201);
        exit;
    }

    $patientId = $_GET['patient_id'] ?? null;
    $sql =
        "SELECT o.encounter_id,
                o.observation_id,
                o.observation_code,
                o.value,
                o.unit,
                o.recorded_at
         FROM Observations o
         JOIN Encounters e ON e.encounter_id = o.encounter_id";
    $params = [];

    if ($patientId !== null) {
        $sql .= " WHERE e.patient_id = ?";
        $params[] = $patientId;
    }

    $sql .= " ORDER BY o.recorded_at DESC LIMIT 100";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    send_json(['observations' => $stmt->fetchAll()]);
} catch (Throwable $error) {
    send_json(['error' => $error->getMessage()], 500);
}
