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
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.safeguardian_fe_cli.MainActivity;
import com.safeguardian_fe_cli.R;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class AccidentDetectionService extends Service implements SensorEventListener, LocationListener {
    public static final String ACTION_START = "com.safeguardian_fe_cli.accident.START";
    public static final String ACTION_STOP = "com.safeguardian_fe_cli.accident.STOP";
    public static final String ACTION_MARK_SAFE = "com.safeguardian_fe_cli.accident.MARK_SAFE";
    public static final String ACTION_MARK_EMERGENCY = "com.safeguardian_fe_cli.accident.MARK_EMERGENCY";
    public static final String ACTION_ML_SUSPECT = "com.safeguardian_fe_cli.accident.ML_SUSPECT";
    public static final String ACTION_COUNTDOWN_TIMEOUT = "com.safeguardian_fe_cli.accident.COUNTDOWN_TIMEOUT";

    private static final String TAG = "AccidentDetection";
    private static final String CHANNEL_ID = "safeguardian_accident_detection";
    private static final String SUSPECT_CHANNEL_ID = "safeguardian_accident_suspect_v6";
    private static final int NOTIFICATION_ID = 4012;
    private static final int SUSPECT_NOTIFICATION_ID = 4013;
    private static final double GRAVITY_MS2 = 9.80665;
    private static final long TRIGGER_COOLDOWN_MS = 8000;
    private static final long SAMPLE_INTERVAL_MS = 100;
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
    private static double lastMlProbability = -1;
    private static double lastMlThreshold = 0.35;
    private static boolean mlReady = false;
    private static boolean gyroAvailable = false;
    private static String lastModelVersion = null;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService mlExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean predicting = new AtomicBoolean(false);
    private final LinkedList<AccidentMlClient.ImuSample> imuWindow = new LinkedList<>();

    private SensorManager sensorManager;
    private Sensor accelerometer;
    private Sensor gyroscope;
    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;

    private String apiBaseUrl = "";
    private int windowSize = 32;
    private int stride = 8;
    private double mlThreshold = 0.35;
    private double homeLatitude = Double.NaN;
    private double homeLongitude = Double.NaN;
    private double homeRadiusMeters = 500.0;
    private String emergencyFullName = "Người dùng SafeGuardian";
    private String emergencyBloodType = "Chưa cập nhật";
    private String emergencyMedicalNote = "Không có";
    private String emergencyContactsText = "Chưa có liên hệ khẩn cấp";
    private long lastTriggerAt = 0;
    private long lastSampleEmitAt = 0;
    private long lastSampleAt = 0;
    private int samplesSincePredict = 0;
    private int mlFailCount = 0;
    private double gyroX = 0;
    private double gyroY = 0;
    private double gyroZ = 0;
    private Location lastLocation;

    public static void setEventSink(EventSink sink) {
        eventSink = sink;
    }

    public static void startIfEnabled(Context context) {
        if (!AccidentDetectionPrefs.isEnabled(context)) {
            return;
        }
        Intent start = new Intent(context, AccidentDetectionService.class);
        start.setAction(ACTION_START);
        AccidentDetectionPrefs.applyToIntent(context, start);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(start);
        } else {
            context.startService(start);
        }
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

    public static double getLastMlProbability() {
        return lastMlProbability;
    }

    public static double getLastMlThreshold() {
        return lastMlThreshold;
    }

    public static boolean isMlReady() {
        return mlReady;
    }

    public static boolean isGyroAvailable() {
        return gyroAvailable;
    }

    public static String getLastModelVersion() {
        return lastModelVersion;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        accelerometer = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) : null;
        gyroscope = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE) : null;
        gyroAvailable = gyroscope != null;
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;

        if (ACTION_STOP.equals(action)) {
            EmergencyAlarmPlayer.stop();
            AccidentDetectionPrefs.setEnabled(this, false);
            AccidentDetectionWatchdog.cancel(this);
            stopMonitoring();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_MARK_SAFE.equals(action)) {
            EmergencyAlarmPlayer.stop();
            cancelSuspectNotification();
            releaseWakeLock();
            setMode(resolveLocationMode());
            updateLocationPolling();
            WritableMap cancelled = Arguments.createMap();
            cancelled.putString("mode", currentMode.name());
            emit("accidentCancelled", cancelled);
            return START_STICKY;
        }

        if (ACTION_MARK_EMERGENCY.equals(action)) {
            setMode(Mode.EMERGENCY);
            updateLocationPolling();
            return START_STICKY;
        }

        if (ACTION_COUNTDOWN_TIMEOUT.equals(action)) {
            handleCountdownTimeout(intent);
            return START_STICKY;
        }

        if (ACTION_ML_SUSPECT.equals(action)) {
            double raw = intent != null ? intent.getDoubleExtra("rawAcceleration", lastRawAcceleration) : lastRawAcceleration;
            double impact = intent != null ? intent.getDoubleExtra("impactAcceleration", lastImpactAcceleration) : lastImpactAcceleration;
            if (currentMode != Mode.SUSPECT && currentMode != Mode.EMERGENCY) {
                enterSuspect(raw, impact, lastMlProbability, lastModelVersion);
            }
            return START_STICKY;
        }

        if (intent == null || !intent.hasExtra("apiBaseUrl")) {
            Intent stored = new Intent();
            AccidentDetectionPrefs.applyToIntent(this, stored);
            applyConfig(stored);
        } else {
            applyConfig(intent);
            AccidentDetectionPrefs.saveFromIntent(this, intent);
        }

        Notification notification = buildNotification("SafeGuardian dang theo doi an toan.");
        startMonitoringForeground(notification);
        startMonitoring();
        AccidentDetectionWatchdog.schedule(this);
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.i(TAG, "App closed from recents; keeping native ML service alive");
        AccidentDetectionWatchdog.schedule(this);
        Intent restart = new Intent(getApplicationContext(), AccidentDetectionService.class);
        restart.setAction(ACTION_START);
        AccidentDetectionPrefs.applyToIntent(this, restart);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(restart);
        } else {
            startService(restart);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopMonitoring();
        mlExecutor.shutdownNow();
        super.onDestroy();
    }

    private void applyConfig(Intent intent) {
        if (intent == null) return;
        apiBaseUrl = AccidentMlClient.normalizeBaseUrl(intent.getStringExtra("apiBaseUrl"));
        homeLatitude = intent.getDoubleExtra("homeLatitude", homeLatitude);
        homeLongitude = intent.getDoubleExtra("homeLongitude", homeLongitude);
        homeRadiusMeters = intent.getDoubleExtra("homeRadiusMeters", homeRadiusMeters);
        emergencyFullName = intent.getStringExtra("emergencyFullName") != null ? intent.getStringExtra("emergencyFullName") : emergencyFullName;
        emergencyBloodType = intent.getStringExtra("emergencyBloodType") != null ? intent.getStringExtra("emergencyBloodType") : emergencyBloodType;
        emergencyMedicalNote = intent.getStringExtra("emergencyMedicalNote") != null ? intent.getStringExtra("emergencyMedicalNote") : emergencyMedicalNote;
        emergencyContactsText = intent.getStringExtra("emergencyContactsText") != null ? intent.getStringExtra("emergencyContactsText") : emergencyContactsText;
    }

    private void startMonitoringForeground(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
            }
            startForeground(NOTIFICATION_ID, notification, serviceType);
            return;
        }
        startForeground(NOTIFICATION_ID, notification);
    }

    private void startMonitoring() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
            if (accelerometer != null) {
                sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
            }
            if (gyroscope != null) {
                sensorManager.registerListener(this, gyroscope, SensorManager.SENSOR_DELAY_GAME);
                Log.i(TAG, "Gyroscope registered");
            } else {
                Log.i(TAG, "Gyroscope unavailable; ML uses accelerometer only (gyro=0).");
            }
        }
        setMode(resolveLocationMode());
        updateLocationPolling();
        refreshModelConfigAsync();
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

    private void refreshModelConfigAsync() {
        if (apiBaseUrl.isEmpty()) {
            Log.w(TAG, "Missing apiBaseUrl; native ML cannot start");
            mlReady = false;
            return;
        }
        mlExecutor.execute(() -> {
            try {
                AccidentMlClient.ModelInfo info = AccidentMlClient.fetchModelInfo(apiBaseUrl);
                if (!info.ready) {
                    mlReady = false;
                    Log.w(TAG, "ML model not ready");
                    emitMlStatus();
                    return;
                }
                windowSize = Math.max(8, info.windowSize);
                stride = Math.max(1, info.stride);
                mlThreshold = info.threshold;
                lastMlThreshold = mlThreshold;
                lastModelVersion = info.modelVersion;
                mlReady = true;
                mlFailCount = 0;
                Log.i(TAG, String.format(
                    Locale.US,
                    "ML ready %s W=%d stride=%d thr=%.2f",
                    info.modelVersion,
                    windowSize,
                    stride,
                    mlThreshold
                ));
                emitMlStatus();
            } catch (Exception error) {
                mlReady = false;
                Log.w(TAG, "Cannot load model-info", error);
                emitMlStatus();
            }
        });
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        int type = event.sensor.getType();
        if (type == Sensor.TYPE_GYROSCOPE) {
            gyroX = event.values[0];
            gyroY = event.values[1];
            gyroZ = event.values[2];
            return;
        }
        if (type != Sensor.TYPE_ACCELEROMETER) return;

        long now = System.currentTimeMillis();
        if (now - lastSampleAt < SAMPLE_INTERVAL_MS) return;
        lastSampleAt = now;

        double x = event.values[0];
        double y = event.values[1];
        double z = event.values[2];
        double raw = Math.sqrt(x * x + y * y + z * z);
        double gyroMagnitude = Math.sqrt(gyroX * gyroX + gyroY * gyroY + gyroZ * gyroZ);
        double impact = Math.abs(raw - GRAVITY_MS2);

        lastRawAcceleration = raw;
        lastImpactAcceleration = impact;

        AccidentMlClient.ImuSample sample = new AccidentMlClient.ImuSample(
            x, y, z, gyroX, gyroY, gyroZ, raw, gyroMagnitude
        );
        synchronized (imuWindow) {
            imuWindow.add(sample);
            while (imuWindow.size() > windowSize) {
                imuWindow.removeFirst();
            }
        }

        if (now - lastSampleEmitAt >= 200) {
            lastSampleEmitAt = now;
            WritableMap payload = Arguments.createMap();
            payload.putDouble("rawAcceleration", raw);
            payload.putDouble("impactAcceleration", impact);
            payload.putString("mode", currentMode.name());
            payload.putBoolean("mlReady", mlReady);
            payload.putBoolean("gyroAvailable", gyroAvailable);
            if (lastMlProbability >= 0) {
                payload.putDouble("mlProbability", lastMlProbability);
            }
            emit("accidentSample", payload);
        }

        samplesSincePredict += 1;
        if (samplesSincePredict >= stride) {
            samplesSincePredict = 0;
            maybePredict();
        }
    }

    private void maybePredict() {
        if (!mlReady || apiBaseUrl.isEmpty()) return;
        if (currentMode == Mode.SUSPECT || currentMode == Mode.EMERGENCY) return;
        if (!predicting.compareAndSet(false, true)) return;

        final List<AccidentMlClient.ImuSample> window;
        synchronized (imuWindow) {
            if (imuWindow.size() < windowSize) {
                predicting.set(false);
                return;
            }
            window = new ArrayList<>(imuWindow);
        }

        mlExecutor.execute(() -> {
            try {
                AccidentMlClient.PredictResult result = AccidentMlClient.predict(apiBaseUrl, window);
                mlFailCount = 0;
                mlReady = true;
                lastMlProbability = result.probability;
                lastMlThreshold = result.threshold;
                if (result.modelVersion != null && !result.modelVersion.isEmpty()) {
                    lastModelVersion = result.modelVersion;
                }

                AccidentMlClient.ImuSample last = window.get(window.size() - 1);
                double peakAccel = 0;
                for (AccidentMlClient.ImuSample sample : window) {
                    peakAccel = Math.max(peakAccel, sample.accMagnitude);
                }
                double impact = Math.abs(peakAccel - GRAVITY_MS2);

                Log.i(TAG, String.format(
                    Locale.US,
                    "ML p=%.3f accident=%s threshold=%.2f lastAccel=%.1f m/s² peakAccel=%.1f m/s² impact=%.1f m/s²",
                    result.probability,
                    result.accident,
                    result.threshold,
                    last.accMagnitude,
                    peakAccel,
                    impact
                ));

                WritableMap payload = Arguments.createMap();
                payload.putBoolean("accident", result.accident);
                payload.putDouble("probability", result.probability);
                payload.putDouble("threshold", result.threshold);
                payload.putDouble("lastAccel", last.accMagnitude);
                payload.putDouble("peakAccel", peakAccel);
                payload.putDouble("impact", impact);
                payload.putBoolean("mlReady", true);
                payload.putBoolean("gyroAvailable", gyroAvailable);
                if (lastModelVersion != null) {
                    payload.putString("modelVersion", lastModelVersion);
                }
                emit("accidentMlResult", payload);

                boolean confirmed = result.accident || result.probability >= mlThreshold;
                long now = System.currentTimeMillis();
                if (confirmed && now - lastTriggerAt > TRIGGER_COOLDOWN_MS) {
                    lastTriggerAt = now;
                    final double peak = peakAccel;
                    final double confirmedImpact = impact;
                    final double probability = result.probability;
                    final String version = lastModelVersion;
                    mainHandler.post(() -> enterSuspect(peak, confirmedImpact, probability, version));
                }
            } catch (Exception error) {
                mlFailCount += 1;
                if (mlFailCount >= 2) {
                    mlReady = false;
                }
                Log.w(TAG, "ML predict failed (no alert sent)", error);
            } finally {
                predicting.set(false);
            }
        });
    }

    private void emitMlStatus() {
        WritableMap payload = Arguments.createMap();
        payload.putBoolean("mlReady", mlReady);
        payload.putBoolean("gyroAvailable", gyroAvailable);
        payload.putDouble("threshold", mlThreshold);
        if (lastModelVersion != null) {
            payload.putString("modelVersion", lastModelVersion);
        }
        emit("accidentMlStatus", payload);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private void enterSuspect(double rawAcceleration, double impactAcceleration, double probability, String modelVersion) {
        if (currentMode == Mode.SUSPECT || currentMode == Mode.EMERGENCY) return;
        lastRawAcceleration = rawAcceleration;
        lastImpactAcceleration = impactAcceleration;
        lastMlProbability = probability;
        lastModelVersion = modelVersion;
        setMode(Mode.SUSPECT);
        acquireWakeLock();
        updateLocationPolling();

        if (MainActivity.isInForeground()) {
            WritableMap payload = Arguments.createMap();
            payload.putDouble("rawAcceleration", rawAcceleration);
            payload.putDouble("impactAcceleration", impactAcceleration);
            payload.putDouble("mlProbability", probability);
            payload.putString("mode", currentMode.name());
            payload.putString("detectionMethod", "cnn-lstm");
            if (modelVersion != null) {
                payload.putString("modelVersion", modelVersion);
            }
            if (lastLocation != null) {
                payload.putDouble("latitude", lastLocation.getLatitude());
                payload.putDouble("longitude", lastLocation.getLongitude());
            }
            emit("accidentSuspect", payload);
            EmergencyAlarmPlayer.start(this);
            return;
        }

        showSuspectFullScreenNotification();
        launchIncomingSosUi();
        EmergencyAlarmPlayer.start(this);
    }

    private void handleCountdownTimeout(Intent intent) {
        setMode(Mode.EMERGENCY);
        updateLocationPolling();
        cancelSuspectNotification();

        double raw = intent != null ? intent.getDoubleExtra(EmergencySosActivity.EXTRA_RAW_ACCELERATION, lastRawAcceleration) : lastRawAcceleration;
        double probability = intent != null ? intent.getDoubleExtra(EmergencySosActivity.EXTRA_ML_PROBABILITY, lastMlProbability) : lastMlProbability;
        String version = intent != null ? intent.getStringExtra(EmergencySosActivity.EXTRA_MODEL_VERSION) : lastModelVersion;

        WritableMap payload = Arguments.createMap();
        payload.putDouble("rawAcceleration", raw);
        payload.putDouble("mlProbability", probability);
        payload.putString("detectionMethod", "cnn-lstm");
        if (version != null) {
            payload.putString("modelVersion", version);
        }
        if (lastLocation != null) {
            payload.putDouble("latitude", lastLocation.getLatitude());
            payload.putDouble("longitude", lastLocation.getLongitude());
        } else if (intent != null) {
            payload.putDouble("latitude", intent.getDoubleExtra(EmergencySosActivity.EXTRA_LATITUDE, 0));
            payload.putDouble("longitude", intent.getDoubleExtra(EmergencySosActivity.EXTRA_LONGITUDE, 0));
        }
        emit("accidentCountdownTimeout", payload);

        try {
            Intent main = new Intent(this, MainActivity.class);
            main.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            main.putExtra("openEmergencyAlert", true);
            startActivity(main);
        } catch (Exception ignored) {
        }
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

    private void launchIncomingSosUi() {
        Intent intent = createSosActivityIntent();
        try {
            startActivity(intent);
        } catch (Exception error) {
            Log.w(TAG, "Cannot start SOS activity from background; full-screen intent should still open it", error);
        }
    }

    private Intent createSosActivityIntent() {
        Intent intent = new Intent(this, EmergencySosActivity.class);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_NO_USER_ACTION
        );
        intent.putExtra(EmergencySosActivity.EXTRA_RAW_ACCELERATION, lastRawAcceleration);
        intent.putExtra(EmergencySosActivity.EXTRA_IMPACT_ACCELERATION, lastImpactAcceleration);
        intent.putExtra(EmergencySosActivity.EXTRA_ML_PROBABILITY, lastMlProbability);
        if (lastModelVersion != null) {
            intent.putExtra(EmergencySosActivity.EXTRA_MODEL_VERSION, lastModelVersion);
        }
        if (lastLocation != null) {
            intent.putExtra(EmergencySosActivity.EXTRA_LATITUDE, lastLocation.getLatitude());
            intent.putExtra(EmergencySosActivity.EXTRA_LONGITUDE, lastLocation.getLongitude());
        }
        StringBuilder details = new StringBuilder();
        details.append(emergencyFullName);
        if (emergencyBloodType != null && !emergencyBloodType.isEmpty()) {
            details.append("  •  Nhóm máu: ").append(emergencyBloodType);
        }
        intent.putExtra(EmergencySosActivity.EXTRA_DETAILS, details.toString());
        return intent;
    }

    private void startActivityForSuspect() {
        launchIncomingSosUi();
    }

    private Intent createMainActivityIntent() {
        return createSosActivityIntent();
    }

    private void showSuspectFullScreenNotification() {
        createSuspectNotificationChannel();
        Intent intent = createSosActivityIntent();
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            SUSPECT_NOTIFICATION_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification notification = new NotificationCompat.Builder(this, SUSPECT_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Cuộc gọi khẩn cấp SafeGuardian")
            .setContentText("AI phát hiện tai nạn. Mở ngay để xác nhận bạn an toàn.")
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSilent(true)
            .build();

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(SUSPECT_NOTIFICATION_ID, notification);
        }
    }

    private void cancelSuspectNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(SUSPECT_NOTIFICATION_ID);
        }
    }

    private void emit(String eventName, WritableMap payload) {
        if (eventSink == null) return;
        mainHandler.post(() -> eventSink.emit(eventName, payload));
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
        channel.enableVibration(false);
        channel.enableLights(true);
        channel.setBypassDnd(true);
        channel.setSound(null, null);
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
