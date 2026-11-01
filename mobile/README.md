# ALABBAS Academy mobile — iOS / Android / Huawei AppGallery

This is an **early functional native mobile app**, not a store-ready release.

## Included now
- One Expo / React Native application for iOS and Android, including Android-compatible Huawei devices without Google Mobile Services.
- Native home, courses, course details, search, category filtering, saved courses, and account entry points.
- Arabic and English interface with right-aligned Arabic content.
- Saved courses and a **public-only** catalog cache on device. This is *not* offline paid learning.
- Native public syllabus, consuming the Academy backend API. No private lesson URLs, answers, account tokens or payments are exposed.
- Web sign-in and My Courses links for existing learners as an interim bridge, **not native learner authentication**.

## Backend dependency

The platform branch adds:

- `GET /api/mobile/v1/catalog` — published courses, categories and instructor names.
- `GET /api/mobile/v1/courses/:id` — published course metadata and lesson titles only.

**These endpoints only exist on the live domain after the updated Next.js platform is deployed there.** A PHP/legacy deployment will not serve them. The mobile app displays a connection error if it cannot reach the API; it never invents course data.

For development you can run the Next.js backend separately, but the mobile client's fixed `SITE_ORIGIN` in `src/api.ts` intentionally points at the public HTTPS domain. Use a separate explicit development build/config to test against staging, and do not accidentally ship a staging URL.

## Local development

Requirements: Node 22.13+ (Expo SDK 57), Android Studio for Android, Xcode/macOS for iOS native builds, and Apple/Google/Huawei store credentials for publishing.

```sh
cd mobile
npm install
npx expo install --fix
npm run typecheck
npx expo start
```

Use an Android device/emulator, iOS simulator, or a suitable Expo development build. Install only dependencies approved for this SDK. Regenerate and commit a lockfile after dependency validation.

## Cloud builds

```sh
cd mobile
npx eas-cli login
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production
npx eas-cli build --platform android --profile huawei
```

- **iOS:** upload the signed IPA via App Store Connect; requires Apple Developer account, certificate/signing, metadata and review.
- **Google Play:** upload the signed Android App Bundle (AAB), review closed testing/store requirements and app privacy declarations.
- **Huawei AppGallery on Android-compatible phones:** use the `huawei` APK build, verify on a **real Google-services-free Huawei phone**, and submit through AppGallery Connect. The mobile code does not call Google Firebase/Maps/Play Services APIs.
- **HarmonyOS NEXT / native HarmonyOS:** separate ArkTS/ArkUI app package is required. Android APKs are **not guaranteed** to work on HarmonyOS NEXT; this repository does **not** implement that native port.

## Important release blockers

1. Deploy/verify the Next.js API, HTTPS and stability on the actual domain.
2. Complete **native authentication**, secured course streaming, progress, quiz/exam, certificate access and accessibility QA; the existing website links are transitional.
3. Review Apple App Review guidelines 4.2 (minimum app functionality) and 3.1 (digital course purchases); **no off-platform in-app checkout links are offered**. Plan compliant IAP/reader-app entitlements as appropriate to each storefront.
4. Replace demo/placeholder content, supply true course videos and rights, verify instructor identities, and update the privacy policy for mobile use.
5. Add original production-grade app icons (PNG), splash, privacy disclosures, screenshots, support/contact, account deletion flow, and store-specific metadata.
6. Run `npm run typecheck`, Android/iOS production builds, and real-device functional/accessibility tests. Test account flows separately on Huawei without GMS.
7. Configure release signing privately and have the developer accounts submit the apps. **Never commit signing keys, service credentials or passwords.**

Apple's App Review guidelines: https://developer.apple.com/app-store/review/guidelines/

Huawei AppGallery distribution: https://developer.huawei.com/consumer/en/appgallery/
