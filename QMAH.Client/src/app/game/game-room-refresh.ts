import { Observable, Subscription } from 'rxjs';

/** 一次讀取、一個待刷新旗標；通知再密集也不會取消舊請求或累積無限佇列。 */
export function watchRoomRefresh<T>(triggers: Observable<unknown>, load: () => Observable<T>): Observable<T> {
  return new Observable(subscriber => {
    const subscriptions = new Subscription();
    let active = false;
    let pending = false;
    let triggersCompleted = false;
    const refresh = (): void => {
      if (subscriber.closed) return;
      if (active) { pending = true; return; }
      active = true;
      try {
        subscriptions.add(load().subscribe({
          next: value => subscriber.next(value),
          error: error => subscriber.error(error),
          complete: () => {
            active = false;
            if (pending) { pending = false; refresh(); }
            else if (triggersCompleted) subscriber.complete();
          },
        }));
      } catch (error) {
        subscriber.error(error);
      }
    };
    subscriptions.add(triggers.subscribe({
      next: refresh,
      error: error => subscriber.error(error),
      complete: () => { triggersCompleted = true; if (!active) subscriber.complete(); },
    }));
    return subscriptions;
  });
}
