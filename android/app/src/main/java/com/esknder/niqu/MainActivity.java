package com.esknder.niqu;

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
 * (see {@link AlarmKeyLock}) is engaged by the web layer through {@link AlarmLockPlugin}:
 * <ul>
 *   <li>volume down, volume up and mute are swallowed in {@link #dispatchKeyEvent}, so the alarm
 *       cannot be turned down or muted and the system volume panel (with its slider) never opens;</li>
 *   <li>Back is swallowed, so it can neither close the app (which would kill the alarm) nor send it
 *       to the background;</li>
 *   <li>the screen is kept on, because with the screen off Android handles the volume keys itself
 *       before any window gets to see them.</li>
 * </ul>
 *
 * <p>What no app can block: Home, Recents and the power button belong to Android, and while this
 * activity is not in the foreground (screen off, another app on top, notification shade pulled down)
 * the system receives the volume keys instead.
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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins registered by hand must be added before super.onCreate(), which builds the bridge.
        registerPlugin(AlarmLockPlugin.class);
        super.onCreate(savedInstanceState);

        alarmLock.setStateListener(this::onAlarmLockChanged);

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
    public boolean dispatchKeyEvent(KeyEvent event) {
        // Runs before the system's own volume handling (PhoneWindow.onKeyDown), so returning true
        // here is what actually keeps the volume from changing.
        if (alarmLock.handleKey(event.getKeyCode(), event.getAction(), event.getRepeatCount())) {
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
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

    /** May be called from any thread (plugin thread, main thread via the watchdog or a key event). */
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
}
