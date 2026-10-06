import { CustomSound } from '../types';

const DB_NAME = 'wakeup_custom_sounds_db';
const DB_VERSION = 1;
const STORE_NAME = 'sounds';
const LOCAL_STORAGE_KEY = 'wakeup_custom_sounds_fallback';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function getFallbackSounds(): CustomSound[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFallbackSounds(sounds: CustomSound[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sounds));
  } catch {
    // quota exceeded or storage blocked
  }
}

const cachedSoundsMap = new Map<string, CustomSound>();
let cacheInitialized = false;

export function getCachedCustomSound(id: string): CustomSound | undefined {
  return cachedSoundsMap.get(id);
}

export function getCachedCustomSounds(): CustomSound[] {
  return Array.from(cachedSoundsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}

function updateCache(sounds: CustomSound[]) {
  cachedSoundsMap.clear();
  sounds.forEach((s) => cachedSoundsMap.set(s.id, s));
  cacheInitialized = true;
}

export async function getCustomSounds(): Promise<CustomSound[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result || []) as CustomSound[];
        results.sort((a, b) => b.createdAt - a.createdAt);
        updateCache(results);
        resolve(results);
      };
      req.onerror = () => {
        const fallback = getFallbackSounds();
        updateCache(fallback);
        resolve(fallback);
      };
    });
  } catch {
    const fallback = getFallbackSounds();
    updateCache(fallback);
    return fallback;
  }
}

export async function getCustomSoundById(id: string): Promise<CustomSound | undefined> {
  if (cachedSoundsMap.has(id)) {
    return cachedSoundsMap.get(id);
  }
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const sound = req.result as CustomSound | undefined;
        if (sound) cachedSoundsMap.set(sound.id, sound);
        resolve(sound);
      };
      req.onerror = () => {
        const fallback = getFallbackSounds().find((s) => s.id === id);
        if (fallback) cachedSoundsMap.set(fallback.id, fallback);
        resolve(fallback);
      };
    });
  } catch {
    const fallback = getFallbackSounds().find((s) => s.id === id);
    if (fallback) cachedSoundsMap.set(fallback.id, fallback);
    return fallback;
  }
}

export async function saveCustomSoundFromBlob(blob: Blob, name: string): Promise<CustomSound> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const duration = await new Promise<number | undefined>((resolve) => {
    try {
      const audio = new Audio();
      audio.onloadedmetadata = () => resolve(Math.round(audio.duration));
      audio.onerror = () => resolve(undefined);
      audio.src = dataUrl;
    } catch {
      resolve(undefined);
    }
  });

  const newSound: CustomSound = {
    id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim() || 'Recorded Audio',
    dataUrl,
    duration,
    size: blob.size,
    createdAt: Date.now(),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(newSound);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const fallback = getFallbackSounds();
    fallback.unshift(newSound);
    saveFallbackSounds(fallback);
  }

  cachedSoundsMap.set(newSound.id, newSound);
  return newSound;
}

export async function saveCustomSoundFile(file: File): Promise<CustomSound> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  // Calculate audio duration if possible
  const duration = await new Promise<number | undefined>((resolve) => {
    try {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        resolve(Math.round(audio.duration));
      };
      audio.onerror = () => resolve(undefined);
      audio.src = dataUrl;
    } catch {
      resolve(undefined);
    }
  });

  const baseName = file.name.replace(/\.[^/.]+$/, '').trim() || 'Custom Ringtone';
  const newSound: CustomSound = {
    id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: baseName,
    dataUrl,
    duration,
    size: file.size,
    createdAt: Date.now(),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(newSound);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const fallback = getFallbackSounds();
    fallback.unshift(newSound);
    saveFallbackSounds(fallback);
  }

  cachedSoundsMap.set(newSound.id, newSound);
  return newSound;
}

export async function deleteCustomSound(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const fallback = getFallbackSounds().filter((s) => s.id !== id);
    saveFallbackSounds(fallback);
  }
  cachedSoundsMap.delete(id);
}

/** Helper to generate a genuine standard PCM WAV Data URL */
export function generateWavDataUrl(
  generateSample: (time: number, index: number) => number,
  durationSec = 2.5,
  sampleRate = 22050
): string {
  const numSamples = Math.floor(durationSec * sampleRate);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // PCM 16-bit Samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.max(-1, Math.min(1, generateSample(t, i)));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

// Automatically load custom sounds into memory on startup
if (typeof window !== 'undefined') {
  void getCustomSounds();
}
