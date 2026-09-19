import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, Observable, of } from 'rxjs';

import { AuthService } from '../auth/auth.service';

type GuardResult = boolean | UrlTree;

function requireAdmin(): Observable<GuardResult> {
  const auth = inject(AuthService);
  const router = inject(Router);

  // ui-integration: 測試中心雖然不寫入正式資料，仍以目前登入帳號的 Admin role 做正式入口保護，避免只靠導覽隱藏按鈕。
  return auth.getCurrentUser().pipe(
    map((user) => user.roles?.includes('Admin') ? true : router.createUrlTree(['/game'])),
    catchError(() => {
      auth.clearSession();
      return of(router.createUrlTree(['/login']));
    })
  );
}

/** 管理員限定的正式遊戲檢查中心。 */
export const adminGameTestGuard: CanActivateFn = () => requireAdmin();

/**
 * 一般房間仍可由玩家正常進入；只有帶有隔離測試旗標的房間才需要 Admin。
 * 這個邊界避免任何人手動輸入 ?test=1 就繞過測試中心入口。
 */
export const adminTestRoomGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  if (route.queryParamMap.get('test') !== '1') return true;
  return requireAdmin();
};
