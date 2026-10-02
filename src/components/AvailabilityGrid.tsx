import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from 'react';
import {
  applySelection,
  getRectangleSlotKeys,
  getSlotKey,
  type SelectionMode,
  type SlotPosition,
} from '../utilities/availability';
import { addDays, formatDate } from '../utilities/date';
import { formatTime } from '../utilities/time';

const VISIBLE_DAYS = 7;
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
  timeSlots: number[];
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
  timeSlots,
  selectedSlots,
  onSelectedSlotsChange,
  namesBySlot,
  myResponseName,
  liveTotal,
  bestSlotKeys,
}: AvailabilityGridProps) => {
  const firstDate = eventDates[0];
  const lastVisibleStart = eventDates[Math.max(0, eventDates.length - VISIBLE_DAYS)];
  const [visibleStart, setVisibleStart] = useState(firstDate);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  // Roving focus: only one grid cell is in the tab order; arrow keys move it.
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDragging = dragSelection !== null;

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

  const dates = eventDates.filter((date) => date >= visibleStart).slice(0, VISIBLE_DAYS);
  const visibleSlotKeys = timeSlots.map((minutes) => dates.map((date) => getSlotKey(date, minutes)));
  const isVisible = (slotKey: string) => {
    const [date, minutes] = slotKey.split('|');
    return dates.indexOf(date) !== -1 && timeSlots.indexOf(Number(minutes)) !== -1;
  };
  const tabbableSlotKey = activeSlotKey && isVisible(activeSlotKey) ? activeSlotKey : visibleSlotKeys[0]?.[0];

  const getLiveNames = (slotKey: string) => [
    ...(namesBySlot.get(slotKey) ?? []).filter((name) => name !== myResponseName),
    ...(selectedSlots.has(slotKey) ? ['you'] : []),
  ];

  const toggleSlot = (slotKey: string) => {
    onSelectedSlotsChange((current) => applySelection(current, [slotKey], current.has(slotKey) ? 'remove' : 'add'));
  };

  const startDrag = (event: PointerEvent<HTMLButtonElement>, position: SlotPosition) => {
    if (event.button !== 0) return;
    // Touch pointers are captured by the first cell; release so pointerenter fires on the cells we pass over.
    event.currentTarget.releasePointerCapture(event.pointerId);
    const mode = selectedSlots.has(getSlotKey(position.date, position.minutes)) ? 'remove' : 'add';
    setDragSelection({ mode, start: position, slotsBeforeDrag: selectedSlots });
    onSelectedSlotsChange((current) => applySelection(current, getRectangleSlotKeys(dates, timeSlots, position, position), mode));
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
      getRectangleSlotKeys(dates, timeSlots, dragSelection.start, position),
      dragSelection.mode,
    ));
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, row: number, column: number) => {
    const lastRow = timeSlots.length - 1;
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
    const nextKey = visibleSlotKeys[target[0]][target[1]];
    setActiveSlotKey(nextKey);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-slot-key="${nextKey}"]`)?.focus();
  };

  return (
    <>
      <div className="schedule-header">
        <div>
          <div className="eyebrow schedule-eyebrow">YOUR AVAILABILITY</div>
          <h2 id="availability-heading">Choose your times</h2>
        </div>
        <div className="week-controls" aria-label="Navigate event dates">
          <button
            type="button"
            className="week-button"
            disabled={visibleStart <= firstDate}
            onClick={() => {
              const previous = addDays(visibleStart, -VISIBLE_DAYS);
              setVisibleStart(previous < firstDate ? firstDate : previous);
            }}
            aria-label="Previous dates"
          >
            <span aria-hidden="true">←</span> Previous
          </button>
          <button
            type="button"
            className="week-button"
            disabled={visibleStart >= lastVisibleStart}
            onClick={() => {
              const next = addDays(visibleStart, VISIBLE_DAYS);
              setVisibleStart(next > lastVisibleStart ? lastVisibleStart : next);
            }}
            aria-label="Next dates"
          >
            Next <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="date-range" aria-live="polite">
        {dates.length > 0 && <>
          {formatDate(dates[0], { month: 'long', day: 'numeric' })} – {formatDate(dates[dates.length - 1], { month: 'long', day: 'numeric', year: 'numeric' })}
        </>}
      </div>

      <div className="grid-scroll" role="region" aria-label="Weekly availability grid" tabIndex={0}>
        <div
          className="availability-grid"
          data-days={dates.length}
          role="grid"
          aria-label="Availability by day and time. Use arrow keys to move and Space to select."
          ref={gridRef}
        >
          <div className="time-heading" role="columnheader">TIME</div>
          {dates.map((date) => (
            <div className="day-heading" role="columnheader" key={date}>
              <span>{formatDate(date, { weekday: 'short' }).toUpperCase()}</span>
              <strong>{formatDate(date, { day: 'numeric' })}</strong>
            </div>
          ))}

          {timeSlots.map((minutes, row) => (
            <div className="time-row" role="row" key={minutes}>
              <div className="time-label" role="rowheader">{formatTime(minutes)}</div>
              {dates.map((date, column) => {
                const slotKey = getSlotKey(date, minutes);
                const isSelected = selectedSlots.has(slotKey);
                const isRecommended = bestSlotKeys.has(slotKey);
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
                    tabIndex={slotKey === tabbableSlotKey ? 0 : -1}
                    aria-pressed={isSelected}
                    aria-label={`${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${formatTime(minutes)}, ${readout}${isRecommended ? ', best meeting time' : ''}`}
                    title={liveTotal > 0 ? readout : undefined}
                    key={slotKey}
                    onFocus={() => setActiveSlotKey(slotKey)}
                    onKeyDown={(event) => moveFocus(event, row, column)}
                    onPointerDown={(event) => startDrag(event, { date, minutes })}
                    onPointerEnter={(event) => extendDrag(event, { date, minutes })}
                    onClick={(event) => {
                      // Pointer clicks are handled by the drag; detail 0 means Enter/Space from the keyboard.
                      if (event.detail === 0) toggleSlot(slotKey);
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
        <span className="legend-caption">Tap, drag, or use arrow keys and Space to pick times</span>
      </div>
    </>
  );
};
