using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Data;
using QMAH.Web.Models.Identity;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile(
    "appsettings.Local.json",
    optional: true,
    reloadOnChange: true);

builder.Services.AddControllersWithViews(options =>
{
    // 所有非 GET MVC Action 預設驗證 Anti-forgery token。
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});
builder.Services.AddDbContext<QmahDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("QmahDatabase")
        ?? throw new InvalidOperationException(
            "Connection string 'QmahDatabase' was not found."));
});
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Stores.MaxLengthForKeys = 128;
    })
    .AddEntityFrameworkStores<QmahDbContext>()
    .AddDefaultTokenProviders();
builder.Services.AddAuthorization();
builder.Services.ConfigureApplicationCookie(options =>
{
    // Identity 會把登入狀態放在受 Data Protection 保護的 HttpOnly Cookie。
    options.Cookie.HttpOnly = true;
    options.SlidingExpiration = true;
    options.LoginPath = "/User/Account/Login";
    options.LogoutPath = "/User/Account/Logout";
    options.AccessDeniedPath = "/User/Account/AccessDenied";
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
