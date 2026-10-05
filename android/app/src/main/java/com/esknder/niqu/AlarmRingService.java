package com.esknder.niqu;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * The alarm itself: a foreground service that rings whether or not the app is open.
 *
 * <p>Phase 1 rang from a JavaScript timer, so an alarm could not fire while the app was closed, and
 * the hardware-button lock only existed while the page was alive. This service is started by
 * {@link AlarmReceiver} from an {@link android.app.AlarmManager} exact alarm, and:
 * <ul>
 *   <li>plays the alarm tone on the phone's <b>alarm</b> stream ({@link AlarmTonePlayer});</li>
 *   <li>posts a high-priority notification with a <b>full-screen intent</b> that brings the puzzle
 *       screen up over the lock screen, and holds the CPU awake so the ring cannot be throttled;</li>
 *   <li>publishes the ringing session to {@link RingSession}, which is what ties the volume-key
 *       block to the service: {@link AlarmKeyLock} swallows the keys while this service rings, even
 *       if the WebView never ran (see {@code MainActivity});</li>
 *   <li>vibrates, escalates loudness at 30 s / 60 s / 90 s, and gives up by itself after 30 minutes
 *       so a phone can never ring forever.</li>
 * </ul>
 *
 * <p>When the app does come up, the web layer tells us to hand over the sound
 * ({@link #ACTION_TAKE_OVER}): the Web Audio engine takes over with the user's chosen tone, while
 * the notification, the session and therefore the key lock stay exactly as they are. The alarm ends
 * only when the puzzle is solved and the web layer asks for it ({@code stopRing}), or when the
 * auto-stop cap is reached.
 */
public class AlarmRingService extends Service {

    private static final String TAG = "NiquAlarmRing";

    static final String ACTION_RING = "com.esknder.niqu.service.RING";
    static final String ACTION_TAKE_OVER = "com.esknder.niqu.service.TAKE_OVER";

    static final String CHANNEL_ID = "niqu_alarm_ringing";
    static final int NOTIFICATION_ID = 4711;

    /** Loudness escalation, mirroring the ringing screen's 30 s / 60 s / 90 s ladder. */
    static final long ESCALATE_1_MS = 30_000L;
    static final long ESCALATE_2_MS = 60_000L;
    static final long ESCALATE_3_MS = 90_000L;
    /** Hard cap: no alarm may ring for longer than this. */
    static final long AUTO_STOP_MS = 30L * 60L * 1000L;
    private static final long VIBRATE_INTERVAL_MS = 2_500L;

    private static final long[] VIBRATE_PATTERN = { 400, 150, 400, 150, 800 };

    /** The running ring, if any. Same process as the activity, so a plain static is enough. */
    private static AlarmRingService running;

    /**
     * Called by the activity when the app goes to the background. The WebView's audio is throttled
     * (or stopped) there, so if the app had taken the sound over, the service takes it back - a
     * ringing alarm must never go quiet because the phone was locked again.
     */
    static void appMovedToBackground() {
        AlarmRingService service = running;
        if (service != null) service.resumeNativeAudioIfTakenOver();
    }

    private final Handler handler = new Handler(Looper.getMainLooper());

    private AlarmTonePlayer player;
    private AlarmSchedule alarm;
    private long startedAt;
    private boolean nativeAudioActive;
    private boolean finished;
    private PowerManager.WakeLock wakeLock;
    private Vibrator vibrator;

    /** Builds the intent that starts (or resumes) the ring. */
    static Intent ringIntent(Context context, AlarmSchedule alarm) {
        return new Intent(context, AlarmRingService.class).setAction(ACTION_RING).putExtra(AlarmScheduler.EXTRA_ALARM, alarm.encode());
    }

    /** Tells a ringing service that the app is now playing the alarm itself. */
    static Intent takeOverIntent(Context context) {
        return new Intent(context, AlarmRingService.class).setAction(ACTION_TAKE_OVER);
    }

    private final Runnable vibrateTick = new Runnable() {
        @Override
        public void run() {
            vibrateOnce();
            handler.postDelayed(this, VIBRATE_INTERVAL_MS);
        }
    };

    private final Runnable autoStop = new Runnable() {
        @Override
        public void run() {
            Log.w(TAG, "Auto-stopping the alarm after " + (AUTO_STOP_MS / 60000L) + " minutes");
            stopRinging();
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_TAKE_OVER.equals(action)) {
            if (alarm == null) {
                stopSelf(startId); // nothing is ringing; do not keep this service alive
                return START_NOT_STICKY;
            }
            takeOverNativeAudio();
            return START_REDELIVER_INTENT;
        }
        AlarmSchedule fromIntent = intent != null ? AlarmSchedule.decode(intent.getStringExtra(AlarmScheduler.EXTRA_ALARM)) : null;
        if (fromIntent != null) {
            startRinging(fromIntent, System.currentTimeMillis());
        } else if (alarm == null) {
            // The system re-created us without the original intent (or with a stale one).
            resumePersistedRingOrStop();
        }
        return START_REDELIVER_INTENT;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ---------------------------------------------------------------------------- ring control

    private void startRinging(AlarmSchedule newAlarm, long ringStartedAt) {
        if (alarm != null && newAlarm.isSameAs(alarm) && !finished) {
            return; // the same alarm was delivered twice (re-delivery after a process restart)
        }
        if (player != null) {
            player.stop();
        }
        if (player == null) {
            player = new AlarmTonePlayer(this);
        }
        // Nothing from the previous ring may survive: its escalation timers, vibration tick and
        // auto-stop are re-posted below.
        handler.removeCallbacksAndMessages(null);
        finished = false;
        running = this;
        alarm = newAlarm;
        startedAt = ringStartedAt;
        nativeAudioActive = true;

        AlarmStore.saveRinging(this, alarm, startedAt);
        RingSession.shared().start(alarm, startedAt);
        createChannel();
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(alarm), foregroundServiceType());

        acquireWakeLock();
        player.start(alarm.volume, alarm.gentleWakeUp);
        startVibration();

        handler.removeCallbacks(autoStop);
        handler.postDelayed(autoStop, AUTO_STOP_MS);
        handler.postDelayed(escalateTo1, ESCALATE_1_MS);
        handler.postDelayed(escalateTo2, ESCALATE_2_MS);
        handler.postDelayed(escalateTo3, ESCALATE_3_MS);

        Log.i(TAG, "Ringing " + alarm + " on the alarm stream");
    }

    /** Ends the ring: releases the session (and with it the button lock), audio, and notification. */
    private void stopRinging() {
        cleanup();
        stopSelf();
    }

    /** The app stopped playing (backgrounded, screen off): ring from here again. */
    private void resumeNativeAudioIfTakenOver() {
        if (nativeAudioActive || !RingSession.shared().isRinging() || player == null || alarm == null) return;
        nativeAudioActive = true;
        player.start(alarm.volume, alarm.gentleWakeUp);
        Log.i(TAG, "App left the foreground; the service is ringing again");
    }

    private void takeOverNativeAudio() {
        if (!nativeAudioActive) return;
        nativeAudioActive = false;
        player.stop();
        Log.i(TAG, "The app is playing the alarm itself; native tone silenced");
    }

    private void resumePersistedRingOrStop() {
        AlarmStore.Ringing record = AlarmStore.loadRinging(this);
        long now = System.currentTimeMillis();
        if (record != null && record.alarm != null && now - record.startedAt < AUTO_STOP_MS) {
            Log.i(TAG, "Resuming the persisted ring after a restart");
            startRinging(record.alarm, record.startedAt);
        } else {
            cleanup();
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        if (running == this) running = null;
        cleanup();
        super.onDestroy();
    }

    /** Idempotent teardown; also runs when the system kills the service. */
    private void cleanup() {
        if (finished) return;
        finished = true;
        handler.removeCallbacksAndMessages(null);
        AlarmStore.clearRinging(this);
        RingSession.shared().stop();
        if (player != null) player.stop();
        stopVibration();
        releaseWakeLock();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        alarm = null;
    }

    // ------------------------------------------------------------------------- the notification

    private Notification buildNotification(AlarmSchedule ringing) {
        PendingIntent open = openPuzzleIntent(ringing);
        String label = ringing.label.isEmpty() ? getString(R.string.alarm_notification_default_label) : ringing.label;
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_niqu_alarm)
            .setContentTitle(getString(R.string.alarm_notification_title, label, ringing.timeLabel()))
            .setContentText(getString(R.string.alarm_notification_text))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSilent(true) // the alarm is played by this service, not by the notification
            .setOngoing(true)
            .setAutoCancel(false)
            .setShowWhen(true)
            .setWhen(startedAt)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .build();
    }

    /**
     * The puzzle screen, over the lock screen. The activity itself is {@code showWhenLocked} and
     * {@code turnScreenOn}, so the full-screen intent does not need the keyguard to be unlocked.
     */
    private PendingIntent openPuzzleIntent(AlarmSchedule ringing) {
        Intent open = AlarmScheduler.ringScreenIntent(this, ringing);
        return PendingIntent.getActivity(this, AlarmScheduler.REQUEST_CODE_SHOW, open, AlarmScheduler.PENDING_INTENT_FLAGS);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.alarm_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(getString(R.string.alarm_channel_description));
        channel.setSound(null, null); // the service owns the audio (alarm stream, escalation)
        channel.enableVibration(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private int foregroundServiceType() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return 0;
        return ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
    }

    // ---------------------------------------------------------------------------------- the rest

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (power == null) return;
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "niqu:alarm-ringing");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(AUTO_STOP_MS + 60_000L);
    }

    private void releaseWakeLock() {
        if (wakeLock == null) return;
        try {
            if (wakeLock.isHeld()) wakeLock.release();
        } catch (RuntimeException ignored) {
            // The system already took it back.
        }
        wakeLock = null;
    }

    private void startVibration() {
        vibrator = vibrator();
        if (vibrator == null || !vibrator.hasVibrator()) {
            vibrator = null;
            return;
        }
        handler.post(vibrateTick);
    }

    private void stopVibration() {
        handler.removeCallbacks(vibrateTick);
        if (vibrator == null) return;
        try {
            vibrator.cancel();
        } catch (RuntimeException ignored) {
            // Nothing to cancel.
        }
    }

    private void vibrateOnce() {
        if (vibrator == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                vibrator.vibrate(VibrationEffect.createWaveform(VIBRATE_PATTERN, -1), VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM));
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createWaveform(VIBRATE_PATTERN, -1),
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
            } else {
                vibrator.vibrate(VIBRATE_PATTERN, -1);
            }
        } catch (RuntimeException ignored) {
            // Some OEMs refuse alarm-usage vibration without extra permissions; the tone still rings.
        }
    }

    private Vibrator vibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager != null ? manager.getDefaultVibrator() : null;
        }
        return (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    }

    private final Runnable escalateTo1 = () -> escalateTo(1);
    private final Runnable escalateTo2 = () -> escalateTo(2);
    private final Runnable escalateTo3 = () -> escalateTo(3);

    private void escalateTo(int level) {
        if (player != null) player.setLevel(level);
    }
}
