import { useEffect, useRef, useState } from 'react';
import { addMonths, daysBetween, formatDate, getMonthDays, startOfMonth } from '../utilities/date';
import { getEventDates, toDateSelection } from '../utilities/eventDates';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  excludedDates: string[];
  selectionMode: 'range' | 'multiple';
  minDate: string;
  onModeChange: (mode: 'range' | 'multiple') => void;
  onChange: (startDate: string, endDate: string, excludedDates: string[]) => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatFieldDate = (date: string) => formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' });

// Two-month calendar: choose a range or toggle individual dates.
export const DateRangePicker = ({ startDate, endDate, excludedDates, selectionMode, minDate, onModeChange, onChange }: DateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(startDate || null);
  const [draftEnd, setDraftEnd] = useState<string | null>(endDate || null);
  const [draftExcluded, setDraftExcluded] = useState<string[]>(excludedDates);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [firstMonth, setFirstMonth] = useState(startOfMonth(startDate || minDate));
  const pickerRef = useRef<HTMLDivElement>(null);

  const open = () => {
    setDraftStart(startDate || null);
    setDraftEnd(endDate || null);
    setDraftExcluded(excludedDates);
    setFirstMonth(startOfMonth(startDate || minDate));
    setIsOpen(true);
  };

  const close = () => {
    // A lone start day becomes a one-day event rather than being thrown away.
    onChange(draftStart ?? '', draftStart ? draftEnd ?? draftStart : '', draftStart ? draftExcluded : []);
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
    if (selectionMode === 'multiple') {
      const selected = getEventDates({ startDate: draftStart ?? '', endDate: draftEnd ?? draftStart ?? '', excludedDates: draftExcluded });
      const next = toDateSelection(selected.includes(date) ? selected.filter((day) => day !== date) : [...selected, date]);
      setDraftStart(next.startDate || null);
      setDraftEnd(next.endDate || null);
      setDraftExcluded(next.excludedDates);
      onChange(next.startDate, next.endDate, next.excludedDates);
      return;
    }
    if (draftStart && draftEnd && date > draftStart && date < draftEnd) {
      const next = draftExcluded.includes(date)
        ? draftExcluded.filter((excluded) => excluded !== date)
        : [...draftExcluded, date].sort();
      setDraftExcluded(next);
      onChange(draftStart, draftEnd, next);
      return;
    }
    if (!draftStart || draftEnd || date < draftStart) {
      setDraftStart(date);
      setDraftEnd(null);
      setDraftExcluded([]);
      return;
    }
    setDraftEnd(date);
    onChange(draftStart, date, []);
  };

  const changeMode = (mode: 'range' | 'multiple') => {
    if (mode === selectionMode) return;
    if (draftStart && !draftEnd) {
      setDraftEnd(draftStart);
      onChange(draftStart, draftStart, []);
    }
    setHoverDate(null);
    onModeChange(mode);
  };

  const previewEnd = selectionMode === 'range' ? draftEnd ?? (draftStart && hoverDate && hoverDate > draftStart ? hoverDate : null) : draftEnd;
  const selectedDays = draftStart ? daysBetween(draftStart, draftEnd ?? draftStart) + 1 - draftExcluded.length : 0;
  const isChoosingEnd = selectionMode === 'range' && isOpen && draftStart !== null && draftEnd === null;
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
          const isEdge = selectionMode === 'range' && (date === draftStart || date === previewEnd);
          const isInRange = selectionMode === 'range' && Boolean(draftStart && previewEnd && date > draftStart && date < previewEnd);
          const isExcluded = isInRange && draftExcluded.includes(date);
          const isIndividuallySelected = selectionMode === 'multiple' && Boolean(draftStart && draftEnd && date >= draftStart && date <= draftEnd && !draftExcluded.includes(date));
          const hasRange = selectionMode === 'range' && Boolean(draftStart && previewEnd && draftStart !== previewEnd);
          const classNames = [
            'calendar-day',
            (isEdge || isIndividuallySelected) && 'is-selected',
            isInRange && !isExcluded && 'is-in-range',
            isExcluded && 'is-excluded',
            hasRange && date === draftStart && 'is-range-start',
            hasRange && date === previewEnd && 'is-range-end',
          ].filter(Boolean).join(' ');
          return (
            <button
              type="button"
              className={classNames}
              key={date}
              disabled={date < minDate}
              aria-pressed={Boolean(isEdge || isIndividuallySelected || (isInRange && !isExcluded))}
              aria-label={`${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${isExcluded ? ' (skipped)' : ''}`}
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
          <span className="field-label">{selectionMode === 'multiple' ? 'First selected' : 'Start date'}</span>
          <strong>{shownStart ? formatFieldDate(shownStart) : 'Add date'}</strong>
        </span>
        <span className={`date-range-half${isChoosingEnd ? ' is-active' : ''}`}>
          <span className="field-label">{selectionMode === 'multiple' ? 'Last selected' : 'End date'}</span>
          <strong>{shownEnd ? formatFieldDate(shownEnd) : 'Add date'}</strong>
        </span>
      </button>

      {isOpen && (
        <div className="calendar-popover" role="dialog" aria-label="Choose event dates">
          <div className="calendar-mode-switch" role="group" aria-label="Date selection mode">
            <button type="button" aria-pressed={selectionMode === 'range'} onClick={() => changeMode('range')}>Date range</button>
            <button type="button" aria-pressed={selectionMode === 'multiple'} onClick={() => changeMode('multiple')}>Multiple dates</button>
          </div>
          <div className="calendar-header">
            <div>
              <strong>{selectedDays > 0 ? `${selectedDays} ${selectedDays === 1 ? 'day' : 'days'}` : 'Select dates'}</strong>
              <span>{selectionMode === 'multiple'
                ? 'Click dates to add or remove them. Clear dates to start fresh.'
                : isChoosingEnd ? 'Now choose the last day' : 'Click a day inside the range to skip or restore it'}</span>
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
                setDraftExcluded([]);
                onChange('', '', []);
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
