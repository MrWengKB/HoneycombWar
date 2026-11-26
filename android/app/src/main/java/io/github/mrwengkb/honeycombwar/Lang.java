package io.github.mrwengkb.honeycombwar;

import android.content.Context;
import android.content.res.Configuration;

import java.util.Locale;

/**
 * The app's language, the same as the game page's: "en", "zh" (Simplified) or "tw" (Traditional).
 * The player's pick from the game's En 简 繁 buttons wins; otherwise the phone's language decides
 * (zh-TW, zh-HK, zh-MO and zh-Hant → Traditional, other Chinese → Simplified, everything else English).
 */
final class Lang {
    private static final String PREFS = "lang";
    private static final String KEY = "lang";

    private Lang() { }

    /** Saved by the game page; "" means follow the phone */
    static void set(Context c, String v) {
        if (!"en".equals(v) && !"zh".equals(v) && !"tw".equals(v)) v = "";
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, v).apply();
    }

    static String current(Context c) {
        String v = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "");
        if (!v.isEmpty()) return v;
        Locale l = Locale.getDefault();
        if (!"zh".equals(l.getLanguage())) return "en";
        String country = l.getCountry();
        if ("Hant".equals(l.getScript()) || "TW".equals(country) || "HK".equals(country) || "MO".equals(country)) return "tw";
        return "zh";
    }

    static String pick(Context c, String en, String zh, String tw) {
        switch (current(c)) {
            case "zh": return zh;
            case "tw": return tw;
            default: return en;
        }
    }

    /** A context whose resources (strings.xml) are in the app's language */
    static Context wrap(Context c) {
        String v = current(c);
        Locale loc = "tw".equals(v) ? Locale.TRADITIONAL_CHINESE : "zh".equals(v) ? Locale.SIMPLIFIED_CHINESE : Locale.ENGLISH;
        Configuration conf = new Configuration(c.getResources().getConfiguration());
        conf.setLocale(loc);
        return c.createConfigurationContext(conf);
    }
}
