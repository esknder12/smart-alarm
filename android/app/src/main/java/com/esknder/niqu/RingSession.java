package com.esknder.niqu;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * The alarm that is ringing <em>right now</em>, as far as the whole app process is concerned.
 *
 * <p>Phase 1's button lock was a lease driven by the web layer: if the page was not running, there
 * was nothing to block the volume keys. Phase 2 rings from a foreground service that exists whether
 * or not the WebView does, so the service - not the page - decides when an alarm is ringing, and
 * {@link AlarmKeyLock} asks this object (see {@link AlarmKeyLock.RingSource}) instead of only
 * trusting the JavaScript lease.
 *
 * <p>State is published as one immutable {@link Snapshot} held in a {@code volatile} field, so
 * {@link #isAlarmRinging()} is a single lock-free read: it is called from the activity's key-event
 * path and must never be able to block behind a slow listener.
 *
 * <p>Listeners are always notified <em>after</em> the snapshot is published and outside any lock.
 */
final class RingSession implements AlarmKeyLock.RingSource {

    /** Told when the ringing alarm starts, changes or stops (any thread). */
    interface Listener {
        void onRingSessionChanged();
    }

    /** Immutable view of the current session, safe to hand to other threads and to the web layer. */
    static final class Snapshot {

        static final Snapshot IDLE = new Snapshot(false, null, 0L);

        final boolean ringing;
        final AlarmSchedule alarm;
        final long startedAtMillis;

        Snapshot(boolean ringing, AlarmSchedule alarm, long startedAtMillis) {
            this.ringing = ringing;
            this.alarm = alarm;
            this.startedAtMillis = startedAtMillis;
        }

        long ringingSeconds(long nowMillis) {
            if (!ringing) return 0L;
            return Math.max(0L, (nowMillis - startedAtMillis) / 1000L);
        }
    }

    private static final RingSession SHARED = new RingSession(System::currentTimeMillis);

    /** The process-wide session (the service and the activity share one process). */
    static RingSession shared() {
        return SHARED;
    }

    private final AlarmKeyLock.Clock clock;
    private final List<Listener> listeners = new CopyOnWriteArrayList<>();
    private volatile Snapshot current = Snapshot.IDLE;

    /** Test seam: see {@code RingSessionTest}, which uses its own instance and a fake clock. */
    RingSession(AlarmKeyLock.Clock clock) {
        this.clock = clock;
    }

    // ------------------------------------------------------------------ AlarmKeyLock.RingSource

    /** Lock-free: this is called while the alarm lock is deciding whether to swallow a key. */
    @Override
    public boolean isAlarmRinging() {
        return current.ringing;
    }

    // ------------------------------------------------------------------------------- the state

    boolean isRinging() {
        return current.ringing;
    }

    AlarmSchedule alarm() {
        return current.alarm;
    }

    Snapshot snapshot() {
        return current;
    }

    long ringingSeconds() {
        return current.ringingSeconds(clock.now());
    }

    /** Starts (or restarts, when a different alarm fires) a ringing session. */
    void start(AlarmSchedule alarm, long startedAtMillis) {
        if (alarm == null) return;
        Snapshot previous = current;
        if (previous.ringing && alarm.isSameAs(previous.alarm)) return; // already ringing this one
        long startedAt = startedAtMillis > 0 ? startedAtMillis : clock.now();
        current = new Snapshot(true, alarm, startedAt);
        notifyListeners();
    }

    /** Ends the session. Harmless when nothing is ringing. */
    void stop() {
        if (!current.ringing) return;
        current = Snapshot.IDLE;
        notifyListeners();
    }

    void addListener(Listener listener) {
        if (listener != null) listeners.add(listener);
    }

    void removeListener(Listener listener) {
        listeners.remove(listener);
    }

    private void notifyListeners() {
        for (Listener listener : listeners) {
            try {
                listener.onRingSessionChanged();
            } catch (RuntimeException ignored) {
                // A misbehaving listener must never break the ringing alarm.
            }
        }
    }
}
