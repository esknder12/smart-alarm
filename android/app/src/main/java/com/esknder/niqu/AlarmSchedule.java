package com.esknder.niqu;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * One alarm as the native side knows it: the subset of the web app's {@code Alarm} that
 * AlarmManager, the ringing service and the web layer all have to agree on.
 *
 * <p>Instances are immutable, and {@link #encode()} / {@link #decode(String)} are a tiny codec
 * written by hand - no {@code org.json}, no Android APIs - so the whole class can be exercised on a
 * plain JVM (see {@code AlarmPlannerTest} / {@code AlarmScheduleTest}) and one alarm can travel
 * inside SharedPreferences <em>and</em> inside a PendingIntent's extras.
 *
 * <p>{@code days} is indexed like {@link java.util.Calendar#DAY_OF_WEEK} minus one: 0 = Sunday …
 * 6 = Saturday. An <b>empty</b> array means "every day", which is what the web app's alarm checker
 * does with an empty {@code repeatDays} list.
 */
final class AlarmSchedule {

    /** Codec version; record 0 must match or the record is ignored. */
    static final String VERSION = "v1";
    private static final char FIELD = '|';
    private static final int FIELD_COUNT = 12;

    final String id;
    final int hour;
    final int minute;
    /** 0 = Sunday … 6 = Saturday; empty = every day. Never null. */
    final boolean[] days;
    final String label;
    final String sound;
    /** Configured alarm volume, 0-100. */
    final int volume;
    final boolean gentleWakeUp;
    final String challenge;
    final String challengeDifficulty;
    final boolean enabled;

    AlarmSchedule(
        String id,
        int hour,
        int minute,
        boolean[] days,
        String label,
        String sound,
        int volume,
        boolean gentleWakeUp,
        String challenge,
        String challengeDifficulty,
        boolean enabled
    ) {
        this.id = id == null ? "" : id;
        this.hour = clamp(hour, 0, 23);
        this.minute = clamp(minute, 0, 59);
        boolean[] normalisedDays = new boolean[7];
        if (days != null) {
            System.arraycopy(days, 0, normalisedDays, 0, Math.min(days.length, 7));
        }
        this.days = normalisedDays;
        this.label = label == null ? "" : label;
        this.sound = sound == null ? "" : sound;
        this.volume = clamp(volume, 0, 100);
        this.gentleWakeUp = gentleWakeUp;
        this.challenge = challenge == null ? "math" : challenge;
        this.challengeDifficulty = challengeDifficulty == null ? "easy" : challengeDifficulty;
        this.enabled = enabled;
    }

    /** Convenience for the tests and for the plugin, which receives the days as a JSON array. */
    static AlarmSchedule fromDayList(
        String id,
        int hour,
        int minute,
        List<Integer> repeatDays,
        String label,
        String sound,
        int volume,
        boolean gentleWakeUp,
        String challenge,
        String challengeDifficulty,
        boolean enabled
    ) {
        boolean[] days = new boolean[7];
        if (repeatDays != null) {
            for (Integer day : repeatDays) {
                if (day != null && day >= 0 && day < 7) {
                    days[day] = true;
                }
            }
        }
        return new AlarmSchedule(
            id,
            hour,
            minute,
            days,
            label,
            sound,
            volume,
            gentleWakeUp,
            challenge,
            challengeDifficulty,
            enabled
        );
    }

    String timeLabel() {
        return String.format(java.util.Locale.US, "%02d:%02d", hour, minute);
    }

    boolean repeats() {
        for (boolean day : days) {
            if (day) return true;
        }
        return false;
    }

    boolean repeatsOn(int dayOfWeek) {
        // An alarm without repeat days fires every day (matching the web app's matcher).
        return !repeats() || days[Math.max(0, Math.min(6, dayOfWeek))];
    }

    List<Integer> repeatDays() {
        List<Integer> out = new ArrayList<>(7);
        for (int i = 0; i < 7; i++) {
            if (days[i]) out.add(i);
        }
        return Collections.unmodifiableList(out);
    }

    AlarmSchedule withEnabled(boolean shouldBeEnabled) {
        return new AlarmSchedule(
            id,
            hour,
            minute,
            days,
            label,
            sound,
            volume,
            gentleWakeUp,
            challenge,
            challengeDifficulty,
            shouldBeEnabled
        );
    }

    /** True when the two describe exactly the same alarm (any difference means "re-arm it"). */
    boolean isSameAs(AlarmSchedule other) {
        return other != null && encode().equals(other.encode());
    }

    // ------------------------------------------------------------------------------- codec

    String encode() {
        StringBuilder out = new StringBuilder(80);
        out.append(VERSION).append(FIELD);
        out.append(escape(id)).append(FIELD);
        out.append(hour).append(FIELD);
        out.append(minute).append(FIELD);
        if (!repeats()) {
            out.append('-');
        } else {
            boolean first = true;
            for (int i = 0; i < days.length; i++) {
                if (!days[i]) continue;
                if (!first) out.append(',');
                out.append(i);
                first = false;
            }
        }
        out.append(FIELD);
        out.append(escape(label)).append(FIELD);
        out.append(escape(sound)).append(FIELD);
        out.append(volume).append(FIELD);
        out.append(gentleWakeUp ? 1 : 0).append(FIELD);
        out.append(escape(challenge)).append(FIELD);
        out.append(escape(challengeDifficulty)).append(FIELD);
        out.append(enabled ? 1 : 0);
        return out.toString();
    }

    /** @return the decoded alarm, or null when the record is missing, corrupt or from another version. */
    static AlarmSchedule decode(String encoded) {
        if (encoded == null) return null;
        String[] parts = encoded.split("\\|", -1);
        if (parts.length != FIELD_COUNT || !VERSION.equals(parts[0])) return null;
        try {
            boolean[] days = new boolean[7];
            if (!"-".equals(parts[4])) {
                for (String day : parts[4].split(",", -1)) {
                    int index = Integer.parseInt(day.trim());
                    if (index < 0 || index > 6) return null;
                    days[index] = true;
                }
            }
            return new AlarmSchedule(
                unescape(parts[1]),
                Integer.parseInt(parts[2]),
                Integer.parseInt(parts[3]),
                days,
                unescape(parts[5]),
                unescape(parts[6]),
                Integer.parseInt(parts[7]),
                "1".equals(parts[8]),
                unescape(parts[9]),
                unescape(parts[10]),
                "1".equals(parts[11])
            );
        } catch (RuntimeException broken) {
            return null;
        }
    }

    static String encodeList(List<AlarmSchedule> alarms) {
        StringBuilder out = new StringBuilder();
        for (AlarmSchedule alarm : alarms) {
            if (alarm == null) continue;
            if (out.length() > 0) out.append('\n');
            out.append(alarm.encode());
        }
        return out.toString();
    }

    static List<AlarmSchedule> decodeList(String encoded) {
        List<AlarmSchedule> out = new ArrayList<>();
        if (encoded == null || encoded.isEmpty()) return out;
        for (String line : encoded.split("\n", -1)) {
            AlarmSchedule alarm = decode(line.trim());
            if (alarm != null) out.add(alarm);
        }
        return out;
    }

    /** Finds an alarm by id; null when it is gone. */
    static AlarmSchedule findById(List<AlarmSchedule> alarms, String id) {
        if (id == null) return null;
        for (AlarmSchedule alarm : alarms) {
            if (id.equals(alarm.id)) return alarm;
        }
        return null;
    }

    // --------------------------------------------------------------------------- internals

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static String escape(String value) {
        if (value == null) return "";
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '%':
                    out.append("%25");
                    break;
                case '|':
                    out.append("%7C");
                    break;
                case '\n':
                    out.append("%0A");
                    break;
                case '\r':
                    out.append("%0D");
                    break;
                default:
                    out.append(c);
            }
        }
        return out.toString();
    }

    private static String unescape(String value) {
        if (value == null) return "";
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '%' && i + 2 < value.length()) {
                int hi = Character.digit(value.charAt(i + 1), 16);
                int lo = Character.digit(value.charAt(i + 2), 16);
                if (hi >= 0 && lo >= 0) {
                    out.append((char) (hi * 16 + lo));
                    i += 2;
                    continue;
                }
            }
            out.append(c);
        }
        return out.toString();
    }

    @Override
    public String toString() {
        return "AlarmSchedule(" + id + " " + timeLabel() + " days=" + repeatDays() + " enabled=" + enabled + ")";
    }
}
