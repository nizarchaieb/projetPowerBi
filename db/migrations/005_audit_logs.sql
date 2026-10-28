CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id VARCHAR(80) NULL,
  details_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE SET NULL,
  INDEX idx_audit_logs_created (created_at, id),
  INDEX idx_audit_logs_admin (admin_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
