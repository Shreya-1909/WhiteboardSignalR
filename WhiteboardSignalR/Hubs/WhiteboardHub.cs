using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Linq;


namespace WhiteboardSignalR.Hubs
{
    public class StrokeDto
    {
        public string BoardId { get; set; } = "default";
        public string Color { get; set; } = "#000000";
        public float LineWidth { get; set; } = 2f;
        public List<PointDto> Points { get; set; } = new();
    }

    public class PointDto
    {
        public float X { get; set; }
        public float Y { get; set; }
    }

    public class CursorDto
    {
        public string BoardId { get; set; } = "default";
        public string UserId { get; set; } = "";
        public float X { get; set; }
        public float Y { get; set; }
        public string Color { get; set; } = "#ff0000";
    }

    public class ChatMessageDto
    {
        public string BoardId { get; set; } = "default";
        public string UserName { get; set; } = "Anonymous";
        public string Message { get; set; } = "";
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class WhiteboardHub : Hub
    {
        // boardId -> presenter connectionId
private static readonly ConcurrentDictionary<string, string> _presenters =
    new ConcurrentDictionary<string, string>();

        
        // In-memory storage: boardId -> list of strokes
        private static readonly ConcurrentDictionary<string, List<StrokeDto>> _boards =
            new ConcurrentDictionary<string, List<StrokeDto>>();

        // boardId -> set of connectionIds
        private static readonly ConcurrentDictionary<string, HashSet<string>> _boardMembers =
            new ConcurrentDictionary<string, HashSet<string>>();

        public async Task JoinBoard(string boardId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, boardId);

            var members = _boardMembers.GetOrAdd(boardId, _ => new HashSet<string>());
            lock (members)
            {
                members.Add(Context.ConnectionId);
            }

            await Clients.All.SendAsync("BoardsUpdated", _boardMembers.Keys.ToList());
        }

        public async Task SendStroke(StrokeDto stroke)
        {
            // Only presenter can send strokes if a presenter is set
    if (_presenters.TryGetValue(stroke.BoardId, out var presenterId) &&
        presenterId != Context.ConnectionId)
    {
        return; // ignore non-presenter strokes
    }
            var list = _boards.GetOrAdd(stroke.BoardId, _ => new List<StrokeDto>());
    lock (list)
    {
        list.Add(stroke);
    }

    // ✅ Use GroupExcept instead of .Except(...)
    await Clients.GroupExcept(stroke.BoardId, new[] { Context.ConnectionId })
                 .SendAsync("ReceiveStroke", stroke);
        }

        public async Task UpdateCursor(CursorDto cursor)
        {
            if (_presenters.TryGetValue(cursor.BoardId, out var presenterId) &&
        presenterId != Context.ConnectionId)
    {
        return; // ignore non-presenter cursors if presenter exists
    }
            await Clients.GroupExcept(cursor.BoardId, new[] { Context.ConnectionId })
                 .SendAsync("ReceiveCursor", cursor);
        }

        public async Task SendChatMessage(ChatMessageDto chat)
        {
            if (chat.SentAt == default)
                chat.SentAt = DateTime.UtcNow;

            chat.Timestamp = DateTime.UtcNow;
            await Clients.Group(chat.BoardId)
                         .SendAsync("ReceiveChatMessage", chat);
        }

        public async Task RequestReplay(string boardId)
        {
            if (_boards.TryGetValue(boardId, out var strokes))
            {
                await Clients.Caller.SendAsync("ReceiveReplay", strokes);
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            foreach (var kvp in _boardMembers)
            {
                var boardId = kvp.Key;
                var members = kvp.Value;
                lock (members)
                {
                    if (members.Remove(Context.ConnectionId) && members.Count == 0)
                    {
                        _boardMembers.TryRemove(boardId, out _);
                        _boards.TryRemove(boardId, out _);
                    }
                }
            }

            // If this connection was presenter for any board, clear it
foreach (var kvp in _presenters.ToList())
{
    if (kvp.Value == Context.ConnectionId)
    {
        _presenters.TryRemove(kvp.Key, out _);
        await Clients.Group(kvp.Key).SendAsync("PresenterChanged", new
        {
            BoardId = kvp.Key,
            UserName = (string?)null,
            ConnectionId = (string?)null
        });
    }
}

            await Clients.All.SendAsync("BoardsUpdated", _boardMembers.Keys.ToList());
            await base.OnDisconnectedAsync(exception);
        }

        public static List<string> GetBoards()
        {
            return _boardMembers.Keys.ToList();
        }

        public async Task BecomePresenter(string boardId, string userName)
{
    _presenters[boardId] = Context.ConnectionId;

    await Clients.Group(boardId).SendAsync("PresenterChanged", new
    {
        BoardId = boardId,
        UserName = userName,
        ConnectionId = Context.ConnectionId
    });
}

public async Task ReleasePresenter(string boardId)
{
    if (_presenters.TryGetValue(boardId, out var presenterId) &&
        presenterId == Context.ConnectionId)
    {
        _presenters.TryRemove(boardId, out _);
        await Clients.Group(boardId).SendAsync("PresenterChanged", new
        {
            BoardId = boardId,
            UserName = (string?)null,
            ConnectionId = (string?)null
        });
    }
}

    }
}
