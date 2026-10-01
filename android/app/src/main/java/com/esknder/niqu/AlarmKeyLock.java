package com.esknder.niqu;

import android.view.KeyEvent;

/**
 * State machine behind the ringing alarm's hardware-button lock.
 *
 * <p>While the lock is engaged, {@link MainActivity} swallows the volume keys (and Back) before
 * Android can act on them. The alarm therefore cannot be turned down, muted or dismissed with a
 * button - the only way out is the in-app puzzle, which ends with the web layer releasing the lock.
 *
 * <p><b>The lock is a lease, not a switch.</b> {@link #engage(long)} arms it for a short time and
 * the web layer keeps renewing it for as long as the alarm rings. If the renewals stop for any
 * reason (page reload, WebView crash, a JavaScript error that skips the release) the lease simply
 * lapses and the buttons come back by themselves. A stuck lock that leaves the phone's buttons dead
 * is therefore impossible by construction.
 *
 * <p>This class deliberately makes no Android framework calls - it only reads compile-time
 * key-code constants - so it can be unit-tested on the plain JVM (see {@code AlarmKeyLockTest}).
 * All methods are thread-safe: the web layer calls in from the Capacitor plugin thread while key
 * events arrive on the main thread. Listeners are always invoked outside the internal monitor.
 */
final class AlarmKeyLock {

    /** Monotonic millisecond clock ({@code SystemClock.elapsedRealtime} on a device). */
    interface Clock {
        long now();
    }

    /** Told whenever the lock flips between engaged and released (including lease expiry). */
    interface StateListener {
        void onLockChanged(boolean engaged);
    }

    /** Told about every swallowed button press (not key-repeat or key-up events). */
    interface KeyListener {
        void onKeyBlocked(int keyCode, int blockedPresses);
    }

    static final long MIN_LEASE_MS = 2_000L;
    static final long DEFAULT_LEASE_MS = 8_000L;
    static final long MAX_LEASE_MS = 60_000L;

    private final Clock clock;

    private StateListener stateListener; // guarded by this
    private KeyListener keyListener; // guarded by this
    private boolean engaged; // guarded by this
    private long leaseEndsAt; // guarded by this
    private int blockedPresses; // guarded by this

    AlarmKeyLock(Clock clock) {
        this.clock = clock;
    }

    /** The keys that would silence the alarm, or open the volume panel with its slider. */
    static boolean isVolumeKey(int keyCode) {
        return (
            keyCode == KeyEvent.KEYCODE_VOLUME_DOWN ||
            keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
            keyCode == KeyEvent.KEYCODE_VOLUME_MUTE
        );
    }

    synchronized void setStateListener(StateListener listener) {
        this.stateListener = listener;
    }

    synchronized void setKeyListener(KeyListener listener) {
        this.keyListener = listener;
    }

    /**
     * Arms the lock for {@code requestedLeaseMs} (clamped to the allowed range) from now. Calling
     * it again while engaged renews the lease and is how the web layer keeps the lock alive.
     */
    void engage(long requestedLeaseMs) {
        long lease = Math.max(MIN_LEASE_MS, Math.min(MAX_LEASE_MS, requestedLeaseMs));
        boolean expired;
        boolean changed;
        StateListener listener;
        synchronized (this) {
            long now = clock.now();
            expired = expireLocked(now);
            changed = !engaged;
            if (changed) {
                blockedPresses = 0;
            }
            engaged = true;
            leaseEndsAt = now + lease;
            listener = stateListener;
        }
        if (listener != null) {
            if (expired) {
                listener.onLockChanged(false);
            }
            if (changed) {
                listener.onLockChanged(true);
            }
        }
    }

    /** Releases the lock immediately. Safe to call when it is not engaged. */
    void release() {
        boolean wasEngaged;
        StateListener listener;
        synchronized (this) {
            wasEngaged = engaged;
            engaged = false;
            leaseEndsAt = 0L;
            listener = stateListener;
        }
        if (wasEngaged && listener != null) {
            listener.onLockChanged(false);
        }
    }

    /** True while the lease is live. Also what turns an elapsed lease into a release. */
    boolean isEngaged() {
        boolean expired;
        boolean result;
        StateListener listener;
        synchronized (this) {
            expired = expireLocked(clock.now());
            result = engaged;
            listener = stateListener;
        }
        if (expired && listener != null) {
            listener.onLockChanged(false);
        }
        return result;
    }

    /**
     * Decides what to do with a raw key event.
     *
     * @return true when the event must be consumed (the caller must not pass it on to the system).
     */
    boolean handleKey(int keyCode, int action, int repeatCount) {
        if (!isVolumeKey(keyCode)) {
            return false;
        }
        boolean isFreshPress = action == KeyEvent.ACTION_DOWN && repeatCount == 0;
        return consumeIfEngaged(keyCode, isFreshPress);
    }

    /**
     * Decides what to do with a Back press.
     *
     * @return true when Back must be swallowed instead of leaving the alarm screen.
     */
    boolean handleBack() {
        return consumeIfEngaged(KeyEvent.KEYCODE_BACK, true);
    }

    synchronized int getBlockedPresses() {
        return blockedPresses;
    }

    /** Milliseconds until the lease lapses; 0 when the lock is not engaged. */
    synchronized long getLeaseRemainingMs() {
        return engaged ? Math.max(0L, leaseEndsAt - clock.now()) : 0L;
    }

    private boolean consumeIfEngaged(int keyCode, boolean countsAsPress) {
        boolean expired;
        boolean consume;
        boolean counted = false;
        int presses = 0;
        StateListener stateCallback;
        KeyListener keyCallback;
        synchronized (this) {
            expired = expireLocked(clock.now());
            consume = engaged;
            if (consume && countsAsPress) {
                blockedPresses++;
                presses = blockedPresses;
                counted = true;
            }
            stateCallback = stateListener;
            keyCallback = keyListener;
        }
        if (expired && stateCallback != null) {
            stateCallback.onLockChanged(false);
        }
        if (counted && keyCallback != null) {
            keyCallback.onKeyBlocked(keyCode, presses);
        }
        return consume;
    }

    /** Must be called with the monitor held. @return true if the lease just ran out. */
    private boolean expireLocked(long now) {
        if (engaged && now >= leaseEndsAt) {
            engaged = false;
            leaseEndsAt = 0L;
            return true;
        }
        return false;
    }
}
