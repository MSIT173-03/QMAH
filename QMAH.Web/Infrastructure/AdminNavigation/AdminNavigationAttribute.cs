namespace QMAH.Web.Infrastructure.AdminNavigation;

[AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
public sealed class AdminNavigationAttribute(string label, int order = 1000) : Attribute
{
    public string Label { get; } = label;

    public int Order { get; } = order;
}
