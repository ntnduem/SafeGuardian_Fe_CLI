package com.safeguardian_fe_cli.accident;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

final class AccidentDetectionWatchdog {
    private static final String TAG = "AccidentDetection";
    private static final int REQUEST_CODE = 4015;
    private static final long INTERVAL_MS = 60_000;

    private AccidentDetectionWatchdog() {}

    static void schedule(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        PendingIntent pending = pendingIntent(context);
        long triggerAt = SystemClock.elapsedRealtime() + INTERVAL_MS;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending);
            } else {
                alarmManager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending);
            }
        } catch (SecurityException error) {
            Log.w(TAG, "Cannot schedule exact watchdog alarm", error);
            alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending);
        }
    }

    static void cancel(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        alarmManager.cancel(pendingIntent(context));
    }

    private static PendingIntent pendingIntent(Context context) {
        Intent intent = new Intent(context, AccidentDetectionWatchdogReceiver.class);
        intent.setAction(AccidentDetectionWatchdogReceiver.ACTION_RESTART);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags);
    }
}
