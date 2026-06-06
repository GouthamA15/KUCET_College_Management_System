import StorageProvider from './StorageProvider';

export default class LocalStorageProvider extends StorageProvider {
  getUrl(path) {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `/api/assets/view/${cleanPath}`;
  }
}
