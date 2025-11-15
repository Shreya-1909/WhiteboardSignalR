const canvas = document.getElementById("whiteboard");
const ctx = canvas.getContext("2d");
const boardContainer = document.getElementById("board-container");

const boardIdInput = document.getElementById("boardId");
const userNameInput = document.getElementById("userName");
const joinBtn = document.getElementById("joinBtn");
const colorPicker = document.getElementById("colorPicker");

const widthPicker = document.getElementById("widthPicker");
const replayBtn = document.getElementById("replay-btn");

const chatMessagesDiv = document.getElementById("chat-messages");
const chatTextInput = document.getElementById("chatText");
const sendChatBtn = document.getElementById("sendChat");

const latencyValueSpan = document.getElementById("latencyValue");
const boardsList = document.getElementById("boardsList");

const exportBtn = document.getElementById("exportBtn");

const bePresenterBtn = document.getElementById("bePresenterBtn");
const releasePresenterBtn = document.getElementById("releasePresenterBtn");
const presenterStatus = document.getElementById("presenterStatus");


let isDrawing = false;
let strokesBuffer = [];
let lastPoint = null;
let currentBoardId = "default";
let userColor = colorPicker.value;
let userId = "user-" + Math.floor(Math.random() * 100000);

let isPresenter = false;
let hasPresenter = false;
let currentPresenterName = null;
let currentPresenterConnectionId = null;


// Keep userColor in sync with the color picker
colorPicker.addEventListener("input", () => {
    userColor = colorPicker.value;
});

const cursors = new Map(); // userId -> { element }

let latencySamples = [];
function recordLatency(ms) {
    latencySamples.push(ms);
    if (latencySamples.length > 50) {
        latencySamples.shift();
    }
    const avg = latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length;
    latencyValueSpan.textContent = avg.toFixed(1);
}

function resizeCanvas() {
    canvas.width = boardContainer.clientWidth;
    canvas.height = boardContainer.clientHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// SignalR connection
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/whiteboard")
    .withAutomaticReconnect()
    .build();

// Drawing helpers
function drawStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;
    const color = stroke.color || stroke.Color || "#000000";
    const width = stroke.lineWidth || stroke.LineWidth || 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
}

function addChatMessage(chat) {
    const div = document.createElement("div");
    const time = new Date(chat.timestamp || chat.Timestamp).toLocaleTimeString();
    div.textContent = `[${time}] ${chat.userName || chat.UserName}: ${chat.message || chat.Message}`;
    chatMessagesDiv.appendChild(div);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;

    const sentAt = chat.sentAt || chat.SentAt;
    if (sentAt) {
        const now = Date.now();
        const sent = new Date(sentAt).getTime();
        const diff = now - sent;
        if (diff >= 0 && diff < 10000) {
            recordLatency(diff);
        }
    }
}

function updateRemoteCursor(cursor) {
    const id = cursor.userId || cursor.UserId;
    if (!id) return;

    let entry = cursors.get(id);
    if (!entry) {
        const el = document.createElement("div");
        el.className = "cursor-label";
        el.style.backgroundColor = cursor.color || cursor.Color || "rgba(0,0,0,0.6)";
        el.innerText = id;
        boardContainer.appendChild(el);
        entry = { element: el };
        cursors.set(id, entry);
    }
    const x = cursor.x ?? cursor.X;
    const y = cursor.y ?? cursor.Y;
    entry.element.style.left = `${x}px`;
    entry.element.style.top = `${y}px`;
}

// SignalR handlers
connection.on("ReceiveStroke", stroke => {
    drawStroke(stroke);
});

connection.on("ReceiveChatMessage", chat => {
    addChatMessage(chat);
});

connection.on("ReceiveCursor", cursor => {
    updateRemoteCursor(cursor);
});

connection.on("ReceiveReplay", strokes => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!strokes) return;
    for (const s of strokes) {
        drawStroke(s);
    }
});

connection.on("BoardsUpdated", boards => {
    renderBoardsList(boards);
});

// Presenter mode updates from server
connection.on("PresenterChanged", info => {
    const { BoardId, UserName, ConnectionId } = info;

    if (BoardId !== currentBoardId) return; // ignore other boards

    hasPresenter = !!ConnectionId;
    currentPresenterName = UserName || null;
    currentPresenterConnectionId = ConnectionId || null;

    // we are presenter if our connectionId matches
    isPresenter = ConnectionId && ConnectionId === connection.connectionId;

    if (!hasPresenter) {
        presenterStatus.textContent = "No active presenter";
    } else if (isPresenter) {
        presenterStatus.textContent = `You are presenting`;
    } else {
        presenterStatus.textContent = `Presenter: ${currentPresenterName || "Unknown"}`;
    }
});


// Mouse events
canvas.addEventListener("mousedown", e => {

     // if there is a presenter and it's not us, do not start drawing
    if (hasPresenter && !isPresenter) {
        return;
    }

    isDrawing = true;

    userColor = colorPicker.value;
    lastPoint = { x: e.offsetX, y: e.offsetY };
    strokesBuffer = [lastPoint];
});

canvas.addEventListener("mousemove", e => {
    if (isDrawing) {
        const point = { x: e.offsetX, y: e.offsetY };
        strokesBuffer.push(point);

        ctx.strokeStyle = userColor;
        ctx.lineWidth = parseFloat(widthPicker.value);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();

        lastPoint = point;
    }

    if (connection.state === signalR.HubConnectionState.Connected) {
        const cursorDto = {
            boardId: currentBoardId,
            userId: userId,
            x: e.offsetX,
            y: e.offsetY,
            color: userColor
        };
        connection.invoke("UpdateCursor", cursorDto).catch(console.error);
    }
});

["mouseup", "mouseleave"].forEach(evt =>
    canvas.addEventListener(evt, () => {
        if (!isDrawing) return;
        isDrawing = false;

        if (strokesBuffer.length > 1) {
            const strokeDto = {
                boardId: currentBoardId,
                color: userColor,
                lineWidth: parseFloat(widthPicker.value),
                points: strokesBuffer
            };
            connection.invoke("SendStroke", strokeDto).catch(console.error);
        }
        strokesBuffer = [];
    })
);

// Boards list rendering
function renderBoardsList(boards) {
    boardsList.innerHTML = "";
    if (!boards || boards.length === 0) {
        const li = document.createElement("li");
        li.textContent = "(no active boards yet)";
        boardsList.appendChild(li);
        return;
    }
    boards.forEach(b => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.textContent = b;
        btn.onclick = () => {
            boardIdInput.value = b;
            joinBtn.click();
        };
        li.appendChild(btn);
        boardsList.appendChild(li);
    });
}

// Join board & replay
joinBtn.addEventListener("click", async () => {
    currentBoardId = boardIdInput.value || "default";
    userColor = colorPicker.value;

    try {
        await connection.invoke("JoinBoard", currentBoardId);
        console.log("Joined board", currentBoardId);
        await connection.invoke("RequestReplay", currentBoardId);
    } catch (err) {
        console.error(err);
    }
});

replayBtn.addEventListener("click", async () => {
    try {
        await connection.invoke("RequestReplay", currentBoardId);
    } catch (err) {
        console.error(err);
    }
});

// Chat
sendChatBtn.addEventListener("click", async () => {
    const text = chatTextInput.value.trim();
    if (!text) return;
    const chatDto = {
        boardId: currentBoardId,
        userName: userNameInput.value || userId,
        message: text,
        sentAt: new Date().toISOString()
    };
    chatTextInput.value = "";
    try {
        await connection.invoke("SendChatMessage", chatDto);
    } catch (err) {
        console.error(err);
    }
});

chatTextInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        sendChatBtn.click();
    }
});

exportBtn.addEventListener("click", () => {
    // export current canvas as PNG
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `whiteboard-${currentBoardId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

bePresenterBtn.addEventListener("click", async () => {
    try {
        await connection.invoke("BecomePresenter", currentBoardId, userNameInput.value || userId);
    } catch (err) {
        console.error(err);
    }
});

releasePresenterBtn.addEventListener("click", async () => {
    try {
        await connection.invoke("ReleasePresenter", currentBoardId);
    } catch (err) {
        console.error(err);
    }
});



// Fetch existing boards
async function fetchBoards() {
    try {
        const res = await fetch("/api/boards");
        if (!res.ok) return;
        const boards = await res.json();
        renderBoardsList(boards);
    } catch (e) {
        console.error("Failed to fetch boards", e);
    }
}

// Start SignalR connection
async function start() {
    try {
        await connection.start();
        console.log("SignalR connected");
        fetchBoards();
    } catch (err) {
        console.error("Connection failed, retrying...", err);
        setTimeout(start, 3000);
    }
}
start();
