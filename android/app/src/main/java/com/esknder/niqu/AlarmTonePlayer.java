package com.esknder.niqu;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;

/**
 * The sound of an alarm that rings while the app is closed.
 *
 * <p>Everything the web app plays is synthesised by the Web Audio API, which needs a live WebView;
 * a ringing alarm cannot depend on that. This player therefore loops a bundled tone through a
 * {@link MediaPlayer} on the phone's <b>alarm</b> audio stream
 * ({@link AudioAttributes#USAGE_ALARM}) - the stream the volume rocker's "alarm volume" slider
 * controls, and the one that is audible even when ringing/notification streams are silent.
 *
 * <p>Two behaviours are copied from the web engine so the alarm is equally hard to ignore:
 * <ul>
 *   <li><b>Gentle wake-up</b>: the tone fades in from 5 % to the configured volume over 30 s.</li>
 *   <li><b>Escalation</b>: {@link #setLevel(int)} raises the gain (and, from level 2, the playback
 *       speed, which makes the loop audibly more urgent) in the same 30 s / 60 s / 90 s ladder the
 *       ringing screen uses.</li>
 * </ul>
 *
 * <p>If the alarm stream is below the configured alarm volume when the alarm fires (very common:
 * the stream is often left near zero), the player raises it - and remembers what it was, so
 * stopping the alarm restores the user's setting unless they changed it themselves in between.
 */
final class AlarmTonePlayer {

    private static final String TAG = "NiquAlarmTone";
    private static final long RAMP_STEP_MS = 500L;
    private static final long GENTLE_RAMP_MS = 30_000L;
    private static final float GENTLE_START_GAIN = 0.05f;
    /** Loudness multiplier per escalation level (mirrors ESCALATION_BOOST in audio.ts). */
    private static final float[] ESCALATION_BOOST = { 1f, 1.15f, 1.3f, 1.45f };
    private static final float[] ESCALATION_SPEED = { 1f, 1f, 1.15f, 1.3f };

    private final Context context;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private MediaPlayer player;
    private int volumePercent = 80;
    private boolean gentleWakeUp;
    private float targetGain = 0.8f;
    private int level;
    private long rampStartedAt;

    private int raisedStreamVolumeFrom = -1;

    private final Runnable ramp = new Runnable() {
        @Override
        public void run() {
            if (player == null) return;
            float elapsed = (float) (SystemClock.elapsedRealtime() - rampStartedAt);
            if (!gentleWakeUp || elapsed >= GENTLE_RAMP_MS) {
                applyGain(targetGain);
                return;
            }
            float progress = elapsed / (float) GENTLE_RAMP_MS;
            applyGain(GENTLE_START_GAIN + (targetGain - GENTLE_START_GAIN) * progress);
            handler.postDelayed(this, RAMP_STEP_MS);
        }
    };

    AlarmTonePlayer(Context context) {
        this.context = context.getApplicationContext();
    }

    /** Starts looping the alarm tone. Safe to call twice (the previous tone is stopped first). */
    void start(int volumePercent, boolean gentleWakeUp) {
        stop();
        this.volumePercent = Math.max(0, Math.min(100, volumePercent));
        this.gentleWakeUp = gentleWakeUp;
        this.targetGain = Math.max(0.05f, Math.min(1f, this.volumePercent / 100f));
        this.level = 0;
        raiseAlarmStreamVolume(this.volumePercent);

        MediaPlayer created = createPlayer();
        if (created == null) {
            Log.e(TAG, "No alarm tone could be prepared; the ring will fall back to vibration only");
            return;
        }
        player = created;
        try {
            player.setLooping(true);
            player.setVolume(GENTLE_START_GAIN, GENTLE_START_GAIN);
            player.start();
        } catch (IllegalStateException notStarted) {
            Log.e(TAG, "Alarm tone could not start", notStarted);
            releasePlayer();
            return;
        }
        rampStartedAt = SystemClock.elapsedRealtime();
        applyGain(gentleWakeUp ? GENTLE_START_GAIN : targetGain);
        handler.postDelayed(ramp, RAMP_STEP_MS);
        Log.i(TAG, "Ringing on the alarm stream (volume=" + this.volumePercent + "%, gentle=" + gentleWakeUp + ")");
    }

    /** 0 = configured volume, 1 = louder, 2 = + faster loop, 3 = loudest + fastest. */
    void setLevel(int newLevel) {
        int clamped = Math.max(0, Math.min(ESCALATION_BOOST.length - 1, newLevel));
        if (clamped == level) return;
        level = clamped;
        if (player == null) return;
        applyGain(targetGain);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                player.setPlaybackParams(player.getPlaybackParams().setSpeed(ESCALATION_SPEED[level]));
            } catch (RuntimeException unsupported) {
                Log.w(TAG, "Playback speed is not supported on this device", unsupported);
            }
        }
        Log.i(TAG, "Escalated to level " + level);
    }

    boolean isPlaying() {
        if (player == null) return false;
        try {
            return player.isPlaying();
        } catch (IllegalStateException gone) {
            return false;
        }
    }

    /** Stops the tone and undoes the stream-volume change made in {@link #start}. */
    void stop() {
        handler.removeCallbacks(ramp);
        releasePlayer();
        restoreAlarmStreamVolume();
    }

    // ------------------------------------------------------------------------------- internals

    private MediaPlayer createPlayer() {
        // 1. The tone that ships with the app: deterministic and loud, whatever the phone's
        //    ringtone settings say.
        try {
            MediaPlayer bundled = new MediaPlayer();
            bundled.setAudioAttributes(audioAttributes());
            bundled.setWakeMode(context, PowerManager.PARTIAL_WAKE_LOCK);
            AssetFileDescriptor descriptor = context.getResources().openRawResourceFd(R.raw.niqu_alarm);
            try {
                bundled.setDataSource(descriptor.getFileDescriptor(), descriptor.getStartOffset(), descriptor.getLength());
            } finally {
                descriptor.close();
            }
            bundled.prepare();
            return bundled;
        } catch (Exception bundledFailed) {
            Log.w(TAG, "Bundled alarm tone failed, falling back to the system alarm sound", bundledFailed);
        }
        // 2. The phone's own default alarm sound.
        try {
            Uri defaultAlarm = Settings.System.DEFAULT_ALARM_ALERT_URI;
            MediaPlayer system = new MediaPlayer();
            system.setAudioAttributes(audioAttributes());
            system.setWakeMode(context, PowerManager.PARTIAL_WAKE_LOCK);
            system.setDataSource(context, defaultAlarm);
            system.prepare();
            return system;
        } catch (Exception systemFailed) {
            Log.e(TAG, "The system alarm sound could not be played either", systemFailed);
            return null;
        }
    }

    private static AudioAttributes audioAttributes() {
        return new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
    }

    private void applyGain(float base) {
        if (player == null) return;
        float gain = Math.max(0f, Math.min(1f, base * ESCALATION_BOOST[level]));
        try {
            player.setVolume(gain, gain);
        } catch (IllegalStateException gone) {
            // The player was released between two ticks; nothing to do.
        }
    }

    private void releasePlayer() {
        MediaPlayer current = player;
        player = null;
        if (current == null) return;
        try {
            if (current.isPlaying()) current.stop();
        } catch (IllegalStateException ignored) {
            // Already stopped.
        }
        try {
            current.release();
        } catch (RuntimeException ignored) {
            // Nothing sensible to do about a failing release.
        }
    }

    /**
     * Raises the alarm stream to the configured percentage - never lowers it - and remembers where
     * it started so the user's own setting can be put back when the alarm stops.
     */
    private void raiseAlarmStreamVolume(int percent) {
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) return;
        int max = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
        int target = Math.max(1, Math.round(max * (percent / 100f)));
        int current = audio.getStreamVolume(AudioManager.STREAM_ALARM);
        if (current >= target) return;
        try {
            audio.setStreamVolume(AudioManager.STREAM_ALARM, target, 0);
            raisedStreamVolumeFrom = current;
            Log.i(TAG, "Raised alarm volume " + current + " -> " + target + " of " + max);
        } catch (SecurityException blocked) {
            Log.w(TAG, "Not allowed to raise the alarm stream volume", blocked);
        }
    }

    private void restoreAlarmStreamVolume() {
        if (raisedStreamVolumeFrom < 0) return;
        int previous = raisedStreamVolumeFrom;
        raisedStreamVolumeFrom = -1;
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) return;
        try {
            int max = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int target = Math.max(1, Math.round(max * (volumePercent / 100f)));
            // Only restore when the user has not moved the slider themselves in the meantime.
            if (audio.getStreamVolume(AudioManager.STREAM_ALARM) == target) {
                audio.setStreamVolume(AudioManager.STREAM_ALARM, previous, 0);
            }
        } catch (SecurityException blocked) {
            Log.w(TAG, "Not allowed to restore the alarm stream volume", blocked);
        }
    }
}
