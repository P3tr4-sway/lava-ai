# alphaTex Feature Coverage

Source: https://alphatab.net/docs/alphatex/ (fetched 2026-04-08, alphaTab v1.8.1)

## AST Node Mapping

| Feature | Syntax example | AST node/field |
|---|---|---|
| **SCORE METADATA** | | |
| Title | `\title "Song Name"` | `MetaNode.title` |
| Subtitle | `\subtitle "Sub"` | `MetaNode.subtitle` |
| Artist | `\artist "Artist"` | `MetaNode.artist` |
| Album | `\album "Album"` | `MetaNode.album` |
| Words (lyricist) | `\words "Author"` | `MetaNode.words` |
| Music (composer) | `\music "Composer"` | `MetaNode.music` |
| Copyright | `\copyright "Owner"` | `MetaNode.copyright` |
| Tab (transcriber) | `\tab "Transcriber"` | `MetaNode.tab` |
| Tempo (global) | `\tempo 120` | `MetaNode.tempo` |
| **STRUCTURAL** | | |
| Track | `\track "Guitar"` | `TrackNode` |
| Track (with short name) | `\track "Guitar" "Gtr"` | `TrackNode.name`, `TrackNode.shortName` |
| Track color | `\track { color "#FF0000" }` | `TrackNode.color` |
| Track solo | `\track { solo () }` | `TrackNode.solo` |
| Track mute | `\track { mute () }` | `TrackNode.mute` |
| Track volume | `\track { volume 15 }` | `TrackNode.volume` |
| Track instrument | `\track { instrument "Acoustic Guitar Steel" }` | `TrackNode.instrument` (MIDI program) |
| Staff | `\staff` | `StaffNode` |
| Staff score notation | `\staff { score 5 }` | `StaffNode.showScore` |
| Staff tab notation | `\staff { tabs () }` | `StaffNode.showTabs` |
| Staff slash notation | `\staff { slash () }` | `StaffNode.showSlash` |
| Voice | `\voice` | `VoiceNode` |
| **STAFF METADATA** | | |
| Tuning (guitar standard) | `\tuning E2 A2 D3 G3 B3 E4` | `TrackNode.tuning` (MIDI pitches) |
| Tuning (preset) | `\tuning piano` | `TrackNode.tuning` |
| Capo | `\capo 2` | `TrackNode.capo` |
| Chord definition | `\chord "Am" (0 0 2 2 1 0)` | `ChordDefNode` |
| Display transpose | `\displayTranspose -2` | `TrackNode.displayTranspose` |
| Transpose | `\transpose -2` | `TrackNode.transpose` |
| Lyrics (staff) | `\lyrics "Hello World"` | applied to beats |
| **BAR METADATA** | | |
| Time signature | `\ts 4 4` | `BarNode.timeSignature` |
| Time signature (common) | `\ts common` | `BarNode.timeSignature` {4,4} |
| Key signature | `\ks F#` | `BarNode.keySignature` |
| Tempo change | `\tempo 140` | `BarNode.tempo` |
| Tempo with label | `\tempo (140 "Fast")` | `BarNode.tempo`, `BarNode.tempoLabel` |
| Section marker | `\section "Intro"` | `BarNode.section` |
| Section (marker+text) | `\section "A" "Verse 1"` | `BarNode.section` |
| Repeat open | `\ro` | `BarNode.repeat.start` |
| Repeat close | `\rc 2` | `BarNode.repeat.end`, `.count` |
| Alternate ending | `\ae (1 2)` | `BarNode.alternateEnding` |
| Clef change | `\clef G2` | `BarNode.clef` |
| Triplet feel | `\tf triplet8th` | `BarNode.tripletFeel` |
| Anacrusis | `\ac` | `BarNode.anacrusis` |
| Free time | `\ft` | `BarNode.freeTime` |
| Jump (Da Capo etc.) | `\jump DaCapo` | `BarNode.jump` |
| Simile | `\simile simple` | `BarNode.simile` |
| Bar separator | `\|` or end of track | `BarNode` boundary |
| **BEAT CONTENT** | | |
| Single note | `3.1` | `NoteNode` {fret:3, string:1} |
| Rest | `r` | `BeatNode.rest` = true |
| Chord (multi-note) | `(3.1 2.2 0.3)` | `BeatNode.notes` array |
| Duration prefix | `:4` | `BeatNode.duration.value` = 4 |
| Duration suffix | `3.1.4` | `BeatNode.duration.value` = 4 |
| Duration dot | `3.1 { d }` | `BeatNode.duration.dots` = 1 |
| Double dot | `3.1 { dd }` | `BeatNode.duration.dots` = 2 |
| Tuplet | `3.1 { tu 3 }` | `BeatNode.duration.tuplet` {3,2} |
| Tuplet explicit | `3.1 { tu (5 4) }` | `BeatNode.duration.tuplet` {5,4} |
| Beat repeat | `:4 r * 4` | beat repeated N times |
| **BEAT EFFECTS** | | |
| Vibrato (slight) | `3.1 { v }` | `BeatNode.vibrato` = 'slight' |
| Vibrato (wide) | `3.1 { vw }` | `BeatNode.vibrato` = 'wide' |
| Fade in | `3.1 { f }` | `BeatNode.fadeIn` |
| Fade out | `3.1 { fo }` | `BeatNode.fadeOut` |
| Volume swell | `3.1 { vs }` | `BeatNode.volumeSwell` |
| Slap | `3.1 { s }` | `BeatNode.slap` |
| Pop | `3.1 { p }` | `BeatNode.pop` |
| Tapping | `3.1 { tt }` | `BeatNode.tap` |
| Pick stroke up | `3.1 { su }` | `BeatNode.pickStroke` = 'up' |
| Pick stroke down | `3.1 { sd }` | `BeatNode.pickStroke` = 'down' |
| Crescendo | `3.1 { cre }` | `BeatNode.crescendo` |
| Decrescendo | `3.1 { dec }` | `BeatNode.decrescendo` |
| Palm mute (beat-level) | `3.1 { pm }` | deprecated → see note-level |
| Text annotation | `3.1 { txt "Hello" }` | `BeatNode.text` |
| Lyrics | `3.1 { lyrics "He" }` | `BeatNode.lyrics` |
| Chord annotation | `3.1 { ch "Am" }` | `BeatNode.chord` |
| Dynamics | `3.1 { dy f }` | `BeatNode.dynamics` |
| Tempo change (beat) | `3.1 { tempo 120 }` | `BeatNode.tempoChange` |
| Tremolo picking | `3.1 { tp 8 }` | `BeatNode.tremoloPicking` |
| Whammy bar | `3.1 { tb (0 4 0) }` | `BeatNode.whammy` |
| Whammy (exact) | `3.1 { tbe (0 4 0) }` | `BeatNode.whammyExact` |
| Grace note | `3.1 { gr }` | `BeatNode.graceNote` |
| Brush up | `3.1 { bu }` | `BeatNode.brushUp` |
| Brush down | `3.1 { bd }` | `BeatNode.brushDown` |
| Arpeggio up | `3.1 { au }` | `BeatNode.arpeggioUp` |
| Arpeggio down | `3.1 { ad }` | `BeatNode.arpeggioDown` |
| Accent (beat) | via note-level | see `NoteNode.accent` |
| Fermata | `3.1 { fermata (short 1) }` | `BeatNode.fermata` |
| LegatoOrigin | `3.1 { legatoOrigin }` | `BeatNode.legatoOrigin` |
| Dead slap | `3.1 { ds }` | `BeatNode.deadSlap` |
| **NOTE EFFECTS** | | |
| Hammer-on / Pull-off | `3.1 { h }` | `NoteNode.hammerOrPull` |
| Left-hand tap | `3.1 { lht }` | `NoteNode.leftHandTap` |
| Bend | `17.1 { b (0 4 4 0) }` | `NoteNode.bend` (BendPoint[]) |
| Bend (exact) | `17.1 { be (0 4) }` | `NoteNode.bendExact` |
| Vibrato (note, slight) | `3.1 { v }` | `NoteNode.vibrato` = 'slight' |
| Vibrato (note, wide) | `3.1 { vw }` | `NoteNode.vibrato` = 'wide' |
| Legato slide | `3.1 { sl }` | `NoteNode.slide` = 'legato' |
| Shift slide | `3.1 { ss }` | `NoteNode.slide` = 'shift' |
| Slide into from below | `3.1 { sib }` | `NoteNode.slide` = 'intoFromBelow' |
| Slide into from above | `3.1 { sia }` | `NoteNode.slide` = 'intoFromAbove' |
| Slide out up | `3.1 { sou }` | `NoteNode.slide` = 'outUp' |
| Slide out down | `3.1 { sod }` | `NoteNode.slide` = 'outDown' |
| Pick slide up | `3.1 { psu }` | `NoteNode.slide` = 'pickSlideUp' |
| Pick slide down | `3.1 { psd }` | `NoteNode.slide` = 'pickSlideDown' |
| Natural harmonic | `3.1 { nh }` | `NoteNode.harmonic` = 'natural' |
| Artificial harmonic | `3.1 { ah 12 }` | `NoteNode.harmonic` = 'artificial' |
| Tap harmonic | `3.1 { th 12 }` | `NoteNode.harmonic` = 'tap' |
| Pinch harmonic | `3.1 { ph }` | `NoteNode.harmonic` = 'pinch' |
| Semi harmonic | `3.1 { sh }` | `NoteNode.harmonic` = 'semi' |
| Ghost note | `3.1 { g }` | `NoteNode.ghost` |
| Dead note | `x.1` or `3.1 { x }` | `NoteNode.dead` |
| Tie | `3.1 { t }` or `-` | `NoteNode.tie` |
| Palm mute | `3.1 { pm }` | `NoteNode.palmMute` |
| Let ring | `3.1 { lr }` | `NoteNode.letRing` |
| Staccato | `3.1 { st }` | `NoteNode.staccato` |
| Accent (normal) | `3.1 { ac }` | `NoteNode.accent` = 'normal' |
| Accent (heavy) | `3.1 { hac }` | `NoteNode.accent` = 'heavy' |
| Tenuto | `3.1 { ten }` | `NoteNode.accent` = 'tenuto' |
| Trill | `3.1 { tr 5 4 }` | `NoteNode.trill` |
| Left-hand finger | `3.1 { lf 1 }` | `NoteNode.leftFinger` |
| Right-hand finger | `3.1 { rf 0 }` | `NoteNode.rightFinger` |
| Slur | `3.1 { slur 1 }` | `NoteNode.slur` |
| Turn ornament | `3.1 { turn }` | `NoteNode.ornament` = 'turn' |
| Inverted turn | `3.1 { iturn }` | `NoteNode.ornament` = 'iturn' |
| Upper mordent | `3.1 { umordent }` | `NoteNode.ornament` = 'umordent' |
| Lower mordent | `3.1 { lmordent }` | `NoteNode.ornament` = 'lmordent' |
| Hide note | `3.1 { hide }` | `NoteNode.hidden` |

## Coverage Gaps / Limitations

- **Percussion notes**: Articulation names (e.g. `KickHit`) - not in this AST; percussion tracks are out of scope for Phase 3.
- **Pitched instrument notes**: Standard pitch notation (e.g. `C#4`) - out of scope; this AST targets fretted guitar/bass.
- **Sync points**: Time-based sync metadata - out of scope for Phase 3.
- **`\chord` diagram properties** (`firstFret`, `barre`, `showFingering`): Parsed as a `ChordDefNode` but not included in the core AST (stored on `TrackNode.chordDefs`).
- **`\rasgueado`**, **`\golpe`**, **`\wah`** effects: Parsed but stored as opaque `string` flags; not individually modeled.
- **Ottava (`ot`)**: Beat-level octave shift - stored as `BeatNode.ottava` number.
- **Beam direction**: `beam` property - not modeled in Phase 3 AST.
- **MIDI bank/volume/balance** per-beat: Stored as opaque beat properties.
