package com.esknder.niqu;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.view.KeyEvent;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Before;
import org.junit.Test;

/**
 * Plain-JVM tests for the Phase 2 half of the hardware-button lock: an alarm ringing in the
 * foreground service ({@code AlarmRingService} through {@link RingSession}) keeps the volume keys
 * and Back swallowed even when the web layer never engaged its lease.
 *
 * <p>This is the "tie the volume-key block to the service" requirement. The Phase 1 lease tests live
 * in {@code AlarmKeyLockTest} and are unchanged.
 */
public class AlarmKeyLockRingSourceTest {

    private long now;
    private AlarmKeyLock lock;
    private final AtomicBoolean serviceRinging = new AtomicBoolean(false);
    private final List<Boolean> stateChanges = new ArrayList<>();
    private final List<Integer> blockedKeys = new ArrayList<>();

    @Before
    public void setUp() {
        now = 50_000L;
        lock = new AlarmKeyLock(() -> now);
        lock.setRingSource(serviceRinging::get);
        lock.setStateListener(engaged -> stateChanges.add(engaged));
        lock.setKeyListener((keyCode, presses) -> blockedKeys.add(keyCode));
    }

    private boolean press(int keyCode) {
        return lock.handleKey(keyCode, KeyEvent.ACTION_DOWN, 0);
    }

    private void startServiceRing() {
        serviceRinging.set(true);
    }

    private void stopServiceRing() {
        serviceRinging.set(false);
    }

    // ------------------------------------------------------------------------ the service holds it

    @Test
    public void keysAreSwallowedWhileTheServiceRingsWithoutAnyLease() {
        startServiceRing();

        assertTrue("volume down", press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertTrue("volume up", press(KeyEvent.KEYCODE_VOLUME_UP));
        assertTrue("mute", press(KeyEvent.KEYCODE_VOLUME_MUTE));
        assertTrue("back", lock.handleBack());
        assertTrue("key up too", lock.handleKey(KeyEvent.KEYCODE_VOLUME_DOWN, KeyEvent.ACTION_UP, 0));

        assertEquals(Arrays.asList(
            KeyEvent.KEYCODE_VOLUME_DOWN,
            KeyEvent.KEYCODE_VOLUME_UP,
            KeyEvent.KEYCODE_VOLUME_MUTE,
            KeyEvent.KEYCODE_BACK
        ), blockedKeys);
        assertEquals("one engage notification for the ring", Arrays.asList(true), stateChanges);
        assertTrue(lock.isRingLockActive());
    }

    @Test
    public void theLockReportsItselfEngagedForTheWholeRing() {
        startServiceRing();

        assertTrue(lock.isEngaged());

        now += 10 * 60_000L; // no lease involved, so time alone can never unlock it

        assertTrue(lock.isEngaged());
        assertTrue(press(KeyEvent.KEYCODE_VOLUME_DOWN));
    }

    @Test
    public void keysWorkAgainTheMomentTheRingStops() {
        startServiceRing();
        assertTrue(press(KeyEvent.KEYCODE_VOLUME_DOWN));

        stopServiceRing();

        assertFalse("volume down", press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertFalse("back", lock.handleBack());
        assertFalse(lock.isEngaged());
        assertEquals(Arrays.asList(true, false), stateChanges);
        assertEquals("only the press while ringing was counted", 1, lock.getBlockedPresses());
    }

    @Test
    public void unrelatedKeysStayUntouchedWhileTheServiceRings() {
        startServiceRing();

        assertFalse(press(KeyEvent.KEYCODE_A));
        assertFalse(press(KeyEvent.KEYCODE_POWER));
        assertFalse(press(KeyEvent.KEYCODE_HOME));

        assertTrue("nothing swallowed", blockedKeys.isEmpty());
    }

    @Test
    public void ringStartBeginsAFreshCount() {
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);
        press(KeyEvent.KEYCODE_VOLUME_DOWN);
        assertEquals(1, lock.getBlockedPresses());

        startServiceRing();
        assertTrue(lock.isEngaged()); // reading the state is what applies the change

        assertEquals(0, lock.getBlockedPresses());
        assertTrue(press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertEquals(1, lock.getBlockedPresses());
    }

    // --------------------------------------------------------------- interplay with the web lease

    @Test
    public void aLeaseLapseCannotUnlockARingingAlarm() {
        lock.engage(2_000L);
        startServiceRing();
        assertEquals(Arrays.asList(true), stateChanges);

        now += 5_000L; // the lease is long gone; the service is still ringing

        assertTrue("keys stay swallowed", press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertTrue(lock.isEngaged());
        assertEquals("no release may be reported while the service rings", Arrays.asList(true), stateChanges);
        assertEquals(0L, lock.getLeaseRemainingMs());
    }

    @Test
    public void releasingTheLeaseCannotUnlockARingingAlarm() {
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);
        startServiceRing();

        lock.release();

        assertTrue(lock.isEngaged());
        assertTrue(press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertEquals("still locked, so no state flip", Arrays.asList(true), stateChanges);
    }

    @Test
    public void theWebLeaseReleasesCleanlyOnceTheRingHasStopped() {
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);
        startServiceRing();
        stopServiceRing();

        assertTrue("the lease is still holding the lock", lock.isEngaged());
        assertTrue(press(KeyEvent.KEYCODE_VOLUME_DOWN));

        lock.release();

        assertFalse(lock.isEngaged());
        assertFalse(press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertEquals(Arrays.asList(true, false), stateChanges);
    }

    @Test
    public void aRingStartingWhileLeasedDoesNotFlipTheStateTwice() {
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);

        startServiceRing();

        assertEquals(Arrays.asList(true), stateChanges);
        assertTrue(press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertEquals(Arrays.asList(true), stateChanges);
    }

    @Test
    public void heartbeatRenewalsStillWorkWhileTheServiceRings() {
        startServiceRing();
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);

        now += 1_500L;
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS); // the web layer's heartbeat

        assertTrue(lock.isEngaged());
        assertEquals(AlarmKeyLock.DEFAULT_LEASE_MS - 1_500L, lock.getLeaseRemainingMs());
        assertEquals(Arrays.asList(true), stateChanges);
    }

    // ------------------------------------------------------------------------------- detaching

    @Test
    public void removingTheRingSourceRestoresThePhaseOneBehaviour() {
        startServiceRing();
        assertTrue(press(KeyEvent.KEYCODE_VOLUME_DOWN));

        lock.setRingSource(null);

        assertFalse(lock.isEngaged());
        assertFalse(press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertEquals(Arrays.asList(true, false), stateChanges);
    }

    @Test
    public void aSourceThatReportsFalseChangesNothing() {
        assertFalse(lock.isEngaged());
        assertFalse(press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertTrue("no state changes at all", stateChanges.isEmpty());
    }
}
