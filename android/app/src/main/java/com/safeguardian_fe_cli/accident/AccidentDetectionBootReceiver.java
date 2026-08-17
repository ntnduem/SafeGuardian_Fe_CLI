package com.safeguardian_fe_cli.accident;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AccidentDetectionBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        boolean boot =
            Intent.ACTION_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action);
        if (!boot) return;
        AccidentDetectionService.startIfEnabled(context);
        AccidentDetectionWatchdog.schedule(context);
    }
}
