# GreaseMonkey AI - Web Deployment Guide

## Overview
This guide covers deploying GreaseMonkey AI as a Progressive Web App (PWA) with full voice and text input capabilities.

## Features

### Voice Input
- **Custom Wake Word**: Say "Hey GreaseMonkey" to activate hands-free voice input
- **Push-to-Talk**: Manual recording mode for precise control
- **Web Speech API**: Browser-native speech recognition for wake word detection
- **Microphone Permission**: Automatic permission handling with helpful prompts

### Text Input
- **Keyboard Shortcuts**: Enter to send, Shift+Enter for new lines
- **Responsive Design**: Optimized for both desktop and mobile web browsers
- **Dual Input Modes**: Switch seamlessly between text and voice input

### Wake Word Implementation
The web version uses the browser's Web Speech API to detect the custom wake word "Hey GreaseMonkey". When detected:
1. The system automatically starts recording
2. User speaks their question
3. Recording stops when they finish speaking
4. Question is processed and answered with TTS playback

### User Experience
- **Helpful Tips**: When users switch to wake word mode, they see a helpful tip explaining how to use "Hey GreaseMonkey"
- **Visual Feedback**: Clear indicators show when the system is listening for the wake word
- **Fallback Options**: Text input is always available as an alternative to voice

## Technical Implementation

### Wake Word Detection
- Uses browser's native Web Speech API for continuous listening
- Detects variations: "hey greasemonkey" and "hey grease monkey"
- Automatic restart on speech recognition errors
- Proper cleanup and resource management

### Browser Compatibility
- Chrome/Chromium: Full support
- Firefox: Limited speech recognition support
- Safari: Partial support (iOS Safari has better support)
- Edge: Full support

## Deployment

### Environment Variables
No additional environment variables needed for basic wake word functionality. The system uses the browser's built-in speech recognition.

### Build Commands
```bash
# Development with hot reload
make run-web-dev

# Frontend only (requires separate backend)
make run-web-frontend-only

# Production build
cd frontend && flutter build web --web-renderer html
```

### Docker Deployment
The existing Docker configuration supports the new wake word features without modification.

## User Guide

### Getting Started
1. **Grant Microphone Permission**: Allow microphone access when prompted
2. **Choose Input Mode**: Toggle between "Push to Talk" and "Wake Word" modes
3. **Wake Word Usage**: In wake word mode, say "Hey GreaseMonkey" followed by your question
4. **Text Alternative**: Use the text input field for typing questions

### Tips for Best Experience
- **Clear Speech**: Speak clearly when using the wake word
- **Quiet Environment**: Background noise may affect wake word detection
- **Browser Choice**: Chrome/Edge provide the most reliable speech recognition
- **Fallback**: Always use text input if voice isn't working properly

## Troubleshooting

### Wake Word Not Working
1. Check microphone permissions in browser settings
2. Ensure you're using a supported browser (Chrome/Edge recommended)
3. Try refreshing the page to reinitialize speech recognition
4. Use text input as an alternative

### Performance Optimization
- The wake word service automatically restarts on errors
- Speech recognition is optimized for continuous listening
- Proper cleanup prevents memory leaks

## Future Enhancements
- Integration with Picovoice Web SDK for more accurate custom wake word detection
- Offline wake word detection capabilities
- Additional wake word phrases and customization options

## 🎉 Mobile-to-Web Transition Complete!

Your Flutter app has been successfully adapted for web deployment while maintaining all core functionality.

## ✅ What's Been Done

### 1. **Web-Optimized UI**
- **Responsive Design**: Automatically adapts between mobile and desktop layouts
- **Text Input**: Added keyboard input alongside voice for web users
- **Keyboard Shortcuts**: Ctrl+Enter to send questions quickly
- **Progressive Web App (PWA)**: Can be installed on desktop/mobile browsers

### 2. **Cross-Platform Compatibility**
- **Web-Safe Imports**: Conditional imports for platform-specific features
- **Audio Support**: Web-compatible audio playback with just_audio_web
- **Voice Input**: Works on web browsers that support microphone access
- **Fallback UI**: Graceful degradation when features aren't available

### 3. **Deployment Ready**
- **Docker Configuration**: Optimized Dockerfile with nginx for production
- **PWA Manifest**: Proper app metadata for installation
- **Build Optimizations**: CanvasKit renderer, offline-first strategy
- **Render Integration**: Already configured in your `render.yaml`

## 🚀 Deployment Options

### Option 1: Render (Recommended - Already Configured)
Your `render.yaml` is already set up! Just push to your repo and Render will:
- Build the Flutter web app automatically
- Serve it with nginx
- Handle SSL certificates
- Provide a production URL

### Option 2: Alternative Platforms
- **Vercel**: Excellent for Flutter web, simple deployment
- **Netlify**: Great for static sites with form handling
- **Firebase Hosting**: Google's platform with excellent Flutter integration

## 🔧 Environment Variables

For web deployment, ensure these are set in your Render dashboard:

```bash
BACKEND_URL=https://your-backend-url.onrender.com
API_KEY=your-secure-api-key-here
```

## 📱 Features Available on Web

### ✅ Fully Supported
- Text-based questions and answers
- Audio playback of responses (TTS)
- Vehicle management (garage)
- Document upload/search
- Settings and preferences
- Responsive design (mobile/desktop)

### 🔄 Conditional Support
- **Voice Input**: Requires microphone permission in browser
- **Wake Word**: Not supported (automatically uses push-to-talk)
- **File Access**: Uses browser file picker instead of native

### 🎯 Web-Specific Enhancements
- **Keyboard Navigation**: Tab through interface, keyboard shortcuts
- **Copy/Paste**: Easy text manipulation for questions
- **Multi-tab Support**: Can open multiple instances
- **Bookmarkable**: Direct URLs to specific sections

## 🏗️ Build Commands

```bash
# Development
cd frontend
flutter run -d chrome

# Production Build
flutter build web --release --web-renderer canvaskit

# Docker Build (for Render)
docker build -t greasemonkey-web .
```

## 🌐 Browser Compatibility

### ✅ Fully Supported
- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

### ⚠️ Limited Support
- Internet Explorer: Not supported
- Older mobile browsers: Basic functionality only

## 📊 Performance Optimizations

- **Code Splitting**: Automatic with Flutter web
- **Asset Caching**: 1-year cache for static assets
- **Compression**: Gzip enabled via nginx
- **PWA Caching**: Offline-first strategy for core functionality

## 🔒 Security Features

- **HTTPS Only**: Enforced in production
- **Security Headers**: XSS protection, content type sniffing prevention
- **API Key Protection**: Secure backend communication
- **CORS Configuration**: Proper cross-origin handling

## 🚀 Next Steps

1. **Push to Git**: Your changes are ready for deployment
2. **Check Render**: Should auto-deploy from your `render.yaml`
3. **Test Production**: Verify all features work on the live site
4. **Monitor Performance**: Use Render's built-in analytics

## 💡 Pro Tips

- **Mobile Testing**: Use browser dev tools to test mobile layouts
- **PWA Installation**: Users can "Add to Home Screen" on mobile
- **Voice Permissions**: Guide users to allow microphone access
- **Offline Support**: Core UI works without internet connection

Your GreaseMonkey AI is now ready for the web! 🎉
