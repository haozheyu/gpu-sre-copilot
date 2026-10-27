package local.gpusre.copilot;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeVaultPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
