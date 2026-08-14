using System.Reflection;

using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace QMAH.Web.Infrastructure.AdminNavigation;

public sealed class AdminNavigationService(IActionDescriptorCollectionProvider actions)
{
    public IReadOnlyList<AdminNavigationItem> GetAreaItems(string? area)
    {
        if (string.IsNullOrWhiteSpace(area))
        {
            return [];
        }

        return actions.ActionDescriptors.Items
            .OfType<ControllerActionDescriptor>()
            .Where(action =>
                string.Equals(action.RouteValues["area"], area, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(action.ActionName, "Index", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(action.ControllerName, "Home", StringComparison.OrdinalIgnoreCase))
            .GroupBy(action => action.ControllerName, StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var action = group.First();
                var metadata = action.ControllerTypeInfo.GetCustomAttribute<AdminNavigationAttribute>();

                return metadata is null
                    ? null
                    : new AdminNavigationItem(
                        action.ControllerName,
                        metadata.Label,
                        metadata.Order);
            })
            .Where(item => item is not null)
            .Select(item => item!)
            .OrderBy(item => item.Order)
            .ThenBy(item => item.Label, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }
}
