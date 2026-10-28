import { getUser } from '../api';

function storageKey() {
  const user = getUser();
  return user ? `ventesdb_active_dataset_${user.id}` : null;
}

export function getActiveDatasetId() {
  const key = storageKey();
  return key ? localStorage.getItem(key) || '' : '';
}

export function setActiveDatasetId(id) {
  const key = storageKey();
  if (!key) return;
  if (id) localStorage.setItem(key, String(id));
  else localStorage.removeItem(key);
}
