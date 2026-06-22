import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { customerApi } from '../../api/client';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<unknown[]>([]);
  const [bookings, setBookings] = useState<unknown[]>([]);

  useEffect(() => {
    Promise.all([customerApi.orders(), customerApi.bookings()])
      .then(([o, b]) => {
        setOrders(o.data);
        setBookings(b.data);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">My Account</h1>
      <p className="text-gray-500">Welcome, {user?.firstName}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-semibold">Recent Orders ({orders.length})</h2>
          <div className="mt-4 space-y-2">
            {orders.slice(0, 5).map((o) => {
              const order = o as { id: number; trackingId: string; status: string; total: string };
              return (
                <div key={order.id} className="rounded-lg border bg-white p-3 text-sm">
                  <span className="font-mono">{order.trackingId}</span> · {order.status} · PKR{' '}
                  {Number(order.total).toLocaleString()}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h2 className="font-semibold">Service Bookings ({bookings.length})</h2>
          <div className="mt-4 space-y-2">
            {bookings.slice(0, 5).map((b) => {
              const booking = b as { id: number; status: string; date: string };
              return (
                <div key={booking.id} className="rounded-lg border bg-white p-3 text-sm">
                  Booking #{booking.id} · {booking.status} · {booking.date?.slice(0, 10)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
