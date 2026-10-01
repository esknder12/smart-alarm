import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Bridge to the native hardware-button lock of the Android app.
 *
 * Why this exists: the phone's physical volume rocker never reaches a web page - Android's WebView
 * hands it straight to the system - so JavaScript alone cannot disable it. The Android build
 * therefore ships a Capacitor plugin (android/app/src/main/java/com/esknder/niqu/AlarmLockPlugin.java)
 * and MainActivity swallows volume-down / volume-up / mute and Back while the lock is engaged.
 *
 * The lock is a *lease*: `engage()` arms it for `leaseMs` and must be called again before that
 * runs out (volumeLock.ts renews it every ~1.5 s while the alarm rings). If the renewals stop
 * - page reload, crash, a script error - the native side releases the buttons on its own.
 *
 * In a plain browser (dev server, PWA) the plugin does not exist: `isAvailable()` is false and
 * nothing here does anything.
 */

const PLUGIN_NAME = 'AlarmLock';

/** Keep in sync with `keyName()` in AlarmLockPlugin.java. */
export type HardwareKey = 'volumeDown' | 'volumeUp' | 'volumeMute' | 'back' | 'other';

export interface HardwareKeyBlockedEvent {
  keyCode: number;
  key: HardwareKey;
  /** Presses swallowed since this lock session started. */
  blockedPresses: number;
}

export interface AlarmLockNativeState {
  engaged: boolean;
  blockedPresses: number;
  leaseRemainingMs: number;
}

/** The surface of the native plugin; also the seam used by tests to stand in for a phone. */
export interface AlarmLockBackend {
  engage(options: { leaseMs: number }): Promise<AlarmLockNativeState>;
  release(): Promise<AlarmLockNativeState>;
  getState(): Promise<AlarmLockNativeState>;
  addListener(
    eventName: 'hardwareKeyBlocked',
    listener: (event: HardwareKeyBlockedEvent) => void
  ): Promise<PluginListenerHandle>;
}

// undefined = not resolved yet, null = no native lock on this platform.
let backend: AlarmLockBackend | null | undefined;

function getBackend(): AlarmLockBackend | null {
  if (backend === undefined) {
    // registerPlugin() must only run once per plugin name, hence the cache.
    backend =
      Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(PLUGIN_NAME)
        ? registerPlugin<AlarmLockBackend>(PLUGIN_NAME)
        : null;
  }
  return backend;
}

/**
 * Test seam: swap in a fake backend (or `null` to simulate a browser). Pass `undefined` to go
 * back to detecting the real platform.
 */
export function setAlarmLockBackend(next: AlarmLockBackend | null | undefined): void {
  backend = next;
}

export const nativeAlarmLock = {
  /** True only inside the Android app, where the hardware keys can really be blocked. */
  isAvailable(): boolean {
    return getBackend() !== null;
  },

  /** Arms the lock, or renews its lease if it is already engaged. */
  engage(leaseMs: number): Promise<AlarmLockNativeState> {
    const native = getBackend();
    if (!native) return Promise.reject(new Error('Native alarm lock is not available on this platform'));
    // The native side only accepts a whole number (PluginCall.getInt), so never send a fraction.
    return native.engage({ leaseMs: Math.round(leaseMs) });
  },

  /** Releases the lock immediately. */
  release(): Promise<AlarmLockNativeState> {
    const native = getBackend();
    if (!native) return Promise.reject(new Error('Native alarm lock is not available on this platform'));
    return native.release();
  },

  /**
   * Subscribes to swallowed button presses. Resolves with a function that unsubscribes.
   * Resolves with a no-op when there is no native lock.
   */
  async onKeyBlocked(listener: (event: HardwareKeyBlockedEvent) => void): Promise<() => void> {
    const native = getBackend();
    if (!native) return () => {};
    const handle = await native.addListener('hardwareKeyBlocked', listener);
    return () => {
      void Promise.resolve(handle.remove()).catch(() => {});
    };
  },
};
