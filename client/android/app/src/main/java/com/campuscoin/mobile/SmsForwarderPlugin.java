package com.campuscoin.mobile;

import android.Manifest;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * The bridge Settings.jsx talks to: request the SMS permission, save the
 * webhook URL/key once (the same ones already shown for MacroDroid), and
 * turn forwarding on or off - SmsReceiver does the actual catching, this
 * plugin is only the on/off switch and the one-time setup.
 */
@CapacitorPlugin(
  name = "SmsForwarder",
  permissions = {
    @Permission(strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }, alias = "sms")
  }
)
public class SmsForwarderPlugin extends Plugin {

  private SharedPreferences prefs() {
    return getContext().getSharedPreferences(SmsReceiver.PREFS, android.content.Context.MODE_PRIVATE);
  }

  private boolean granted() {
    return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
  }

  @PluginMethod
  public void status(PluginCall call) {
    SharedPreferences p = prefs();
    JSObject result = new JSObject();
    result.put("granted", granted());
    result.put("enabled", p.getBoolean("enabled", false));
    result.put("configured", p.getString("url", null) != null && p.getString("key", null) != null);
    call.resolve(result);
  }

  @PluginMethod
  public void requestPermission(PluginCall call) {
    if (granted()) {
      status(call);
      return;
    }
    requestPermissionForAlias("sms", call, "permissionCallback");
  }

  @PermissionCallback
  private void permissionCallback(PluginCall call) {
    status(call);
  }

  /** Saves the webhook URL and key - the same pair Settings already shows for MacroDroid. */
  @PluginMethod
  public void configure(PluginCall call) {
    String url = call.getString("url");
    String key = call.getString("key");
    if (url == null || key == null) {
      call.reject("Both url and key are required");
      return;
    }
    prefs().edit().putString("url", url).putString("key", key).apply();
    status(call);
  }

  @PluginMethod
  public void setEnabled(PluginCall call) {
    Boolean enabled = call.getBoolean("enabled", false);
    prefs().edit().putBoolean("enabled", Boolean.TRUE.equals(enabled)).apply();
    status(call);
  }
}
