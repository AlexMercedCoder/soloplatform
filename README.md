# SoloPlatform (Static Edition)

**SoloPlatform** is a "No-Backend" content management template for independent creators. It allows you to manage a professional Blog, Event Calendar, and Podcast feed simply by editing Markdown files in this repository.

## 🚀 Quick Start

1.  **Clone this repository**:
    ```bash
    git clone https://github.com/yourusername/soloplatform.git
    cd soloplatform
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run locally**:
    ```bash
    npm run dev
    ```
    This will:
    *   Start a local server at `http://127.0.0.1:8080`.
    *   Watch for changes in your `/content` folder and `config.json`.
    *   Automatically rebuild and reload the page in your browser.

## 🛠 Configuration

### `config.json`
This file controls the global settings of your site.

- **`features`**: Enable/Disable the three main engines (Blog, Events, Podcast).
    - `mode: "internal"`: Uses the built-in Markdown engine.
    - `mode: "external"`: Links the navigation item directly to an external URL (e.g., Luma, Medium).
- **`email_subscribe_form_url`**: Paste your Mailchimp/ConvertKit/Google Forms URL here.
- **`support_link`**: Your Patreon/Ko-fi/GitHub Sponsors link.

### `theme.json`
Controls the colors and fonts using a simplified Material Design 3 token system.

## 📝 Managing Content

## 💬 Comments System (Giscus)
SoloPlatform supports **Giscus**, a comment system powered by GitHub Discussions.

### Setup
1. Go to [giscus.app](https://giscus.app).
2. Follow the instructions to get your repository details.
3. Copy the values into your `config.json` under the `"giscus"` key:
   ```json
   "giscus": {
     "repo": "your-github-user/your-repo",
     "repo_id": "R_kgD...",
     "category": "Announcements",
     "category_id": "DIC_kw...",
     "mapping": "pathname",
     "strict": "0",
     "reactions_enabled": "1",
     "emit_metadata": "0",
     "input_position": "bottom",
     "theme": "light",
     "lang": "en",
     "loading": "lazy"
   }
   ```
4. Comments will automatically appear at the bottom of every blog post!

### Home Page
Edit `/content/home.md` to change the main landing page.

### Blog Posts
Create files in `/content/blog/YYYY-MM-DD-my-post.md`:

```yaml
---
title: My First Post
date: 2026-01-14
tags: ["tech", "life"]
cover_image: /assets/image.jpg
---
# Content goes here...
```

### Events
Create files in `/content/events/YYYY-MM-DD-my-event.md`:

```yaml
---
title: Monthly Meetup
event_date: 2026-02-01T18:00:00Z
location: "Downtown Cafe"
rsvp_link: "https://lu.ma/event-id" 
---
# Event Details...
```

### Podcast Episodes
Create files in `/content/podcast/episode-1.md`:

```yaml
---
title: "Ep 1: The Beginning"
date: 2026-01-14
audio_url: "https://archive.org/download/my-podcast/ep1.mp3"
duration: "45:00"
length_bytes: 50000000
---
# Show Notes...
```

#### 🎧 Where to host your MP3s?
Since this is a static site, you should host your audio files externally to save bandwidth and build time. Recommended free/cheap options:
*   **[Internet Archive](https://archive.org/)**: Free, unlimited hosting. Direct mp3 links available.
*   **[Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/)**: Free tier is very generous (10GB), fast global delivery.
*   **[AWS S3](https://aws.amazon.com/s3/)**: Standard industry choice, cheap but not free.
*   **GitHub Releases**: You can upload mp3s as binaries to a GitHub Release and use that link (hacky but works).

## 🚢 Deployment

**Netlify / Vercel**:
1.  Connect your GitHub repository.
2.  Set the **Build Command** to: `npm run build` (or `node build.js`).
3.  Set the **Publish Directory** to: `dist`.

## 📄 License
MIT
