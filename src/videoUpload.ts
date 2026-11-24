// Video (reel) upload — Firebase Storage.
// Storage is NOT enabled for this project (needs the Blaze plan, which the
// owner has not approved), so uploads currently fail. This module keeps the
// real uploadBytes path intact so uploads succeed the moment Storage is
// turned on, but maps a Storage-disabled failure to an honest message that
// names the real cause instead of blaming the user's connection.

export const VIDEO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024

// Shown when Firebase Storage itself is off / the bucket does not exist.
export const VIDEO_UPLOAD_STORAGE_DISABLED_MESSAGE =
  'Video uploads are not enabled yet — cloud storage is off, so videos cannot be uploaded right now. Your connection is fine; please try again once storage is turned on.'

// Shown for a genuine network failure.
export const VIDEO_UPLOAD_NETWORK_MESSAGE =
  'Video upload failed — check your connection and try again.'

const STORAGE_DISABLED_CODES = new Set([
  'storage/unauthorized',
  'storage/bucket-not-found',
  'storage/project-not-found',
])

function errorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code
    return typeof code === 'string' ? code : ''
  }
  return ''
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? '')
}

/** True when the failure means Storage is disabled / the bucket is missing. */
export function isStorageDisabledError(err: unknown): boolean {
  const code = errorCode(err)
  if (STORAGE_DISABLED_CODES.has(code)) return true
  // storage/unknown only counts as "storage off" when the message says the
  // bucket is missing / Storage is not enabled — any other unknown error
  // stays a generic failure so we never mislabel it.
  if (code === 'storage/unknown') {
    return /bucket|storage (is )?not (enabled|configured|set up)|no (default )?bucket|does not exist|not found/i.test(errorMessage(err))
  }
  return /no (default )?bucket|firebase storage: no bucket|storage (is )?not (enabled|configured)/i.test(errorMessage(err))
}

export function videoUploadErrorMessage(err: unknown): string {
  return isStorageDisabledError(err)
    ? VIDEO_UPLOAD_STORAGE_DISABLED_MESSAGE
    : VIDEO_UPLOAD_NETWORK_MESSAGE
}

export interface VideoUploadDeps {
  getFirebaseApp: () => unknown
  getStorage: (app: unknown) => unknown
  storageRef: (storage: unknown, path: string) => unknown
  uploadBytes: (ref: unknown, file: File) => Promise<{ ref: unknown }>
  getDownloadURL: (ref: unknown) => Promise<string>
}

async function defaultDeps(): Promise<VideoUploadDeps> {
  const [{ getFirebaseApp }, storage] = await Promise.all([
    import('./firebase'),
    import('firebase/storage'),
  ])
  return {
    getFirebaseApp,
    getStorage: storage.getStorage as VideoUploadDeps['getStorage'],
    storageRef: storage.ref as VideoUploadDeps['storageRef'],
    uploadBytes: storage.uploadBytes as VideoUploadDeps['uploadBytes'],
    getDownloadURL: storage.getDownloadURL as VideoUploadDeps['getDownloadURL'],
  }
}

/**
 * Upload one video to Firebase Storage and return its download URL.
 * `deps` is injectable so tests can pass mocked storage; in the app the
 * real Firebase Storage functions are used. Throws an Error whose message
 * is already the user-facing message (see videoUploadErrorMessage).
 */
export async function uploadVideoFile(
  file: File,
  uid: string,
  deps?: VideoUploadDeps,
): Promise<string> {
  const d = deps ?? (await defaultDeps())
  const app = d.getFirebaseApp()
  if (!app || !uid) {
    throw new Error('Video upload needs login — please log in again.')
  }
  try {
    const storage = d.getStorage(app)
    const path = `uploads/${uid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const snap = await d.uploadBytes(d.storageRef(storage, path), file)
    return await d.getDownloadURL(snap.ref)
  } catch (err) {
    throw new Error(videoUploadErrorMessage(err))
  }
}
