// Post-payment fulfillment stages, in order. 'dispatched' is labelled by the
// delivery method ("Shipped" when delivering, "Ready for pickup" otherwise).
export const ORDER_STAGES = ['preparing', 'printing', 'dispatched', 'completed'];

export function stageLabel(stage, deliveryMethod) {
  switch (stage) {
    case 'preparing':
      return 'Preparing';
    case 'printing':
      return 'Printing';
    case 'dispatched':
      return deliveryMethod === 'delivery' ? 'Shipped' : 'Ready for pickup';
    case 'completed':
      return 'Completed';
    default:
      return stage || 'Preparing';
  }
}
