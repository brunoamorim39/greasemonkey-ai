# Wake Word Assets

This directory should contain the Picovoice wake word files for "greasemonkey".

## Required Files:

### 1. `greasemonkey.ppn`
Custom wake word model file for "greasemonkey"

**How to get this file:**
1. Go to https://console.picovoice.ai/
2. Sign up for a free account
3. Navigate to "Wake Word" section
4. Click "Train Wake Word"
5. Enter "greasemonkey" as your wake word
6. Record yourself saying "greasemonkey" multiple times (follow their instructions)
7. Train the model (takes a few minutes)
8. Download the `.ppn` file
9. Rename it to `greasemonkey.ppn` and place it here

### 2. `porcupine_params.pv`
Porcupine model parameters file

**How to get this file:**
1. Download from Porcupine GitHub releases: https://github.com/Picovoice/porcupine/tree/master/lib/common
2. Look for `porcupine_params.pv` in the common folder
3. Download and place it here

## Alternative: Use Built-in Wake Words

If you prefer to use a built-in wake word instead of "greasemonkey", you can modify the `WakeWordService` to use one of these:

```dart
// In lib/services/wakeword_service.dart, replace the keyword path with:
PorcupineManager.fromBuiltInKeywords(
  accessKey,
  [BuiltInKeyword.PORCUPINE], // or JARVIS, COMPUTER, etc.
  _wakeWordCallback,
  // ... other parameters
);
```

Available built-in keywords:
- `BuiltInKeyword.ALEXA`
- `BuiltInKeyword.AMERICANO`
- `BuiltInKeyword.BLUEBERRY`
- `BuiltInKeyword.BUMBLEBEE`
- `BuiltInKeyword.COMPUTER`
- `BuiltInKeyword.GRAPEFRUIT`
- `BuiltInKeyword.GRASSHOPPER`
- `BuiltInKeyword.HEY_GOOGLE`
- `BuiltInKeyword.HEY_SIRI`
- `BuiltInKeyword.JARVIS`
- `BuiltInKeyword.OK_GOOGLE`
- `BuiltInKeyword.PICOVOICE`
- `BuiltInKeyword.PORCUPINE`
- `BuiltInKeyword.TERMINATOR`

## Environment Setup

Don't forget to add your Picovoice access key to `.env`:
```
PICOVOICE_ACCESS_KEY=your-access-key-here
```
