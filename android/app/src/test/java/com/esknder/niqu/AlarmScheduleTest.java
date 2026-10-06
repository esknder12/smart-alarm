package com.esknder.niqu;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.Test;

/**
 * Plain-JVM tests for the alarm record and its codec. This is the format that survives a reboot in
 * SharedPreferences and travels inside a PendingIntent, so it has to round-trip exactly - including
 * hostile input, because a corrupted record must disable one alarm, never crash the app at boot.
 */
public class AlarmScheduleTest {

    private static AlarmSchedule sample() {
        return AlarmSchedule.fromDayList(
            "alarm-1",
            6,
            30,
            Arrays.asList(1, 2, 3, 4, 5),
            "Morning Rise & Shine",
            "sunrise",
            80,
            true,
            "math",
            "easy",
            "8901234567890",
            true
        );
    }

    @Test
    public void roundTripsEveryField() {
        AlarmSchedule original = sample();

        AlarmSchedule decoded = AlarmSchedule.decode(original.encode());

        assertNotNull(decoded);
        assertEquals(original.id, decoded.id);
        assertEquals(original.hour, decoded.hour);
        assertEquals(original.minute, decoded.minute);
        assertEquals(original.repeatDays(), decoded.repeatDays());
        assertEquals(original.label, decoded.label);
        assertEquals(original.sound, decoded.sound);
        assertEquals(original.volume, decoded.volume);
        assertEquals(original.gentleWakeUp, decoded.gentleWakeUp);
        assertEquals(original.challenge, decoded.challenge);
        assertEquals(original.challengeDifficulty, decoded.challengeDifficulty);
        assertEquals(original.barcodeValue, decoded.barcodeValue);
        assertEquals(original.enabled, decoded.enabled);
        assertTrue(original.isSameAs(decoded));
    }

    @Test
    public void roundTripsLabelsWithSeparatorsAndUnicode() {
        AlarmSchedule awkward = AlarmSchedule.fromDayList(
            "id|with|pipes",
            23,
            59,
            Collections.singletonList(0),
            "ንቁ | 100% | %7C | line\nbreak",
            "nuclear",
            100,
            false,
            "typing",
            "hard",
            "QR|morning%值\\nspot",
            true
        );

        AlarmSchedule decoded = AlarmSchedule.decode(awkward.encode());

        assertNotNull(decoded);
        assertEquals("id|with|pipes", decoded.id);
        assertEquals("ንቁ | 100% | %7C | line\nbreak", decoded.label);
        assertEquals("QR|morning%值\\nspot", decoded.barcodeValue);
        assertEquals(23, decoded.hour);
        assertEquals(59, decoded.minute);
        assertEquals(Collections.singletonList(0), decoded.repeatDays());
        assertTrue(decoded.isSameAs(awkward));
    }

    @Test
    public void emptyRepeatDaysSurvivesAsEveryDay() {
        AlarmSchedule everyDay = AlarmSchedule.fromDayList("x", 7, 0, Collections.emptyList(), "Any day", "chime", 70, false, "none", "easy", true);

        AlarmSchedule decoded = AlarmSchedule.decode(everyDay.encode());

        assertNotNull(decoded);
        assertFalse(decoded.repeats());
        assertTrue(decoded.repeatDays().isEmpty());
        assertTrue("no selected days means every day", decoded.repeatsOn(3));
    }

    @Test
    public void noRepeatDaysMeansEveryDayButSelectedDaysFilter() {
        AlarmSchedule weekdays = sample();
        assertFalse(weekdays.repeatsOn(0)); // Sunday
        assertTrue(weekdays.repeatsOn(1)); // Monday
        assertFalse(weekdays.repeatsOn(6)); // Saturday
    }

    @Test
    public void outOfRangeValuesAreClampedInsteadOfBreakingTheRecord() {
        AlarmSchedule wild = AlarmSchedule.fromDayList("x", 42, -5, Arrays.asList(9, -1, 3), null, null, 900, false, null, null, true);

        assertEquals(23, wild.hour);
        assertEquals(0, wild.minute);
        assertEquals(100, wild.volume);
        assertEquals(Collections.singletonList(3), wild.repeatDays());
        assertFalse(wild.gentleWakeUp);
        assertEquals("math", wild.challenge);
    }

    @Test
    public void corruptOrForeignRecordsAreRejectedNotThrown() {
        assertNull(AlarmSchedule.decode(null));
        assertNull(AlarmSchedule.decode(""));
        assertNull(AlarmSchedule.decode("definitely not an alarm"));
        assertNull(AlarmSchedule.decode("v2|id|6|30|-|label|sound|80|0|math|easy|1"));
        assertNull(AlarmSchedule.decode("v1|id|6|30|-|label"));
        assertNull(AlarmSchedule.decode("v1|id|not-an-hour|30|-|label|sound|80|0|math|easy|1"));
        assertNull(AlarmSchedule.decode("v1|id|6|30|9|label|sound|80|0|math|easy|1"));
        assertNull(AlarmSchedule.decode("v3|id|6|30|-|label|sound|80|0|math|easy|1|code"));
    }

    @Test
    public void oldV1AlarmsRemainUsableAfterUpgrade() {
        AlarmSchedule decoded = AlarmSchedule.decode("v1|old|6|30|1,2,3,4,5|Wake up|sunrise|80|1|math|easy|1");
        assertNotNull(decoded);
        assertEquals("old", decoded.id);
        assertEquals("math", decoded.challenge);
        assertEquals("", decoded.barcodeValue);
        assertTrue("legacy schedules are rewritten using the current format", decoded.encode().startsWith("v2|"));
    }

    @Test
    public void listCodecKeepsGoodRecordsAndSkipsTheRest() {
        AlarmSchedule first = sample();
        AlarmSchedule second = AlarmSchedule.fromDayList("alarm-2", 7, 15, Collections.singletonList(0), "Weekend", "chime", 75, false, "typing", "easy", false);

        String encoded = AlarmSchedule.encodeList(Arrays.asList(first, second));
        String withGarbage = encoded + "\nthis line is not an alarm\n";

        List<AlarmSchedule> decoded = AlarmSchedule.decodeList(withGarbage);

        assertEquals(2, decoded.size());
        assertTrue(decoded.get(0).isSameAs(first));
        assertTrue(decoded.get(1).isSameAs(second));
        assertTrue(AlarmSchedule.decodeList(null).isEmpty());
        assertTrue(AlarmSchedule.decodeList("").isEmpty());
    }

    @Test
    public void findByIdFindsOnlyTheRightAlarm() {
        AlarmSchedule first = sample();
        AlarmSchedule second = AlarmSchedule.fromDayList("alarm-2", 7, 15, Collections.emptyList(), "Weekend", "chime", 75, false, "typing", "easy", false);
        List<AlarmSchedule> alarms = Arrays.asList(first, second);

        assertEquals("alarm-2", AlarmSchedule.findById(alarms, "alarm-2").id);
        assertNull(AlarmSchedule.findById(alarms, "nope"));
        assertNull(AlarmSchedule.findById(alarms, null));
    }

    @Test
    public void isSameAsNoticesEveryMeaningfulChange() {
        AlarmSchedule original = sample();

        assertTrue(original.isSameAs(AlarmSchedule.decode(original.encode())));
        assertFalse(original.isSameAs(null));
        assertFalse("a different time must re-arm", original.isSameAs(AlarmSchedule.fromDayList("alarm-1", 6, 31, Arrays.asList(1, 2, 3, 4, 5), "Morning Rise & Shine", "sunrise", 80, true, "math", "easy", "8901234567890", true)));
        assertFalse("a disabled alarm must be cancelled", original.isSameAs(original.withEnabled(false)));
        assertFalse("a different sound must refresh the notification", original.isSameAs(AlarmSchedule.fromDayList("alarm-1", 6, 30, Arrays.asList(1, 2, 3, 4, 5), "Morning Rise & Shine", "nuclear", 80, true, "math", "easy", "8901234567890", true)));
        assertFalse("a different scan target must update the stored challenge", original.isSameAs(AlarmSchedule.fromDayList("alarm-1", 6, 30, Arrays.asList(1, 2, 3, 4, 5), "Morning Rise & Shine", "sunrise", 80, true, "math", "easy", "0001112223334", true)));
    }

    @Test
    public void timeLabelIsZeroPadded() {
        assertEquals("06:05", AlarmSchedule.fromDayList("x", 6, 5, Collections.emptyList(), "", "", 0, false, "", "", true).timeLabel());
        assertEquals("23:59", AlarmSchedule.fromDayList("x", 23, 59, Collections.emptyList(), "", "", 0, false, "", "", true).timeLabel());
    }

    @Test
    public void enabledFlagRoundTripsBothWays() {
        AlarmSchedule off = sample().withEnabled(false);
        assertFalse(AlarmSchedule.decode(off.encode()).enabled);
        assertTrue(AlarmSchedule.decode(off.withEnabled(true).encode()).enabled);
    }
}
