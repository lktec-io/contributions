import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { usePaymentRequestAlerts } from '../../hooks/usePaymentRequestAlerts';
import PaymentRequestAlertPopup from './PaymentRequestAlertPopup';

// Mounted once at the App root (sibling of <AppRoutes/>, inside <BrowserRouter/>)
// so a new payment-request alert surfaces on every authenticated page —
// including PaymentRequests/HiddenRecords, which don't mount Header/NotificationBell.
export default function PaymentRequestAlertHost() {
  const { user } = useContext(AuthContext);
  const { current, dismiss } = usePaymentRequestAlerts(!!user);

  return <PaymentRequestAlertPopup notification={current} onDismiss={dismiss} />;
}
