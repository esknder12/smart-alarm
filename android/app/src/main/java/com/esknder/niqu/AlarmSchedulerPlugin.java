package com.esknder.niqu;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Capacitor bridge to the native alarm engine: {@link AlarmScheduler} (exact alarms),
 * {@link RingSession} (what is ringing now) and the notification permissions the ring needs.
 *
 * <p>Web-side counterpart: {@code src/utils/alarmScheduler.ts}. The web layer mirrors its alarm
 * list here whenever it changes ({@code sync}), asks for {@code getState} to see what the phone
 * actually has armed, and is told about a ring with the {@code alarmTriggered} event so the puzzle
 * screen opens even when the activity was launched from the notification over the lock screen.
 *
 * <p>Methods (all resolve with the state object described in {@link #describeState}):
 * <ul>
 *   <li>{@code sync({ alarms })} - makes the native schedule match the web list</li>
 *   <li>{@code cancel({ id })} / {@code cancelAll()}</li>
 *   <li>{@code getState()} - armed alarms, permissions, device model, current ring</li>
 *   <li>{@code takeOverRing()} - the app is playing the alarm itself; silence the service's tone</li>
 *   <li>{@code stopRing()} - the puzzle was solved; end the ring and release the key lock</li>
 *   <li>{@code openSettings({ target })} - 'exactAlarm' or 'fullScreenIntent' settings screen</li>
 *   <li>{@code checkPermissions()} / {@code requestPermissions()} - POST_NOTIFICATIONS</li>
 * </ul>
 *
 * <p>Event: {@code alarmTriggered} with the ringing alarm, and {@code ringStopped} when it ends.
 */
@CapacitorPlugin(
    name = "AlarmScheduler",
    permissions = { @Permission(alias = AlarmSchedulerPlugin.PERMISSION_NOTIFICATIONS, strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class AlarmSchedulerPlugin extends Plugin {

    static final String PERMISSION_NOTIFICATIONS = "notifications";
    static final String EVENT_ALARM_TRIGGERED = "alarmTriggered";
    static final String EVENT_RING_STOPPED = "ringStopped";

    private static final String TAG = "NiquAlarmScheduler";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean ringWasActive;

    private final RingSession.Listener ringListener = this::onRingSessionChanged;

    @Override
    public void load() {
        ringWasActive = RingSession.shared().isRinging();
        RingSession.shared().addListener(ringListener);
    }

    @Override
    protected void handleOnDestroy() {
        RingSession.shared().removeListener(ringListener);
    }

    // ----------------------------------------------------------------------------------- methods

    @PluginMethod
    public void sync(PluginCall call) {
        List<AlarmSchedule> alarms = parseAlarms(call.getArray("alarms"));
        AlarmScheduler.SyncResult result = new AlarmScheduler(getContext()).sync(alarms);
        call.resolve(describeState(result, alarms));
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("An alarm id is required");
            return;
        }
        Context context = getContext();
        new AlarmScheduler(context).cancel(id);
        List<AlarmSchedule> remaining = new ArrayList<>();
        for (AlarmSchedule alarm : AlarmStore.load(context)) {
            if (!id.equals(alarm.id)) remaining.add(alarm);
        }
        AlarmStore.save(context, remaining);
        call.resolve(describeState(null, remaining));
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        Context context = getContext();
        new AlarmScheduler(context).cancelAll();
        AlarmStore.save(context, new ArrayList<>());
        call.resolve(describeState(null, new ArrayList<>()));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(describeState(null, AlarmStore.load(getContext())));
    }

    @PluginMethod
    public void takeOverRing(PluginCall call) {
        Context context = getContext();
        if (RingSession.shared().isRinging()) {
            context.startService(AlarmRingService.takeOverIntent(context));
        }
        call.resolve(describeState(null, AlarmStore.load(context)));
    }

    @PluginMethod
    public void stopRing(PluginCall call) {
        Context context = getContext();
        RingSession.shared().stop();
        context.stopService(new Intent(context, AlarmRingService.class));
        call.resolve(describeState(null, AlarmStore.load(context)));
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Context context = getContext();
        String target = call.getString("target", "exactAlarm");
        Intent intent;
        if ("fullScreenIntent".equals(target)) {
            intent = AlarmScheduler.fullScreenIntentPermissionIntent(context);
        } else if ("overlay".equals(target)) {
            intent = AlarmScheduler.overlayPermissionIntent(context);
        } else {
            intent = AlarmScheduler.exactAlarmPermissionIntent(context);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException missing) {
            call.reject("No system screen for '" + target + "' on this device", missing);
        }
    }

    // ------------------------------------------------------------------------------------ events

    private void onRingSessionChanged() {
        boolean ringing = RingSession.shared().isRinging();
        if (ringing == ringWasActive) return;
        ringWasActive = ringing;
        RingSession.Snapshot snapshot = RingSession.shared().snapshot();
        // WebView calls must happen on the main thread; the session can change on any thread.
        mainHandler.post(() -> {
            if (ringing) {
                JSObject payload = ringingPayload(snapshot);
                notifyListeners(EVENT_ALARM_TRIGGERED, payload == null ? new JSObject() : payload);
            } else {
                notifyListeners(EVENT_RING_STOPPED, new JSObject());
            }
        });
    }

    // ------------------------------------------------------------------------------ the state

    private JSObject describeState(AlarmScheduler.SyncResult result, List<AlarmSchedule> alarms) {
        Context context = getContext();
        AlarmScheduler scheduler = new AlarmScheduler(context);
        AlarmScheduler.SyncResult state = result != null ? result : scheduler.describe(alarms);

        JSObject out = new JSObject();
        out.put("scheduledCount", state.scheduledCount);
        out.put("nextTriggerAt", state.nextTriggerAt);
        out.put("nextAlarmId", state.nextAlarmId);
        out.put("exactAlarmsAllowed", state.exact);
        out.put("notificationsAllowed", AlarmScheduler.notificationsAllowed(context));
        out.put("fullScreenIntentAllowed", AlarmScheduler.canUseFullScreenIntent(context));
        out.put("overlayAllowed", AlarmScheduler.canDrawOverlays(context));
        out.put("deviceModel", deviceModel());
        out.put("sdkInt", Build.VERSION.SDK_INT);
        out.put("ringing", ringingPayload(RingSession.shared().snapshot()));

        // The key-block telemetry answers the question "was the volume rocker really swallowed?":
        // engaged = keys are locked right now, heldByService = the ringing service (not the web
        // lease) is the one holding them, blockedPresses = presses swallowed this session.
        MainActivity activity = getActivity() instanceof MainActivity ? (MainActivity) getActivity() : null;
        boolean ringing = RingSession.shared().isRinging();
        if (activity != null) {
            AlarmKeyLock lock = activity.getAlarmLock();
            out.put("keyBlockEngaged", lock.isEngaged());
            out.put("keyBlockHeldByService", lock.isRingLockActive());
            out.put("blockedPresses", lock.getBlockedPresses());
        } else {
            out.put("keyBlockEngaged", ringing);
            out.put("keyBlockHeldByService", ringing);
            out.put("blockedPresses", 0);
        }
        return out;
    }

    private static JSObject ringingPayload(RingSession.Snapshot snapshot) {
        if (snapshot == null || !snapshot.ringing || snapshot.alarm == null) return null;
        JSObject out = new JSObject();
        out.put("alarmId", snapshot.alarm.id);
        out.put("label", snapshot.alarm.label);
        out.put("time", snapshot.alarm.timeLabel());
        out.put("hour", snapshot.alarm.hour);
        out.put("minute", snapshot.alarm.minute);
        out.put("sound", snapshot.alarm.sound);
        out.put("volume", snapshot.alarm.volume);
        out.put("gentleWakeUp", snapshot.alarm.gentleWakeUp);
        out.put("challenge", snapshot.alarm.challenge);
        out.put("challengeDifficulty", snapshot.alarm.challengeDifficulty);
        out.put("barcodeValue", snapshot.alarm.barcodeValue);
        out.put("startedAt", snapshot.startedAtMillis);
        out.put("ringingSeconds", snapshot.ringingSeconds(System.currentTimeMillis()));
        return out;
    }

    private static String deviceModel() {
        String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.trim();
        String model = Build.MODEL == null ? "" : Build.MODEL.trim();
        String name = (manufacturer + " " + model).trim();
        return name.isEmpty() ? "Android device" : name;
    }

    // -------------------------------------------------------------------------------- parsing

    /** Turns the web layer's alarm objects into the native value type; unknown fields are ignored. */
    private static List<AlarmSchedule> parseAlarms(JSArray array) {
        List<AlarmSchedule> alarms = new ArrayList<>();
        if (array == null) return alarms;
        for (int i = 0; i < array.length(); i++) {
            Object raw = array.opt(i);
            if (!(raw instanceof JSONObject)) continue;
            JSONObject json = (JSONObject) raw;
            List<Integer> days = new ArrayList<>();
            JSONArray jsonDays = json.optJSONArray("days");
            if (jsonDays != null) {
                for (int d = 0; d < jsonDays.length(); d++) {
                    int day = jsonDays.optInt(d, -1);
                    if (day >= 0 && day <= 6) days.add(day);
                }
            }
            String id = json.optString("id", "");
            if (id.isEmpty()) {
                Log.w(TAG, "Skipping an alarm without an id");
                continue;
            }
            alarms.add(
                AlarmSchedule.fromDayList(
                    id,
                    json.optInt("hour", 0),
                    json.optInt("minute", 0),
                    days,
                    json.optString("label", ""),
                    json.optString("sound", "sunrise"),
                    json.optInt("volume", 80),
                    json.optBoolean("gentleWakeUp", false),
                    json.optString("challenge", "math"),
                    json.optString("challengeDifficulty", "easy"),
                    json.optString("barcodeValue", ""),
                    json.optBoolean("enabled", false)
                )
            );
        }
        return alarms;
    }
}
