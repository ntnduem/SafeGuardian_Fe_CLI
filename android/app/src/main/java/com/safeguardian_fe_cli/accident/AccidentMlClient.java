package com.safeguardian_fe_cli.accident;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

final class AccidentMlClient {
    private static final String TAG = "AccidentDetection";
    private static final int TIMEOUT_MS = 4000;

    static final class ModelInfo {
        boolean ready;
        int windowSize = 32;
        int stride = 8;
        double threshold = 0.35;
        String modelVersion;
    }

    static final class PredictResult {
        boolean accident;
        double probability;
        double threshold;
        String modelVersion;
    }

    static final class ImuSample {
        final double accX;
        final double accY;
        final double accZ;
        final double gyroX;
        final double gyroY;
        final double gyroZ;
        final double accMagnitude;
        final double gyroMagnitude;

        ImuSample(
            double accX,
            double accY,
            double accZ,
            double gyroX,
            double gyroY,
            double gyroZ,
            double accMagnitude,
            double gyroMagnitude
        ) {
            this.accX = accX;
            this.accY = accY;
            this.accZ = accZ;
            this.gyroX = gyroX;
            this.gyroY = gyroY;
            this.gyroZ = gyroZ;
            this.accMagnitude = accMagnitude;
            this.gyroMagnitude = gyroMagnitude;
        }
    }

    private AccidentMlClient() {}

    static String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null) return "";
        String trimmed = baseUrl.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    static ModelInfo fetchModelInfo(String baseUrl) throws Exception {
        String url = normalizeBaseUrl(baseUrl) + "/api/ml/model-info";
        String body = request("GET", url, null);
        JSONObject root = new JSONObject(body);
        JSONObject data = root.optJSONObject("data");
        ModelInfo info = new ModelInfo();
        if (data == null) {
            info.ready = false;
            return info;
        }
        info.ready = data.optBoolean("ready", false);
        info.windowSize = data.optInt("windowSize", 32);
        info.stride = data.optInt("stride", 8);
        info.threshold = data.optDouble("threshold", 0.35);
        info.modelVersion = data.optString("modelVersion", null);
        return info;
    }

    static PredictResult predict(String baseUrl, List<ImuSample> samples) throws Exception {
        JSONArray array = new JSONArray();
        for (ImuSample sample : samples) {
            JSONObject item = new JSONObject();
            item.put("accX", sample.accX);
            item.put("accY", sample.accY);
            item.put("accZ", sample.accZ);
            item.put("gyroX", sample.gyroX);
            item.put("gyroY", sample.gyroY);
            item.put("gyroZ", sample.gyroZ);
            item.put("accMagnitude", sample.accMagnitude);
            item.put("gyroMagnitude", sample.gyroMagnitude);
            array.put(item);
        }
        JSONObject payload = new JSONObject();
        payload.put("samples", array);

        String url = normalizeBaseUrl(baseUrl) + "/api/ml/accident/predict";
        String body = request("POST", url, payload.toString());
        JSONObject root = new JSONObject(body);
        JSONObject data = root.optJSONObject("data");
        if (data == null) {
            throw new IllegalStateException("Empty ML response");
        }
        PredictResult result = new PredictResult();
        result.accident = data.optBoolean("accident", false);
        result.probability = data.optDouble("probability", 0);
        result.threshold = data.optDouble("threshold", 0.35);
        result.modelVersion = data.optString("modelVersion", null);
        return result;
    }

    private static String request(String method, String urlString, String jsonBody) throws Exception {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(urlString);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);
            connection.setRequestProperty("Accept", "application/json");
            if (jsonBody != null) {
                byte[] bytes = jsonBody.getBytes(StandardCharsets.UTF_8);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("Content-Length", String.valueOf(bytes.length));
                OutputStream output = connection.getOutputStream();
                output.write(bytes);
                output.flush();
                output.close();
            }

            int code = connection.getResponseCode();
            InputStream stream = code >= 200 && code < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
            String response = readStream(stream);
            if (code < 200 || code >= 300) {
                Log.w(TAG, String.format(Locale.US, "ML HTTP %d %s %s", code, method, urlString));
                throw new IllegalStateException("ML HTTP " + code + ": " + response);
            }
            return response;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private static String readStream(InputStream stream) throws Exception {
        if (stream == null) return "";
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            builder.append(line);
        }
        reader.close();
        return builder.toString();
    }
}
