CREATE TABLE operation_requests (
  company_id INTEGER NOT NULL REFERENCES companies(id),
  operation TEXT NOT NULL,
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(company_id,operation,request_key)
);
CREATE INDEX production_operations_created ON operation_requests(company_id,created_at);
