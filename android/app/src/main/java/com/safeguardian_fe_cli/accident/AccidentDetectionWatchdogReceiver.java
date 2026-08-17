package com.safeguardian_fe_cli.accident;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AccidentDetectionWatchdogReceiver extends BroadcastReceiver {
    public static final String ACTION_RESTART = "com.safeguardian_fe_cli.accident.WATCHDOG_RESTART";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        boolean restart =
            ACTION_RESTART.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action);

        if (!restart || !AccidentDetectionPrefs.isEnabled(context)) {
            return;
        }
        AccidentDetectionService.startIfEnabled(context);
        AccidentDetectionWatchdog.schedule(context);
    }
}
