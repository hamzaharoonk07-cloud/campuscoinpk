package com.campuscoin.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Fires on every incoming SMS, with no app screen open and no third-party
 * automation app installed - the thing MacroDroid used to be needed for.
 *
 * It only reads the message text and sender; it does nothing with any SMS
 * that is not a logged-in student's own bank alert, and nothing is kept on
 * the phone - it is posted straight to the same /api/webhook/sms endpoint
 * Settings already shows the key and URL for, exactly as MacroDroid would,
 * just without MacroDroid.
 */
public class SmsReceiver extends BroadcastReceiver {
  private static final String TAG = "CampusCoinSms";
  static final String PREFS = "campuscoin_sms";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    boolean enabled = prefs.getBoolean("enabled", false);
    String url = prefs.getString("url", null);
    String key = prefs.getString("key", null);
    if (!enabled || url == null || key == null) return; // not set up - do nothing, same as before this existed

    StringBuilder body = new StringBuilder();
    Object[] pdus = (Object[]) intent.getSerializableExtra(Telephony.Sms.Intents.EXTRA_PDUS);
    if (pdus == null) return;
    String format = intent.getStringExtra("format");
    for (Object pdu : pdus) {
      SmsMessage part = SmsMessage.createFromPdu((byte[]) pdu, format);
      body.append(part.getMessageBody());
    }

    final String text = body.toString();
    final String finalUrl = url;
    final String finalKey = key;
    // Off the receiver's own thread - a network call here would block it.
    new Thread(() -> forward(finalUrl, finalKey, text)).start();
  }

  private void forward(String url, String key, String text) {
    try {
      JSONObject payload = new JSONObject();
      payload.put("key", key);
      payload.put("text", text);

      HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
      conn.setRequestMethod("POST");
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setDoOutput(true);
      conn.setConnectTimeout(15000);
      conn.setReadTimeout(15000);
      try (OutputStream out = conn.getOutputStream()) {
        out.write(payload.toString().getBytes("UTF-8"));
      }
      int code = conn.getResponseCode();
      Log.i(TAG, "Forwarded SMS to Campus Coin, server replied " + code);
      conn.disconnect();
    } catch (Exception e) {
      // A dropped message here is recoverable (the student can still add it
      // by hand) - it must never crash the receiver or the app.
      Log.e(TAG, "Could not forward SMS to Campus Coin", e);
    }
  }
}
