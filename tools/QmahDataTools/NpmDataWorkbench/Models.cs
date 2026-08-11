using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace NpmDataWorkbench;

public sealed class ShopCategoryOption : INotifyPropertyChanged
{
    private bool _isSelected;

    public ShopCategoryOption(
        string code,
        string name,
        bool isSelected,
        int observedProductLinks = 0,
        string? mappedCategoryCode = null)
    {
        Code = code;
        Name = name;
        ObservedProductLinks = observedProductLinks;
        MappedCategoryCode = mappedCategoryCode ?? "";
        _isSelected = isSelected;
    }

    public string Code { get; }
    public string Name { get; }
    public int ObservedProductLinks { get; }
    public string MappedCategoryCode { get; }
    public string Display => ObservedProductLinks > 0
        ? $"{Name}（{Code}）｜約 {ObservedProductLinks:N0} 個商品連結"
        : $"{Name}（{Code}）";

    public bool IsSelected
    {
        get => _isSelected;
        set
        {
            if (_isSelected == value) return;
            _isSelected = value;
            OnPropertyChanged();
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
