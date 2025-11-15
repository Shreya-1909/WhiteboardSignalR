# Real-Time Collaboration Whiteboard (Mini Microsoft Teams) - WhiteboardSignalR

A real-time collaborative whiteboard built with **C#**, **.NET 8**, and **SignalR**, inspired by Microsoft Teams.  
Supports live drawing, multi-user cursors, chat, and board replay with Azure-ready hosting.

---

## 🧰 Tech Stack

- **Backend:** ASP.NET Core Minimal API, SignalR
- **Frontend:** HTML5 Canvas, Vanilla JavaScript
- **Real-time:** WebSockets via SignalR
- **Infra (optional):** Azure App Service, Azure SignalR Service

---

## ✨ Features

- 🖌️ **Real-time drawing** on a shared canvas using SignalR over WebSockets  
- 👥 **Multi-user cursor presence** with per-user labels and colors  
- 🎤 **Presenter mode** – only the presenter can draw; others are viewers
- 💬 **Chat sidebar** with timestamps and username support  
- 🔁 **Board replay** – new users see existing strokes when they join  
- 🧩 **Multi-board support** – join or create boards by ID, browse active boards  
- 📊 **Latency metrics** – client-side measurement of message round-trip time  
- 📂 **Export to PNG** – download the current board as an image
- ☁️ **Azure App Service–ready** (WebSockets enabled)  

---

## 🏗️ Architecture

**Backend**

- ASP.NET Core 8 minimal API
- `WhiteboardHub` (SignalR hub) managing:
  - Strokes per board (in-memory)
  - User cursors
  - Chat messages
  - Board membership and discovery
- REST endpoint: `/api/boards` – returns active board IDs

**Frontend**

- Static HTML/JS served from `wwwroot`
- `<canvas>` for drawing
- SignalR JS client for:
  - Sending strokes, cursor updates, chat messages
  - Receiving strokes from others
  - Receiving replay and boards list
- Basic CSS for split layout (canvas + sidebar)

---

## 🧩 Project Structure

```text
WhiteboardSignalR/
  Hubs/
    WhiteboardHub.cs       # SignalR hub + DTOs + in-memory state
  wwwroot/
    index.html             # UI layout (canvas + chat + controls)
    js/
      whiteboard.js        # client-side SignalR + drawing logic
  Program.cs               # minimal hosting model + SignalR + API endpoints
  WhiteboardSignalR.csproj
  README.md
```

---

## 🚀 Running Locally

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/) installed

### Steps

```bash
dotnet restore
dotnet run
```

Then open:

- `https://localhost:5001` (or the URL printed in the console)

Open the site in **two or more browser windows**, click **Join Board**, and start drawing / chatting.

---

## ☁️ Deploying to Azure App Service (Optional - Upcoming)

1. **Publish locally**

```bash
dotnet publish -c Release
```

2. In the **Azure Portal**:
   - Create a new **App Service** with runtime **.NET 8 (LTS)**
   - Enable **WebSockets** in the App Service configuration
   - Use **Deployment Center** to connect your GitHub repo or upload the published artifacts

3. Browse to your App Service URL and test the whiteboard with multiple clients.

---

## 📈 Metrics

- Client-side latency metrics are tracked by attaching timestamps (`sentAt`) to chat messages.
- The UI displays a rolling average latency across the last N messages.

---

## 💬 Possible Enhancements

- Persist board strokes to a database (Cosmos DB, SQL)
- Add per-user colors and avatars tied to identity
- Add export (PNG, PDF) for whiteboard content
- Add “follow presenter” mode (camera following one user’s cursor)

---

## 🧪 Skills Demonstrated

- C# and .NET 8 minimal APIs
- SignalR real-time communication over WebSockets
- Canvas-based drawing and event handling in JavaScript
- Basic distributed state management (multi-board shared state)
- Azure-ready web app design
