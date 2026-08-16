interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle | string;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
}

interface PermissionAwareDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

const directoryDatabaseName = 'moyu-typeset-article-images';
const directoryStoreName = 'directory-handles';
const recentDirectoryKey = 'recent-article-directory';

export function canChooseArticleImageDirectory(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
}

export async function chooseArticleImageDirectory(
  recentDirectory?: FileSystemDirectoryHandle | null,
): Promise<FileSystemDirectoryHandle> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error('directory picker is unavailable');
  }

  return picker.call(window, {
    id: 'moyu-typeset-article-images',
    mode: 'read',
    ...(recentDirectory ? { startIn: recentDirectory } : {}),
  });
}

export async function articleImageDirectoryPermission(
  directoryHandle: FileSystemDirectoryHandle,
  requestPermission: boolean,
): Promise<PermissionState> {
  const permissionAwareHandle = directoryHandle as PermissionAwareDirectoryHandle;
  if (!permissionAwareHandle.queryPermission) {
    return 'prompt';
  }

  const permission = await permissionAwareHandle.queryPermission({ mode: 'read' });
  if (permission !== 'prompt' || !requestPermission || !permissionAwareHandle.requestPermission) {
    return permission;
  }

  return permissionAwareHandle.requestPermission({ mode: 'read' });
}

export async function recallArticleImageDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const database = await openDirectoryDatabase();
  try {
    return await requestResult<FileSystemDirectoryHandle | undefined>(
      database.transaction(directoryStoreName, 'readonly').objectStore(directoryStoreName).get(recentDirectoryKey),
    ).then((handle) => handle ?? null);
  } finally {
    database.close();
  }
}

export async function rememberArticleImageDirectory(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
  const database = await openDirectoryDatabase();
  try {
    await transactionCompleted(database, 'readwrite', (store) => store.put(directoryHandle, recentDirectoryKey));
  } finally {
    database.close();
  }
}

export async function forgetArticleImageDirectory(): Promise<void> {
  const database = await openDirectoryDatabase();
  try {
    await transactionCompleted(database, 'readwrite', (store) => store.delete(recentDirectoryKey));
  } finally {
    database.close();
  }
}

function openDirectoryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(directoryDatabaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(directoryStoreName)) {
        database.createObjectStore(directoryStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('failed to open article image directory database'));
  });
}

function transactionCompleted(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  mutate: (store: IDBObjectStore) => IDBRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(directoryStoreName, mode);
    mutate(transaction.objectStore(directoryStoreName));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('article image directory transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('article image directory transaction aborted'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('article image directory request failed'));
  });
}
