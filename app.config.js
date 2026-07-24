// Dynamic Expo config layered on top of app.json.
//
// The direct-to-device "dev" build (APP_VARIANT=dev, set by
// scripts/build-iphone.sh and the EAS development/preview profiles) gets its
// OWN bundle id, home-screen name and icon, so it installs ALONGSIDE the real
// app instead of overwriting it – you can tell at a glance which build is on
// the phone. Only a production build (TestFlight / App Store) leaves
// APP_VARIANT unset and keeps the real Prep+Eat identity.
//
// The Expo `name` is deliberately NOT changed – it drives the native Xcode
// project/scheme name ("PrepEat"), which scripts/build-iphone.sh hardcodes.
// The dev label is set via CFBundleDisplayName instead, which only affects the
// text under the icon.

const IS_DEV = process.env.APP_VARIANT === 'dev';

module.exports = ({ config }) => {
  if (!IS_DEV) return config;
  return {
    ...config,
    icon: './assets/images/icon-dev.png',
    ios: {
      ...config.ios,
      bundleIdentifier: 'app.prepeat.dev',
      infoPlist: {
        ...config.ios?.infoPlist,
        CFBundleDisplayName: 'Prep+Eat Dev',
      },
    },
    android: {
      ...config.android,
      package: 'app.prepeat.dev',
    },
  };
};
