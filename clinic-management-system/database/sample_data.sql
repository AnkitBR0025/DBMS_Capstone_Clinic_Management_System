
USE clinic_management;

INSERT INTO doctors
(name, specialization, contact, consultation_fee)
VALUES
('Dr. Sharma', 'Cardiologist', '9876543210', 800.00),
('Dr. Rao', 'Dermatologist', '9876543211', 600.00),
('Dr. Mehta', 'General Physician', '9876543212', 500.00);

INSERT INTO patients
(name, age, gender, contact, address)
VALUES
('Rahul Kumar', 25, 'Male', '9876500001', 'Gurugram'),
('Priya Sharma', 30, 'Female', '9876500002', 'Delhi'),
('Sanjay Verma', 42, 'Male', '9876500003', 'Faridabad');

INSERT INTO appointments
(patient_id, doctor_id, appointment_date, appointment_time, status)
VALUES
(1, 3, CURDATE(), '10:00:00', 'Scheduled'),
(2, 2, CURDATE(), '11:00:00', 'Completed'),
(3, 1, CURDATE(), '12:00:00', 'Scheduled');

INSERT INTO treatments
(appointment_id, diagnosis, treatment_date)
VALUES
(2, 'Skin allergy', CURDATE());

INSERT INTO prescriptions
(treatment_id, medicine, dosage)
VALUES
(1, 'Cetirizine', 'One tablet daily');

INSERT INTO payments
(appointment_id, amount, payment_date, payment_status)
VALUES
(1, 500.00, CURDATE(), 'Pending'),
(2, 600.00, CURDATE(), 'Paid'),
(3, 800.00, CURDATE(), 'Pending');

INSERT INTO doctor_availability
(doctor_id, day_of_week, start_time, end_time, slot_minutes, is_available)
SELECT doctor_id, day_number, '09:00:00', '17:00:00', 30, TRUE
FROM doctors
CROSS JOIN (
    SELECT 1 AS day_number UNION ALL SELECT 2 UNION ALL SELECT 3
    UNION ALL SELECT 4 UNION ALL SELECT 5
) AS working_days;
