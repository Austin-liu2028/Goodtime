import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from 'react';
import {
  applySelection,
  getRectangleSlotKeys,
  getSlotKey,
  type SelectionMode,
  type SlotPosition,
} from '../utilities/availability';
import { formatDate } from '../utilities/date';
import { formatScheduleDay } from '../utilities/schedule';
import { formatTime, formatTimeRange, SLOT_LENGTH_MINUTES } from '../utilities/time';

const VISIBLE_DAYS = 7;
const MOBILE_VISIBLE_TIME_ROWS = 8;
const HEAT_LEVELS = 4;

// Share of people free, bucketed into 0 (nobody) .. HEAT_LEVELS (everyone) for the heatmap shade.
const getHeatLevel = (count: number, total: number) =>
  count === 0 || total === 0 ? 0 : Math.max(1, Math.ceil((count / total) * HEAT_LEVELS));

interface DragSelection {
  mode: SelectionMode;
  start: SlotPosition;
  slotsBeforeDrag: Set<string>;
}

interface AvailabilityGridProps {
  eventDates: string[];
  scheduleMode?: 'dates' | 'weekdays';
  timeSlots: number[];
  canonicalSlotsByDisplay?: Map<string, string[]>;
  selectedSlots: Set<string>;
  // Takes an updater so rapid toggles each apply to the latest selection.
  onSelectedSlotsChange: Dispatch<SetStateAction<Set<string>>>;
  // Submitted responses per slot; the current person's saved response is swapped for their live picks.
  namesBySlot: Map<string, string[]>;
  myResponseName: string | undefined;
  liveTotal: number;
  bestSlotKeys: Set<string>;
}

export const AvailabilityGrid = ({
  eventDates,
  scheduleMode,
  timeSlots,
  canonicalSlotsByDisplay,
  selectedSlots,
  onSelectedSlotsChange,
  namesBySlot,
  myResponseName,
  liveTotal,
  bestSlotKeys,
}: AvailabilityGridProps) => {
  const [pageStart, setPageStart] = useState(0);
  const [timePageStart, setTimePageStart] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 720);
  const lastPageStart = Math.max(0, eventDates.length - VISIBLE_DAYS);
  const visibleStart = Math.min(pageStart, lastPageStart);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  // Roving focus: only one grid cell is in the tab order; arrow keys move it.
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDragging = dragSelection !== null;
  const lastPointerType = useRef('');

  useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth <= 720);
    window.addEventListener('resize', updateMobile);
    return () => window.removeEventListener('resize', updateMobile);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const endDrag = () => setDragSelection(null);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [isDragging]);

  const dates = eventDates.slice(visibleStart, visibleStart + VISIBLE_DAYS);
  const visibleTimeStart = isMobile && timePageStart < timeSlots.length ? timePageStart : 0;
  const visibleTimeSlots = isMobile
    ? timeSlots.slice(visibleTimeStart, visibleTimeStart + MOBILE_VISIBLE_TIME_ROWS)
    : timeSlots;
  const visibleSlotKeys = visibleTimeSlots.map((minutes) => dates.map((date) => getSlotKey(date, minutes)));
  const isVisible = (slotKey: string) => {
    const [date, minutes] = slotKey.split('|');
    return dates.indexOf(date) !== -1 && visibleTimeSlots.indexOf(Number(minutes)) !== -1;
  };
  const sourceKeys = (displayKey: string) => canonicalSlotsByDisplay?.get(displayKey) ?? (canonicalSlotsByDisplay ? [] : [displayKey]);
  const isValidDisplayKey = (key: string) => sourceKeys(key).length > 0;
  const firstValidKey = visibleSlotKeys.flat().find(isValidDisplayKey);
  const tabbableSlotKey = activeSlotKey && isVisible(activeSlotKey) && isValidDisplayKey(activeSlotKey) ? activeSlotKey : firstValidKey;

  const getLiveNames = (slotKey: string) => Array.from(new Set(sourceKeys(slotKey).flatMap((sourceKey) => [
    ...(namesBySlot.get(sourceKey) ?? []).filter((name) => name !== myResponseName),
    ...(selectedSlots.has(sourceKey) ? ['you'] : []),
  ])));

  const rectangleSourceKeys = (start: SlotPosition, end: SlotPosition) =>
    getRectangleSlotKeys(dates, visibleTimeSlots, start, end).flatMap(sourceKeys);

  const toggleSlot = (slotKey: string) => {
    const keys = sourceKeys(slotKey);
    onSelectedSlotsChange((current) => applySelection(current, keys, keys.every((key) => current.has(key)) ? 'remove' : 'add'));
  };

  const startDrag = (event: PointerEvent<HTMLButtonElement>, position: SlotPosition) => {
    lastPointerType.current = event.pointerType;
    // On touchscreens, a swipe must scroll the page. A tap is handled by onClick below.
    if (event.pointerType === 'touch') return;
    if (event.button !== 0) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const mode = sourceKeys(getSlotKey(position.date, position.minutes)).every((key) => selectedSlots.has(key)) ? 'remove' : 'add';
    setDragSelection({ mode, start: position, slotsBeforeDrag: selectedSlots });
    onSelectedSlotsChange((current) => applySelection(current, rectangleSourceKeys(position, position), mode));
  };

  const extendDrag = (event: PointerEvent<HTMLButtonElement>, position: SlotPosition) => {
    if (!dragSelection) return;
    // The button was released outside the window, so no pointerup reached us.
    if (event.buttons === 0) {
      setDragSelection(null);
      return;
    }
    onSelectedSlotsChange(applySelection(
      dragSelection.slotsBeforeDrag,
      rectangleSourceKeys(dragSelection.start, position),
      dragSelection.mode,
    ));
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, row: number, column: number) => {
    const lastRow = visibleTimeSlots.length - 1;
    const lastColumn = dates.length - 1;
    const targets: Record<string, [number, number]> = {
      ArrowUp: [Math.max(0, row - 1), column],
      ArrowDown: [Math.min(lastRow, row + 1), column],
      ArrowLeft: [row, Math.max(0, column - 1)],
      ArrowRight: [row, Math.min(lastColumn, column + 1)],
      Home: event.ctrlKey ? [0, 0] : [row, 0],
      End: event.ctrlKey ? [lastRow, lastColumn] : [row, lastColumn],
      PageUp: [0, column],
      PageDown: [lastRow, column],
    };
    const target = targets[event.key];
    if (!target) return;
    event.preventDefault();
    let nextKey = visibleSlotKeys[target[0]][target[1]];
    if (!isValidDisplayKey(nextKey)) {
      nextKey = visibleSlotKeys.flat().find(isValidDisplayKey) ?? nextKey;
    }
    setActiveSlotKey(nextKey);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-slot-key="${nextKey}"]`)?.focus();
  };

  return (
    <>
      <div className="grid-toolbar">
        <p className="date-range" aria-live="polite">
          {dates.length > 0 && <>
            {scheduleMode === 'weekdays'
              ? 'Weekly availability'
              : <>{formatDate(dates[0], { month: 'long', day: 'numeric' })} – {formatDate(dates[dates.length - 1], { month: 'long', day: 'numeric', year: 'numeric' })}</>}
          </>}
        </p>
        {eventDates.length > VISIBLE_DAYS && (
          <div className="week-controls" role="group" aria-label="Navigate event dates">
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={visibleStart === 0}
              onClick={() => setPageStart(Math.max(0, visibleStart - VISIBLE_DAYS))}
              aria-label="Previous dates"
            >
              <span aria-hidden="true">←</span> Earlier
            </button>
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={visibleStart >= lastPageStart}
              onClick={() => setPageStart(Math.min(lastPageStart, visibleStart + VISIBLE_DAYS))}
              aria-label="Next dates"
            >
              Later <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>

      {isMobile && timeSlots.length > MOBILE_VISIBLE_TIME_ROWS && visibleTimeSlots.length > 0 && (
        <div className="mobile-time-pages" role="group" aria-label="Navigate event hours">
          <div className="mobile-time-page-copy" aria-live="polite">
            <span>Showing hours</span>
            <strong>{formatTimeRange(visibleTimeSlots[0], visibleTimeSlots[visibleTimeSlots.length - 1] + SLOT_LENGTH_MINUTES)}</strong>
          </div>
          <div className="mobile-time-page-actions">
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={visibleTimeStart === 0}
              onClick={() => setTimePageStart(Math.max(0, visibleTimeStart - MOBILE_VISIBLE_TIME_ROWS))}
              aria-label="Earlier hours"
              title="Earlier hours"
            >
              ↑
            </button>
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={visibleTimeStart + MOBILE_VISIBLE_TIME_ROWS >= timeSlots.length}
              onClick={() => setTimePageStart(visibleTimeStart + MOBILE_VISIBLE_TIME_ROWS)}
              aria-label="Later hours"
              title="Later hours"
            >
              ↓
            </button>
          </div>
        </div>
      )}

      {isMobile && <p className="field-hint mobile-grid-hint">Tap a square to select. Swipe to scroll the page or see more days.</p>}

      <div className="grid-scroll" role="region" aria-label="Availability grid" tabIndex={0}>
        <div
          className="availability-grid"
          data-days={dates.length}
          role="grid"
          aria-label="Availability by day and time. Use arrow keys to move and Space to select."
          ref={gridRef}
        >
          <div className="time-heading" role="columnheader"><span className="visually-hidden">Time</span></div>
          {dates.map((date) => (
            <div className="day-heading" role="columnheader" key={date}>
              <span>{scheduleMode === 'weekdays' ? formatScheduleDay({ scheduleMode }, date, true) : formatDate(date, { weekday: 'short' })}</span>
              {scheduleMode !== 'weekdays' && <strong>{formatDate(date, { day: 'numeric' })}</strong>}
            </div>
          ))}

          {visibleTimeSlots.map((minutes, row) => (
            <div className="time-row" role="row" key={minutes}>
              <div className="time-label" role="rowheader">{formatTime(minutes)}</div>
              {dates.map((date, column) => {
                const slotKey = getSlotKey(date, minutes);
                const source = sourceKeys(slotKey);
                const isDisabled = source.length === 0;
                const isSelected = source.length > 0 && source.every((key) => selectedSlots.has(key));
                const isRecommended = source.some((key) => bestSlotKeys.has(key));
                const liveNames = getLiveNames(slotKey);
                const count = liveNames.length;
                const whoIsFree = count > 0 ? `: ${liveNames.join(', ')}` : '';
                const readout = `${count} of ${liveTotal} available${whoIsFree}`;

                return (
                  <button
                    className={`time-slot${isSelected ? ' is-available' : ''}${isRecommended ? ' is-recommended' : ''}`}
                    type="button"
                    role="gridcell"
                    data-heat={getHeatLevel(count, liveTotal)}
                    data-slot-key={slotKey}
                    disabled={isDisabled}
                    tabIndex={slotKey === tabbableSlotKey ? 0 : -1}
                    aria-pressed={isSelected}
                    aria-label={`${scheduleMode === 'weekdays' ? `Every ${formatScheduleDay({ scheduleMode }, date)}` : formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${formatTime(minutes)}, ${readout}${isRecommended ? ', best meeting time' : ''}`}
                    title={liveTotal > 0 ? readout : undefined}
                    key={slotKey}
                    onFocus={() => setActiveSlotKey(slotKey)}
                    onKeyDown={(event) => moveFocus(event, row, column)}
                    onPointerDown={(event) => startDrag(event, { date, minutes })}
                    onPointerEnter={(event) => extendDrag(event, { date, minutes })}
                    onPointerCancel={() => { lastPointerType.current = ''; }}
                    onClick={(event) => {
                      // Mouse drags select on pointerdown; touch taps and keyboard clicks select here.
                      if (event.detail === 0 || lastPointerType.current === 'touch') toggleSlot(slotKey);
                      lastPointerType.current = '';
                    }}
                  >
                    {count > 0 && <span>{count}/{liveTotal}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="grid-legend">
        <span className="legend-item"><span className="legend-swatch available-swatch" /> Your pick</span>
        <span className="legend-item"><span className="legend-swatch recommended-swatch" /> Best time</span>
        <span className="legend-item heat-legend" aria-label="Darker green means more people are free">
          <span>Fewer free</span>
          {Array.from({ length: HEAT_LEVELS }, (_, index) => (
            <span className="legend-swatch heat-swatch" data-heat={index + 1} key={index} />
          ))}
          <span>Everyone</span>
        </span>
      </div>
    </>
  );
};
