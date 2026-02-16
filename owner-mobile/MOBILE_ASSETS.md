# Mobile App Assets (Android + iOS)

Use this folder for your final brand sources:

- `owner-mobile/assets/brand/app-icon.png` (1024x1024)
- `owner-mobile/assets/brand/splash.png` (2732x2732)
- `owner-mobile/assets/brand/adaptive-icon-foreground.png` (1024x1024)
- `owner-mobile/assets/brand/adaptive-icon-background.png` (1024x1024)

Optional editable placeholders are already added:

- `owner-mobile/assets/brand/app-icon.svg`
- `owner-mobile/assets/brand/splash.svg`

## Recommended workflow

1. Design logo + icon in Figma/Illustrator.
2. Export PNG files with the exact names above.
3. Run:

```powershell
cd owner-mobile
./scripts/prepare-brand-assets.ps1
npx @capacitor/assets generate --android --ios
npx cap sync android
npx cap sync ios
```

## Notes

- Android update check: open `owner-mobile/android/app/src/main/res/mipmap-*` to confirm generated icons.
- iOS update check (on macOS): open Xcode and confirm `AppIcon` + LaunchScreen assets.
- Keep all logo/icon source files in `owner-mobile/assets/brand` so updates are one-command.
