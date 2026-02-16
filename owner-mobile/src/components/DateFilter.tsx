import { useMemo, useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { chevronBackOutline, chevronForwardOutline, calendarOutline } from 'ionicons/icons';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

type Preset = 'all' | '7d' | '30d' | '90d' | 'custom';

const presetLabel: Record<Preset, string> = {
  all: 'All time',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  custom: 'Custom'
};

const presetDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

interface DateFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isInRange = (day: Date, from: Date | null, to: Date | null) => {
  if (!from || !to) return false;
  return day >= from && day <= to;
};

const DateFilter = ({ value, onChange }: DateFilterProps) => {
  const [activePreset, setActivePreset] = useState<Preset>('all');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [pickState, setPickState] = useState<'from' | 'to'>('from');

  const selectPreset = (preset: Preset) => {
    setActivePreset(preset);
    if (preset === 'all') {
      onChange({ from: null, to: null });
      setShowCalendar(false);
    } else if (preset === 'custom') {
      setShowCalendar(true);
    } else {
      const days = presetDays[preset];
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = new Date();
      from.setDate(from.getDate() - days);
      from.setHours(0, 0, 0, 0);
      onChange({ from, to });
      setShowCalendar(false);
    }
  };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const totalDays = daysInMonth(calYear, calMonth);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(new Date(calYear, calMonth, d));
    return days;
  }, [calYear, calMonth]);

  const monthLabel = new Date(calYear, calMonth).toLocaleString('default', {
    month: 'long',
    year: 'numeric'
  });

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  const onDayClick = (day: Date) => {
    if (pickState === 'from') {
      onChange({ from: day, to: null });
      setPickState('to');
    } else {
      const from = value.from!;
      if (day < from) {
        onChange({ from: day, to: from });
      } else {
        onChange({ from, to: day });
      }
      setPickState('from');
    }
  };

  return (
    <div className="date-filter-bar">
      <div className="date-chip-row">
        {(Object.keys(presetLabel) as Preset[]).map((p) => (
          <button
            key={p}
            className={'date-chip' + (activePreset === p ? ' active' : '')}
            onClick={() => selectPreset(p)}
          >
            {p === 'custom' && <IonIcon icon={calendarOutline} style={{ fontSize: 14, marginRight: 4 }} />}
            {presetLabel[p]}
          </button>
        ))}
      </div>

      {showCalendar && (
        <div className="date-calendar">
          <div className="cal-header">
            <IonButton fill="clear" size="small" onClick={prevMonth}>
              <IonIcon icon={chevronBackOutline} slot="icon-only" />
            </IonButton>
            <span className="cal-month-label">{monthLabel}</span>
            <IonButton fill="clear" size="small" onClick={nextMonth}>
              <IonIcon icon={chevronForwardOutline} slot="icon-only" />
            </IonButton>
          </div>
          <div className="cal-weekdays">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="cal-grid">
            {calendarDays.map((day, i) =>
              day ? (
                <button
                  key={i}
                  className={
                    'cal-day' +
                    (value.from && isSameDay(day, value.from) ? ' selected-start' : '') +
                    (value.to && isSameDay(day, value.to) ? ' selected-end' : '') +
                    (isInRange(day, value.from, value.to) ? ' in-range' : '')
                  }
                  onClick={() => onDayClick(day)}
                >
                  {day.getDate()}
                </button>
              ) : (
                <span key={i} className="cal-day empty" />
              )
            )}
          </div>
          <p className="cal-hint">
            {pickState === 'from' ? 'Select start date' : 'Select end date'}
            {value.from && value.to && (
              <> &middot; {value.from.toLocaleDateString()} – {value.to.toLocaleDateString()}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default DateFilter;
