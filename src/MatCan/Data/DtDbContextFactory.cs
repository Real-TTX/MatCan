using MatCan.Data.Entities;
using MatCan.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MatCan.Data;

/// <summary>Lets <c>dotnet ef migrations add</c> create the context without starting the application.</summary>
public sealed class DtDbContextFactory : IDesignTimeDbContextFactory<DtDbContext>
{
    public DtDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<DtDbContext>()
            .UseNpgsql("Host=localhost;Database=matcan_design;Username=postgres;Password=postgres")
            .Options;
        return new DtDbContext(options, new DesignTimeUser(), TimeProvider.System);
    }

    private sealed class DesignTimeUser : ICurrentUser
    {
        public long? UserId => null;

        public string? Name => null;

        public UserRole? Role => null;

        public bool IsAuthenticated => false;

        public bool IsAdmin => false;

        public string? IpAddress => null;

        public IDisposable RunAs(long? userId, string? name, UserRole role = UserRole.Admin) => new NoOp();

        private sealed class NoOp : IDisposable
        {
            public void Dispose()
            {
            }
        }
    }
}
