package com.safeguardian_fe_cli.accident;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.provider.Settings;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.safeguardian_fe_cli.MainActivity;

public class AccidentDetectionModule extends ReactContextBaseJavaModule {
    private static final String COUNTDOWN_SOUND_RESOURCE = "emergency_countdown";
    private static final String LOCK_SCREEN_CHANNEL_ID = "safeguardian_emergency_full_screen_v3";
    private static ReactApplicationContext reactContext;
    private MediaPlayer countdownPlayer;

    public AccidentDetectionModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
        AccidentDetectionService.setEventSink(AccidentDetectionModule::emitEvent);
    }

    @NonNull
    @Override
    public String getName() {
        return "AccidentDetection";
    }

    @ReactMethod
    public void startMonitoring(ReadableMap config, Promise promise) {
        Intent intent = new Intent(getReactApplicationContext(), AccidentDetectionService.class);
        intent.setAction(AccidentDetectionService.ACTION_START);

        if (config.hasKey("threshold")) {
            intent.putExtra("threshold", config.getDouble("threshold"));
        }
        if (config.hasKey("homeLatitude") && config.hasKey("homeLongitude")) {
            intent.putExtra("homeLatitude", config.getDouble("homeLatitude"));
            intent.putExtra("homeLongitude", config.getDouble("homeLongitude"));
        }
        if (config.hasKey("homeRadiusMeters")) {
            intent.putExtra("homeRadiusMeters", config.getDouble("homeRadiusMeters"));
        }
        putOptionalStringExtra(config, intent, "emergencyFullName");
        putOptionalStringExtra(config, intent, "emergencyBloodType");
        putOptionalStringExtra(config, intent, "emergencyMedicalNote");
        putOptionalStringExtra(config, intent, "emergencyContactsText");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getReactApplicationContext().startForegroundService(intent);
        } else {
            getReactApplicationContext().startService(intent);
        }
        promise.resolve(true);
    }

    @ReactMethod
    public void stopMonitoring(Promise promise) {
        Intent intent = new Intent(getReactApplicationContext(), AccidentDetectionService.class);
        intent.setAction(AccidentDetectionService.ACTION_STOP);
        getReactApplicationContext().startService(intent);
        promise.resolve(true);
    }

    @ReactMethod
    public void markSafe(Promise promise) {
        Intent intent = new Intent(getReactApplicationContext(), AccidentDetectionService.class);
        intent.setAction(AccidentDetectionService.ACTION_MARK_SAFE);
        getReactApplicationContext().startService(intent);
        promise.resolve(true);
    }

    @ReactMethod
    public void markEmergency(Promise promise) {
        Intent intent = new Intent(getReactApplicationContext(), AccidentDetectionService.class);
        intent.setAction(AccidentDetectionService.ACTION_MARK_EMERGENCY);
        getReactApplicationContext().startService(intent);
        promise.resolve(true);
    }

    @ReactMethod
    public void playCountdownSound(Promise promise) {
        try {
            int soundResId = getReactApplicationContext()
                .getResources()
                .getIdentifier(
                    COUNTDOWN_SOUND_RESOURCE,
                    "raw",
                    getReactApplicationContext().getPackageName()
                );

            if (soundResId == 0) {
                promise.resolve(false);
                return;
            }

            stopCountdownPlayer();
            AssetFileDescriptor descriptor = getReactApplicationContext()
                .getResources()
                .openRawResourceFd(soundResId);
            if (descriptor == null) {
                promise.resolve(false);
                return;
            }

            countdownPlayer = new MediaPlayer();
            countdownPlayer.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            countdownPlayer.setDataSource(
                descriptor.getFileDescriptor(),
                descriptor.getStartOffset(),
                descriptor.getLength()
            );
            descriptor.close();
            countdownPlayer.setLooping(true);
            countdownPlayer.prepare();
            countdownPlayer.start();
            promise.resolve(true);
        } catch (Exception error) {
            stopCountdownPlayer();
            promise.reject("COUNTDOWN_SOUND_ERROR", error);
        }
    }

    @ReactMethod
    public void stopCountdownSound(Promise promise) {
        stopCountdownPlayer();
        promise.resolve(true);
    }

    @ReactMethod
    public void getAlarmVolumeInfo(Promise promise) {
        AudioManager audioManager = (AudioManager) getReactApplicationContext()
            .getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) {
            promise.reject("AUDIO_MANAGER_UNAVAILABLE", "Không thể truy cập AudioManager.");
            return;
        }

        int currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
        int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
        WritableMap map = Arguments.createMap();
        map.putString("stream", "ALARM");
        map.putInt("currentVolume", currentVolume);
        map.putInt("maxVolume", maxVolume);
        map.putDouble("volumePercent", maxVolume > 0 ? (currentVolume * 100.0 / maxVolume) : 0);
        promise.resolve(map);
    }

    @ReactMethod
    public void getLockScreenPermissionStatus(Promise promise) {
        WritableMap map = Arguments.createMap();
        boolean requiresFullScreenPermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE;
        boolean canUseFullScreenIntent = true;

        if (requiresFullScreenPermission) {
            NotificationManager manager = (NotificationManager) getReactApplicationContext()
                .getSystemService(Context.NOTIFICATION_SERVICE);
            canUseFullScreenIntent = manager != null && manager.canUseFullScreenIntent();
        }

        map.putBoolean("requiresFullScreenPermission", requiresFullScreenPermission);
        map.putBoolean("canUseFullScreenIntent", canUseFullScreenIntent);
        promise.resolve(map);
    }

    @ReactMethod
    public void openLockScreenPermissionSettings(Promise promise) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                intent.setData(Uri.parse("package:" + getReactApplicationContext().getPackageName()));
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getReactApplicationContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception error) {
            promise.reject("LOCK_SCREEN_PERMISSION_SETTINGS_ERROR", error);
        }
    }

    @ReactMethod
    public void showEmergencyLockScreen(ReadableMap data, Promise promise) {
        try {
            createLockScreenNotificationChannel();

            String fullName = getString(data, "fullName", "Người dùng SafeGuardian");
            String bloodType = getString(data, "bloodType", "Chưa cập nhật");
            String medicalNote = getString(data, "medicalNote", "Không có");
            String contactsText = getString(data, "contactsText", "Chưa có liên hệ khẩn cấp");
            String locationText = getString(data, "locationText", "");

            Intent intent = new Intent(getReactApplicationContext(), MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra("openEmergencyAlert", true);
            intent.putExtra("fullName", fullName);
            intent.putExtra("bloodType", bloodType);
            intent.putExtra("medicalNote", medicalNote);
            intent.putExtra("contactsText", contactsText);
            intent.putExtra("locationText", locationText);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                getReactApplicationContext(),
                911,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            String title = "Tai nạn giao thông nghiêm trọng";
            String text = fullName + " không phản hồi sau 30 giây";
            String bigText = "Người dùng: " + fullName
                + "\nNhóm máu: " + bloodType
                + "\nHồ sơ y tế: " + medicalNote
                + "\nLiên hệ khẩn cấp:\n" + contactsText
                + (locationText.isEmpty() ? "" : "\nVị trí: " + locationText);

            Notification notification = new NotificationCompat.Builder(getReactApplicationContext(), LOCK_SCREEN_CHANNEL_ID)
                .setSmallIcon(com.safeguardian_fe_cli.R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(bigText))
                .setContentIntent(pendingIntent)
                .setFullScreenIntent(pendingIntent, true)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setOngoing(true)
                .setAutoCancel(false)
                .build();

            NotificationManager manager = (NotificationManager) getReactApplicationContext()
                .getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.notify(9120, notification);
            }

            try {
                getReactApplicationContext().startActivity(intent);
            } catch (Exception ignored) {
                // Full-screen notification remains the fallback if Android blocks direct background launch.
            }
            promise.resolve(true);
        } catch (Exception error) {
            promise.reject("LOCK_SCREEN_NOTIFICATION_ERROR", error);
        }
    }

    @ReactMethod
    public void clearEmergencyLockScreen(Promise promise) {
        NotificationManager manager = (NotificationManager) getReactApplicationContext()
            .getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(9120);
        }
        promise.resolve(true);
    }

    @ReactMethod
    public void getSnapshot(Promise promise) {
        WritableMap map = Arguments.createMap();
        map.putString("mode", AccidentDetectionService.getCurrentMode());
        map.putDouble("rawAcceleration", AccidentDetectionService.getLastRawAcceleration());
        map.putDouble("impactAcceleration", AccidentDetectionService.getLastImpactAcceleration());
        promise.resolve(map);
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required by NativeEventEmitter.
    }

    @ReactMethod
    public void removeListeners(double count) {
        // Required by NativeEventEmitter.
    }

    private void stopCountdownPlayer() {
        if (countdownPlayer == null) {
            return;
        }
        if (countdownPlayer.isPlaying()) {
            countdownPlayer.stop();
        }
        countdownPlayer.release();
        countdownPlayer = null;
    }

    private void createLockScreenNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            LOCK_SCREEN_CHANNEL_ID,
            "SafeGuardian Emergency",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Cảnh báo khẩn cấp hiển thị trên màn hình khóa");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);

        NotificationManager manager = (NotificationManager) getReactApplicationContext()
            .getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private String getString(ReadableMap data, String key, String fallback) {
        if (data == null || !data.hasKey(key) || data.isNull(key)) {
            return fallback;
        }
        String value = data.getString(key);
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private void putOptionalStringExtra(ReadableMap map, Intent intent, String key) {
        if (map.hasKey(key) && !map.isNull(key)) {
            String value = map.getString(key);
            if (value != null) {
                intent.putExtra(key, value);
            }
        }
    }

    private static void emitEvent(String eventName, WritableMap payload) {
        if (reactContext == null || !reactContext.hasActiveReactInstance()) {
            return;
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, payload);
    }
}
