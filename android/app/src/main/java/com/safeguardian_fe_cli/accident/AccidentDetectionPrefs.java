package com.safeguardian_fe_cli.accident;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

final class AccidentDetectionPrefs {
    private static final String PREF = "accident_detection";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_API_BASE_URL = "apiBaseUrl";
    private static final String KEY_HOME_LAT = "homeLatitude";
    private static final String KEY_HOME_LNG = "homeLongitude";
    private static final String KEY_HOME_RADIUS = "homeRadiusMeters";
    private static final String KEY_FULL_NAME = "emergencyFullName";
    private static final String KEY_BLOOD = "emergencyBloodType";
    private static final String KEY_NOTE = "emergencyMedicalNote";
    private static final String KEY_CONTACTS = "emergencyContactsText";

    private AccidentDetectionPrefs() {}

    static void saveFromIntent(Context context, Intent intent) {
        if (intent == null) return;
        SharedPreferences.Editor editor = prefs(context).edit();
        editor.putBoolean(KEY_ENABLED, true);
        if (intent.hasExtra("apiBaseUrl")) {
            editor.putString(KEY_API_BASE_URL, intent.getStringExtra("apiBaseUrl"));
        }
        if (intent.hasExtra("homeLatitude")) {
            editor.putLong(KEY_HOME_LAT, Double.doubleToRawLongBits(intent.getDoubleExtra("homeLatitude", Double.NaN)));
        }
        if (intent.hasExtra("homeLongitude")) {
            editor.putLong(KEY_HOME_LNG, Double.doubleToRawLongBits(intent.getDoubleExtra("homeLongitude", Double.NaN)));
        }
        if (intent.hasExtra("homeRadiusMeters")) {
            editor.putFloat(KEY_HOME_RADIUS, (float) intent.getDoubleExtra("homeRadiusMeters", 500));
        }
        putString(editor, KEY_FULL_NAME, intent.getStringExtra("emergencyFullName"));
        putString(editor, KEY_BLOOD, intent.getStringExtra("emergencyBloodType"));
        putString(editor, KEY_NOTE, intent.getStringExtra("emergencyMedicalNote"));
        putString(editor, KEY_CONTACTS, intent.getStringExtra("emergencyContactsText"));
        editor.apply();
    }

    static void applyToIntent(Context context, Intent intent) {
        SharedPreferences prefs = prefs(context);
        intent.putExtra("apiBaseUrl", prefs.getString(KEY_API_BASE_URL, ""));
        if (prefs.contains(KEY_HOME_LAT) && prefs.contains(KEY_HOME_LNG)) {
            intent.putExtra("homeLatitude", Double.longBitsToDouble(prefs.getLong(KEY_HOME_LAT, 0)));
            intent.putExtra("homeLongitude", Double.longBitsToDouble(prefs.getLong(KEY_HOME_LNG, 0)));
        }
        intent.putExtra("homeRadiusMeters", (double) prefs.getFloat(KEY_HOME_RADIUS, 500f));
        intent.putExtra("emergencyFullName", prefs.getString(KEY_FULL_NAME, "Người dùng SafeGuardian"));
        intent.putExtra("emergencyBloodType", prefs.getString(KEY_BLOOD, "Chưa cập nhật"));
        intent.putExtra("emergencyMedicalNote", prefs.getString(KEY_NOTE, "Không có"));
        intent.putExtra("emergencyContactsText", prefs.getString(KEY_CONTACTS, "Chưa có liên hệ khẩn cấp"));
    }

    static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply();
    }

    private static void putString(SharedPreferences.Editor editor, String key, String value) {
        if (value != null) {
            editor.putString(key, value);
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }
}
