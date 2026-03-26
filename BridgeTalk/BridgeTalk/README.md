# 🤝 Bridge Talk — PSL Sign Language Web App

A complete web application for **Pakistan Sign Language (PSL)** with two modules:
- **Sign Language → Text**: Real-time webcam hand detection using MediaPipe
- **Text → Sign Language**: Animated PSL sign display with word dictionary

---

## 📁 Project Structure

```
BridgeTalk/
├── index.html                          ← Login / Signup page
├── style.css                           ← Global styles
├── README.md                           ← This file
├── serve.py                            ← Local dev server (run this!)
└── src/
    ├── assets/
    │   ├── psl_dataset.json            ← PSL word/phrase dataset
    │   └── psl_gifs/                   ← PSL letter sign SVGs (A-Z, 0-9)
    └── pages/
        ├── Dashboard/
        │   └── dashboard.html
        ├── SignToText/
        │   └── sign-to-text.html       ← Webcam + MediaPipe module
        └── TextToSign/
            └── text-to-sign.html       ← Animated signs module
```

---

## 🚀 How to Run Locally

### Option 1: Python (Recommended)
```bash
cd BridgeTalk
python serve.py
```
Then open: **http://localhost:8000**

### Option 2: Python directly
```bash
cd BridgeTalk
python3 -m http.server 8000
```

### Option 3: Node.js
```bash
cd BridgeTalk
npx serve .
```

> ⚠️ **Do NOT open index.html directly** (file://) — the webcam and fetch() APIs require HTTP.

---

## 🎯 Features

### Module 1: Sign Language → Text (Webcam)
- Real-time hand landmark detection via **MediaPipe Hands**
- PSL fingerspelling recognition (A–Z)
- Configurable hold time (0.8s – 2.5s) before a sign is captured
- Adjustable confidence threshold
- Letter/word mode
- Output text with space, backspace, copy controls

### Module 2: Text → Sign Language
- Type any text → see animated PSL signs
- **Word Signs**: 35+ common PSL words shown with their signs
- **Fingerspelling**: Letter-by-letter for unrecognized words
- Playback controls: Play, Pause, Prev, Next, Restart, Speed
- PSL Alphabet reference grid (A–Z, click to insert)
- PSL Dictionary with 35+ words (click to convert)

---

## 📊 Dataset

Located in `src/assets/`:

- **`psl_dataset.json`** — 36 alphabet entries + 25 common words + 9 phrases
- **`psl_gifs/`** — SVG animated signs for each letter A–Z and 0–9

### Extending the Dataset
To add more words, edit `psl_dataset.json`:
```json
{
  "words": {
    "new_word": {
      "type": "word",
      "letters": "NEW WORD",
      "description": "Description of the sign motion"
    }
  }
}
```
To add real GIFs/images, place them in `src/assets/psl_gifs/` named as `WORD.gif`.

---

## 🛠 Tech Stack

| Technology | Purpose |
|-----------|---------|
| HTML/CSS/JS | Frontend (no framework) |
| MediaPipe Hands | Hand landmark detection |
| Google Fonts | Typography |
| Python HTTP server | Local development |

---

## 💡 Usage Tips

**Sign Language → Text:**
1. Click "Start Camera" and allow browser permission
2. Hold your hand in frame, make a PSL letter sign
3. Hold the sign steady for the configured duration (default 1.2s)
4. The letter appears in the output area
5. Use Space / Delete / Clear buttons to edit

**Text → Sign Language:**
1. Type text in the input box OR click letters from the alphabet grid
2. Click "Convert to Signs"
3. Watch the animated sign sequence play
4. Use Prev/Next to step through manually
5. Adjust speed from the dropdown

---

## ⚙️ Login
Default credentials: any email + any password (demo mode, stored in localStorage)

---

## 📝 Notes
- The webcam module requires HTTPS or localhost (browser security requirement)
- MediaPipe loads from CDN — internet connection required for Sign→Text module
- PSL gesture classifier uses geometric hand landmark analysis
- For production use, replace SVG signs with authentic PSL GIF recordings
