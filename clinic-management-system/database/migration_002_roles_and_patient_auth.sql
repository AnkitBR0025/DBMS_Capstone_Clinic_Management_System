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

CALL add_column_if_missing('users', 'role', "VARCHAR(30) NOT NULL DEFAULT 'Admin'")$$
CALL add_column_if_missing('patients', 'user_id', 'INT NULL')$$
CALL add_column_if_missing('patients', 'date_of_birth', 'DATE NULL')$$
CALL add_column_if_missing('patients', 'mobile', 'VARCHAR(15) NULL')$$
CALL add_column_if_missing('doctors', 'user_id', 'INT NULL')$$
CALL add_column_if_missing('doctors', 'email', 'VARCHAR(254) NULL')$$
CALL add_column_if_missing('doctors', 'address', 'VARCHAR(255) NULL')$$
CALL add_column_if_missing('doctors', 'is_active', 'BOOLEAN NOT NULL DEFAULT TRUE')$$
CALL add_column_if_missing('appointments', 'reason_for_visit', 'VARCHAR(255) NULL')$$

DROP PROCEDURE add_column_if_missing$$

-- Preserve existing role values while allowing the three supported roles.
SET @role_constraint_name = (
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND constraint_name = 'chk_users_role'
    LIMIT 1
);
SET @drop_role_constraint = IF(
    @role_constraint_name IS NULL,
    'SELECT 1',
    'ALTER TABLE users DROP CONSTRAINT chk_users_role'
);
PREPARE role_stmt FROM @drop_role_constraint;
EXECUTE role_stmt;
DEALLOCATE PREPARE role_stmt;

UPDATE users SET role = 'Admin' WHERE role NOT IN ('Admin', 'Doctor', 'Patient');
ALTER TABLE users
    ADD CONSTRAINT chk_users_role CHECK (role IN ('Admin', 'Doctor', 'Patient'))$$

CREATE TABLE IF NOT EXISTS doctor_blocked_slots (
    block_id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    blocked_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_blocked_slot_doctor FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    CONSTRAINT chk_blocked_slot_time CHECK (start_time < end_time),
    INDEX idx_blocked_slot_doctor_date (doctor_id, blocked_date)
) ENGINE=InnoDB$$

DELIMITER ;
