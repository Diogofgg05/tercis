import type { Budget } from './types';

// Legacy offline storage retained for compatibility. The active Tercis demo
// uses its own versioned localStorage key; real accounts use Supabase.
const DB_NAME = 'orcamentos_db';
const DB_VERSION = 2;
const STORE_NAME = 'orcamentos';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir a base de dados local.'));
    request.onblocked = () => reject(new Error('O armazenamento local está bloqueado por outra janela.'));
  });
}

/** Resolve only after the IndexedDB transaction commits. A request's
 * onsuccess alone is not proof that the write was persisted. */
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, setResult: (value:T) => void) => void,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    let result!: T;
    let finished = false;
    const close = () => {
      if (!finished) { finished = true; db.close(); }
    };
    try {
      const tx = db.transaction(STORE_NAME, mode);
      tx.oncomplete = () => { close(); resolve(result); };
      tx.onabort = () => {
        close();
        reject(tx.error ?? new Error('A transação de armazenamento foi cancelada.'));
      };
      tx.onerror = () => {
        close();
        reject(tx.error ?? new Error('Erro na transação de armazenamento local.'));
      };
      action(tx.objectStore(STORE_NAME), value => { result = value; });
    } catch (error) {
      close();
      reject(error);
    }
  });
}

export function saveBudget(budget: Budget): Promise<void> {
  return transact<void>('readwrite', store => { store.put(budget); });
}

export function loadAllBudgets(): Promise<Budget[]> {
  return transact<Budget[]>('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result as Budget[]);
  });
}

export function deleteBudget(id: string): Promise<void> {
  return transact<void>('readwrite', store => { store.delete(id); });
}
