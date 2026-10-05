package com.esknder.niqu;

import android.view.KeyEvent;

/**
 * State machine behind the ringing alarm's hardware-button lock.
 *
 * <p>While the lock is engaged, {@link MainActivity} swallows the volume keys (and Back) before
 * Android can act on them. The alarm therefore cannot be turned down, muted or dismissed with a
 * button - the only way out is the in-app puzzle, which ends with the web layer releasing the lock.
 *
 * <p><b>The lock has two reasons to be held.</b>
 * <ol>
 *   <li>A <b>lease</b> ({@link #engage(long)}): the web layer arms it for a short time and keeps
 *       renewing it while the alarm rings. If the renewals stop - page reload, WebView crash, a
 *       JavaScript error that skips the release - the lease simply lapses and the buttons come
 *       back by themselves. A stuck lock that leaves the phone's buttons dead is therefore
 *       impossible by construction.</li>
 *   <li>A <b>ringing session</b> ({@link RingSource}): since Phase 2 the alarm is owned by
 *       {@code AlarmRingService}, which rings whether or not the WebView is alive. While that
 *       service is ringing, the keys stay swallowed even if the page never engaged the lease -
 *       "tie the volume-key block to the service". The web lease still runs on top of it, so the
 *       page's own state (pending / locked / failed) keeps meaning what it did before.</li>
 * </ol>
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

    /**
     * Something outside the web layer - in practice {@link RingSession}, fed by
     * {@code AlarmRingService} - that knows an alarm is ringing right now.
     */
    interface RingSource {
        /** Must be cheap and non-blocking: it is called from the key-event path. */
        boolean isAlarmRinging();
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

    /** Pending listener notifications, emitted in this order. */
    private static final int EV_NONE = 0;
    private static final int EV_RELEASED = 1;
    private static final int EV_LOCKED = 2;

    private final Clock clock;

    private StateListener stateListener; // guarded by this
    private KeyListener keyListener; // guarded by this
    private RingSource ringSource; // guarded by this
    private boolean engaged; // guarded by this - the web layer's lease
    private boolean ringActive; // guarded by this - the service's ringing session
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
     * Attaches the source of truth for "an alarm is ringing natively". Passing null (or a source
     * that reports false) restores the Phase 1 behaviour, where only the web lease holds the lock.
     */
    void setRingSource(RingSource source) {
        int events;
        StateListener listener;
        synchronized (this) {
            this.ringSource = source;
            events = advanceLocked(clock.now());
            listener = stateListener;
        }
        emit(listener, events);
    }

    /**
     * Arms the lease for {@code requestedLeaseMs} (clamped to the allowed range) from now. Calling
     * it again while engaged renews the lease and is how the web layer keeps the lock alive.
     */
    void engage(long requestedLeaseMs) {
        long lease = Math.max(MIN_LEASE_MS, Math.min(MAX_LEASE_MS, requestedLeaseMs));
        int events;
        StateListener listener;
        synchronized (this) {
            long now = clock.now();
            events = advanceLocked(now);
            boolean wasLive = lockedLocked();
            if (!engaged) {
                blockedPresses = 0;
            }
            engaged = true;
            leaseEndsAt = now + lease;
            if (!wasLive && lockedLocked()) {
                events |= EV_LOCKED;
            }
            listener = stateListener;
        }
        emit(listener, events);
    }

    /** Releases the lease immediately. Safe to call when it is not engaged. */
    void release() {
        int events;
        StateListener listener;
        synchronized (this) {
            events = advanceLocked(clock.now());
            boolean wasLive = lockedLocked();
            engaged = false;
            leaseEndsAt = 0L;
            if (wasLive && !lockedLocked()) {
                events |= EV_RELEASED;
            }
            listener = stateListener;
        }
        emit(listener, events);
    }

    /**
     * True while either reason holds the lock. Also what turns an elapsed lease - and a service
     * that has stopped ringing - into a release.
     */
    boolean isEngaged() {
        int events;
        boolean result;
        StateListener listener;
        synchronized (this) {
            events = advanceLocked(clock.now());
            result = lockedLocked();
            listener = stateListener;
        }
        emit(listener, events);
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

    /** Milliseconds until the lease lapses; 0 when no lease is held. */
    synchronized long getLeaseRemainingMs() {
        return engaged ? Math.max(0L, leaseEndsAt - clock.now()) : 0L;
    }

    /** True while the ringing service (rather than the web lease) is holding the lock. */
    synchronized boolean isRingLockActive() {
        return ringActive;
    }

    private boolean consumeIfEngaged(int keyCode, boolean countsAsPress) {
        int events;
        boolean consume;
        boolean counted = false;
        int presses = 0;
        StateListener stateCallback;
        KeyListener keyCallback;
        synchronized (this) {
            events = advanceLocked(clock.now());
            consume = lockedLocked();
            if (consume && countsAsPress) {
                blockedPresses++;
                presses = blockedPresses;
                counted = true;
            }
            stateCallback = stateListener;
            keyCallback = keyListener;
        }
        emit(stateCallback, events);
        if (counted && keyCallback != null) {
            keyCallback.onKeyBlocked(keyCode, presses);
        }
        return consume;
    }

    /** Must be called with the monitor held. */
    private boolean lockedLocked() {
        return engaged || ringActive;
    }

    /**
     * Applies lease expiry and re-reads the ring source, in one place, for every entry point.
     *
     * <p>Must be called with the monitor held.
     *
     * @return the listener events this state change owes, as an {@code EV_*} bit mask.
     */
    private int advanceLocked(long now) {
        int events = EV_NONE;
        // Read the ring source first: if the alarm started ringing and the web lease ran out in the
        // very same call, the keys must stay locked and no release may be reported.
        RingSource source = ringSource;
        boolean ringsNow = source != null && source.isAlarmRinging();
        if (ringsNow != ringActive) {
            ringActive = ringsNow;
            if (ringsNow) {
                blockedPresses = 0; // a new alarm, a fresh count
            }
        }
        boolean wasLive = lockedLocked();
        if (expireLocked(now) && !lockedLocked()) {
            events |= EV_RELEASED;
        }
        boolean isLive = lockedLocked();
        if (isLive && !wasLive) {
            events |= EV_LOCKED;
        } else if (!isLive && wasLive) {
            events |= EV_RELEASED;
        }
        return events;
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

    private static void emit(StateListener listener, int events) {
        if (listener == null || events == EV_NONE) return;
        if ((events & EV_RELEASED) != 0) listener.onLockChanged(false);
        if ((events & EV_LOCKED) != 0) listener.onLockChanged(true);
    }
}
