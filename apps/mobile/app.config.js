// Extends app.json. CI sets ANDROID_VERSION_CODE (the workflow run number) so every published
// APK has a higher version code than the last and installs as an update.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.ANDROID_VERSION_CODE ?? config.android.versionCode),
  },
});
