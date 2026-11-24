USE clinic_management;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing$$
CREATE PROCEDURE add_column_if_missing(
    IN table_name_value VARCHAR(64),
    IN column_name_value VARCHAR(64),
    IN column_definition_value VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = table_name_value
          AND column_name = column_name_value
    ) THEN
        SET @migration_sql = CONCAT(
            'ALTER TABLE `', REPLACE(table_name_value, '`', '``'),
            '` ADD COLUMN `', REPLACE(column_name_value, '`', '``'),
            '` ', column_definition_value
        );
        PREPARE migration_statement FROM @migration_sql;
        EXECUTE migration_statement;
        DEALLOCATE PREPARE migration_statement;
    END IF;
END$$

CALL add_column_if_missing('patients', 'email', 'VARCHAR(254) NULL')$$
CALL add_column_if_missing('patients', 'blood_group', 'VARCHAR(3) NULL')$$
CALL add_column_if_missing('patients', 'emergency_contact', 'VARCHAR(20) NULL')$$
CALL add_column_if_missing('appointments', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP')$$
CALL add_column_if_missing('appointments', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')$$
CALL add_column_if_missing('treatments', 'treatment_details', 'TEXT NULL')$$
CALL add_column_if_missing('treatments', 'doctor_notes', 'TEXT NULL')$$
CALL add_column_if_missing('treatments', 'follow_up_date', 'DATE NULL')$$
CALL add_column_if_missing('prescriptions', 'frequency', 'VARCHAR(100) NULL')$$
CALL add_column_if_missing('prescriptions', 'duration', 'VARCHAR(100) NULL')$$
CALL add_column_if_missing('prescriptions', 'instructions', 'TEXT NULL')$$
CALL add_column_if_missing('prescriptions', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP')$$
CALL add_column_if_missing('payments', 'payment_method', 'VARCHAR(30) NULL')$$
CALL add_column_if_missing('payments', 'invoice_id', 'INT NULL')$$
CALL add_column_if_missing('doctors', 'email', 'VARCHAR(254) NULL')$$
CALL add_column_if_missing('doctors', 'address', 'VARCHAR(255) NULL')$$
CALL add_column_if_missing('doctors', 'is_active', 'BOOLEAN NOT NULL DEFAULT TRUE')$$

CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'Admin',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_role CHECK (role IN ('Admin', 'Doctor', 'Staff'))
) ENGINE=InnoDB$$

CREATE TABLE IF NOT EXISTS doctor_availability (
    availability_id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    day_of_week TINYINT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_minutes SMALLINT NOT NULL DEFAULT 30,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_availability_doctor FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    CONSTRAINT chk_availability_day CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT chk_availability_time CHECK (start_time < end_time),
    CONSTRAINT chk_availability_slot CHECK (slot_minutes BETWEEN 5 AND 480),
    INDEX idx_availability_doctor_day (doctor_id, day_of_week, is_available)
) ENGINE=InnoDB$$

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL UNIQUE,
    consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    additional_charges DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_appointment FOREIGN KEY (appointment_id)
        REFERENCES appointments(appointment_id) ON DELETE RESTRICT,
    CONSTRAINT chk_invoice_amounts CHECK (
        consultation_fee >= 0 AND additional_charges >= 0
        AND total_amount >= 0 AND amount_paid >= 0
    ),
    CONSTRAINT chk_invoice_status CHECK (
        payment_status IN ('Paid', 'Pending', 'Partially Paid')
    ),
    INDEX idx_invoice_payment_status (payment_status)
) ENGINE=InnoDB$$

CREATE TABLE IF NOT EXISTS payment_transactions (
    transaction_id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference_number VARCHAR(100) NULL,
    CONSTRAINT fk_transaction_invoice FOREIGN KEY (invoice_id)
        REFERENCES invoices(invoice_id) ON DELETE RESTRICT,
    CONSTRAINT chk_transaction_amount CHECK (amount > 0),
    INDEX idx_transaction_invoice_paid (invoice_id, paid_at)
) ENGINE=InnoDB$$

DROP PROCEDURE add_column_if_missing$$

DROP PROCEDURE IF EXISTS add_fk_if_missing$$
CREATE PROCEDURE add_fk_if_missing(
    IN table_name_value VARCHAR(64),
    IN constraint_name_value VARCHAR(64),
    IN constraint_definition_value VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = table_name_value
          AND constraint_name = constraint_name_value
          AND constraint_type = 'FOREIGN KEY'
    ) THEN
        SET @migration_sql = CONCAT(
            'ALTER TABLE `', REPLACE(table_name_value, '`', '``'),
            '` ADD CONSTRAINT `', REPLACE(constraint_name_value, '`', '``'),
            '` ', constraint_definition_value
        );
        PREPARE migration_statement FROM @migration_sql;
        EXECUTE migration_statement;
        DEALLOCATE PREPARE migration_statement;
    END IF;
END$$

CALL add_fk_if_missing(
    'payments',
    'fk_payment_invoice',
    'FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE RESTRICT'
)$$

DROP PROCEDURE add_fk_if_missing$$

UPDATE doctors
SET is_active = TRUE
WHERE is_active IS NULL$$

INSERT INTO invoices (
    appointment_id,
    consultation_fee,
    additional_charges,
    total_amount,
    amount_paid,
    payment_status
)
SELECT
    a.appointment_id,
    d.consultation_fee,
    0.00,
    GREATEST(d.consultation_fee, COALESCE(SUM(p.amount), 0.00)),
    COALESCE(SUM(CASE WHEN p.payment_status = 'Paid' THEN p.amount ELSE 0.00 END), 0.00),
    CASE
        WHEN COALESCE(SUM(CASE WHEN p.payment_status = 'Paid' THEN p.amount ELSE 0.00 END), 0.00)
             >= GREATEST(d.consultation_fee, COALESCE(SUM(p.amount), 0.00)) THEN 'Paid'
        WHEN COALESCE(SUM(CASE WHEN p.payment_status = 'Paid' THEN p.amount ELSE 0.00 END), 0.00) > 0
             THEN 'Partially Paid'
        ELSE 'Pending'
    END
FROM appointments a
JOIN doctors d ON d.doctor_id = a.doctor_id
LEFT JOIN payments p ON p.appointment_id = a.appointment_id
GROUP BY a.appointment_id, d.consultation_fee
ON DUPLICATE KEY UPDATE appointment_id = VALUES(appointment_id)$$

UPDATE payments p
JOIN invoices i ON i.appointment_id = p.appointment_id
SET p.invoice_id = i.invoice_id
WHERE p.invoice_id IS NULL$$

INSERT INTO payment_transactions (invoice_id, amount, payment_method, paid_at)
SELECT p.invoice_id, p.amount, COALESCE(p.payment_method, 'Other'),
       COALESCE(TIMESTAMP(p.payment_date), CURRENT_TIMESTAMP)
FROM payments p
WHERE p.invoice_id IS NOT NULL
  AND p.payment_status = 'Paid'
  AND NOT EXISTS (
      SELECT 1
      FROM payment_transactions t
      WHERE t.invoice_id = p.invoice_id
        AND t.amount = p.amount
        AND DATE(t.paid_at) = COALESCE(p.payment_date, CURDATE())
  )$$

CREATE OR REPLACE VIEW v_appointment_details AS
SELECT
    a.appointment_id,
    a.patient_id,
    p.name AS patient_name,
    p.contact AS patient_contact,
    a.doctor_id,
    d.name AS doctor_name,
    d.specialization,
    a.appointment_date,
    a.appointment_time,
    a.status,
    i.total_amount,
    i.amount_paid,
    i.payment_status
FROM appointments a
JOIN patients p ON p.patient_id = a.patient_id
JOIN doctors d ON d.doctor_id = a.doctor_id
LEFT JOIN invoices i ON i.appointment_id = a.appointment_id$$

DROP PROCEDURE IF EXISTS sp_monthly_revenue$$
CREATE PROCEDURE sp_monthly_revenue(IN report_year SMALLINT)
BEGIN
    SELECT MONTH(t.paid_at) AS month_number, SUM(t.amount) AS revenue
    FROM payment_transactions t
    WHERE YEAR(t.paid_at) = report_year
    GROUP BY MONTH(t.paid_at)
    ORDER BY month_number;
END$$

DROP TRIGGER IF EXISTS trg_appointment_status_log$$
CREATE TRIGGER trg_appointment_status_log
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO appointment_logs (appointment_id, old_status, new_status)
        VALUES (NEW.appointment_id, OLD.status, NEW.status);
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_payment_transaction_insert$$
CREATE TRIGGER trg_payment_transaction_insert
AFTER INSERT ON payment_transactions
FOR EACH ROW
BEGIN
    UPDATE invoices
    SET amount_paid = (
            SELECT COALESCE(SUM(amount), 0.00)
            FROM payment_transactions
            WHERE invoice_id = NEW.invoice_id
        ),
        payment_status = CASE
            WHEN (
                SELECT COALESCE(SUM(amount), 0.00)
                FROM payment_transactions
                WHERE invoice_id = NEW.invoice_id
            ) >= total_amount THEN 'Paid'
            WHEN (
                SELECT COALESCE(SUM(amount), 0.00)
                FROM payment_transactions
                WHERE invoice_id = NEW.invoice_id
            ) > 0 THEN 'Partially Paid'
            ELSE 'Pending'
        END
    WHERE invoice_id = NEW.invoice_id;
END$$

DELIMITER ;
