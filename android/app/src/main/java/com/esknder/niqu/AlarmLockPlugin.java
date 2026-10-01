package com.esknder.niqu;

import android.util.Log;
import android.view.KeyEvent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JavaScript bridge to the native hardware-button lock ({@link AlarmKeyLock}).
 *
 * <p>Web-side counterpart: {@code src/utils/alarmLock.ts}. The ringing screen engages the lock when
 * the alarm starts, renews it every second or so while the alarm rings, and releases it once the
 * puzzle is solved and the alarm is switched off. See {@link AlarmKeyLock} for why it is a lease.
 *
 * <p>Methods (all resolve with {@code { engaged, blockedPresses, leaseRemainingMs }}):
 * <ul>
 *   <li>{@code engage({ leaseMs })} - arm the lock, or renew it if already engaged</li>
 *   <li>{@code release()} - release it immediately</li>
 *   <li>{@code getState()} - read the current state</li>
 * </ul>
 *
 * <p>Event: {@code hardwareKeyBlocked} with {@code { keyCode, key, blockedPresses }}, fired for each
 * swallowed button press so the UI can show feedback.
 */
@CapacitorPlugin(name = "AlarmLock")
public class AlarmLockPlugin extends Plugin {

    static final String EVENT_KEY_BLOCKED = "hardwareKeyBlocked";
    private static final String TAG = "AlarmLock";

    @Override
    public void load() {
        MainActivity host = host();
        if (host == null) {
            Log.w(TAG, "Host activity is not MainActivity; hardware-key lock is unavailable");
            return;
        }
        host.getAlarmLock().setKeyListener(this::onKeyBlocked);
    }

    @Override
    protected void handleOnDestroy() {
        MainActivity host = host();
        if (host != null) {
            host.getAlarmLock().setKeyListener(null);
        }
    }

    @PluginMethod
    public void engage(PluginCall call) {
        MainActivity host = host();
        if (host == null) {
            call.reject("Alarm lock unavailable: host activity is not ready");
            return;
        }
        Integer lease = call.getInt("leaseMs", (int) AlarmKeyLock.DEFAULT_LEASE_MS);
        host.engageAlarmLock(lease != null ? lease : AlarmKeyLock.DEFAULT_LEASE_MS);
        call.resolve(describe(host.getAlarmLock()));
    }

    @PluginMethod
    public void release(PluginCall call) {
        MainActivity host = host();
        if (host == null) {
            call.reject("Alarm lock unavailable: host activity is not ready");
            return;
        }
        host.releaseAlarmLock();
        call.resolve(describe(host.getAlarmLock()));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        MainActivity host = host();
        if (host == null) {
            call.reject("Alarm lock unavailable: host activity is not ready");
            return;
        }
        call.resolve(describe(host.getAlarmLock()));
    }

    private void onKeyBlocked(int keyCode, int blockedPresses) {
        Log.i(TAG, "Swallowed " + keyName(keyCode) + " (press #" + blockedPresses + ")");
        JSObject data = new JSObject();
        data.put("keyCode", keyCode);
        data.put("key", keyName(keyCode));
        data.put("blockedPresses", blockedPresses);
        notifyListeners(EVENT_KEY_BLOCKED, data);
    }

    private MainActivity host() {
        return getActivity() instanceof MainActivity ? (MainActivity) getActivity() : null;
    }

    private static JSObject describe(AlarmKeyLock lock) {
        JSObject state = new JSObject();
        state.put("engaged", lock.isEngaged());
        state.put("blockedPresses", lock.getBlockedPresses());
        state.put("leaseRemainingMs", lock.getLeaseRemainingMs());
        return state;
    }

    /** Stable names for the web layer; keep in sync with {@code HardwareKey} in alarmLock.ts. */
    private static String keyName(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_VOLUME_DOWN:
                return "volumeDown";
            case KeyEvent.KEYCODE_VOLUME_UP:
                return "volumeUp";
            case KeyEvent.KEYCODE_VOLUME_MUTE:
                return "volumeMute";
            case KeyEvent.KEYCODE_BACK:
                return "back";
            default:
                return "other";
        }
    }
}
