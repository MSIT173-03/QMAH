namespace QMAH.Web.Areas.Store.ViewModels;

public class OrderDetailAppendData
{
    public struct Data
    {
        public Guid Id;
        public int Amount;
    }

    public Guid Id { get; set; }
    public List<Data> List { get; set; } = [];
}
