ALTER TABLE payment_reversals ADD COLUMN original_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
CREATE TABLE reversal_allocations (
  id BIGSERIAL PRIMARY KEY,
  reversal_id BIGINT NOT NULL REFERENCES payment_reversals(id),
  receipt_allocation_id BIGINT NOT NULL REFERENCES receipt_allocations(id),
  amount NUMERIC(12,2) NOT NULL CHECK(amount>0)
);
CREATE INDEX production_reversal_allocation ON reversal_allocations(receipt_allocation_id);
