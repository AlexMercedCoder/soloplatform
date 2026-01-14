const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Config
const CONTENT_DIR = './content';
const TYPES = ['blog', 'events', 'podcast'];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

function getToday() {
    return new Date().toISOString().split('T')[0];
}

async function createContent(type, title) {
    const slug = slugify(title);
    const date = getToday();
    let dir = path.join(CONTENT_DIR, type);
    
    // Blog Hierarchy: Year/Slug
    if (type === 'blog') {
        const year = new Date().getFullYear().toString();
        dir = path.join(dir, year);
    }
    
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    const filename = type === 'blog' ? `${slug}.md` : `${date}-${slug}.md`;
    // For blog we want clean URLs like /blog/2026/my-post, so filename is just slug.md inside year folder.
    // Actually, stick to simple flat or year/slug. Let's stick to year/slug.
    
    // Adjust filename strategy based on type if needed
    let fullPath = path.join(dir, filename);
    if (type === 'events' || type === 'podcast') {
         fullPath = path.join(dir, `${slug}.md`);
    }

    if (fs.existsSync(fullPath)) {
        console.error(`❌ File already exists: ${fullPath}`);
        process.exit(1);
    }

    let template = '';
    if (type === 'blog') {
        template = `---
title: ${title}
date: ${date}
tags: []
cover_image: 
published: false
---

# ${title}

Write your post here...
`;
    } else if (type === 'events') {
        template = `---
title: ${title}
event_date: ${date}
location: Virtual
rsvp_link: 
published: false
---

Write event details...
`;
    } else if (type === 'podcast') {
        template = `---
title: ${title}
date: ${date}
audio_url: 
duration: "00:00"
length_bytes: 0
published: false
---

Show notes...
`;
    }

    fs.writeFileSync(fullPath, template);
    console.log(`✅ Created ${type}: ${fullPath}`);
    process.exit(0);
}

// Main Logic
const args = process.argv.slice(2);
const command = args[0]; // "new"
const titleArg = args[1]; // "My Title"

if (command === 'new') {
    if (titleArg) {
        // Default to blog if Title provided but no type prompted yet?
        // Let's prompt for type.
        rl.question(`Select type (blog/events/podcast) [blog]: `, (answer) => {
            const type = answer.trim().toLowerCase() || 'blog';
            if (!TYPES.includes(type)) {
                console.error(`Invalid type. Must be one of: ${TYPES.join(', ')}`);
                process.exit(1);
            }
            createContent(type, titleArg);
        });
    } else {
        console.log("Usage: node cli.js new \"My Post Title\"");
        process.exit(0);
    }
} else if (['new-post', 'new-event', 'new-ep'].includes(command)) {
    const typeMap = { 'new-post': 'blog', 'new-event': 'events', 'new-ep': 'podcast' };
    const type = typeMap[command];
    const title = args.slice(1).join(' '); // Allow no quotes if simple
    
    if (!title) {
         rl.question(`Enter title for ${type}: `, (t) => {
             createContent(type, t);
         });
    } else {
        createContent(type, title);
    }
} else {
    console.log(`
SoloPlatform CLI

Commands:
  node cli.js new "Title"        (Interactive type selection)
  node cli.js new-post "Title"   (Create Blog Post)
  node cli.js new-event "Title"  (Create Event)
  node cli.js new-ep "Title"     (Create Podcast Episode)
    `);
    process.exit(0);
}
