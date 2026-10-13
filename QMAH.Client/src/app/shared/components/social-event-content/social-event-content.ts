import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatDate } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideCalendarDays, LucideMapPin, LucideUsers, LucideArrowUpRight } from '@lucide/angular';
import { parseSocialEventSummary } from '../../social-event-summary';
import { stripSocialMarkup } from '../../social-markup';
import { SocialPostContentComponent } from '../social-post-content/social-post-content';
import { SocialPostListItem } from '../../../core/services/social-api';
import { eventMode, eventPlace } from '../../../features/social/social-labels';

@Component({
  selector: 'app-social-event-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SocialPostContentComponent, LucideCalendarDays, LucideMapPin, LucideUsers, LucideArrowUpRight],
  styleUrl: './social-event-content.scss',
  template: `
    @if (summary(); as event) {
      @if (preview() && eventSummary(); as facts) {
        <!-- 貼文牆預覽：日曆磚＋時間／地點／名額，只留活動本身的說明，不重複內建的開場白與結尾。 -->
        <section class="ev" aria-label="活動資訊">
          <div class="ev__date" aria-hidden="true"><small>{{ month() }}</small><strong>{{ day() }}</strong><em>{{ weekday() }}</em></div>
          <div class="ev__facts">
            <p class="ev__time">{{ timeRange() }}</p>
            @if (place()) { <p class="ev__line"><svg lucideMapPin aria-hidden="true"></svg><span>{{ place() }}</span></p> }
            <p class="ev__line"><svg lucideUsers aria-hidden="true"></svg><span>{{ event.capacity }}</span>
              @if (mode(); as m) { <span class="social-mode" [attr.data-mode]="m.key">{{ m.label }}</span> }
            </p>
          </div>
          @if (eventId()) { <a class="ev__go" [routerLink]="['/social/events', eventId()]">查看活動<svg lucideArrowUpRight aria-hidden="true"></svg></a> }
        </section>
        @if (plainDescription()) { <p class="excerpt">{{ plainDescription() }}</p> }
      } @else {
        @if (event.description) {
          @if (preview()) { <p class="excerpt">{{ plainDescription() }}</p> }
          @else { <app-social-post-content [content]="event.description" /> }
        }
        <section class="event-info" aria-label="活動資訊">
          <header><span>活動資訊</span>
            @if (eventId()) { <a [routerLink]="['/social/events', eventId()]">查看活動<svg lucideArrowUpRight aria-hidden="true"></svg></a> }
          </header>
          <dl>
            <div><dt><svg lucideCalendarDays aria-hidden="true"></svg>時間</dt><dd><span>{{ event.start }}</span><span class="end">至 {{ event.end }}</span></dd></div>
            <div><dt><svg lucideMapPin aria-hidden="true"></svg>地點</dt><dd>{{ event.location }}</dd></div>
            <div><dt><svg lucideUsers aria-hidden="true"></svg>名額</dt><dd>{{ event.capacity }}</dd></div>
          </dl>
        </section>
      }
    } @else {
      @if (preview()) { <p class="excerpt">{{ plainContent() }}</p> }
      @else { <app-social-post-content [content]="content()" /> }
    }
  `,
})
export class SocialEventContentComponent {
  readonly content = input.required<string>();
  readonly preview = input(false);
  readonly eventId = input<string | null>(null);
  readonly eventSummary = input<SocialPostListItem['eventSummary']>(null);
  protected readonly summary = computed(() => {
    const parsed = parseSocialEventSummary(this.content());
    const event = this.eventSummary();
    if (!event) return parsed;
    return {
      description: parsed?.description ?? this.content().replace(/\s+活動資訊\s+時間[：:][\s\S]*$/, '').trimEnd(),
      start: formatDate(event.startAt, 'yyyy/MM/dd HH:mm', 'en-US'),
      end: formatDate(event.endAt, 'yyyy/MM/dd HH:mm', 'en-US'),
      location: event.location || '地點待補充',
      capacity: event.capacity === null ? '不限人數' : `${event.capacity} 人`,
    };
  });
  /** 預覽只留活動本身的說明：去掉系統內建的「…是官方辦的活動」開場與「想參加的話」結尾。 */
  protected readonly plainDescription = computed(() => {
    const text = this.summary()?.description ?? '';
    const kept = text.split(/\n\s*\n/).filter(part => !/^\s*「.*」是(官方|會員)辦的活動/.test(part) && !/^\s*想參加的話/.test(part));
    return stripSocialMarkup(kept.join('\n\n'));
  });
  private readonly startDate = computed(() => { const e = this.eventSummary(); return e ? new Date(e.startAt) : null; });
  protected readonly month = computed(() => { const d = this.startDate(); return d ? `${d.getMonth() + 1}月` : ''; });
  protected readonly day = computed(() => this.startDate()?.getDate() ?? '');
  protected readonly weekday = computed(() => this.startDate()?.toLocaleDateString('zh-TW', { weekday: 'short' }) ?? '');
  protected readonly timeRange = computed(() => {
    const e = this.eventSummary();
    if (!e) return '';
    const start = new Date(e.startAt);
    const end = new Date(e.endAt);
    const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const sameDay = start.toDateString() === end.toDateString();
    return `${start.getMonth() + 1}/${start.getDate()} ${hm(start)} – ${sameDay ? '' : `${end.getMonth() + 1}/${end.getDate()} `}${hm(end)}`;
  });
  protected readonly place = computed(() => eventPlace(this.eventSummary()?.location));
  protected readonly mode = computed(() => eventMode(this.eventSummary()?.location));
  protected readonly plainContent = computed(() => stripSocialMarkup(this.content()));
}
