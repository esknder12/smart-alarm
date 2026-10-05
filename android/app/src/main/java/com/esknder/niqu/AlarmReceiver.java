package com.esknder.niqu;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import androidx.core.content.ContextCompat;

/**
 * Fired by AlarmManager when an alarm is due, even if the app has not run for weeks.
 *
 * <p>It starts {@link AlarmRingService} as a foreground service. That start is allowed from the
 * background because it comes from an exact alarm, which Android explicitly exempts from the
 * background-start restrictions. Before doing so it re-arms the alarm's <em>next</em> occurrence,
 * because exact alarms are one-shot: without this, a repeating alarm would never ring twice.
 */
public class AlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "NiquAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !AlarmScheduler.ACTION_FIRE.equals(intent.getAction())) {
            return;
        }
        AlarmSchedule fired = AlarmSchedule.decode(intent.getStringExtra(AlarmScheduler.EXTRA_ALARM));
        if (fired == null) {
            Log.w(TAG, "Alarm fired without a usable payload; ignoring");
            return;
        }
        AlarmSchedule stored = AlarmSchedule.findById(AlarmStore.load(context), fired.id);
        if (stored == null || !stored.enabled) {
            Log.i(TAG, "Alarm " + fired.id + " was deleted or disabled while the phone slept; ignoring");
            return;
        }
        // One-shot exact alarms: arm the next occurrence before ringing this one.
        new AlarmScheduler(context).schedule(stored);
        Log.i(TAG, "Firing " + stored);
        ContextCompat.startForegroundService(context, AlarmRingService.ringIntent(context, stored));

        // Directly launch the activity so the user immediately sees the full-screen Niqu puzzle interface
        try {
            Intent ringScreen = AlarmScheduler.ringScreenIntent(context, stored);
            context.startActivity(ringScreen);
        } catch (Exception e) {
            Log.w(TAG, "Direct startActivity from AlarmReceiver failed: " + e.getMessage());
        }
    }
}
