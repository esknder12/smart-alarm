package com.esknder.niqu;

import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.KeyEvent;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

/**
 * Hosts the web app and enforces the ringing alarm's hardware-button lock.
 *
 * <p>A web page never sees the phone's volume rocker - Android's WebView hands those events straight
 * to the system - so the only place they can be stopped is here, in the activity. While the lock
 * (see {@link AlarmKeyLock}) is engaged:
 * <ul>
 *   <li>volume down, volume up and mute are swallowed in {@link #dispatchKeyEvent}, so the alarm
 *       cannot be turned down or muted and the system volume panel (with its slider) never opens;</li>
 *   <li>Back is swallowed, so it can neither close the app (which would kill the alarm) nor send it
 *       to the background;</li>
 *   <li>the screen is kept on, because with the screen off Android handles the volume keys itself
 *       before any window gets to see them.</li>
 * </ul>
 *
 * <p><b>Phase 2:</b> since the alarm is rung by {@link AlarmRingService}, this activity does not
 * own the ring any more - it asks {@link RingSession} whether one is ringing and hands that to the
 * lock as a second, service-driven reason to stay engaged ({@link AlarmKeyLock#setRingSource}).
 * The web lease still runs on top of it, and the activity is started over the lock screen by the
 * service's full-screen intent ({@code showWhenLocked} / {@code turnScreenOn} below), so the puzzle
 * is what the user wakes up to.
 *
 * <p>What no app can block: Home, Recents and the power button belong to Android, and while this
 * activity is not in the foreground (screen off, another app on top, notification shade pulled down)
 * the system receives the volume keys instead. The lock is also re-asserted every time the activity
 * comes back to the front.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "AlarmLock";
    private static final long LEASE_CHECK_SLACK_MS = 50L;

    private final AlarmKeyLock alarmLock = new AlarmKeyLock(SystemClock::elapsedRealtime);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private OnBackPressedCallback backGuard;

    /** Fires just after the lease would lapse and turns an unrenewed lease into a clean release. */
    private final Runnable leaseWatchdog = () -> {
        if (alarmLock.isEngaged()) {
            scheduleLeaseCheck();
        }
    };

    /** Told by the ringing service (through {@link RingSession}) that a ring started or ended. */
    private final RingSession.Listener ringListener = () -> {
        // isEngaged() re-reads the session and reports the change to onAlarmLockChanged().
        alarmLock.isEngaged();
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins registered by hand must be added before super.onCreate(), which builds the bridge.
        registerPlugin(AlarmLockPlugin.class);
        registerPlugin(AlarmSchedulerPlugin.class);
        super.onCreate(savedInstanceState);

        // The ringing service, not the page, is the source of truth for "an alarm is ringing".
        alarmLock.setRingSource(RingSession.shared());
        RingSession.shared().addListener(ringListener);
        alarmLock.setStateListener(this::onAlarmLockChanged);

        // Show the puzzle (and block the keys) over the lock screen when the alarm's full-screen
        // intent brings this activity up. The manifest attributes do this on API 27+; these calls
        // cover Android 7.x, which the app still supports.
        setShowWhenLockedCompat(true);
        setTurnScreenOnCompat(true);

        // Back is only swallowed while the lock is engaged (the callback is disabled otherwise, so
        // Capacitor / the platform keep handling it exactly as before).
        backGuard = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                if (alarmLock.handleBack()) {
                    return;
                }
                // The lease lapsed after this callback was enabled: stand down and replay the press.
                setEnabled(false);
                MainActivity.this.getOnBackPressedDispatcher().onBackPressed();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backGuard);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Covers the activity being re-created (or brought forward from the notification) while the
        // service is already ringing: the lock picks the session up without the page's help.
        alarmLock.isEngaged();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // Runs before the system's own volume handling (PhoneWindow.onKeyDown), so returning true
        // here is what actually keeps the volume from changing.
        if (alarmLock.handleKey(event.getKeyCode(), event.getAction(), event.getRepeatCount())) {
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onPause() {
        super.onPause();
        // While this activity is not in front, Android throttles the WebView's audio (and the screen
        // is often off), so a ring the app took over must go back to the ringing service.
        AlarmRingService.appMovedToBackground();
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        RingSession.shared().removeListener(ringListener);
        alarmLock.setRingSource(null);
        alarmLock.setStateListener(null);
        alarmLock.release();
        super.onDestroy();
    }

    // ------------------------------------------------------------ used by AlarmLockPlugin

    AlarmKeyLock getAlarmLock() {
        return alarmLock;
    }

    /** Arms the lock, or renews its lease if it is already engaged. */
    void engageAlarmLock(long leaseMs) {
        alarmLock.engage(leaseMs);
        scheduleLeaseCheck();
    }

    void releaseAlarmLock() {
        alarmLock.release();
        mainHandler.removeCallbacks(leaseWatchdog);
    }

    // ------------------------------------------------------------------------- internals

    private void scheduleLeaseCheck() {
        mainHandler.removeCallbacks(leaseWatchdog);
        mainHandler.postDelayed(leaseWatchdog, alarmLock.getLeaseRemainingMs() + LEASE_CHECK_SLACK_MS);
    }

    /** May be called from any thread (plugin thread, main thread via the watchdog or a ring). */
    private void onAlarmLockChanged(boolean engaged) {
        Log.i(TAG, engaged ? "Hardware-key lock engaged" : "Hardware-key lock released");
        runOnUiThread(() -> {
            if (engaged) {
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            if (backGuard != null) {
                backGuard.setEnabled(engaged);
            }
        });
    }

    private void setShowWhenLockedCompat(boolean show) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(show);
            return;
        }
        if (show) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
        }
    }

    private void setTurnScreenOnCompat(boolean turnOn) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setTurnScreenOn(turnOn);
            return;
        }
        if (turnOn) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
    }
}
