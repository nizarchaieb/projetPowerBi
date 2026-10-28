-- Run once to add private CSV workspaces and saved client reports.
CREATE TABLE IF NOT EXISTS custom_datasets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  columns_json JSON NOT NULL,
  rows_json JSON NOT NULL,
  row_count INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_custom_datasets_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saved_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  dataset_id INT NOT NULL,
  title VARCHAR(120) NOT NULL,
  chart_type ENUM('bar', 'line', 'pie', 'table') NOT NULL,
  dimension_column VARCHAR(255) NOT NULL,
  metric_column VARCHAR(255) NULL,
  aggregation ENUM('sum', 'average', 'count') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (dataset_id) REFERENCES custom_datasets (id) ON DELETE CASCADE,
  INDEX idx_saved_reports_user_dataset (user_id, dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
