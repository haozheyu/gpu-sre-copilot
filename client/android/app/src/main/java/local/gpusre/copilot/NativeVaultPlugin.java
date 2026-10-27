package local.gpusre.copilot;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import java.nio.charset.StandardCharsets;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "NativeVault")
public class NativeVaultPlugin extends Plugin {
    private static final String ALIAS = "gpu-sre-deepseek-v1";
    private SharedPreferences prefs() { return getContext().getSharedPreferences("credential-v1", Context.MODE_PRIVATE); }
    private SecretKey encryptionKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    private void save(String value) throws Exception {
        if (value == null || !value.matches("sk-[A-Za-z0-9_-]{12,297}")) throw new IllegalArgumentException();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, encryptionKey());
        String data = Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
        if (!prefs().edit().putString("data", data).putString("iv", iv).putBoolean("initialized", true).commit()) throw new IllegalStateException();
    }
    @PluginMethod public synchronized void get(PluginCall call) {
        try {
            if (!prefs().getBoolean("initialized", false)) {
                // This asset exists only in the explicitly requested private APK. APK holders can extract it.
                String bootstrap = null;
                try (java.io.InputStream input = getContext().getAssets().open("private-bootstrap.key")) {
                    java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
                    byte[] bytes = new byte[512]; int count;
                    while ((count = input.read(bytes)) != -1) buffer.write(bytes, 0, count);
                    bootstrap = buffer.toString("UTF-8").trim();
                } catch (java.io.FileNotFoundException ignored) { }
                if (bootstrap != null) save(bootstrap);
            }
            String data = prefs().getString("data", null), value = "";
            if (data != null) {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), new GCMParameterSpec(128, Base64.decode(prefs().getString("iv", ""), Base64.NO_WRAP)));
                value = new String(cipher.doFinal(Base64.decode(data, Base64.NO_WRAP)), StandardCharsets.UTF_8);
            }
            JSObject result = new JSObject(); result.put("key", value); call.resolve(result);
        } catch (Exception e) { call.reject("Android 密钥读取失败，请在设置中重新保存密钥。"); }
    }
    @PluginMethod public synchronized void set(PluginCall call) {
        try { save(call.getString("key")); call.resolve(); }
        catch (Exception e) { call.reject("Android 密钥保存失败，请检查密钥或系统安全存储。"); }
    }
    @PluginMethod public synchronized void clear(PluginCall call) {
        // Keep tombstone: removing a key must not restore the bundled credential on next launch.
        if (prefs().edit().remove("data").remove("iv").putBoolean("initialized", true).commit()) call.resolve();
        else call.reject("密钥移除失败。");
    }
}
