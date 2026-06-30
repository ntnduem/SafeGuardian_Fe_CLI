package com.safeguardian_fe_cli.accident;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.safeguardian_fe_cli.MainActivity;
import com.safeguardian_fe_cli.R;

public class AccidentDetectionService extends Service implements SensorEventListener, LocationListener {
    public static final String ACTION_START = "com.safeguardian_fe_cli.accident.START";
    public static final String ACTION_STOP = "com.safeguardian_fe_cli.accident.STOP";
    public static final String ACTION_MARK_SAFE = "com.safeguardian_fe_cli.accident.MARK_SAFE";
    public static final String ACTION_MARK_EMERGENCY = "com.safeguardian_fe_cli.accident.MARK_EMERGENCY";

    private static final String CHANNEL_ID = "safeguardian_accident_detection";
    private static final String SUSPECT_CHANNEL_ID = "safeguardian_accident_suspect_v2";
    private static final int NOTIFICATION_ID = 4012;
    private static final int SUSPECT_NOTIFICATION_ID = 4013;
    private static final double GRAVITY_MS2 = 9.80665;
    private static final long TRIGGER_COOLDOWN_MS = 5000;
    private static final long HOME_GPS_INTERVAL_MS = 10 * 60 * 1000;
    private static final long OUTDOOR_GPS_INTERVAL_MS = 5 * 60 * 1000;
    private static final long SUSPECT_GPS_INTERVAL_MS = 1000;

    public interface EventSink {
        void emit(String eventName, WritableMap payload);
    }

    private enum Mode {
        HOME,
        OUTDOOR,
        SUSPECT,
        EMERGENCY
    }

    private static EventSink eventSink;
    private static Mode currentMode = Mode.OUTDOOR;
    private static double lastRawAcceleration = 0;
    private static double lastImpactAcceleration = 0;

    private SensorManager sensorManager;
    private Sensor accelerometer;
    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;

    private double threshold = 25.0;
    private double homeLatitude = Double.NaN;
    private double homeLongitude = Double.NaN;
    private double homeRadiusMeters = 500.0;
    private String emergencyFullName = "Người dùng SafeGuardian";
    private String emergencyBloodType = "Chưa cập nhật";
    private String emergencyMedicalNote = "Không có";
    private String emergencyContactsText = "Chưa có liên hệ khẩn cấp";
    private long lastTriggerAt = 0;
    private long lastSampleEmitAt = 0;
    private Location lastLocation;

    public static void setEventSink(EventSink sink) {
        eventSink = sink;
    }

    public static String getCurrentMode() {
        return currentMode.name();
    }

    public static double getLastRawAcceleration() {
        return lastRawAcceleration;
    }

    public static double getLastImpactAcceleration() {
        return lastImpactAcceleration;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        accelerometer = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) : null;
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;

        if (ACTION_STOP.equals(action)) {
            stopMonitoring();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_MARK_SAFE.equals(action)) {
            releaseWakeLock();
            setMode(resolveLocationMode());
            updateLocationPolling();
            return START_STICKY;
        }

        if (ACTION_MARK_EMERGENCY.equals(action)) {
            setMode(Mode.EMERGENCY);
            updateLocationPolling();
            return START_STICKY;
        }

        applyConfig(intent);
        startForeground(NOTIFICATION_ID, buildNotification("SafeGuardian dang theo doi an toan."));
        startMonitoring();
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void applyConfig(Intent intent) {
        if (intent == null) return;
        threshold = intent.getDoubleExtra("threshold", threshold);
        homeLatitude = intent.getDoubleExtra("homeLatitude", homeLatitude);
        homeLongitude = intent.getDoubleExtra("homeLongitude", homeLongitude);
        homeRadiusMeters = intent.getDoubleExtra("homeRadiusMeters", homeRadiusMeters);
        emergencyFullName = intent.getStringExtra("emergencyFullName") != null ? intent.getStringExtra("emergencyFullName") : emergencyFullName;
        emergencyBloodType = intent.getStringExtra("emergencyBloodType") != null ? intent.getStringExtra("emergencyBloodType") : emergencyBloodType;
        emergencyMedicalNote = intent.getStringExtra("emergencyMedicalNote") != null ? intent.getStringExtra("emergencyMedicalNote") : emergencyMedicalNote;
        emergencyContactsText = intent.getStringExtra("emergencyContactsText") != null ? intent.getStringExtra("emergencyContactsText") : emergencyContactsText;
    }

    private void startMonitoring() {
        if (sensorManager != null && accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_NORMAL);
        }
        setMode(resolveLocationMode());
        updateLocationPolling();
    }

    private void stopMonitoring() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        releaseWakeLock();
        stopForeground(true);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) return;

        double x = event.values[0];
        double y = event.values[1];
        double z = event.values[2];
        double raw = Math.sqrt(x * x + y * y + z * z);
        double impact = Math.abs(raw - GRAVITY_MS2);
        long now = System.currentTimeMillis();

        lastRawAcceleration = raw;
        lastImpactAcceleration = impact;

        if (now - lastSampleEmitAt >= 1000) {
            lastSampleEmitAt = now;
            WritableMap payload = Arguments.createMap();
            payload.putDouble("rawAcceleration", raw);
            payload.putDouble("impactAcceleration", impact);
            payload.putString("mode", currentMode.name());
            emit("accidentSample", payload);
        }

        if (impact > threshold && currentMode != Mode.SUSPECT && now - lastTriggerAt > TRIGGER_COOLDOWN_MS) {
            lastTriggerAt = now;
            enterSuspect(raw, impact);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private void enterSuspect(double rawAcceleration, double impactAcceleration) {
        setMode(Mode.SUSPECT);
        acquireWakeLock();
        updateLocationPolling();
        startActivityForSuspect();
        showSuspectFullScreenNotification();

        WritableMap payload = Arguments.createMap();
        payload.putDouble("rawAcceleration", rawAcceleration);
        payload.putDouble("impactAcceleration", impactAcceleration);
        payload.putString("mode", currentMode.name());
        if (lastLocation != null) {
            payload.putDouble("latitude", lastLocation.getLatitude());
            payload.putDouble("longitude", lastLocation.getLongitude());
        }
        emit("accidentSuspect", payload);
    }

    private void setMode(Mode mode) {
        if (currentMode == mode) return;
        currentMode = mode;
        WritableMap payload = Arguments.createMap();
        payload.putString("mode", currentMode.name());
        emit("accidentModeChanged", payload);
    }

    private Mode resolveLocationMode() {
        if (lastLocation == null || !hasHomeLocation()) {
            return Mode.OUTDOOR;
        }
        float[] results = new float[1];
        Location.distanceBetween(
            homeLatitude,
            homeLongitude,
            lastLocation.getLatitude(),
            lastLocation.getLongitude(),
            results
        );
        return results[0] <= homeRadiusMeters ? Mode.HOME : Mode.OUTDOOR;
    }

    private boolean hasHomeLocation() {
        return !Double.isNaN(homeLatitude) && !Double.isNaN(homeLongitude);
    }

    private void updateLocationPolling() {
        if (locationManager == null || ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        locationManager.removeUpdates(this);

        long interval = HOME_GPS_INTERVAL_MS;
        float minDistance = 100f;
        if (currentMode == Mode.OUTDOOR) {
            interval = OUTDOOR_GPS_INTERVAL_MS;
            minDistance = 50f;
        } else if (currentMode == Mode.SUSPECT || currentMode == Mode.EMERGENCY) {
            interval = SUSPECT_GPS_INTERVAL_MS;
            minDistance = 0f;
        }

        locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, interval, minDistance, this);
        Location lastKnown = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        if (lastKnown != null) {
            lastLocation = lastKnown;
            if (currentMode != Mode.SUSPECT && currentMode != Mode.EMERGENCY) {
                setMode(resolveLocationMode());
            }
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        lastLocation = location;
        if (currentMode != Mode.SUSPECT && currentMode != Mode.EMERGENCY) {
            Mode next = resolveLocationMode();
            if (next != currentMode) {
                setMode(next);
                updateLocationPolling();
            }
        }
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager == null) return;
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "SafeGuardian:AccidentSuspect"
        );
        wakeLock.acquire(30_000);
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;
    }

    private void startActivityForSuspect() {
        Intent intent = createMainActivityIntent();
        try {
            startActivity(intent);
        } catch (Exception ignored) {
            // Full-screen notification is the fallback when Android blocks direct background launch.
        }
    }

    private Intent createMainActivityIntent() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("openEmergencyCountdown", true);
        intent.putExtra("rawAcceleration", lastRawAcceleration);
        intent.putExtra("impactAcceleration", lastImpactAcceleration);
        if (lastLocation != null) {
            intent.putExtra("latitude", lastLocation.getLatitude());
            intent.putExtra("longitude", lastLocation.getLongitude());
        }
        return intent;
    }

    private void showSuspectFullScreenNotification() {
        createSuspectNotificationChannel();
        Intent intent = createMainActivityIntent();
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            SUSPECT_NOTIFICATION_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification notification = new NotificationCompat.Builder(this, SUSPECT_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("SafeGuardian")
            .setContentText("Phát hiện va chạm. Vui lòng xác nhận bạn an toàn.")
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .build();

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(SUSPECT_NOTIFICATION_ID, notification);
        }
    }

    private void emit(String eventName, WritableMap payload) {
        if (eventSink != null) {
            eventSink.emit(eventName, payload);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "SafeGuardian Accident Detection",
            NotificationManager.IMPORTANCE_LOW
        );
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private void createSuspectNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            SUSPECT_CHANNEL_ID,
            "SafeGuardian Accident Alert",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String content) {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("SafeGuardian")
            .setContentText(content)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build();
    }
}
