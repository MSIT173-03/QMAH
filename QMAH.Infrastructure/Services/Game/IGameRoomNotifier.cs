namespace QMAH.Infrastructure.Services.Game;

/// <summary>
/// 房間狀態有變動時的通知出口。只傳「哪一桌變了」，不夾帶任何遊戲資料；
/// 客戶端收到後仍走既有 API 重新讀取，因此作者、票數的匿名規則不會因推播而繞過。
/// </summary>
public interface IGameRoomNotifier
{
    void Changed(Guid roomId);
}
