package com.esknder.niqu;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Re-arms every alarm after the phone reboots.
 *
 * <p>AlarmManager forgets everything on shutdown, so without this an alarm would silently never
 * ring again after a restart. The list of alarms lives in {@link AlarmStore} (the web layer mirrors
 * its alarms there on every change), which means the re-arm works with the app closed and the
 * WebView never started.
 *
 * <p>The same handler covers an app update and manual clock/time-zone changes: all three invalidate
 * the wall-clock times AlarmManager is holding.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "NiquBootReceiver";
    private static final String ACTION_QUICKBOOT = "android.intent.action.QUICKBOOT_POWERON";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (!isRescheduleAction(action)) return;

        // A ring interrupted by the reboot must not come back silently from the store.
        AlarmStore.clearRinging(context);
        AlarmScheduler scheduler = new AlarmScheduler(context);
        scheduler.rescheduleAll();
        Log.i(TAG, "Re-armed alarms after " + action);
    }

    private static boolean isRescheduleAction(String action) {
        if (action == null) return false;
        return (
            Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            Intent.ACTION_TIME_CHANGED.equals(action) ||
            Intent.ACTION_TIMEZONE_CHANGED.equals(action) ||
            ACTION_QUICKBOOT.equals(action)
        );
    }
}
