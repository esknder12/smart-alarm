package com.esknder.niqu;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.util.Collections;
import org.junit.Before;
import org.junit.Test;

/**
 * Plain-JVM tests for the process-wide "what is ringing now" state that ties the ringing service to
 * the hardware-button lock. The clock is a plain field, so ring duration is tested without sleeping.
 */
public class RingSessionTest {

    private long now;
    private RingSession session;
    private int notifications;

    private static AlarmSchedule alarm(String id) {
        return AlarmSchedule.fromDayList(id, 6, 30, Collections.emptyList(), "Wake up", "sunrise", 80, false, "math", "easy", true);
    }

    @Before
    public void setUp() {
        now = 1_000_000L;
        session = new RingSession(() -> now);
        notifications = 0;
        session.addListener(() -> notifications++);
    }

    @Test
    public void startsIdle() {
        assertFalse(session.isRinging());
        assertFalse(session.isAlarmRinging());
        assertNull(session.alarm());
        assertEquals(0L, session.ringingSeconds());
        assertEquals(0, notifications);
    }

    @Test
    public void startingPublishesTheAlarmAndNotifies() {
        AlarmSchedule alarm = alarm("a1");

        session.start(alarm, now);

        assertTrue(session.isRinging());
        assertTrue("the lock asks this on the key-event path", session.isAlarmRinging());
        assertSame(alarm, session.alarm());
        assertEquals(now, session.snapshot().startedAtMillis);
        assertEquals(1, notifications);
    }

    @Test
    public void restartingTheSameAlarmIsIgnored() {
        // The service can be re-delivered its start intent; the ring must not restart (timers,
        // escalation and the notification all hang off the first start).
        AlarmSchedule alarm = alarm("a1");
        session.start(alarm, now);
        now += 5_000L;

        session.start(alarm, now);

        assertEquals("startedAt must not be pushed back", 1_000_000L, session.snapshot().startedAtMillis);
        assertEquals(1, notifications);
    }

    @Test
    public void aDifferentAlarmReplacesTheRunningOne() {
        session.start(alarm("a1"), now);

        AlarmSchedule second = alarm("a2");
        session.start(second, now);

        assertSame(second, session.alarm());
        assertEquals(2, notifications);
    }

    @Test
    public void stoppingClearsEverythingAndNotifiesOnce() {
        session.start(alarm("a1"), now);
        now += 3_000L;

        session.stop();
        session.stop();

        assertFalse(session.isRinging());
        assertNull(session.alarm());
        assertEquals(0L, session.ringingSeconds());
        assertEquals(2, notifications); // one start, one stop
    }

    @Test
    public void ringingSecondsFollowsTheClock() {
        session.start(alarm("a1"), 1_000_000L);

        now = 1_000_000L + 42_500L;

        assertEquals(42L, session.ringingSeconds());
        assertEquals(42L, session.snapshot().ringingSeconds(now));
    }

    @Test
    public void startingWithoutAnAlarmDoesNothing() {
        session.start(null, now);

        assertFalse(session.isRinging());
        assertEquals(0, notifications);
    }

    @Test
    public void aFailingListenerCannotBreakTheRing() {
        session.addListener(() -> {
            throw new IllegalStateException("listener blew up");
        });
        int[] reached = { 0 };
        session.addListener(() -> reached[0]++);

        session.start(alarm("a1"), now);

        assertEquals("the listener after the failing one still runs", 1, reached[0]);
        assertTrue(session.isRinging());
    }

    @Test
    public void listenersCanBeRemoved() {
        RingSession.Listener listener = () -> notifications += 100;
        session.addListener(listener);
        session.removeListener(listener);

        session.start(alarm("a1"), now);

        assertEquals(1, notifications);
    }

    @Test
    public void theSharedSessionIsASingletonAndARingSource() {
        assertSame(RingSession.shared(), RingSession.shared());
        AlarmKeyLock.RingSource asSource = RingSession.shared();
        assertNotNull(asSource);
        // Never leave the process-wide session ringing for other tests.
        RingSession.shared().stop();
        assertFalse(asSource.isAlarmRinging());
    }
}
