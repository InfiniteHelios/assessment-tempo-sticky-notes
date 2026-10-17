import { forwardRef } from 'react';
import styles from './TrashZone.module.css';

type TrashZoneProps = {
  armed: boolean;
  right: number;
  bottom: number;
};

export const TrashZone = forwardRef<HTMLDivElement, TrashZoneProps>(function TrashZone(
  { armed, right, bottom },
  ref,
) {
  return (
    <div
      ref={ref}
      className={armed ? `${styles.trash} ${styles.armed}` : styles.trash}
      style={{ right, bottom }}
      role="region"
      aria-label="Trash zone. Release a note here to delete it."
      data-armed={armed ? 'true' : 'false'}
    >
      Trash
    </div>
  );
});
