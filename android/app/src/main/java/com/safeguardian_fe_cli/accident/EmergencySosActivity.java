package com.safeguardian_fe_cli.accident;

import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.LinearInterpolator;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.safeguardian_fe_cli.R;

import java.util.Locale;

public class EmergencySosActivity extends AppCompatActivity {
    public static final String EXTRA_RAW_ACCELERATION = "rawAcceleration";
    public static final String EXTRA_IMPACT_ACCELERATION = "impactAcceleration";
    public static final String EXTRA_ML_PROBABILITY = "mlProbability";
    public static final String EXTRA_MODEL_VERSION = "modelVersion";
    public static final String EXTRA_LATITUDE = "latitude";
    public static final String EXTRA_LONGITUDE = "longitude";
    public static final String EXTRA_DETAILS = "details";

    private static final long COUNTDOWN_MS = 30_000;
    private static final int COLOR_OK = Color.parseColor("#38A169");
    private static final int COLOR_WARN = Color.parseColor("#DD6B20");
    private static final int COLOR_DANGER = Color.parseColor("#E53E3E");

    private CountDownTimer timer;
    private AnimatorSet pulseAnim;
    private boolean finished = false;
    private TextView timerView;
    private TextView titleView;
    private TextView subtitleView;
    private TextView safeButtonText;
    private View safeButton;
    private View confirmOverlay;
    private View pulseRing;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        showOnLockScreen();
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_emergency_sos);

        timerView = findViewById(R.id.sosTimer);
        titleView = findViewById(R.id.sosTitle);
        subtitleView = findViewById(R.id.sosSubtitle);
        safeButton = findViewById(R.id.sosSafeButton);
        safeButtonText = findViewById(R.id.sosSafeButtonText);
        confirmOverlay = findViewById(R.id.sosConfirmOverlay);
        pulseRing = findViewById(R.id.sosPulseRing);
        TextView accelView = findViewById(R.id.sosAccel);

        double acceleration = getIntent().getDoubleExtra(EXTRA_RAW_ACCELERATION, 0);
        if (acceleration > 0) {
            accelView.setText(String.format(Locale.US, "Gia tốc phát hiện: %.1f m/s²", acceleration));
            accelView.setVisibility(View.VISIBLE);
        } else {
            accelView.setVisibility(View.GONE);
        }

        safeButton.setOnClickListener(v -> showSafeConfirmation());
        findViewById(R.id.sosConfirmYes).setOnClickListener(v -> markSafeAndClose());
        findViewById(R.id.sosConfirmNo).setOnClickListener(v -> hideSafeConfirmation());

        EmergencyAlarmPlayer.start(this);
        startPulse();
        startTimer();
        updateTimerDisplay(30);
        vibrateTick(30);
    }

    private void showOnLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );
    }

    private void startTimer() {
        timer = new CountDownTimer(COUNTDOWN_MS, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                long seconds = Math.max(1, (millisUntilFinished + 999) / 1000);
                updateTimerDisplay(seconds);
                if (seconds % 5 == 0 && seconds < 30) {
                    vibrateTick(seconds);
                }
            }

            @Override
            public void onFinish() {
                updateTimerDisplay(0);
                vibrateTimeout();
                onTimeout();
            }
        };
        timer.start();
    }

    private void updateTimerDisplay(long seconds) {
        timerView.setText(seconds + " s");
        timerView.setTextColor(colorForSeconds(seconds));
    }

    private int colorForSeconds(long seconds) {
        if (seconds <= 10) return COLOR_DANGER;
        if (seconds <= 20) return COLOR_WARN;
        return COLOR_OK;
    }

    private void startPulse() {
        ObjectAnimator scaleX = ObjectAnimator.ofFloat(pulseRing, View.SCALE_X, 1f, 1.25f);
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(pulseRing, View.SCALE_Y, 1f, 1.25f);
        ObjectAnimator alpha = ObjectAnimator.ofFloat(pulseRing, View.ALPHA, 0.8f, 0.2f);
        for (ObjectAnimator animator : new ObjectAnimator[] { scaleX, scaleY, alpha }) {
            animator.setRepeatCount(ValueAnimator.INFINITE);
            animator.setRepeatMode(ValueAnimator.REVERSE);
            animator.setDuration(900);
            animator.setInterpolator(new LinearInterpolator());
        }
        pulseAnim = new AnimatorSet();
        pulseAnim.playTogether(scaleX, scaleY, alpha);
        pulseAnim.start();
    }

    private void showSafeConfirmation() {
        if (finished) return;
        EmergencyAlarmPlayer.stop();
        Vibrator vibrator = getVibrator();
        if (vibrator != null) vibrator.cancel();
        confirmOverlay.setVisibility(View.VISIBLE);
    }

    private void hideSafeConfirmation() {
        if (finished) return;
        confirmOverlay.setVisibility(View.GONE);
        EmergencyAlarmPlayer.start(this);
    }

    private void markSafeAndClose() {
        if (finished) return;
        finished = true;
        if (timer != null) timer.cancel();
        Intent intent = new Intent(this, AccidentDetectionService.class);
        intent.setAction(AccidentDetectionService.ACTION_MARK_SAFE);
        startService(intent);
        finish();
    }

    private void onTimeout() {
        if (finished) return;
        finished = true;
        confirmOverlay.setVisibility(View.GONE);
        titleView.setText("Đang báo người thân");
        subtitleView.setText("Bạn không phản hồi. Cảnh báo khẩn cấp đang được gửi.");

        Intent timeout = new Intent(this, AccidentDetectionService.class);
        timeout.setAction(AccidentDetectionService.ACTION_COUNTDOWN_TIMEOUT);
        copyExtras(timeout);
        startService(timeout);
        safeButtonText.setText("Đóng");
        safeButton.setOnClickListener(v -> finish());
    }

    private void copyExtras(Intent target) {
        Intent source = getIntent();
        target.putExtra(EXTRA_RAW_ACCELERATION, source.getDoubleExtra(EXTRA_RAW_ACCELERATION, 0));
        target.putExtra(EXTRA_IMPACT_ACCELERATION, source.getDoubleExtra(EXTRA_IMPACT_ACCELERATION, 0));
        target.putExtra(EXTRA_ML_PROBABILITY, source.getDoubleExtra(EXTRA_ML_PROBABILITY, 0));
        target.putExtra(EXTRA_LATITUDE, source.getDoubleExtra(EXTRA_LATITUDE, 0));
        target.putExtra(EXTRA_LONGITUDE, source.getDoubleExtra(EXTRA_LONGITUDE, 0));
        if (source.getStringExtra(EXTRA_MODEL_VERSION) != null) {
            target.putExtra(EXTRA_MODEL_VERSION, source.getStringExtra(EXTRA_MODEL_VERSION));
        }
    }

    private void vibrateTick(long seconds) {
        if (seconds <= 0) return;
        Vibrator vibrator = getVibrator();
        if (vibrator == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            vibrator.vibrate(200);
        }
    }

    private void vibrateTimeout() {
        Vibrator vibrator = getVibrator();
        if (vibrator == null) return;
        long[] pattern = {0, 500, 200, 500};
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } else {
            vibrator.vibrate(pattern, -1);
        }
    }

    private Vibrator getVibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) getSystemService(VIBRATOR_MANAGER_SERVICE);
            return manager != null ? manager.getDefaultVibrator() : null;
        }
        return (Vibrator) getSystemService(VIBRATOR_SERVICE);
    }

    @Override
    protected void onDestroy() {
        if (timer != null) timer.cancel();
        if (pulseAnim != null) pulseAnim.cancel();
        EmergencyAlarmPlayer.stop();
        Vibrator vibrator = getVibrator();
        if (vibrator != null) vibrator.cancel();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        // Incoming-call style: back must not dismiss the emergency screen.
    }
}
