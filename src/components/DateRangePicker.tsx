import { useEffect, useRef, useState } from 'react';
import { addMonths, daysBetween, formatDate, getMonthDays, startOfMonth } from '../utilities/date';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  minDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatFieldDate = (date: string) => formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' });

// Two-month range calendar: click a start day, then an end day, like Airbnb's check-in / check-out picker.
export const DateRangePicker = ({ startDate, endDate, minDate, onChange }: DateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(startDate);
  const [draftEnd, setDraftEnd] = useState<string | null>(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [firstMonth, setFirstMonth] = useState(startOfMonth(startDate));
  const pickerRef = useRef<HTMLDivElement>(null);

  const open = () => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setFirstMonth(startOfMonth(startDate));
    setIsOpen(true);
  };

  const close = () => {
    // A lone start day becomes a one-day event rather than being thrown away.
    if (draftStart) onChange(draftStart, draftEnd ?? draftStart);
    setHoverDate(null);
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  });

  const pickDay = (date: string) => {
    if (!draftStart || draftEnd || date < draftStart) {
      setDraftStart(date);
      setDraftEnd(null);
      return;
    }
    setDraftEnd(date);
    onChange(draftStart, date);
  };

  const previewEnd = draftEnd ?? (draftStart && hoverDate && hoverDate > draftStart ? hoverDate : null);
  const selectedDays = draftStart ? daysBetween(draftStart, draftEnd ?? draftStart) + 1 : 0;
  const isChoosingEnd = isOpen && draftStart !== null && draftEnd === null;
  const shownStart = isOpen ? draftStart : startDate;
  const shownEnd = isOpen ? draftEnd : endDate;

  const renderMonth = (month: string) => (
    <div className="calendar-month" key={month}>
      <h3>{formatDate(month, { month: 'long', year: 'numeric' })}</h3>
      <div className="calendar-grid" role="grid" aria-label={formatDate(month, { month: 'long', year: 'numeric' })}>
        {WEEKDAYS.map((weekday) => (
          <span className="calendar-weekday" role="columnheader" key={weekday}>{weekday}</span>
        ))}
        {getMonthDays(month).map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />;
          const isEdge = date === draftStart || date === previewEnd;
          const isInRange = Boolean(draftStart && previewEnd && date > draftStart && date < previewEnd);
          const hasRange = Boolean(draftStart && previewEnd && draftStart !== previewEnd);
          const classNames = [
            'calendar-day',
            isEdge && 'is-selected',
            isInRange && 'is-in-range',
            hasRange && date === draftStart && 'is-range-start',
            hasRange && date === previewEnd && 'is-range-end',
          ].filter(Boolean).join(' ');
          return (
            <button
              type="button"
              className={classNames}
              key={date}
              disabled={date < minDate}
              aria-pressed={isEdge || isInRange}
              aria-label={formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              onClick={() => pickDay(date)}
              onPointerEnter={() => setHoverDate(date)}
            >
              <span>{formatDate(date, { day: 'numeric' })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="date-range-picker" ref={pickerRef}>
      <button
        type="button"
        className={`date-range-trigger${isOpen ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : open())}
      >
        <span className={`date-range-half${isOpen && !isChoosingEnd ? ' is-active' : ''}`}>
          <span className="field-label">START DATE</span>
          <strong>{shownStart ? formatFieldDate(shownStart) : 'Add date'}</strong>
        </span>
        <span className={`date-range-half${isChoosingEnd ? ' is-active' : ''}`}>
          <span className="field-label">END DATE</span>
          <strong>{shownEnd ? formatFieldDate(shownEnd) : 'Add date'}</strong>
        </span>
      </button>

      {isOpen && (
        <div className="calendar-popover" role="dialog" aria-label="Choose event dates">
          <div className="calendar-header">
            <div>
              <strong>{selectedDays > 0 ? `${selectedDays} ${selectedDays === 1 ? 'day' : 'days'}` : 'Select dates'}</strong>
              <span>{isChoosingEnd ? 'Now choose the last day' : 'Choose the first day'}</span>
            </div>
            <div className="calendar-nav">
              <button
                type="button"
                aria-label="Previous month"
                disabled={firstMonth <= startOfMonth(minDate)}
                onClick={() => setFirstMonth(addMonths(firstMonth, -1))}
              >
                ‹
              </button>
              <button type="button" aria-label="Next month" onClick={() => setFirstMonth(addMonths(firstMonth, 1))}>
                ›
              </button>
            </div>
          </div>
          <div className="calendar-months" onPointerLeave={() => setHoverDate(null)}>
            {renderMonth(firstMonth)}
            {renderMonth(addMonths(firstMonth, 1))}
          </div>
          <div className="calendar-footer">
            <button
              type="button"
              className="calendar-clear"
              onClick={() => {
                setDraftStart(null);
                setDraftEnd(null);
              }}
            >
              Clear dates
            </button>
            <button type="button" className="calendar-done" onClick={close}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
};
