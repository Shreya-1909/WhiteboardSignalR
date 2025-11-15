using WhiteboardSignalR.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapHub<WhiteboardHub>("/hubs/whiteboard");
app.MapGet("/health", () => Results.Ok("OK"));
app.MapGet("/api/boards", () => WhiteboardHub.GetBoards());

app.Run();
