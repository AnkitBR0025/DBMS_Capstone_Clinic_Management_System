CREATE DATABASE IF NOT EXISTS clinic_management;

USE clinic_management;

-- 1. Patients
CREATE TABLE patients (
    patient_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    age INT,
    gender VARCHAR(15),
    contact VARCHAR(15),
    address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Doctors
CREATE TABLE doctors (
    doctor_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    contact VARCHAR(15),
    consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00
);

-- 3. Appointments
CREATE TABLE appointments (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Scheduled',

    CONSTRAINT fk_appointment_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(patient_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_appointment_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id)
        ON DELETE RESTRICT
);

-- 4. Treatments
CREATE TABLE treatments (
    treatment_id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    diagnosis VARCHAR(200),
    treatment_date DATE,

    FOREIGN KEY (appointment_id)
        REFERENCES appointments(appointment_id)
        ON DELETE CASCADE
);

-- 5. Prescriptions
CREATE TABLE prescriptions (
    prescription_id INT PRIMARY KEY AUTO_INCREMENT,
    treatment_id INT NOT NULL,
    medicine VARCHAR(100) NOT NULL,
    dosage VARCHAR(100),

    FOREIGN KEY (treatment_id)
        REFERENCES treatments(treatment_id)
        ON DELETE CASCADE
);

-- 6. Payments
CREATE TABLE payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE,
    payment_status VARCHAR(20) DEFAULT 'Pending',

    FOREIGN KEY (appointment_id)
        REFERENCES appointments(appointment_id)
        ON DELETE CASCADE
);

-- 7. Appointment status history
CREATE TABLE appointment_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (appointment_id)
        REFERENCES appointments(appointment_id)
        ON DELETE CASCADE
);

-- Indexes for frequently searched columns
CREATE INDEX idx_patient_name ON patients(name);
CREATE INDEX idx_appointment_date ON appointments(appointment_date);
CREATE INDEX idx_appointment_status ON appointments(status);
