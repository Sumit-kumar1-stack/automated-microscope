import type {
  AnalysisSnapshot,
} from "@/lib/analysis-snapshot";

const DATABASE_NAME =
  "automated-microscope";

const DATABASE_VERSION =
  1;

const STORE_NAME =
  "analysis-history";

const MAX_HISTORY_ITEMS =
  20;

export async function saveAnalysisSnapshot(
  snapshot:
    AnalysisSnapshot,
): Promise<void> {
  const db =
    await openDatabase();

  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      const transaction =
        db.transaction(
          STORE_NAME,
          "readwrite",
        );

      const store =
        transaction.objectStore(
          STORE_NAME,
        );

      store.put(
        snapshot,
      );

      transaction.oncomplete =
        () =>
          resolve();

      transaction.onerror =
        () =>
          reject(
            transaction.error ??
              new Error(
                "Unable to save analysis history.",
              ),
          );
    },
  );

  await trimHistory();
}

export async function listAnalysisSnapshots():
  Promise<
    AnalysisSnapshot[]
  > {
  const db =
    await openDatabase();

  const result =
    await new Promise<
      AnalysisSnapshot[]
    >(
      (
        resolve,
        reject,
      ) => {
        const transaction =
          db.transaction(
            STORE_NAME,
            "readonly",
          );

        const store =
          transaction.objectStore(
            STORE_NAME,
          );

        const request =
          store.getAll();

        request.onsuccess =
          () => {
            resolve(
              request.result as
                AnalysisSnapshot[],
            );
          };

        request.onerror =
          () =>
            reject(
              request.error,
            );
      },
    );

  return result.sort(
    (
      first,
      second,
    ) =>
      new Date(
        second.createdAt,
      ).getTime() -
      new Date(
        first.createdAt,
      ).getTime(),
  );
}

export async function deleteAnalysisSnapshot(
  id:
    string,
): Promise<void> {
  const db =
    await openDatabase();

  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      const transaction =
        db.transaction(
          STORE_NAME,
          "readwrite",
        );

      transaction
        .objectStore(
          STORE_NAME,
        )
        .delete(
          id,
        );

      transaction.oncomplete =
        () =>
          resolve();

      transaction.onerror =
        () =>
          reject(
            transaction.error ??
              new Error(
                "Unable to delete analysis history.",
              ),
          );
    },
  );
}

async function trimHistory():
  Promise<void> {
  const items =
    await listAnalysisSnapshots();

  const excess =
    items.slice(
      MAX_HISTORY_ITEMS,
    );

  for (
    const item
    of excess
  ) {
    await deleteAnalysisSnapshot(
      item.id,
    );
  }
}

function openDatabase():
  Promise<
    IDBDatabase
  > {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      if (
        typeof indexedDB ===
        "undefined"
      ) {
        reject(
          new Error(
            "IndexedDB is not available in this browser.",
          ),
        );

        return;
      }

      const request =
        indexedDB.open(
          DATABASE_NAME,
          DATABASE_VERSION,
        );

      request.onupgradeneeded =
        () => {
          const db =
            request.result;

          if (
            !db.objectStoreNames
              .contains(
                STORE_NAME,
              )
          ) {
            db.createObjectStore(
              STORE_NAME,
              {
                keyPath:
                  "id",
              },
            );
          }
        };

      request.onsuccess =
        () =>
          resolve(
            request.result,
          );

      request.onerror =
        () =>
          reject(
            request.error ??
              new Error(
                "Unable to open analysis database.",
              ),
          );
    },
  );
}