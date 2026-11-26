package io.github.mrwengkb.honeycombwar;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

/**
 * "Watch an ad to support the developer".
 * The game opens this screen from its "Support the author" button (HWApp.support()).
 * It loads one rewarded ad, shows it, and closes, which returns to the app.
 */
public class SupportActivity extends Activity {
    private boolean rewarded = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(loadingView());

        MobileAds.setRequestConfiguration(new RequestConfiguration.Builder()
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
                .build());
        MobileAds.initialize(this, status -> loadAd());
    }

    private LinearLayout loadingView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(getColor(R.color.page_bg));
        box.addView(new ProgressBar(this));
        TextView text = new TextView(this);
        text.setText(Lang.wrap(this).getString(R.string.ad_loading));
        text.setTextColor(getColor(R.color.ink));
        text.setTextSize(16);
        text.setPadding(0, 32, 0, 0);
        box.addView(text);
        return box;
    }

    private void loadAd() {
        RewardedAd.load(this, getString(R.string.admob_rewarded_unit), new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedAd ad) {
                        if (isFinishing()) return;
                        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                            @Override
                            public void onAdDismissedFullScreenContent() { done(); }

                            @Override
                            public void onAdFailedToShowFullScreenContent(@NonNull AdError e) { fail(); }
                        });
                        ad.show(SupportActivity.this, reward -> rewarded = true);
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError e) { fail(); }
                });
    }

    private void done() {
        if (rewarded) Toast.makeText(this, Lang.wrap(this).getString(R.string.ad_thanks), Toast.LENGTH_LONG).show();
        finish();
    }

    private void fail() {
        Toast.makeText(this, Lang.wrap(this).getString(R.string.ad_unavailable), Toast.LENGTH_LONG).show();
        finish();
    }
}
