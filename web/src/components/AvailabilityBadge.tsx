import type { Availability } from '../lib/availability.ts'
import { availabilityLabel } from '../lib/availability.ts'

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const tone =
    availability.kind === 'sold_out'
      ? 'badge-soldout'
      : availability.kind === 'made_to_order'
        ? 'badge-order'
        : availability.remaining !== null
          ? 'badge-low'
          : 'badge-stock'
  return <span className={`badge ${tone}`}>{availabilityLabel(availability)}</span>
}
