// Copyright 2026 haozheyu. SPDX-License-Identifier: Apache-2.0
package local.gpusre.copilot;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeVaultPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
