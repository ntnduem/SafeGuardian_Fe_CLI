package com.safeguardian_fe_cli.accident;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.safeguardian_fe_cli.R;

final class EmergencyAlarmPlayer {
    private static final String TAG = "AccidentDetection";
    private static final int TONE_MS = 900;
    private static final int TONE_GAP_MS = 1100;

    private static final Handler handler = new Handler(Looper.getMainLooper());
    private static Ringtone ringtone;
    private static MediaPlayer mediaPlayer;
    private static ToneGenerator toneGenerator;
    private static AudioManager audioManager;
    private static AudioFocusRequest focusRequest;
    private static int originalAlarmVolume = -1;
    private static boolean playing;

    private static final Runnable toneLoop = new Runnable() {
        @Override
        public void run() {
            if (toneGenerator == null) return;
            try {
                toneGenerator.startTone(ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, TONE_MS);
            } catch (Exception ignored) {
                try {
                    toneGenerator.startTone(ToneGenerator.TONE_SUP_RADIO_ACK, TONE_MS);
                } catch (Exception ignored2) {
                }
            }
            handler.postDelayed(this, TONE_GAP_MS);
        }
    };

    private EmergencyAlarmPlayer() {}

    static synchronized void start(Context context) {
        Context app = context.getApplicationContext();
        if (playing && (isRingtonePlaying() || isMediaPlaying() || toneGenerator != null)) {
            return;
        }
        stop();
        playing = true;
        audioManager = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
        prepareOutput();
        requestFocus();

        AudioAttributes attributes = alarmAttributes();
        if (startBundledSound(app, attributes)) {
            return;
        }

        Uri soundUri = defaultAlarmUri(app);
        if (soundUri != null && startMediaPlayer(app, soundUri, attributes)) {
            return;
        }
        if (soundUri != null && startRingtone(app, soundUri, attributes)) {
            return;
        }
        startToneFallback();
    }

    static synchronized void stop() {
        playing = false;
        handler.removeCallbacks(toneLoop);
        if (toneGenerator != null) {
            try {
                toneGenerator.stopTone();
                toneGenerator.release();
            } catch (Exception ignored) {
            }
            toneGenerator = null;
        }
        if (ringtone != null) {
            try {
                ringtone.stop();
            } catch (Exception ignored) {
            }
            ringtone = null;
        }
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception ignored) {
            }
            mediaPlayer = null;
        }
        restoreOutput();
        abandonFocus();
    }

    static Uri bundledSoundUri(Context context) {
        return Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.emergency_countdown);
    }

    static Uri defaultAlarmUri(Context context) {
        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (uri == null) {
            uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        }
        if (uri == null) {
            uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE);
        }
        if (uri == null) {
            uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        return uri;
    }

    static AudioAttributes alarmAttributes() {
        AudioAttributes.Builder builder = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            builder.setHapticChannelsMuted(true);
        }
        return builder.build();
    }

    private static boolean startBundledSound(Context app, AudioAttributes attributes) {
        AssetFileDescriptor descriptor = null;
        try {
            descriptor = app.getResources().openRawResourceFd(R.raw.emergency_countdown);
            if (descriptor == null) {
                Log.w(TAG, "emergency_countdown.mp3 is missing from res/raw");
                return false;
            }
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(attributes);
            mediaPlayer.setDataSource(
                descriptor.getFileDescriptor(),
                descriptor.getStartOffset(),
                descriptor.getLength()
            );
            mediaPlayer.setLooping(true);
            mediaPlayer.setVolume(1f, 1f);
            mediaPlayer.prepare();
            mediaPlayer.start();
            return mediaPlayer.isPlaying();
        } catch (Exception error) {
            Log.w(TAG, "Bundled emergency_countdown.mp3 failed", error);
            if (mediaPlayer != null) {
                try {
                    mediaPlayer.release();
                } catch (Exception ignored) {
                }
                mediaPlayer = null;
            }
            return false;
        } finally {
            if (descriptor != null) {
                try {
                    descriptor.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private static boolean startMediaPlayer(Context app, Uri soundUri, AudioAttributes attributes) {
        try {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(attributes);
            mediaPlayer.setDataSource(app, soundUri);
            mediaPlayer.setLooping(true);
            mediaPlayer.setVolume(1f, 1f);
            mediaPlayer.prepare();
            mediaPlayer.start();
            return mediaPlayer.isPlaying();
        } catch (Exception error) {
            Log.w(TAG, "MediaPlayer alarm failed", error);
            if (mediaPlayer != null) {
                try {
                    mediaPlayer.release();
                } catch (Exception ignored) {
                }
                mediaPlayer = null;
            }
            return false;
        }
    }

    private static boolean startRingtone(Context app, Uri soundUri, AudioAttributes attributes) {
        try {
            ringtone = RingtoneManager.getRingtone(app, soundUri);
            if (ringtone == null) return false;
            ringtone.setAudioAttributes(attributes);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ringtone.setLooping(true);
            }
            ringtone.play();
            return ringtone.isPlaying();
        } catch (Exception error) {
            Log.w(TAG, "Ringtone alarm failed", error);
            ringtone = null;
            return false;
        }
    }

    private static void startToneFallback() {
        try {
            toneGenerator = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            handler.post(toneLoop);
        } catch (Exception error) {
            Log.w(TAG, "ToneGenerator STREAM_ALARM failed", error);
            try {
                toneGenerator = new ToneGenerator(AudioManager.STREAM_RING, 100);
                handler.post(toneLoop);
            } catch (Exception ringError) {
                Log.w(TAG, "ToneGenerator STREAM_RING failed", ringError);
                playing = false;
            }
        }
    }

    private static boolean isMediaPlaying() {
        try {
            return mediaPlayer != null && mediaPlayer.isPlaying();
        } catch (Exception ignored) {
            return false;
        }
    }

    private static boolean isRingtonePlaying() {
        try {
            return ringtone != null && ringtone.isPlaying();
        } catch (Exception ignored) {
            return false;
        }
    }

    private static void prepareOutput() {
        if (audioManager == null) return;
        originalAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
        boostIfSilent(AudioManager.STREAM_ALARM);
        try {
            audioManager.setSpeakerphoneOn(true);
        } catch (Exception ignored) {
        }
    }

    private static void boostIfSilent(int stream) {
        if (audioManager == null) return;
        int max = audioManager.getStreamMaxVolume(stream);
        int current = audioManager.getStreamVolume(stream);
        if (max > 0 && current == 0) {
            audioManager.setStreamVolume(stream, Math.max(1, max * 3 / 4), 0);
        }
    }

    private static void restoreOutput() {
        if (audioManager == null) return;
        try {
            if (originalAlarmVolume >= 0) {
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, originalAlarmVolume, 0);
            }
            audioManager.setSpeakerphoneOn(false);
        } catch (Exception ignored) {
        }
        originalAlarmVolume = -1;
    }

    private static void requestFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(alarmAttributes())
                .build();
            audioManager.requestAudioFocus(focusRequest);
        } else {
            audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        }
    }

    private static void abandonFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
            audioManager.abandonAudioFocusRequest(focusRequest);
        } else {
            audioManager.abandonAudioFocus(null);
        }
        focusRequest = null;
        audioManager = null;
    }
}
