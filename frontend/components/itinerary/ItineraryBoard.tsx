'use client';

import { useMemo } from 'react';
import { cn, formatDate } from '@/lib/utils';

type ItineraryBoardItem = {
  id: string;
  title: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  isCompleted: boolean;
};

type ItineraryBoardProps = {
  mode: 'guest' | 'mc';
  eventName: string;
  items: ItineraryBoardItem[];
  subtitle?: string;
  syncLabel?: string;
  submittingId?: string | null;
  recentlyChangedIds?: string[];
  onToggleItem?: (itemId: string) => void;
};

type Section = {
  key: string;
  label: string;
  items: ItineraryBoardItem[];
};

const getDayKey = (startsAt?: string | null) => {
  if (!startsAt) return 'undated';
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return 'undated';
  return formatDate(date.toISOString(), 'yyyy-MM-dd');
};

const getDayLabel = (startsAt?: string | null) => {
  if (!startsAt) return 'Schedule';
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return 'Schedule';
  return formatDate(date.toISOString(), 'dd . MM . yy');
};

const getTimeLabel = (startsAt?: string | null, endsAt?: string | null) => {
  const parts: string[] = [];
  if (startsAt) {
    const s = new Date(startsAt);
    if (!Number.isNaN(s.getTime())) parts.push(formatDate(s.toISOString(), 'p'));
  }
  if (endsAt) {
    const e = new Date(endsAt);
    if (!Number.isNaN(e.getTime())) parts.push(formatDate(e.toISOString(), 'p'));
  }
  return parts.join(' - ');
};

export default function ItineraryBoard({
  mode,
  eventName,
  items,
  subtitle,
  syncLabel,
  submittingId,
  recentlyChangedIds = [],
  onToggleItem,
}: ItineraryBoardProps) {
  const sections = useMemo<Section[]>(() => {
    if (!items.length) return [];

    const grouped = new Map<string, Section>();
    items.forEach((item) => {
      const key = getDayKey(item.startsAt);
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          label: getDayLabel(item.startsAt),
          items: [],
        });
      }
      grouped.get(key)!.items.push(item);
    });
    return Array.from(grouped.values());
  }, [items]);

  const completed = items.filter((item) => item.isCompleted).length;

  return (
    <div className="min-h-screen bg-[#f6eaee] px-3 py-4 md:px-5 md:py-8">
      <div className="mx-auto w-full max-w-md md:max-w-3xl rounded-[30px] bg-[#fbf9fc] border border-[#eadfe5] shadow-[0_18px_45px_rgba(75,40,84,0.14)] overflow-hidden">
        <div className="px-5 pt-6 pb-4 md:px-8 md:pt-8 md:pb-5">
          <h1 className="text-center text-xl md:text-2xl font-semibold text-[#403347] tracking-tight">
            {mode === 'mc' ? 'MC Itinerary Control' : 'Your Event Itinerary'}
          </h1>
          <p className="mt-1 text-center text-xs md:text-sm tracking-[0.14em] uppercase text-[#9a8e95]">
            {eventName}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] md:text-xs text-[#7d7178]">
            <span>{completed}/{items.length} done</span>
            {syncLabel ? <span>• {syncLabel}</span> : null}
            {subtitle ? <span>• {subtitle}</span> : null}
          </div>
        </div>

        <div className="relative pb-6 md:pb-8">
          <div className="absolute left-0 top-0 bottom-0 w-[74px] md:w-[94px] bg-[#f1eaee]" />
          <div className="absolute left-[37px] md:left-[47px] top-4 bottom-4 w-px bg-[#ded2d9]" />

          {sections.length === 0 ? (
            <div className="px-5 py-8 md:px-8 md:py-12 text-center text-sm text-[#847881]">
              No itinerary items yet.
            </div>
          ) : (
            <div className="relative z-10">
              {sections.map((section, sectionIndex) => (
                <div key={section.key}>
                  <div className="grid grid-cols-[74px_1fr] md:grid-cols-[94px_1fr] items-center min-h-[44px]">
                    <div className="flex justify-center">
                      {sectionIndex === 0 ? (
                        <span className="inline-flex items-center rounded-full bg-[#d8b5b9] text-white text-[10px] md:text-xs font-semibold px-3 py-1">
                          START
                        </span>
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#d6c8cf]" />
                      )}
                    </div>
                    <div
                      className={cn(
                        'pr-4 md:pr-8 py-1 text-sm md:text-base font-semibold tracking-[0.16em] text-[#75696f]',
                        mode === 'mc' && 'pl-2 md:pl-4'
                      )}
                    >
                      {section.label}
                    </div>
                  </div>

                  {section.items.map((item) => {
                    const isSubmitting = submittingId === item.id;
                    const recent = recentlyChangedIds.includes(item.id);
                    const timeLabel = getTimeLabel(item.startsAt, item.endsAt);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'grid grid-cols-[74px_1fr] md:grid-cols-[94px_1fr] min-h-[74px] transition-all duration-300',
                          recent && 'bg-emerald-50/60'
                        )}
                      >
                        <div className="flex items-start justify-center pt-3">
                          {mode === 'mc' ? (
                            <button
                              type="button"
                              onClick={() => onToggleItem?.(item.id)}
                              disabled={isSubmitting}
                              className={cn(
                                'h-7 min-w-[36px] px-2 rounded-full border text-[10px] font-semibold transition-colors',
                                item.isCompleted
                                  ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                                  : 'bg-white border-[#d0c2ca] text-[#6d6068]',
                                isSubmitting && 'opacity-70 cursor-not-allowed'
                              )}
                            >
                              {isSubmitting ? '...' : item.isCompleted ? 'Done' : 'Check'}
                            </button>
                          ) : item.isCompleted ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-semibold px-2.5 py-1">
                              Done
                            </span>
                          ) : (
                            <span className="mt-2 h-2.5 w-2.5 rounded-full bg-[#2e2633]" />
                          )}
                        </div>

                        <div className={cn('pr-4 md:pr-8 pb-3 pt-2', mode === 'mc' && 'pl-2 md:pl-4')}>
                          <h3
                            className={cn(
                              'text-[15px] md:text-base font-semibold text-[#3f3446] leading-tight',
                              item.isCompleted && 'text-[#8e838b] line-through'
                            )}
                          >
                            {item.title}
                          </h3>
                          {timeLabel ? (
                            <p className="mt-1 text-[12px] md:text-[13px] text-[#9a8f96] font-medium">
                              {timeLabel}
                            </p>
                          ) : null}
                          {item.location ? (
                            <p className="mt-1 text-[12px] md:text-[13px] text-[#8e8289]">
                              {item.location}
                            </p>
                          ) : null}
                          {item.description ? (
                            <p className="mt-1.5 text-[12.5px] md:text-[13.5px] text-[#6f636b] leading-snug">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
