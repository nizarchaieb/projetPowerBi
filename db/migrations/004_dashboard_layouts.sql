CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  scope ENUM('demo', 'personal') NOT NULL,
  layout_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dashboard_layouts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE KEY uq_dashboard_layouts_user_scope (user_id, scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
