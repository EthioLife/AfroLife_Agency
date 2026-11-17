ALTER TABLE lease_move_out_inspections
  ADD COLUMN client_submission_id uuid;

CREATE UNIQUE INDEX lease_move_out_inspection_client_submission_idx
  ON lease_move_out_inspections(lease_id,submitted_by,client_submission_id)
  WHERE client_submission_id IS NOT NULL;
