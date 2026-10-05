package com.esknder.niqu;

import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;

/**
 * When an alarm should ring next.
 *
 * <p>This is the native mirror of the "is it HH:mm and does the day match?" check the web app runs
 * every second: the web layer can only do that while it is alive, whereas AlarmManager needs a
 * concrete wall-clock time handed to it while the app is <em>not</em> running. Keeping the maths in
 * one dependency-free place means it can be unit-tested with a fixed clock and time zone, which is
 * exactly what {@code AlarmPlannerTest} does.
 *
 * <p>Semantics copied from the web app:
 * <ul>
 *   <li>the trigger is always strictly in the future ({@code >} now); an alarm that is firing right
 *       now computes its <em>next</em> occurrence, so a re-arm can never loop;</li>
 *   <li>an empty repeat-day list means "every day";</li>
 *   <li>DST is handled by {@link Calendar} (a time that does not exist on a spring-forward day
 *       lands on the next valid instant, as it does on Android's own clock).</li>
 * </ul>
 */
final class AlarmPlanner {

    /** Upper bound for how far ahead a weekly alarm can be; 8 days covers every pattern. */
    private static final int MAX_DAYS_AHEAD = 8;

    private AlarmPlanner() {}

    /** @return the next epoch millis this alarm rings at, or -1 when it can never ring. */
    static long nextTrigger(AlarmSchedule alarm, long nowMillis, TimeZone zone) {
        if (alarm == null) return -1L;
        for (int daysAhead = 0; daysAhead <= MAX_DAYS_AHEAD; daysAhead++) {
            long candidate = at(alarm, nowMillis, daysAhead, zone);
            if (candidate > nowMillis) return candidate;
        }
        return -1L;
    }

    /** @return the earliest trigger of any enabled alarm, or -1 when nothing is scheduled. */
    static long nextTrigger(List<AlarmSchedule> alarms, long nowMillis, TimeZone zone) {
        long earliest = -1L;
        for (AlarmSchedule alarm : alarms) {
            if (alarm == null || !alarm.enabled) continue;
            long trigger = nextTrigger(alarm, nowMillis, zone);
            if (trigger > 0 && (earliest < 0 || trigger < earliest)) earliest = trigger;
        }
        return earliest;
    }

    /** @return the enabled alarm that rings first, or null when nothing is scheduled. */
    static AlarmSchedule nextAlarm(List<AlarmSchedule> alarms, long nowMillis, TimeZone zone) {
        AlarmSchedule next = null;
        long earliest = -1L;
        for (AlarmSchedule alarm : alarms) {
            if (alarm == null || !alarm.enabled) continue;
            long trigger = nextTrigger(alarm, nowMillis, zone);
            if (trigger > 0 && (earliest < 0 || trigger < earliest)) {
                earliest = trigger;
                next = alarm;
            }
        }
        return next;
    }

    /** The alarm's time {@code daysAhead} days from {@code nowMillis} (day is not filtered here). */
    private static long at(AlarmSchedule alarm, long nowMillis, int daysAhead, TimeZone zone) {
        Calendar candidate = Calendar.getInstance(zone);
        candidate.setTimeInMillis(nowMillis);
        candidate.add(Calendar.DAY_OF_YEAR, daysAhead);
        candidate.set(Calendar.HOUR_OF_DAY, alarm.hour);
        candidate.set(Calendar.MINUTE, alarm.minute);
        candidate.set(Calendar.SECOND, 0);
        candidate.set(Calendar.MILLISECOND, 0);
        int dayIndex = candidate.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY;
        if (!alarm.repeatsOn(dayIndex)) return -1L;
        return candidate.getTimeInMillis();
    }
}
