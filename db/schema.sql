-- ============================================================
-- VentesDB — Schéma MySQL 8
-- Miroir du modèle en étoile Power BI (1 table de faits + 4 dimensions)
-- Données source : sales_2.csv (1 043 lignes de commandes, 2023)
-- ============================================================

CREATE DATABASE IF NOT EXISTS ventesdb
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ventesdb;

-- ---------------- Dimensions ----------------

CREATE TABLE IF NOT EXISTS dim_client (
  id_client VARCHAR(20) PRIMARY KEY,
  nom_client VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dim_produit (
  id_produit VARCHAR(20) PRIMARY KEY,
  nom_produit VARCHAR(255) NOT NULL,
  categorie VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dim_region (
  id_region VARCHAR(20) PRIMARY KEY,
  nom_region VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dim_date (
  date DATE PRIMARY KEY,
  annee INT NOT NULL,
  mois INT NOT NULL,
  mois_nom VARCHAR(20) NOT NULL,
  annee_mois VARCHAR(7) NOT NULL,
  trimestre INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Table de faits ----------------

CREATE TABLE IF NOT EXISTS fact_ventes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_commande VARCHAR(20) NOT NULL,
  id_client VARCHAR(20) NOT NULL,
  id_produit VARCHAR(20) NOT NULL,
  id_region VARCHAR(20) NOT NULL,
  date_commande DATE NOT NULL,
  quantite INT NOT NULL,
  prix_unitaire DECIMAL(12,2) NOT NULL,
  prix_total DECIMAL(12,2) NOT NULL,
  statut VARCHAR(50) NOT NULL,
  FOREIGN KEY (id_client) REFERENCES dim_client (id_client),
  FOREIGN KEY (id_produit) REFERENCES dim_produit (id_produit),
  FOREIGN KEY (id_region) REFERENCES dim_region (id_region),
  FOREIGN KEY (date_commande) REFERENCES dim_date (date),
  INDEX idx_commande (id_commande),
  INDEX idx_statut (statut),
  INDEX idx_date (date_commande)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Application ----------------

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  is_approved TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS insights (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page ENUM('ventes', 'annulations') NOT NULL,
  title VARCHAR(255) NOT NULL,
  text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- Espaces de travail clients ----------------

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

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  scope ENUM('demo', 'personal') NOT NULL,
  layout_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dashboard_layouts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE KEY uq_dashboard_layouts_user_scope (user_id, scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
