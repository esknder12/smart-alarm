package com.esknder.niqu;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.List;

/**
 * The native copy of the alarm list.
 *
 * <p>AlarmManager arms a PendingIntent once, and after a reboot or an app update nothing survives
 * except persistent storage - so {@link BootReceiver} needs to know what to re-arm without asking
 * the WebView (which will not be running at boot). The web layer pushes its list here on every
 * change ({@code AlarmSchedulerPlugin.sync}), and this class keeps it as one encoded string; the
 * codec itself lives in {@link AlarmSchedule} and is unit-tested on the plain JVM.
 *
 * <p>It also remembers the alarm that is ringing right now, so a service restarted by the system
 * mid-ring can pick the ring back up instead of leaving a silent notification behind.
 */
final class AlarmStore {

    private static final String PREFS = "niqu_alarm_schedule";
    private static final String KEY_ALARMS = "alarms";
    private static final String KEY_RINGING_ALARM = "ringing_alarm";
    private static final String KEY_RINGING_STARTED_AT = "ringing_started_at";

    /** The alarm that is ringing, with the moment the ring began. */
    static final class Ringing {

        final AlarmSchedule alarm;
        final long startedAt;

        Ringing(AlarmSchedule alarm, long startedAt) {
            this.alarm = alarm;
            this.startedAt = startedAt;
        }
    }

    private AlarmStore() {}

    static List<AlarmSchedule> load(Context context) {
        return AlarmSchedule.decodeList(prefs(context).getString(KEY_ALARMS, ""));
    }

    static void save(Context context, List<AlarmSchedule> alarms) {
        prefs(context).edit().putString(KEY_ALARMS, AlarmSchedule.encodeList(alarms)).apply();
    }

    static void saveRinging(Context context, AlarmSchedule alarm, long startedAt) {
        prefs(context).edit().putString(KEY_RINGING_ALARM, alarm.encode()).putLong(KEY_RINGING_STARTED_AT, startedAt).apply();
    }

    static Ringing loadRinging(Context context) {
        SharedPreferences prefs = prefs(context);
        AlarmSchedule alarm = AlarmSchedule.decode(prefs.getString(KEY_RINGING_ALARM, null));
        if (alarm == null) return null;
        return new Ringing(alarm, prefs.getLong(KEY_RINGING_STARTED_AT, 0L));
    }

    static void clearRinging(Context context) {
        prefs(context).edit().remove(KEY_RINGING_ALARM).remove(KEY_RINGING_STARTED_AT).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
