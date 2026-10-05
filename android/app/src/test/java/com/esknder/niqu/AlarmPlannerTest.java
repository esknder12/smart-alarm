package com.esknder.niqu;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.TimeZone;
import org.junit.Test;

/**
 * Plain-JVM tests for when an alarm fires: the native counterpart of the web app's
 * "is it HH:mm and does today match?" check. No emulator, no Android runtime - the planner only
 * uses {@link java.util.Calendar} and a time zone that each test passes in.
 */
public class AlarmPlannerTest {

    /** Addis Ababa has never observed DST, which keeps the "normal" cases unambiguous. */
    private static final TimeZone ADDIS = TimeZone.getTimeZone("Africa/Addis_Ababa");
    private static final ZoneId ADDIS_ZONE = ADDIS.toZoneId();

    private static long at(int year, int month, int day, int hour, int minute, ZoneId zone) {
        return ZonedDateTime.of(year, month, day, hour, minute, 0, 0, zone).toInstant().toEpochMilli();
    }

    private static String describe(long epochMillis, TimeZone zone) {
        return ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(epochMillis), zone.toZoneId()).toString();
    }

    private static AlarmSchedule daily(int hour, int minute) {
        return AlarmSchedule.fromDayList("daily", hour, minute, Collections.emptyList(), "Daily", "sunrise", 80, false, "math", "easy", true);
    }

    private static AlarmSchedule onDays(String id, int hour, int minute, List<Integer> days) {
        return AlarmSchedule.fromDayList(id, hour, minute, days, id, "sunrise", 80, false, "math", "easy", true);
    }

    // ---------------------------------------------------------------------------- the basics

    @Test
    public void todayWhenTheTimeIsStillAhead() {
        long now = at(2026, 5, 4, 5, 0, ADDIS_ZONE); // Monday 05:00

        long trigger = AlarmPlanner.nextTrigger(daily(6, 30), now, ADDIS);

        assertEquals(at(2026, 5, 4, 6, 30, ADDIS_ZONE), trigger);
    }

    @Test
    public void tomorrowWhenTheTimeHasPassed() {
        long now = at(2026, 5, 4, 7, 0, ADDIS_ZONE); // Monday 07:00, alarm was 06:30

        long trigger = AlarmPlanner.nextTrigger(daily(6, 30), now, ADDIS);

        assertEquals(at(2026, 5, 5, 6, 30, ADDIS_ZONE), trigger);
    }

    @Test
    public void anAlarmSittingExactlyOnNowMovesToTheNextDay() {
        // "Strictly in the future" is what stops a re-arm from looping on itself.
        long now = at(2026, 5, 4, 6, 30, ADDIS_ZONE);

        long trigger = AlarmPlanner.nextTrigger(daily(6, 30), now, ADDIS);

        assertEquals(at(2026, 5, 5, 6, 30, ADDIS_ZONE), trigger);
    }

    @Test
    public void emptyRepeatDaysMeansEveryDay() {
        long now = at(2026, 5, 4, 7, 0, ADDIS_ZONE); // Monday

        long trigger = AlarmPlanner.nextTrigger(daily(6, 30), now, ADDIS);

        assertEquals(at(2026, 5, 5, 6, 30, ADDIS_ZONE), trigger); // Tuesday
    }

    // ------------------------------------------------------------------------ repeat patterns

    @Test
    public void weekdayIndicesMatchTheWebAppsConvention() {
        // The single most dangerous thing in this file: the web app stores repeatDays as
        // 0 = Sunday … 6 = Saturday, while Calendar.DAY_OF_WEEK is 1 = Sunday … 7 = Saturday.
        // This walks all seven indices and checks the day that actually fires.
        String[] expectedDayNames = { "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY" };
        long saturdayEvening = at(2026, 5, 9, 20, 0, ADDIS_ZONE);

        for (int index = 0; index < 7; index++) {
            AlarmSchedule onlyThatDay = onDays("d" + index, 12, 0, Collections.singletonList(index));
            long trigger = AlarmPlanner.nextTrigger(onlyThatDay, saturdayEvening, ADDIS);
            java.time.DayOfWeek fired = ZonedDateTime
                .ofInstant(java.time.Instant.ofEpochMilli(trigger), ADDIS_ZONE)
                .getDayOfWeek();
            assertEquals("repeatDays " + index, expectedDayNames[index], fired.name());
        }
    }

    @Test
    public void weeklyAlarmSkipsDaysThatAreNotSelected() {
        // Monday, Wednesday, Friday. The web app stores 0 = Sunday, so these are 1, 3 and 5.
        AlarmSchedule monWedFri = onDays("work", 6, 30, Arrays.asList(1, 3, 5));
        long mondayLunchtime = at(2026, 5, 4, 12, 0, ADDIS_ZONE);

        long trigger = AlarmPlanner.nextTrigger(monWedFri, mondayLunchtime, ADDIS);

        assertEquals("Monday's time has passed, so the next one is Wednesday", at(2026, 5, 6, 6, 30, ADDIS_ZONE), trigger);
    }

    @Test
    public void weeklyAlarmKeepsTheSameDayWhenTheTimeIsStillAhead() {
        AlarmSchedule monWedFri = onDays("work", 18, 0, Arrays.asList(1, 3, 5));
        long mondayMorning = at(2026, 5, 4, 9, 0, ADDIS_ZONE);

        long trigger = AlarmPlanner.nextTrigger(monWedFri, mondayMorning, ADDIS);

        assertEquals(at(2026, 5, 4, 18, 0, ADDIS_ZONE), trigger);
    }

    @Test
    public void sundayIsIndexZero() {
        // The web app stores 0 = Sunday; a mismatch here would fire the alarm on the wrong day.
        AlarmSchedule sundays = onDays("sunday", 8, 0, Collections.singletonList(0));
        long saturday = at(2026, 5, 9, 12, 0, ADDIS_ZONE);

        long trigger = AlarmPlanner.nextTrigger(sundays, saturday, ADDIS);

        assertEquals(at(2026, 5, 10, 8, 0, ADDIS_ZONE), trigger);
        assertEquals("2026-05-10 is a Sunday", java.time.DayOfWeek.SUNDAY, ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(trigger), ADDIS_ZONE).getDayOfWeek());
    }

    @Test
    public void saturdayIsIndexSix() {
        AlarmSchedule saturdays = onDays("saturday", 9, 15, Collections.singletonList(6));
        long friday = at(2026, 5, 8, 20, 0, ADDIS_ZONE);

        long trigger = AlarmPlanner.nextTrigger(saturdays, friday, ADDIS);

        assertEquals(at(2026, 5, 9, 9, 15, ADDIS_ZONE), trigger);
    }

    // ----------------------------------------------------------------------------------- DST

    @Test
    public void springForwardLandsOnTheNextValidInstant() {
        // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00 -> 03:00). Android's own
        // clock fires such an alarm at the first valid instant rather than skipping the day.
        TimeZone newYork = TimeZone.getTimeZone("America/New_York");
        long saturdayNoon = at(2026, 3, 7, 12, 0, newYork.toZoneId());

        long trigger = AlarmPlanner.nextTrigger(daily(2, 30), saturdayNoon, newYork);

        ZonedDateTime fired = ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(trigger), newYork.toZoneId());
        assertEquals(2026, fired.getYear());
        assertEquals(3, fired.getMonthValue());
        assertEquals(8, fired.getDayOfMonth());
        assertEquals("02:30 is skipped that night", 3, fired.getHour());
        assertEquals(30, fired.getMinute());
    }

    // ---------------------------------------------------------------------------- whole lists

    @Test
    public void theEarliestEnabledAlarmWins() {
        AlarmSchedule late = onDays("late", 9, 0, Collections.emptyList());
        AlarmSchedule early = onDays("early", 6, 0, Collections.emptyList());
        long now = at(2026, 5, 4, 5, 0, ADDIS_ZONE);

        long trigger = AlarmPlanner.nextTrigger(Arrays.asList(late, early), now, ADDIS);

        assertEquals(at(2026, 5, 4, 6, 0, ADDIS_ZONE), trigger);
        assertSame(early, AlarmPlanner.nextAlarm(Arrays.asList(late, early), now, ADDIS));
    }

    @Test
    public void disabledAlarmsAreNotScheduled() {
        AlarmSchedule disabled = onDays("off", 5, 0, Collections.emptyList()).withEnabled(false);
        AlarmSchedule enabled = onDays("on", 7, 0, Collections.emptyList());
        long now = at(2026, 5, 4, 4, 0, ADDIS_ZONE);

        assertEquals(at(2026, 5, 4, 7, 0, ADDIS_ZONE), AlarmPlanner.nextTrigger(Arrays.asList(disabled, enabled), now, ADDIS));
        assertSame(enabled, AlarmPlanner.nextAlarm(Arrays.asList(disabled, enabled), now, ADDIS));
    }

    @Test
    public void aTotallyDisabledListHasNothingScheduled() {
        AlarmSchedule disabled = onDays("off", 6, 0, Collections.emptyList()).withEnabled(false);
        long now = at(2026, 5, 4, 4, 0, ADDIS_ZONE);

        assertEquals(-1L, AlarmPlanner.nextTrigger(Collections.singletonList(disabled), now, ADDIS));
        assertNull(AlarmPlanner.nextAlarm(Collections.singletonList(disabled), now, ADDIS));
        assertEquals(-1L, AlarmPlanner.nextTrigger(Collections.<AlarmSchedule>emptyList(), now, ADDIS));
    }

    @Test
    public void everyDayOfTheWeekIsReachableWithinAWeek() {
        AlarmSchedule alarm = onDays("any", 6, 30, Collections.singletonList(4)); // 4 = Thursday
        long start = at(2026, 5, 4, 0, 0, ADDIS_ZONE); // Monday

        long trigger = AlarmPlanner.nextTrigger(alarm, start, ADDIS);

        assertEquals("Thursday 06:30", at(2026, 5, 7, 6, 30, ADDIS_ZONE), trigger);
        assertEquals(java.time.DayOfWeek.THURSDAY, ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(trigger), ADDIS_ZONE).getDayOfWeek());
    }

    @Test
    public void triggerIsAlwaysInTheFuture() {
        AlarmSchedule alarm = onDays("any", 6, 30, Arrays.asList(1, 2, 3));
        for (int day = 1; day <= 10; day++) {
            long now = at(2026, 5, day, 6, 30, ADDIS_ZONE);
            long trigger = AlarmPlanner.nextTrigger(alarm, now, ADDIS);
            if (trigger > 0) {
                org.junit.Assert.assertTrue("trigger must be after now: " + describe(trigger, ADDIS), trigger > now);
            }
        }
    }
}
