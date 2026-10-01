package com.esknder.niqu;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.view.KeyEvent;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.Before;
import org.junit.Test;

/**
 * Plain-JVM tests for the hardware-button lock: no emulator, no Android runtime. The clock is a
 * plain field, so lease expiry is tested without sleeping.
 */
public class AlarmKeyLockTest {

    private static final int[] VOLUME_KEYS = {
        KeyEvent.KEYCODE_VOLUME_DOWN,
        KeyEvent.KEYCODE_VOLUME_UP,
        KeyEvent.KEYCODE_VOLUME_MUTE,
    };

    private long now;
    private AlarmKeyLock lock;
    private final List<Boolean> stateChanges = new ArrayList<>();
    private final List<Integer> blockedKeys = new ArrayList<>();
    private final List<Integer> blockedCounts = new ArrayList<>();

    @Before
    public void setUp() {
        now = 10_000L;
        lock = new AlarmKeyLock(() -> now);
        lock.setStateListener(engaged -> stateChanges.add(engaged));
        lock.setKeyListener(
            (keyCode, presses) -> {
                blockedKeys.add(keyCode);
                blockedCounts.add(presses);
            }
        );
    }

    private boolean press(int keyCode) {
        return lock.handleKey(keyCode, KeyEvent.ACTION_DOWN, 0);
    }

    private boolean releaseKey(int keyCode) {
        return lock.handleKey(keyCode, KeyEvent.ACTION_UP, 0);
    }

    // ------------------------------------------------------------------ the point of it all

    @Test
    public void volumeDownIsSwallowedWhileTheAlarmRings() {
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);

        assertTrue("key down must be consumed", press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertTrue("key up must be consumed too", releaseKey(KeyEvent.KEYCODE_VOLUME_DOWN));
    }

    @Test
    public void volumeUpAndMuteAreSwallowedToo() {
        // Volume up would open the system volume panel, whose slider can lower the alarm.
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);

        for (int key : VOLUME_KEYS) {
            assertTrue("down " + key, press(key));
            assertTrue("up " + key, releaseKey(key));
        }
    }

    @Test
    public void keysPassThroughWhenNoAlarmIsRinging() {
        for (int key : VOLUME_KEYS) {
            assertFalse("down " + key, press(key));
            assertFalse("up " + key, releaseKey(key));
        }
        assertTrue("nothing counted", blockedKeys.isEmpty());
    }

    @Test
    public void unrelatedKeysAreNeverSwallowed() {
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);

        int[] others = {
            KeyEvent.KEYCODE_A,
            KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_DEL,
            KeyEvent.KEYCODE_0,
            KeyEvent.KEYCODE_HOME,
            KeyEvent.KEYCODE_POWER,
            // Back has its own path (handleBack) because it is not delivered as a key event.
            KeyEvent.KEYCODE_BACK,
        };
        for (int key : others) {
            assertFalse("key " + key, press(key));
        }
        assertTrue("typing the puzzle answer must keep working", blockedKeys.isEmpty());
    }

    @Test
    public void backIsSwallowedOnlyWhileTheAlarmRings() {
        assertFalse("not engaged yet", lock.handleBack());

        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);
        assertTrue("engaged", lock.handleBack());

        lock.release();
        assertFalse("released", lock.handleBack());
    }

    // ------------------------------------------------------------------------ counting

    @Test
    public void onlyTheFirstDownOfAPressIsCounted() {
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);

        assertTrue(lock.handleKey(KeyEvent.KEYCODE_VOLUME_DOWN, KeyEvent.ACTION_DOWN, 0));
        // Holding the key auto-repeats; every repeat is still swallowed but is not a new attempt.
        for (int repeat = 1; repeat <= 5; repeat++) {
            assertTrue(lock.handleKey(KeyEvent.KEYCODE_VOLUME_DOWN, KeyEvent.ACTION_DOWN, repeat));
        }
        assertTrue(lock.handleKey(KeyEvent.KEYCODE_VOLUME_DOWN, KeyEvent.ACTION_UP, 0));

        assertEquals(1, lock.getBlockedPresses());
        assertEquals(Arrays.asList(KeyEvent.KEYCODE_VOLUME_DOWN), blockedKeys);

        assertTrue(press(KeyEvent.KEYCODE_VOLUME_UP));
        assertTrue(lock.handleBack());
        assertEquals(3, lock.getBlockedPresses());
        assertEquals(
            Arrays.asList(KeyEvent.KEYCODE_VOLUME_DOWN, KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_BACK),
            blockedKeys
        );
        assertEquals(Arrays.asList(1, 2, 3), blockedCounts);
    }

    @Test
    public void aNewAlarmStartsWithAFreshCounter() {
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);
        press(KeyEvent.KEYCODE_VOLUME_DOWN);
        press(KeyEvent.KEYCODE_VOLUME_DOWN);
        assertEquals(2, lock.getBlockedPresses());

        lock.release();
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);

        assertEquals(0, lock.getBlockedPresses());
    }

    // ------------------------------------------------------------------ release & the lease

    @Test
    public void releaseGivesTheButtonsBackImmediately() {
        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);
        assertTrue(press(KeyEvent.KEYCODE_VOLUME_DOWN));

        lock.release();

        assertFalse(lock.isEngaged());
        assertFalse(press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertEquals(Arrays.asList(true, false), stateChanges);
    }

    @Test
    public void releaseWhenNotEngagedIsHarmless() {
        lock.release();
        lock.release();

        assertFalse(lock.isEngaged());
        assertTrue("no spurious state change", stateChanges.isEmpty());
    }

    @Test
    public void theLockLapsesByItselfIfTheWebLayerStopsRenewingIt() {
        lock.engage(5_000L);

        now += 4_999L;
        assertTrue("one millisecond before expiry", press(KeyEvent.KEYCODE_VOLUME_DOWN));

        now += 1L;
        assertFalse("lease lapsed: the buttons must work again", press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertFalse(lock.isEngaged());
        assertEquals("exactly one release notification", Arrays.asList(true, false), stateChanges);
    }

    @Test
    public void expiryIsReportedEvenIfNoKeyIsEverPressed() {
        lock.engage(5_000L);
        now += 6_000L;

        assertFalse(lock.isEngaged());
        assertFalse("polling again must not re-notify", lock.isEngaged());
        assertEquals(Arrays.asList(true, false), stateChanges);
    }

    @Test
    public void renewingExtendsTheLeaseAndDoesNotRetriggerTheLock() {
        lock.engage(5_000L);
        now += 4_000L;
        lock.engage(5_000L); // heartbeat from the web layer
        now += 4_000L; // 8 s after the first engage, 4 s after the renewal

        assertTrue("renewed lease is still live", press(KeyEvent.KEYCODE_VOLUME_DOWN));
        assertEquals("renewals are not state changes", Arrays.asList(true), stateChanges);
        assertEquals("a renewal must not reset the counter", 1, lock.getBlockedPresses());
        assertEquals(1_000L, lock.getLeaseRemainingMs());
    }

    @Test
    public void reEngagingAfterALapseNotifiesAgain() {
        lock.engage(2_000L);
        now += 5_000L;

        lock.engage(2_000L);

        assertTrue(lock.isEngaged());
        assertEquals(Arrays.asList(true, false, true), stateChanges);
    }

    @Test
    public void leaseIsClampedToTheAllowedRange() {
        lock.engage(1L);
        assertEquals(AlarmKeyLock.MIN_LEASE_MS, lock.getLeaseRemainingMs());

        lock.engage(-500L);
        assertEquals(AlarmKeyLock.MIN_LEASE_MS, lock.getLeaseRemainingMs());

        lock.engage(10L * 60L * 1000L);
        assertEquals(AlarmKeyLock.MAX_LEASE_MS, lock.getLeaseRemainingMs());

        lock.engage(AlarmKeyLock.DEFAULT_LEASE_MS);
        assertEquals(AlarmKeyLock.DEFAULT_LEASE_MS, lock.getLeaseRemainingMs());
    }

    @Test
    public void leaseRemainingIsZeroWhenNotEngaged() {
        assertEquals(0L, lock.getLeaseRemainingMs());

        lock.engage(5_000L);
        lock.release();

        assertEquals(0L, lock.getLeaseRemainingMs());
    }

    @Test
    public void theLockWorksWithoutAnyListenersAttached() {
        AlarmKeyLock bare = new AlarmKeyLock(() -> now);

        bare.engage(5_000L);
        assertTrue(bare.handleKey(KeyEvent.KEYCODE_VOLUME_DOWN, KeyEvent.ACTION_DOWN, 0));
        assertTrue(bare.handleBack());
        now += 5_000L;
        assertFalse(bare.isEngaged());
        bare.release();
    }
}
