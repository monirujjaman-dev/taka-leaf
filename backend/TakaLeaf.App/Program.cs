using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Data;
using TakaLeaf.App.Features.Health;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Database")));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Every feature registers its own endpoints under /api. One line per slice.
var api = app.MapGroup("/api");
api.MapGetHealth();

app.Run();

// Lets the test project start the app with WebApplicationFactory<Program>.
public partial class Program;
