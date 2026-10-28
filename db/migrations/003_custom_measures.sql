CREATE TABLE IF NOT EXISTS custom_measures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  titre VARCHAR(120) NOT NULL,
  formule ENUM('sum', 'average', 'count', 'ratio', 'taux_annulation') NOT NULL,
  colonne VARCHAR(40) NOT NULL,
  group_by ENUM('region', 'produit', 'client', 'mois') NULL,
  type_graphique ENUM('bar', 'line', 'pie', 'table') NOT NULL DEFAULT 'bar',
  ordre INT NOT NULL DEFAULT 0,
  visible TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_custom_measures_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_custom_measures_visible_order (visible, ordre, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
