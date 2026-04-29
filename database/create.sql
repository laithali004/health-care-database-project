-- Create Sql file for Healthcare Database Project

-- Create the database
CREATE DATABASE IF NOT EXISTS SmartChartDatabase;
USE SmartChartDatabase;

--
-- Patient Table 
--

CREATE TABLE IF NOT EXISTS Patients (
    patient_id  INT          NOT NULL,
    first_name  VARCHAR(50)  NOT NULL,
    last_name   VARCHAR(50)  NOT NULL,
    dob         DATE         NOT NULL,
    gender      VARCHAR(20)  DEFAULT NULL,
    PRIMARY KEY (patient_id)
);

--
-- Provider Table
--

CREATE TABLE IF NOT EXISTS Providers (
    provider_id INT          NOT NULL,
    first_name  VARCHAR(50)  NOT NULL,
    last_name   VARCHAR(50)  NOT NULL,
    license_no  VARCHAR(30)  NOT NULL,
    PRIMARY KEY (provider_id),
    UNIQUE KEY uq_license (license_no)
);

--
-- Provider Specialities Table. Specialty theoretically be a multivalued attribute but for similpicity in our load.sql
-- we gave providers at most one specialty. This relation had to be decomposed from the original schema to ensure BCNF
--

CREATE TABLE IF NOT EXISTS Provider_Specialties (
    provider_id INT          NOT NULL,
    specialty   VARCHAR(80)  NOT NULL,
    PRIMARY KEY (provider_id, specialty),
    CONSTRAINT fk_ps_provider
        FOREIGN KEY (provider_id) REFERENCES Providers(provider_id)
        ON DELETE CASCADE
);

--
-- Create Medications Table
-- No DELETE protocol since no other entities solely rely on the existence of Medications
--

CREATE TABLE IF NOT EXISTS Medications (
    med_id      INT           NOT NULL,
    drug_name   VARCHAR(500)  NOT NULL,
    drug_class  VARCHAR(80)   DEFAULT NULL,
    PRIMARY KEY (med_id)
);

--
-- Create Staff Users Table.
-- 

CREATE TABLE IF NOT EXISTS StaffUsers (
    staff_id      INT           NOT NULL,
    username      VARCHAR(50)   NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(50)   NOT NULL,
    access_level  INT           NOT NULL DEFAULT 1,
    department    VARCHAR(80)   DEFAULT NULL,
    PRIMARY KEY (staff_id),
    UNIQUE KEY uq_username (username)
);

--
-- Create Encounters Table
--

CREATE TABLE IF NOT EXISTS Encounters (
    encounter_id    INT          NOT NULL,
    patient_id      INT          NOT NULL,
    provider_id     INT          NOT NULL,
    encounter_date  DATE         NOT NULL,
    visit_type      VARCHAR(30)  NOT NULL,
    PRIMARY KEY (encounter_id),
    CONSTRAINT fk_enc_patient
        FOREIGN KEY (patient_id)  REFERENCES Patients(patient_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_enc_provider
        FOREIGN KEY (provider_id) REFERENCES Providers(provider_id)
        ON DELETE NO ACTION
);

--
-- Create Prescriptions Table. This relation has multiple foreign key references so it is important to note delete mechanics
-- if a patient_id or encounter_id is missing the entire prescription is lost but if the med_id or provider_id is deleted the data can sitll remain 
--

CREATE TABLE IF NOT EXISTS Prescriptions (
    prescription_id INT           NOT NULL,
    patient_id      INT           DEFAULT NULL,
    provider_id     INT           DEFAULT NULL,
    med_id          INT           NOT NULL,
    encounter_id    INT           NOT NULL,
    dosage          VARCHAR(500)  NOT NULL,
    frequency       VARCHAR(50)   NOT NULL,
    start_date      DATE          NOT NULL DEFAULT (CURRENT_DATE),
    end_date        DATE          DEFAULT NULL,
    status          VARCHAR(20)   NOT NULL DEFAULT 'active',
    PRIMARY KEY (prescription_id),
    CONSTRAINT fk_rx_patient
        FOREIGN KEY (patient_id)   REFERENCES Patients(patient_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_rx_provider
        FOREIGN KEY (provider_id)  REFERENCES Providers(provider_id)
        ON DELETE NO ACTION,
    CONSTRAINT fk_rx_medication
        FOREIGN KEY (med_id)       REFERENCES Medications(med_id)
        ON DELETE NO ACTION,
    CONSTRAINT fk_rx_encounter
        FOREIGN KEY (encounter_id) REFERENCES Encounters(encounter_id)
        ON DELETE CASCADE
);

--
-- Create Observations Table. By setting Primary Key of the Relation to encounter_id and observation_id all attributes in table are in accordance to BCNF
--

CREATE TABLE IF NOT EXISTS Observations (
    encounter_id      INT           NOT NULL,
    observation_id    INT           NOT NULL,
    observation_code  VARCHAR(50)   NOT NULL,
    value             VARCHAR(50)   NOT NULL,
    unit              VARCHAR(20)   DEFAULT NULL,
    recorded_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (encounter_id, observation_id),
    CONSTRAINT fk_obs_encounter
        FOREIGN KEY (encounter_id) REFERENCES Encounters(encounter_id)
        ON DELETE CASCADE
);

--
-- Table eastablushed for drugs lookups used by Drug_drug Interaction checker
--

CREATE TABLE IF NOT EXISTS Interaction_Drugs (
    idrug_id   INT           NOT NULL,
    drug_name  VARCHAR(500)  NOT NULL,
    PRIMARY KEY (idrug_id),
    UNIQUE KEY uq_idrug_name (drug_name)
);

--
-- Drug Interaction table that tracks pairwsie drug interactions and outputs a message of their negative effects. Data is sourced from kaggle drug-drug interactions dataset.
--

CREATE TABLE IF NOT EXISTS Drug_Interactions (
    interaction_id  INT     NOT NULL,
    drug1_id        INT     NOT NULL,
    drug2_id        INT     NOT NULL,
    description     TEXT    NOT NULL,
    PRIMARY KEY (interaction_id),
    CONSTRAINT fk_di_drug1
        FOREIGN KEY (drug1_id) REFERENCES Interaction_Drugs(idrug_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_di_drug2
        FOREIGN KEY (drug2_id) REFERENCES Interaction_Drugs(idrug_id)
        ON DELETE CASCADE
);
