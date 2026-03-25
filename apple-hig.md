# Apple Human Interface Guidelines
> Reference: https://developer.apple.com/design/human-interface-guidelines/
> Last updated: 2025–2026 (includes Liquid Glass / iOS 26 / macOS 26)

---

## Table of Contents

1. [Foundations](#1-foundations)
2. [Platforms](#2-platforms)
3. [Layout & Spacing](#3-layout--spacing)
4. [Typography](#4-typography)
5. [Color](#5-color)
6. [Iconography & SF Symbols](#6-iconography--sf-symbols)
7. [Navigation Patterns](#7-navigation-patterns)
8. [Controls & Inputs](#8-controls--inputs)
9. [Presentation Patterns](#9-presentation-patterns)
10. [Gestures & Interaction](#10-gestures--interaction)
11. [Accessibility](#11-accessibility)
12. [Materials & Visual Effects](#12-materials--visual-effects)
13. [Motion & Animation](#13-motion--animation)
14. [Privacy & Permissions](#14-privacy--permissions)
15. [App Icons](#15-app-icons)
16. [Platform-Specific: iOS / iPadOS](#16-platform-specific-ios--ipados)
17. [Platform-Specific: macOS](#17-platform-specific-macos)
18. [Platform-Specific: watchOS](#18-platform-specific-watchos)
19. [Platform-Specific: tvOS](#19-platform-specific-tvos)
20. [Platform-Specific: visionOS](#20-platform-specific-visionos)

---

## 1. Foundations

### Three Core Design Principles

| Principle | Meaning |
|-----------|---------|
| **Clarity** | Text is legible at every size, icons are precise and lucid, adornments are subtle and appropriate, sharpened focus on functionality motivates the design |
| **Deference** | Fluid motion and a crisp, beautiful interface help people understand and interact with content without competing with it |
| **Depth** | Visual layers and realistic motion convey hierarchy, impart vitality, and facilitate understanding |

### Design for Real People

- Design for a range of abilities, not just the most capable user
- Accommodate all body types — left-handed, right-handed, small hands, large hands
- People should be able to accomplish tasks without requiring explanation
- Use familiar metaphors and standard interactions where possible
- Provide feedback for every action — visual, haptic, or auditory

### Consistency

- **Internal consistency** — interactions and visual elements should behave predictably across your app
- **External consistency** — follow platform conventions so people can apply their existing knowledge
- Do not reinvent interactions that the platform already defines well

---

## 2. Platforms

| Platform | Primary Input | Screen Context | Key Metaphor |
|----------|--------------|----------------|--------------|
| iOS | Multi-touch | Handheld, portrait-first | Direct manipulation |
| iPadOS | Touch + optional Pointer/Keyboard | Tablet, flexible orientation | Desktop-lite |
| macOS | Pointer + Keyboard | Desktop, persistent windows | Document-centric |
| watchOS | Tap + Crown + Raise-to-wake | Glanceable, wrist | Micro-interactions |
| tvOS | Siri Remote / Game Controller | Living room, 10-foot UI | Focus / Browse |
| visionOS | Eyes + Hands + Voice | Spatial, unbounded | Window in space |

---

## 3. Layout & Spacing

### Safe Areas

Never place interactive controls or critical content in unsafe areas:

- **Top safe area** — status bar, notch, Dynamic Island
- **Bottom safe area** — home indicator bar
- **Side safe areas** — device curvature on iPhone
- Always use `safeAreaInsets` / `.safeAreaPadding()` in SwiftUI

### Standard Margins

| Context | Value |
|---------|-------|
| Screen edge margins (iPhone) | 16 pt |
| Screen edge margins (iPad) | 20–24 pt |
| Between related elements | 8 pt |
| Between sections | 16–24 pt |
| Large gaps / section dividers | 32–40 pt |

### Grid & Column Systems

- iPhone: 4-column grid at ~375 pt, edge margins ~16 pt
- iPad: 8 or 12-column grid, margins scale with size class
- Content max width for readable text: ~66 characters per line

### Dynamic Type & Scalability

- Use semantic text styles (`title`, `headline`, `body`, `caption`) not fixed sizes
- UI must be functional at all Dynamic Type sizes including Accessibility sizes (up to ~310% scale)
- Test with the largest Accessibility type size enabled
- Avoid truncating text — prefer wrapping or expanding containers

### Adaptive Layouts

- Use `UITraitCollection` / `@Environment(\.horizontalSizeClass)` to adapt between compact and regular
- Compact width (iPhone portrait, iPad split-view) → stacked, single-column layouts
- Regular width (iPad full-screen, iPhone landscape on large models) → multi-column layouts
- Provide landscape variants where orientation matters (e.g. media players, games)

---

## 4. Typography

### System Fonts

| Font | Use |
|------|-----|
| **SF Pro** | iOS, iPadOS, macOS body, UI text |
| **SF Pro Rounded** | Friendly / playful contexts |
| **SF Compact** | watchOS |
| **SF Mono** | Code, monospaced data |
| **New York** | Serif reading / editorial |

Always prefer system fonts. Custom fonts require careful sizing and weight parity with system defaults.

### Text Styles (Dynamic Type)

| Style | Default Size | Weight | Use |
|-------|-------------|--------|-----|
| Large Title | 34 pt | Regular | Page headers, hero titles |
| Title 1 | 28 pt | Regular | Section titles |
| Title 2 | 22 pt | Regular | Sub-section titles |
| Title 3 | 20 pt | Regular | Smaller sub-titles |
| Headline | 17 pt | Semibold | List item labels, card headers |
| Body | 17 pt | Regular | Primary reading text |
| Callout | 16 pt | Regular | Supporting body text |
| Subheadline | 15 pt | Regular | Secondary text |
| Footnote | 13 pt | Regular | Notes, captions |
| Caption 1 | 12 pt | Regular | Image captions |
| Caption 2 | 11 pt | Regular | Timestamps, metadata |

### Typography Rules

- Maintain a clear hierarchy: no more than 2–3 type weights per screen
- Minimum body text: 17 pt at default scale (never hardcode below 11 pt)
- Line spacing: ~1.4× for body, ~1.2× for headings
- Letter spacing: default tracking for body; tighter for display sizes (> 28 pt)
- Left-align body text; center short labels only

---

## 5. Color

### Semantic System Colors

Use semantic colors so your UI automatically adapts to Light Mode, Dark Mode, and accessibility settings.

| Semantic | SwiftUI | UIKit |
|----------|---------|-------|
| Primary label | `.primary` | `.label` |
| Secondary label | `.secondary` | `.secondaryLabel` |
| Tertiary label | — | `.tertiaryLabel` |
| Background | — | `.systemBackground` |
| Secondary background | — | `.secondarySystemBackground` |
| Grouped background | — | `.systemGroupedBackground` |
| Separator | — | `.separator` |
| Tint / Accent | `.accentColor` | `.tintColor` |

### System Accent Colors

- **Blue** — Default tint, interactive elements, links
- **Red** — Destructive actions, alerts, errors
- **Green** — Confirmations, success states
- **Orange** — Warnings, notifications
- **Yellow** — Caution
- **Purple / Pink / Indigo** — Branding accents (use sparingly)

### Color Rules

- Never rely on color alone to convey information — always pair with shape, label, or icon
- Maintain WCAG AA contrast ratio: **4.5:1** for text, **3:1** for large text and UI components
- Prefer WCAG AAA (7:1) where possible
- Test all screens in both Light Mode and Dark Mode
- Test with Color Filters (Settings → Accessibility → Display) — deuteranopia, protanopia, tritanopia
- Avoid pure white on pure black — use system background colors which are slightly off-pure

### Dark Mode

- Always support Dark Mode — use semantic colors, not hardcoded hex values
- Elevated surfaces use slightly lighter backgrounds in Dark Mode (not darker)
- Materials (vibrancy) respond automatically when using system materials

---

## 6. Iconography & SF Symbols

### SF Symbols

SF Symbols is Apple's icon library (6,000+ symbols, free for Apple platform apps).

- Always prefer SF Symbols over custom icons when a fitting symbol exists
- Symbols automatically align with Dynamic Type and adapt weight to match adjacent text
- Use `Image(systemName:)` in SwiftUI or `UIImage(systemName:)` in UIKit
- Specify weight: `.symbolRenderingMode(.hierarchical)`, `.palette`, `.multicolor`

```swift
Image(systemName: "heart.fill")
    .font(.title2)
    .symbolRenderingMode(.hierarchical)
    .foregroundStyle(.red)
```

### Symbol Scales

| Scale | Use |
|-------|-----|
| `.small` | Inline with caption text |
| `.medium` (default) | Standard UI |
| `.large` | Prominent buttons, empty states |

### Custom Icons

- Keep a consistent visual weight across your icon set
- Use a 24×24 pt grid with 1 pt stroke weight minimum
- Align to pixel grid — avoid half-pixel strokes
- Provide all required sizes: 1×, 2×, 3× assets

---

## 7. Navigation Patterns

### Tab Bar (iOS / iPadOS)

- Use for top-level navigation with 2–5 distinct sections
- Tabs are always visible — they represent the major areas of your app
- Never use tabs for sequential or hierarchical flows
- Label all tabs (text + icon) — icon only is acceptable at very small sizes
- Highlight the active tab; do not animate switching
- **iOS 26 / Liquid Glass**: tab bars now float over content with glass material

### Navigation Stack (Push/Pop)

- Use for hierarchical content (drill-down): list → detail → sub-detail
- Back button always present; title updates to reflect current level
- Limit depth — if the user needs more than 3 taps to get somewhere, reconsider
- Support swipe-back gesture at all times

### Sidebar (iPadOS / macOS)

- Use on iPad in regular width (split view, full screen)
- Sidebar takes ~320 pt; collapses to a slide-over overlay in compact
- Groups related sections; use disclosure groups for sub-navigation
- Primary navigation pattern for iPad apps (replaces tab bar at regular width)

### Modal Presentations

| Type | Use | Dismissal |
|------|-----|-----------|
| Sheet (card) | Subtasks, pickers, forms | Drag down or cancel button |
| Full-screen cover | Camera, immersive flows, onboarding | Explicit close button |
| Popover | Contextual info / actions (iPad/Mac) | Tap outside |
| Alert | Confirmations, errors (1–2 actions) | Button tap only |
| Action sheet | 3+ destructive or contextual actions | Cancel option always |

### Search

- Place search in the navigation bar using `searchable()`
- Support search tokens and scopes for complex content
- Show results immediately as user types (no "Search" button needed)
- Display a recent searches list when search is empty

---

## 8. Controls & Inputs

### Buttons

| Style | Use |
|-------|-----|
| **Filled** (primary) | Most important action on screen; 1 per screen |
| **Tinted** (secondary) | Supporting actions |
| **Gray** | Neutral/tertiary actions |
| **Plain / Borderless** | Low emphasis, inline actions |
| **Destructive** | Irreversible actions — red tint |

- Minimum touch target: **44×44 pt**
- Button labels: concise verb phrases ("Add to Library", not "Click here to add")
- Show loading state for async actions (spinner or disabled state)

### Text Fields

- Always use a placeholder that describes the expected input
- Show keyboard type matching input (email, number, phone, URL)
- Use Return key label matching the action ("Done", "Search", "Next", "Send")
- Validate inline — show errors below the field, not in an alert
- Support AutoFill for credentials, addresses, payments

### Toggles & Switches

- Use for binary on/off settings with immediate effect
- Label should describe the on state
- Do not use a toggle for actions that require confirmation

### Sliders

- Use for continuous ranges (volume, brightness, opacity)
- Provide value labels where precision matters
- Minimum touch target height: 44 pt

### Pickers

| Type | Use |
|------|-----|
| Segmented control | 2–5 mutually exclusive options (visible at once) |
| Menu / dropdown | 3+ options when space is constrained |
| Wheel picker | Date/time, medium-length lists |
| List picker (sheet) | Long lists, searchable |

### Steppers

- Use for small integer adjustments (quantity, pages)
- Always show the current value adjacent to the stepper

---

## 9. Presentation Patterns

### Lists & Tables

- Use `List` / `UITableView` for scrollable content of similar items
- Group related items with section headers
- Support swipe actions for common quick actions (delete, archive, pin)
- Support context menus (long-press) for secondary actions
- Provide empty state with an illustration + explanation + CTA

### Cards

- Use cards to group related information into a scannable unit
- Cards should be tappable when they represent navigable content
- Rounded corners: system default corner radius (~10–16 pt)
- Cards with elevation: use system shadow or material background

### Empty States

Every empty list/screen should have:
1. An SF Symbol or illustration
2. A short title explaining what's empty
3. A brief description of why / what to do
4. A call-to-action button

### Loading States

- Use skeleton screens over spinners for content-heavy views
- Show progress indicators for operations > 2 seconds
- Use indeterminate spinner for unknown duration
- Use `ProgressView(value:)` for known progress
- Never block the entire UI with a spinner — prefer in-place loading

### Pull to Refresh

- Support pull-to-refresh on all scrollable lists that can have new content
- The refresh indicator appears at the top; content stays in place

---

## 10. Gestures & Interaction

### Standard iOS Gestures

| Gesture | Action |
|---------|--------|
| Tap | Select, activate |
| Double-tap | Zoom in / toggle detail |
| Long press | Context menu / drag handle |
| Swipe (left/right) | Navigation, swipe actions |
| Swipe (up/down) | Scroll, dismiss sheets |
| Pinch | Zoom |
| Rotate | Rotate (maps, images) |
| Drag | Reorder, pan |
| Edge swipe (leading) | Back navigation |
| Edge swipe (trailing) | Forward navigation (if applicable) |

### Haptics

Use `UIFeedbackGenerator` / `SensoryFeedback` to reinforce interactions:

| Feedback | Use |
|----------|-----|
| **Impact** (light/medium/heavy) | Physical collisions, snap-to-grid |
| **Selection** | Value changes (picker ticks, toggle) |
| **Notification** (success/warning/error) | Task completion, errors |

- Haptics should feel natural, not disruptive
- Never fire haptics without a matching visual interaction
- Respect "Reduce Motion" and "Haptic feedback" system settings

---

## 11. Accessibility

Accessibility is a first-class requirement, not an afterthought.

### VoiceOver

- Every interactive element must have a meaningful accessibility label
- Use `accessibilityLabel`, `accessibilityHint`, `accessibilityValue`
- Group related elements: `accessibilityElement(children: .combine)`
- Implement custom actions for swipe-based interactions
- Test by enabling VoiceOver and navigating your entire app

### Dynamic Type

- Support all Dynamic Type sizes including Accessibility sizes (xL–xxxL)
- Test at the maximum Accessibility size
- Never clip or truncate essential content at any size

### Contrast & Color

- Minimum contrast: 4.5:1 for normal text, 3:1 for large text
- Support "Increase Contrast" setting
- Never communicate state with color alone

### Motion

- Respect `UIAccessibility.isReduceMotionEnabled` / `.accessibilityReduceMotion`
- Provide non-animated fallbacks for all transitions
- Avoid flashing or strobing effects (can trigger photosensitive epilepsy)

### Focus Management

- Manage keyboard focus explicitly when presenting modals
- Return focus to the triggering element when dismissing modals

### Minimum Touch Targets

- 44×44 pt for all interactive elements
- Use `.contentShape(Rectangle())` in SwiftUI to expand tap targets

---

## 12. Materials & Visual Effects

### System Materials (iOS / macOS)

Materials are translucent, dynamic backgrounds that pick up color from underlying content.

| Material | Opacity | Use |
|----------|---------|-----|
| `.ultraThinMaterial` | Very translucent | Overlays on vivid content |
| `.thinMaterial` | Translucent | Navigation bars, sidebars |
| `.regularMaterial` | Medium | Sheets, popovers |
| `.thickMaterial` | Opaque-ish | High-contrast surfaces |
| `.ultraThickMaterial` | Near-opaque | Strong separation |

### Liquid Glass (iOS 26 / macOS 26 — 2025)

Liquid Glass is a new adaptive material introduced in 2025 that:
- Acts as a dynamic lens that refracts and responds to underlying content
- Used by system chrome: tab bars, toolbars, navigation bars, sidebars
- Harmonizes the relationship between interface and content
- Automatically adapts to light/dark mode and content hue
- Replaces the static frosted-glass look with a physically-simulated refraction

Use system components (tab bars, navigation bars) to get Liquid Glass automatically. Avoid manually recreating the effect with custom blur layers.

### Vibrancy

- Vibrancy layers labels and fills onto materials so they adapt to the blurred background
- Use `.foregroundStyle(.secondary)` and `.tertiary` to get vibrancy on material backgrounds
- Do not use solid colors on material backgrounds — use vibrancy-aware semantic colors

---

## 13. Motion & Animation

### Principles

- Animations should feel **physical** — use spring animations, not linear tweens
- Animations should **aid comprehension** — show where elements come from/go to
- Never animate purely for decoration
- Duration: UI transitions typically 0.25–0.35 s; avoid anything over 0.5 s for routine actions

### Standard Transitions

| Transition | Use |
|------------|-----|
| Push/slide | Hierarchical navigation (forward/back) |
| Cover/uncover | Modal sheets (bottom-up) |
| Fade | Tabs, non-hierarchical changes |
| Zoom | Opening/closing items (documents, photos) |
| Matched geometry | Hero transitions (item → detail) |

### Spring Animation Parameters

```swift
.animation(.spring(response: 0.35, dampingFraction: 0.8), value: isOpen)
```

- `response`: controls speed (0.3–0.4 for snappy, 0.5–0.6 for smooth)
- `dampingFraction`: 0.7–0.9 for subtle bounce; 1.0 for no bounce

### Reduce Motion

Always provide a non-animated alternative:

```swift
@Environment(\.accessibilityReduceMotion) var reduceMotion

.animation(reduceMotion ? .none : .spring(), value: state)
```

---

## 14. Privacy & Permissions

### Principles

- Request permissions only when needed, not at launch
- Explain why you need access immediately before the system prompt
- Gracefully degrade when permission is denied — never disable the whole app
- Minimize data collection; process on-device when possible

### Permission Usage Descriptions

Required keys in `Info.plist`:

| Permission | Key |
|------------|-----|
| Camera | `NSCameraUsageDescription` |
| Microphone | `NSMicrophoneUsageDescription` |
| Photo Library (read) | `NSPhotoLibraryUsageDescription` |
| Photo Library (write) | `NSPhotoLibraryAddUsageDescription` |
| Location (always) | `NSLocationAlwaysAndWhenInUseUsageDescription` |
| Location (in-use) | `NSLocationWhenInUseUsageDescription` |
| Contacts | `NSContactsUsageDescription` |
| Bluetooth | `NSBluetoothAlwaysUsageDescription` |
| Face ID | `NSFaceIDUsageDescription` |
| Notifications | Via `UNUserNotificationCenter` |

### Data Transparency

- Use App Privacy Report items accurately in App Store Connect
- Show a clear privacy policy link in Settings / About
- Implement `App Tracking Transparency` (ATT) before any cross-app tracking

---

## 15. App Icons

### Required Sizes

| Platform | Sizes |
|----------|-------|
| iOS (App Store + Home Screen) | 1024×1024 (App Store), 60×60 @2x/3x, 20×20 @1x/2x/3x, 29×29, 40×40 |
| iPadOS | 1024, 83.5@2x, 76@2x, 40@2x, 29@2x, 20@2x |
| macOS | 1024, 512@2x, 256@2x, 128@2x, 64, 32@2x, 16@2x |
| watchOS | Various including 44@2x, 50@2x, 86@2x, 98@2x, 108@2x |

Use an Xcode Asset Catalog (`AppIcon`) and provide a single 1024×1024 pt source — Xcode generates all sizes.

### Design Rules

- Must be a perfect square; the OS applies the rounded-rectangle mask
- No transparency — the background must be opaque
- Keep the design bold and recognizable at 29×29 pt (smallest displayed size)
- Do not add your own rounded corners or drop shadows — the OS handles this
- Avoid text that becomes illegible at small sizes
- Test against both light and dark wallpapers

---

## 16. Platform-Specific: iOS / iPadOS

### iPhone Form Factors

| Model | Points | Scale | Notable |
|-------|--------|-------|---------|
| iPhone SE (3rd) | 375×667 | @2x | Smallest current form factor |
| iPhone 16 | 390×844 | @3x | Standard |
| iPhone 16 Plus | 430×932 | @3x | Large |
| iPhone 16 Pro | 393×852 | @3x | Dynamic Island |
| iPhone 16 Pro Max | 430×932 | @3x | Dynamic Island, largest |

### Dynamic Island

- Do not place content in the Dynamic Island area
- Use `ActivityKit` for Live Activities that integrate with Dynamic Island
- Live Activities expand in Dynamic Island for timely, glanceable info
- Compact / minimal / expanded presentations defined by the system

### Home Screen & Widgets

- Support Lock Screen widgets (WidgetKit, `.accessoryCircular`, `.accessoryRectangular`)
- Home Screen widgets: `.systemSmall`, `.systemMedium`, `.systemLarge`, `.systemExtraLarge`
- Widgets are not apps — no buttons or user input; tap navigates to the app
- Widget data should be fresh — use `TimelineProvider` for scheduled updates

### iPad Multitasking

- Support Split View (side-by-side apps) and Slide Over
- Use `UISplitViewController` / `NavigationSplitView` for the sidebar + detail pattern
- Never assume full-screen — test in all multitasking configurations

---

## 17. Platform-Specific: macOS

### Window Management

- Apps can have multiple windows — design accordingly
- Support standard window controls: minimize, zoom, close
- Use `NSWindowController` / SwiftUI's `WindowGroup` and `Window`
- Support full-screen mode for focus-oriented apps
- Save and restore window position/size between launches

### Menu Bar

- Every macOS app requires a menu bar with standard items
- Required menus: App menu (Quit, About, Preferences), File, Edit, View, Window, Help
- Add app-specific menus between Edit and View
- All major features should be keyboard-accessible via menu bar

### Keyboard

- Support standard keyboard shortcuts (⌘C, ⌘V, ⌘Z, etc.)
- Expose all actions as keyboard shortcuts
- Full keyboard navigation: all interactive elements reachable via Tab / arrow keys

### Toolbar

- Use the window toolbar for frequent document/window-level actions
- Support toolbar customization (`NSToolbar` customization)
- Keep toolbars minimal — 5–8 items maximum

### Cursor & Pointer

- Cursor must update to contextual shape: pointer hand (links/buttons), I-beam (text), crosshair (drawing)
- Support hover states for all interactive elements
- Support right-click / secondary click context menus everywhere

---

## 18. Platform-Specific: watchOS

### Design Constraints

- Screen sizes: 40 mm (176×215 pt), 44 mm (198×242 pt), 45/49 mm (205/251×251/307 pt)
- Primary input: tap + Digital Crown + raise-to-wake
- Glanceable first — content must be readable in 2–5 seconds
- No nested navigation beyond 2 levels
- Use the Digital Crown for scrolling and value adjustment

### Complications

- Provide complications for all relevant data
- Families: circular, rectangular, corner, graphic (44 mm+)
- Complications update with background refresh (budget-limited)
- Keep complications to 1–3 data points

### Notifications

- Short Look: app icon + title, dismissable
- Long Look: expanded notification with action buttons
- Keep notification content concise and actionable

### watchOS UI

- Use `WKInterfaceTable` for lists (limited to ~20 rows)
- Avoid dense text — use large type, concise labels
- Use haptics for confirmations and alerts (`.WKHapticType`)
- Prefer system list style over custom layouts

---

## 19. Platform-Specific: tvOS

### 10-Foot Interface

- Content is viewed from ~10 feet away — design for TV, not phone
- Minimum font size: ~29 pt (equivalent to ~17 pt at phone distance)
- High contrast between text and background — vibrancy helps
- Large touch targets: focus item size ≥ 120×100 pt

### Focus Engine

- All interactivity is through focus — the focused element is highlighted by the system
- Use `.focusable()` and `FocusState` in SwiftUI
- Never hide critical content — it must be reachable by the focus engine
- Support the Siri Remote: swipe, click, menu, play/pause

### Top Shelf

- Apps on the top row of the Home Screen can display a Top Shelf image
- Inset Top Shelf: 1920×720 px; Scrolling Top Shelf: 1920×720 px per item
- Use Top Shelf for featured content, recent items, or promotions

### Parallax

- System automatically applies parallax to focused items
- Layer your app icon into foreground, middle, background layers for parallax
- Use `UIMotionEffect` for custom parallax on focused elements

---

## 20. Platform-Specific: visionOS

### Spatial Design Principles

- **Familiarity** — apps should feel familiar; extend from iOS/iPadOS patterns where possible
- **Dimensionality** — use depth to convey hierarchy and focus, not just decoration
- **Immersion** — apps exist on a spectrum from Shared Space to Full Space

### Spaces

| Mode | Description |
|------|-------------|
| **Shared Space** | App coexists with other apps; windows float in the user's space |
| **Full Space** | App takes over the entire space; no other apps visible |
| **Passthrough** | Mixed reality, real world visible |
| **Environment** | Custom rendered immersive environment, real world hidden |

### Windows

- Windows are glass panels floating in space
- Minimum window size: 400×400 pt (default)
- Windows have a glass material background by default
- Users position and resize windows with hands/eyes
- Do not fight the user's window positioning

### Input

- **Eyes** — look at any interactive element to focus it
- **Hands (direct)** — pinch or tap to activate focused elements near you
- **Hands (indirect)** — pinch while looking at a distant element
- **Voice** — Siri and dictation
- **Gamepad / Keyboard / Pointer** — optional accessories
- All interactive elements require a hover effect on eye focus

### Depth & Materials

- Use glass material (`.glass`) for window backgrounds
- Use depth to separate panels (foreground content higher Z than background chrome)
- Avoid large solid-color planes — they look flat in spatial context
- 3D objects: use RealityKit / ModelEntity; avoid faking 3D with 2D shadows

### Ornaments

- Toolbar-like controls attached to the edge of a window
- Use ornaments for playback controls, toolbars that should not scroll with content

---

## Quick Reference: Do's and Don'ts

### Do
- Use semantic system colors (never hardcode hex values)
- Use SF Symbols for icons wherever possible
- Support Dynamic Type at all sizes including Accessibility sizes
- Support Dark Mode with semantic colors
- Provide 44×44 pt minimum touch targets
- Respect safe areas on all devices
- Test with VoiceOver, keyboard navigation, and Switch Control
- Provide empty states, loading states, and error states
- Use spring animations and respect Reduce Motion

### Don't
- Don't add your own loading screen over the system launch screen
- Don't disable the system back gesture
- Don't present alerts for every minor error
- Don't use color alone to convey state
- Don't block the UI with full-screen spinners
- Don't request permissions before explaining why
- Don't animate everything — animation should serve a purpose
- Don't use tab bars for hierarchical or sequential flows
- Don't hardcode device-specific logic (check traits, not model strings)
- Don't set `UIRequiresFullScreen` unless truly necessary

---

## Resources

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [SF Symbols App](https://developer.apple.com/sf-symbols/)
- [Apple Design Resources (Figma/Sketch kits)](https://developer.apple.com/design/resources/)
- [WWDC Design Sessions](https://developer.apple.com/videos/design/)
- [Accessibility Programming Guide](https://developer.apple.com/accessibility/)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
