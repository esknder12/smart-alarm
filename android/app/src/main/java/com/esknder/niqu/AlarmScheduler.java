package com.esknder.niqu;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import java.util.List;
import java.util.TimeZone;

/**
 * Arms the {@link AlarmManager} so alarms fire when the app is closed, and reports back what it did.
 *
 * <p>Each enabled alarm gets a {@link AlarmManager#setAlarmClock} entry: the exact, Doze-proof,
 * "alarm clock" kind of alarm (the one that shows the little clock icon in the status bar), which
 * is what a wake-up alarm must use. On Android 12+ that needs the exact-alarm permission; the app
 * declares {@code USE_EXACT_ALARM} (an alarm clock legitimately qualifies) and, on Android 12,
 * {@code SCHEDULE_EXACT_ALARM}, which the user grants from a settings screen the in-app
 * "Wake-Up Reliability" panel offers. If it is not granted the code falls back to
 * {@code setExactAndAllowWhileIdle} / {@code setAndAllowWhileIdle} so the alarm still fires - just
 * not to the minute - and {@link #canScheduleExactAlarms()} lets the UI say so honestly.
 *
 * <p>PendingIntent identity: one Intent per alarm id ({@code niqu://alarm/<id>}), so re-arming a
 * changed alarm replaces the old entry and cancelling needs nothing but the id.
 */
final class AlarmScheduler {

    static final String ACTION_FIRE = "com.esknder.niqu.action.ALARM_FIRE";
    static final String EXTRA_ALARM = "niqu.alarm";
    static final String EXTRA_ALARM_ID = "niqu.alarmId";

    static final int REQUEST_CODE_FIRE = 6101;
    static final int REQUEST_CODE_SHOW = 6102;
    static final int PENDING_INTENT_FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    private static final String ALARM_URI_PREFIX = "niqu://alarm/";

    private final Context context;

    AlarmScheduler(Context context) {
        this.context = context.getApplicationContext();
    }

    /** What the web layer gets after a sync, so the UI can show the real state of the scheduler. */
    static final class SyncResult {

        final int scheduledCount;
        final long nextTriggerAt;
        final String nextAlarmId;
        final boolean exact;

        SyncResult(int scheduledCount, long nextTriggerAt, String nextAlarmId, boolean exact) {
            this.scheduledCount = scheduledCount;
            this.nextTriggerAt = nextTriggerAt;
            this.nextAlarmId = nextAlarmId;
            this.exact = exact;
        }
    }

    /**
     * Makes the native schedule match {@code alarms} exactly: everything that was removed, disabled
     * or edited is cancelled, everything enabled is armed at its next occurrence.
     */
    SyncResult sync(List<AlarmSchedule> alarms) {
        List<AlarmSchedule> previouslyStored = AlarmStore.load(context);
        for (AlarmSchedule old : previouslyStored) {
            AlarmSchedule current = AlarmSchedule.findById(alarms, old.id);
            if (current == null || !current.enabled || !current.isSameAs(old)) {
                cancel(old.id);
            }
        }
        for (AlarmSchedule alarm : alarms) {
            if (alarm.enabled) schedule(alarm);
        }
        AlarmStore.save(context, alarms);
        return describe(alarms);
    }

    /** Arms (or re-arms) one alarm at its next occurrence after now. */
    void schedule(AlarmSchedule alarm) {
        long triggerAt = AlarmPlanner.nextTrigger(alarm, System.currentTimeMillis(), TimeZone.getDefault());
        if (triggerAt <= 0L) return;
        armAt(triggerAt, alarm);
    }

    /** Cancels one alarm by id. Safe when nothing was armed. */
    void cancel(String alarmId) {
        PendingIntent fire = existingFirePendingIntent(alarmId);
        if (fire != null) {
            manager().cancel(fire);
            fire.cancel();
        }
        PendingIntent show = existingShowPendingIntent(alarmId);
        if (show != null) show.cancel();
    }

    void cancelAll() {
        for (AlarmSchedule alarm : AlarmStore.load(context)) {
            cancel(alarm.id);
        }
    }

    /** Re-arms everything the store knows about; used after a reboot, an update or a time change. */
    void rescheduleAll() {
        List<AlarmSchedule> alarms = AlarmStore.load(context);
        cancelAll();
        for (AlarmSchedule alarm : alarms) {
            if (alarm.enabled) schedule(alarm);
        }
    }

    boolean canScheduleExactAlarms() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return manager().canScheduleExactAlarms();
    }

    SyncResult describe(List<AlarmSchedule> alarms) {
        long now = System.currentTimeMillis();
        TimeZone zone = TimeZone.getDefault();
        AlarmSchedule next = AlarmPlanner.nextAlarm(alarms, now, zone);
        int enabled = 0;
        for (AlarmSchedule alarm : alarms) {
            if (alarm.enabled) enabled++;
        }
        return new SyncResult(
            enabled,
            next == null ? -1L : AlarmPlanner.nextTrigger(next, now, zone),
            next == null ? null : next.id,
            canScheduleExactAlarms()
        );
    }

    // ---------------------------------------------------------------------------------- extras

    /** The intent that brings the puzzle screen up (also used as the alarm's "show" intent). */
    static Intent ringScreenIntent(Context context, AlarmSchedule alarm) {
        return new Intent(context, MainActivity.class)
            .setAction(ACTION_FIRE)
            .setData(Uri.parse(ALARM_URI_PREFIX + Uri.encode(alarm.id)))
            .putExtra(EXTRA_ALARM_ID, alarm.id)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }

    static Intent exactAlarmPermissionIntent(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).setData(Uri.parse("package:" + context.getPackageName()));
        }
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(Uri.parse("package:" + context.getPackageName()));
    }

    /** Where the user grants "full-screen notifications" (Android 14+ gated it behind a switch). */
    static Intent fullScreenIntentPermissionIntent(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).setData(Uri.parse("package:" + context.getPackageName()));
        }
        return new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
    }

    static boolean canUseFullScreenIntent(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        return manager == null || manager.canUseFullScreenIntent();
    }

    static boolean notificationsAllowed(Context context) {
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    // ------------------------------------------------------------------------------ internals

    private void armAt(long triggerAt, AlarmSchedule alarm) {
        PendingIntent fire = PendingIntent.getBroadcast(context, REQUEST_CODE_FIRE, fireIntent(alarm), PENDING_INTENT_FLAGS);
        PendingIntent show = PendingIntent.getActivity(context, REQUEST_CODE_SHOW, showIntent(alarm), PENDING_INTENT_FLAGS);

        if (canScheduleExactAlarms()) {
            try {
                manager().setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAt, show), fire);
                return;
            } catch (SecurityException lost) {
                // The permission was revoked between the check and the call; use the inexact path.
            }
        }
        try {
            manager().setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, fire);
        } catch (SecurityException noExactEither) {
            manager().setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, fire);
        }
    }

    private AlarmManager manager() {
        return (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    }

    /**
     * The broadcast that fires the alarm. It names its component explicitly (a manifest receiver
     * with a custom action would be an illegal implicit broadcast on Android 8+) and carries the
     * encoded alarm, so the receiver needs no lookup of its own.
     */
    private Intent fireIntent(AlarmSchedule alarm) {
        return fireIntent(alarm.id).putExtra(EXTRA_ALARM, alarm.encode());
    }

    private Intent fireIntent(String alarmId) {
        return new Intent(context, AlarmReceiver.class)
            .setAction(ACTION_FIRE)
            .setData(Uri.parse(ALARM_URI_PREFIX + Uri.encode(alarmId)));
    }

    private Intent showIntent(AlarmSchedule alarm) {
        return showIntent(alarm.id).putExtra(EXTRA_ALARM_ID, alarm.id);
    }

    /** Same identity as {@link #ringScreenIntent}, without the activity flags. */
    private Intent showIntent(String alarmId) {
        return new Intent(context, MainActivity.class).setAction(ACTION_FIRE).setData(Uri.parse(ALARM_URI_PREFIX + Uri.encode(alarmId)));
    }

    private PendingIntent existingFirePendingIntent(String alarmId) {
        return PendingIntent.getBroadcast(context, REQUEST_CODE_FIRE, fireIntent(alarmId), PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
    }

    private PendingIntent existingShowPendingIntent(String alarmId) {
        return PendingIntent.getActivity(context, REQUEST_CODE_SHOW, showIntent(alarmId), PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
    }
}
