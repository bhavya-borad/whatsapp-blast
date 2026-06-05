# 💬 WhatsApp Blast — Bulk Messaging Platform

A full-stack web app to send personalized WhatsApp messages from an Excel sheet.

## Project Structure

```
whatsapp-blast/
├── backend/          ← Node.js + Express + Socket.io + whatsapp-web.js
│   ├── server.js
│   └── package.json
└── frontend/         ← React app
    ├── src/
    │   ├── App.jsx
    │   └── index.js
    ├── public/
    │   └── index.html
    └── package.json
```

---

## Setup & Run

### 1. Backend

```bash
cd backend
npm install
node server.js
```

Server starts at **http://localhost:3001**

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
npm start
```

App opens at **http://localhost:3000**

---

## How to Use

1. **Upload** — drag & drop your Excel file (columns: Name, Phone, Outstanding Amount)
2. **Message** — customize your message template with {Name} and {Outstanding Amount}
3. **Connect** — scan the QR code with WhatsApp on your phone
4. **Send** — hit Send and watch the live progress

---

## Excel Format

| Name | Phone | Outstanding Amount |
|------|-------|-------------------|
| Ravi Kumar | 919876543210 | 5000 |
| Priya Shah | 918765432109 | 12000 |

- Phone: country code + 10 digits (India = 91 + 10 digits)
- No spaces, no + sign, no dashes
- If Excel shows scientific notation (9.19E+11), format column as Text and retype

---

## Tips

- Keep the browser tab open while sending
- Don't send to more than 100 people per session
- Add a delay if WhatsApp flags your number (increase delay in server.js)
- Use a business/secondary number for bulk sending
