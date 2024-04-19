import { useState, useRef, useCallback, useEffect } from 'react'
import { useDrop, useDrag, useDragDropManager } from 'react-dnd';
import classNames from 'classnames';
import { data, DataType } from './data';
import './App.css'

export default function App () {
  const [items, setItems] = useState(data);
  const [scrollDir, setScrollDir] = useState(0);
  const scrollSpeedRef = useRef(1);
  const scrollEl = useRef<HTMLDivElement>(null);
  const monitor = useDragDropManager().getMonitor();

  const getIsTop = () => scrollEl.current!.scrollTop === 0;
  const getIsBottom = () => {
    const BROWSER_ZOOM_TRESHOLD = 1; // dimensions can be off by ~1px due browser's zoom
    return scrollEl.current && scrollEl.current.clientHeight + scrollEl.current.scrollTop >= scrollEl.current.scrollHeight - BROWSER_ZOOM_TRESHOLD;
  }

  useInterval(() => {
    if (scrollDir === 0 || scrollDir < 0 && getIsTop() || scrollDir > 0 && getIsBottom()) {
      setScrollDir(0);
      return;
    }

    const SCROLL_SPEED = 10;
    scrollEl.current?.scrollBy(0, SCROLL_SPEED * scrollDir * Math.abs(scrollSpeedRef.current));
  }, 16, scrollDir !== 0);

  useEffect(() => {
    const TRESHOLD = 120; // vertical distance from the edge
    const ELEMENT_HEIGHT = 42; // could be dynalically calculated

    return monitor.subscribeToOffsetChange(() => {
      const offset = monitor.getSourceClientOffset()?.y;
      const rect = scrollEl.current?.getBoundingClientRect(); // should be cached 
      if (!offset || !rect) {
        setScrollDir(0);
        return;
      }

      let direction = 0;
      scrollSpeedRef.current = 1;
      if (offset > rect.bottom - (TRESHOLD + ELEMENT_HEIGHT)) {
        scrollSpeedRef.current = (offset - (rect.bottom - (TRESHOLD + ELEMENT_HEIGHT))) / TRESHOLD;
        direction = 1;
      } else if (offset < rect.top + TRESHOLD) {
        scrollSpeedRef.current = (offset - (rect.top + TRESHOLD)) / TRESHOLD;
        direction = -1;
      }

      setScrollDir(direction);
    });
  }, [monitor]);

  // TODO: find a way to fix memoisation
  const onChangePosition = useCallback((from: number, to: number, hoveredItem: DragItem) => {
    if (scrollDir !== 0) return true;

    // is it a must to have a function here?
    setItems(prev => move(prev, from, to)); 
    hoveredItem.index = to;
  }, [setItems, scrollDir]);

  return (
    <>
      <h3>List of cats</h3>
      <div ref={scrollEl} className="list">
        {items.map((item, index) => (
          <Item
            key={item.id}
            data={item}
            index={index}
            onChangePosition={onChangePosition}
          />
        ))}
      </div>
    </>
  )
}

interface DragItem {
  index: number;
}
interface DragCollectedProps {
  isDragging: boolean;
}
interface DropCollectedProps {
  handlerId: string | symbol | null;
}

interface ItemProps {
  data: DataType;
  index: number;
  onChangePosition: (from: number, to: number, hoverItem: DragItem) => void;
}

function Item (props: ItemProps) {
  const { data, index, onChangePosition } = props;
  const ref = useRef<HTMLDivElement>(null);

  const [dropProps, drop] = useDrop<DragItem, unknown, DropCollectedProps>({
    accept: 'my-item-type',
    collect: (monitor) => ({
      handlerId: monitor.getHandlerId(),
    }),
    hover: (hoverItem, monitor) => {
      if (!ref.current) {
        return;
      }
      const dragPosition = hoverItem.index || 0;
      const hoverPosition = index || 0;

      if (dragPosition === hoverPosition) {
        return;
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect(); // yup it should be cached as well
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        return;
      }

      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      if (dragPosition < hoverPosition && hoverClientY < hoverMiddleY) {
        return;
      }
      if (dragPosition > hoverPosition && hoverClientY > hoverMiddleY) {
        return;
      }
      
      onChangePosition(dragPosition, hoverPosition, hoverItem);
    }
  });

  const [{ isDragging }, drag] = useDrag<DragItem, unknown, DragCollectedProps>({
    type: 'my-item-type',
    // !!!
    item: () => ({
      index,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    })
  });

  drag(drop(ref));

  const className = classNames('item', { 'dragging': isDragging })

  return (
    <div
      ref={ref}
      className={className}
      data-handler-id={dropProps.handlerId}
    >
      <div className="item-id">{"{ "}id: {data.id}{" }"}</div>
      <div className="name">{data.name}</div>
    </div>
  );
}

// Inspired by Formik https://github.com/jaredpalmer/formik/blob/main/packages/formik/src/FieldArray.tsx
function move (arr: DataType[], from: number, to: number) {
  const newArr = [...arr];
  newArr.splice(to, 0, newArr.splice(from, 1)[0]);
  return newArr;
}

// Inspired by @restart/hooks https://github.com/react-restart/hooks/blob/master/src/useInterval.ts
function useInterval(callback: () => void, delay: number, condition: boolean) {
  const savedCallback = useRef(Function.prototype);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!condition) {
      return;
    }

    function tick() {
      savedCallback.current();
    }

    const id = setInterval(tick, delay);
    return () => {
      clearInterval(id);
    };
  }, [delay, condition]);
}
