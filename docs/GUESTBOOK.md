# Guestbook Feature

A guestbook dialog that allows visitors to leave messages. Submissions are stored in localStorage so users can see/edit/delete their entry on revisit.

## Requirements

### Backend API

Base URL: `https://api.fahru.me` (or `http://localhost:3000` for local dev)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guestbook` | Get all approved entries |
| POST | `/api/guestbook` | Create new entry |
| PUT | `/api/guestbook/:id` | Update entry (message, website only) |
| DELETE | `/api/guestbook/:id` | Delete entry |

### Response Format

```json
{
  "id": "uuid",
  "name": "string",
  "message": "string",
  "website": "string | null",
  "source": "string | null",
  "status": "approved | pending_review",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

## Frontend Setup

### 1. Add navbar div to HTML

Add this inside `<body>` before your main content:

```html
<div id="navbar"></div>
```

### 2. Include script.js

The guestbook code is in `script.js`. It automatically:
- Injects the navbar with "Home" and "Guestbook" links
- Injects the guestbook dialog into the DOM
- Only shows on allowed domains (localhost, *.fahru.me, *.fakhrusy.com)

### 3. Include styles

Add the guestbook CSS from `style.css` (search for `/* --- Guestbook Dialog --- */`).

## Features

- **Dialog UI**: Form on left, scrollable messages on right
- **Submit**: Creates entry with `source: 'blog'` (or your subdomain identifier)
- **localStorage**: Saves submission so users see their entry on revisit
- **Status display**: Shows "approved" ✓ or "pending review" ⏳
- **Edit**: Update message/website (name is locked)
- **Delete**: Remove entry with confirmation
- **Source links**: Displays "via {source}" linking to `https://{source}.{mainDomain}`

## Domain Restriction

Guestbook only appears on:
- `localhost` / `127.0.0.1`
- `fahru.me` and `*.fahru.me`
- `fakhrusy.com` and `*.fakhrusy.com`

To modify, edit `shouldShowGuestbook()` in `script.js`.

## Customization

### Change source identifier

In `submitGuestbook()`, modify:
```javascript
source: 'blog'  // Change to your subdomain name
```

### Add more allowed domains

In `shouldShowGuestbook()`:
```javascript
if (host.endsWith('.yourdomain.com') || host === 'yourdomain.com') return true;
```

## Key Functions

| Function | Purpose |
|----------|---------|
| `openGuestbook()` | Opens dialog, loads entries |
| `closeGuestbook()` | Closes dialog |
| `submitGuestbook(e)` | Handles new submission |
| `editSubmission()` | Shows edit form |
| `submitEdit(e)` | Handles edit save |
| `deleteSubmission()` | Deletes entry |
| `loadGuestbookEntries()` | Fetches and renders messages |
| `getStoredSubmission()` | Gets saved submission from localStorage |
| `saveSubmission(entry)` | Saves submission to localStorage |

## Files Modified

- `script.js` - All guestbook JavaScript
- `style.css` - Guestbook styles (navbar, dialog, form, entries, actions)
- `index.html` - Added `<div id="navbar"></div>`
- `build.js` - Template already includes navbar div for post pages
