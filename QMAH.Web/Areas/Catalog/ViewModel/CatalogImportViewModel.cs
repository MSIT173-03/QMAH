using QMAH.Infrastructure.CatalogImport;

namespace QMAH.Web.Areas.Catalog.ViewModel;

public sealed class CatalogImportViewModel
{
    public IReadOnlyList<CatalogArtifactImportRow> Artifacts { get; init; } = [];
    public CatalogImportPreview? Preview { get; init; }
    public string? StageId { get; init; }
    public string? ApprovalToken { get; init; }
    public string? ErrorMessage { get; init; }
}
